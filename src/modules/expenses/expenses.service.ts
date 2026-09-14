import { PrismaClient, Prisma, ExpenseStatus, ExpensePaymentMode } from '@prisma/client';
import {
  CreateExpenseInput,
  UpdateExpenseInput,
  ExpenseFilterQuery,
  DailyReconciliationInput,
  FloatTopUpInput,
  amountToPaise,
} from './expenses.schema';
import { AppError } from '../../middleware/error.middleware';
import prisma from '../../config/database';
import {
  buildDayWiseWorkbook,
  buildWeekWiseWorkbook,
  buildMonthWiseWorkbook,
  buildYearWiseWorkbook,
  paiseToRupees,
} from './expenses-export.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse YYYY-MM-DD into a UTC Date object representing date only */
function parseDateOnly(dateStr?: string): Date {
  if (!dateStr) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
  }
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** Get formatted current time HH:mm:ss */
function getCurrentTimeString(): string {
  const now = new Date();
  return now.toTimeString().split(' ')[0]; // e.g. "14:35:10"
}

/** Atomic Sequence Generator EXP-YYYY-MM-XXXX */
async function generateEntryNumber(tx: Prisma.TransactionClient, date: Date): Promise<string> {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const prefix = `EXP-${yyyy}-${mm}`;

  const seq = await tx.expenseSequence.upsert({
    where: { prefix },
    update: { lastNumber: { increment: 1 } },
    create: { prefix, lastNumber: 1 },
  });

  const padded = String(seq.lastNumber).padStart(4, '0');
  return `${prefix}-${padded}`;
}

/** Get effective settings for a branch */
async function getEffectiveSettings(branchId?: string, tx?: Prisma.TransactionClient) {
  const db = tx || prisma;
  if (branchId) {
    const branchSettings = await db.expenseSettings.findUnique({
      where: { branchId },
    });
    if (branchSettings) return branchSettings;
  }
  const globalSettings = await db.expenseSettings.findFirst({
    where: { branchId: null },
  });
  if (globalSettings) return globalSettings;

  return {
    autoApprovalThreshold: 200000, // ₹2,000 in paise
    requireReceiptAbove: null,
    alertNegativeBalance: true,
    fiscalYearStartMonth: 4,
  };
}

export class ExpensesService {
  // ─── 1. Create Single Expense (Atomic with Rollups) ───────────────────────────
  static async createExpense(input: CreateExpenseInput, userId: string) {
    // Check if clientTempId already exists (idempotent offline sync)
    if (input.clientTempId) {
      const existing = await prisma.expenseEntry.findUnique({
        where: { clientTempId: input.clientTempId },
        include: { category: true, branch: true, addedBy: true },
      });
      if (existing) {
        return { expense: existing, isDuplicate: true };
      }
    }

    const date = parseDateOnly(input.date);
    const time = input.time || getCurrentTimeString();
    const amount = amountToPaise(input.amount, input.amountInPaise);

    // Verify category and branch exist
    const [category, branch] = await Promise.all([
      prisma.expenseCategory.findUnique({ where: { id: input.categoryId } }),
      prisma.branch.findUnique({ where: { id: input.branchId } }),
    ]);

    if (!category || category.isDeleted) {
      throw new AppError('VALIDATION_ERROR', 'Invalid or deleted expense category', 400);
    }
    if (!branch) {
      throw new AppError('NOT_FOUND', 'Branch not found', 404);
    }

    const settings = await getEffectiveSettings(input.branchId);

    // Auto-approval decision: amount <= threshold auto-approves
    const isAutoApproved = amount <= settings.autoApprovalThreshold;
    const status: ExpenseStatus = isAutoApproved ? 'APPROVED' : 'PENDING';

    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    const result = await prisma.$transaction(async (tx) => {
      const entryNumber = await generateEntryNumber(tx, date);

      const expense = await tx.expenseEntry.create({
        data: {
          entryNumber,
          date,
          time,
          amount,
          categoryId: input.categoryId,
          subCategory: input.subCategory || null,
          paymentMode: input.paymentMode as ExpensePaymentMode,
          description: input.description,
          paidTo: input.paidTo,
          receiptAttachment: input.receiptAttachment || null,
          branchId: input.branchId,
          departmentId: input.departmentId || null,
          employeeId: input.employeeId || null,
          addedById: userId,
          status,
          approvedById: isAutoApproved ? userId : null,
          approvedAt: isAutoApproved ? new Date() : null,
          clientTempId: input.clientTempId || null,
        },
        include: {
          category: true,
          branch: true,
          addedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      // If approved, mutate live running balance, daily ledger, and rollups atomically
      if (isAutoApproved) {
        // 1. Live balance decrement
        await tx.branchCashBalance.upsert({
          where: { branchId: input.branchId },
          update: {
            currentBalance: { decrement: amount },
            lastEntryAt: new Date(),
          },
          create: {
            branchId: input.branchId,
            currentBalance: -amount,
            lastEntryAt: new Date(),
          },
        });

        // 2. Daily Ledger update
        await tx.expenseDailyLedger.upsert({
          where: {
            branchId_date: {
              branchId: input.branchId,
              date,
            },
          },
          update: {
            totalExpenses: { increment: amount },
            closingBalance: { decrement: amount },
          },
          create: {
            branchId: input.branchId,
            date,
            openingBalance: 0,
            cashReceived: 0,
            totalExpenses: amount,
            closingBalance: -amount,
          },
        });

        // 3. Pre-aggregated Daily Rollup
        await tx.expenseDailyRollup.upsert({
          where: {
            branchId_date_categoryId: {
              branchId: input.branchId,
              date,
              categoryId: input.categoryId,
            },
          },
          update: {
            totalAmount: { increment: amount },
            entryCount: { increment: 1 },
          },
          create: {
            branchId: input.branchId,
            date,
            categoryId: input.categoryId,
            totalAmount: amount,
            entryCount: 1,
          },
        });

        // 4. Pre-aggregated Monthly Rollup
        await tx.expenseMonthlyRollup.upsert({
          where: {
            branchId_year_month_categoryId: {
              branchId: input.branchId,
              year,
              month,
              categoryId: input.categoryId,
            },
          },
          update: {
            totalAmount: { increment: amount },
            entryCount: { increment: 1 },
          },
          create: {
            branchId: input.branchId,
            year,
            month,
            categoryId: input.categoryId,
            totalAmount: amount,
            entryCount: 1,
          },
        });
      }

      // 5. Immutable Audit Log
      await tx.expenseAuditLog.create({
        data: {
          expenseId: expense.id,
          action: 'CREATE',
          performedById: userId,
          changes: {
            entryNumber,
            amount,
            status,
            isAutoApproved,
            paymentMode: input.paymentMode,
            category: category.name,
          },
        },
      });

      return expense;
    });

    // Budget check
    let budgetWarning: string | null = null;
    if (category.monthlyBudgetLimit && category.monthlyBudgetLimit > 0) {
      const monthSpend = await prisma.expenseMonthlyRollup.findUnique({
        where: {
          branchId_year_month_categoryId: {
            branchId: input.branchId,
            year,
            month,
            categoryId: input.categoryId,
          },
        },
      });
      const currentTotal = monthSpend?.totalAmount || amount;
      if (currentTotal > category.monthlyBudgetLimit) {
        budgetWarning = `Category "${category.name}" exceeded its monthly budget of ₹${(
          category.monthlyBudgetLimit / 100
        ).toLocaleString('en-IN')} by ₹${((currentTotal - category.monthlyBudgetLimit) / 100).toLocaleString('en-IN')}`;
      }
    }

    return { expense: result, isDuplicate: false, budgetWarning };
  }

  // ─── 2. Batch Offline Sync (Deduplicated & High Performance) ────────────────
  static async batchSync(entries: CreateExpenseInput[], userId: string) {
    const synced: any[] = [];
    const duplicates: string[] = [];
    const errors: { tempId?: string; error: string }[] = [];

    for (const item of entries) {
      try {
        const res = await this.createExpense(item, userId);
        if (res.isDuplicate) {
          duplicates.push(item.clientTempId || res.expense.id);
        } else {
          synced.push(res.expense);
        }
      } catch (err: any) {
        errors.push({ tempId: item.clientTempId || undefined, error: err.message || 'Failed' });
      }
    }

    return {
      syncedCount: synced.length,
      duplicateCount: duplicates.length,
      errorCount: errors.length,
      synced,
      duplicates,
      errors,
    };
  }

  // ─── 3. Paginated Expense List (Cursor-Based) ─────────────────────────────────
  static async getExpenses(query: ExpenseFilterQuery) {
    const {
      cursor,
      limit = 20,
      branchId,
      categoryId,
      status,
      paymentMode,
      startDate,
      endDate,
      date,
      minAmount,
      maxAmount,
      addedById,
      employeeId,
      search,
      isVoid = false,
      sortBy = 'date',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.ExpenseEntryWhereInput = {
      isVoid,
    };

    if (branchId) where.branchId = branchId;
    if (categoryId) where.categoryId = categoryId;
    if (addedById) where.addedById = addedById;
    if (employeeId) where.employeeId = employeeId;

    if (status && status !== 'ALL') {
      where.status = status as ExpenseStatus;
    }
    if (paymentMode && paymentMode !== 'ALL') {
      where.paymentMode = paymentMode as ExpensePaymentMode;
    }

    if (date) {
      where.date = parseDateOnly(date);
    } else if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = parseDateOnly(startDate);
      if (endDate) where.date.lte = parseDateOnly(endDate);
    }

    if (minAmount != null || maxAmount != null) {
      where.amount = {};
      if (minAmount != null) where.amount.gte = Math.round(minAmount * 100);
      if (maxAmount != null) where.amount.lte = Math.round(maxAmount * 100);
    }

    if (search) {
      where.OR = [
        { entryNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { paidTo: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.ExpenseEntryOrderByWithRelationInput[] = [];
    if (sortBy === 'amount') {
      orderBy.push({ amount: sortOrder });
    } else if (sortBy === 'createdAt') {
      orderBy.push({ createdAt: sortOrder });
    } else {
      orderBy.push({ date: sortOrder });
      orderBy.push({ createdAt: sortOrder });
    }
    orderBy.push({ id: 'desc' });

    const take = limit + 1;
    const findArgs: Prisma.ExpenseEntryFindManyArgs = {
      where,
      take,
      orderBy,
      include: {
        category: true,
        branch: { select: { id: true, name: true, code: true } },
        addedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        employee: { select: { id: true, employeeId: true, name: true, designation: true } },
      },
    };

    if (cursor) {
      findArgs.cursor = { id: cursor };
      findArgs.skip = 1;
    }

    const [entries, totalCount] = await Promise.all([
      prisma.expenseEntry.findMany(findArgs),
      prisma.expenseEntry.count({ where }),
    ]);

    let nextCursor: string | null = null;
    let hasMore = false;
    if (entries.length > limit) {
      hasMore = true;
      entries.pop();
      nextCursor = entries[entries.length - 1].id;
    }

    return {
      entries,
      nextCursor,
      hasMore,
      totalCount,
    };
  }

  // ─── 4. Live Running Balance & Today's Metric Snapshot (O(1)) ─────────────────
  static async getLiveBalance(branchId: string) {
    const today = parseDateOnly();

    const [balanceRecord, todayLedger, pendingApprovalsCount] = await Promise.all([
      prisma.branchCashBalance.findUnique({ where: { branchId } }),
      prisma.expenseDailyLedger.findUnique({
        where: { branchId_date: { branchId, date: today } },
      }),
      prisma.expenseEntry.count({
        where: { branchId, status: 'PENDING', isVoid: false },
      }),
    ]);

    const openingBalance = todayLedger?.openingBalance || 0;
    const cashReceived = todayLedger?.cashReceived || 0;
    const totalExpenses = todayLedger?.totalExpenses || 0;
    const systemClosing = todayLedger?.closingBalance || openingBalance + cashReceived - totalExpenses;
    const currentBalance = balanceRecord?.currentBalance ?? systemClosing;

    return {
      branchId,
      currentBalance,
      currentBalanceRupees: paiseToRupees(currentBalance),
      todayOpening: openingBalance,
      todayReceived: cashReceived,
      todayExpenses: totalExpenses,
      todayClosing: systemClosing,
      physicalCashCounted: todayLedger?.physicalCashCounted ?? null,
      variance: todayLedger?.variance ?? null,
      isReconciled: todayLedger?.isReconciled || false,
      reconciledAt: todayLedger?.reconciledAt || null,
      pendingApprovalsCount,
      lastEntryAt: balanceRecord?.lastEntryAt || null,
    };
  }

  // ─── 5. Multi-Branch Summary (Super Admin Batched Rollup) ─────────────────────
  static async getMultiBranchSummary() {
    const branches = await prisma.branch.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, name: true, code: true },
    });

    const summaries = await Promise.all(
      branches.map(async (b) => {
        const live = await this.getLiveBalance(b.id);
        return {
          branch: b,
          ...live,
        };
      })
    );

    const consolidated = summaries.reduce(
      (acc, curr) => {
        acc.totalCashInHand += curr.currentBalance;
        acc.todayTotalExpenses += curr.todayExpenses;
        acc.todayTotalReceived += curr.todayReceived;
        acc.totalPendingApprovals += curr.pendingApprovalsCount;
        return acc;
      },
      {
        totalCashInHand: 0,
        todayTotalExpenses: 0,
        todayTotalReceived: 0,
        totalPendingApprovals: 0,
      }
    );

    return {
      branches: summaries,
      consolidated: {
        ...consolidated,
        totalCashInHandRupees: paiseToRupees(consolidated.totalCashInHand),
        todayTotalExpensesRupees: paiseToRupees(consolidated.todayTotalExpenses),
      },
    };
  }

  // ─── 6. Approve Expense ──────────────────────────────────────────────────────
  static async approveExpense(id: string, userId: string, notes?: string) {
    const expense = await prisma.expenseEntry.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!expense) throw new AppError('NOT_FOUND', 'Expense entry not found', 404);
    if (expense.status === 'APPROVED') throw new AppError('BAD_REQUEST', 'Expense is already approved', 400);
    if (expense.isVoid) throw new AppError('BAD_REQUEST', 'Cannot approve a voided expense', 400);

    const amount = expense.amount;
    const date = expense.date;
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    const updated = await prisma.$transaction(async (tx) => {
      const appRecord = await tx.expenseEntry.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById: userId,
          approvedAt: new Date(),
          rejectionReason: null,
        },
        include: {
          category: true,
          branch: true,
          addedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      // Mutate live balance, ledger, rollups
      await tx.branchCashBalance.upsert({
        where: { branchId: expense.branchId },
        update: { currentBalance: { decrement: amount }, lastEntryAt: new Date() },
        create: { branchId: expense.branchId, currentBalance: -amount, lastEntryAt: new Date() },
      });

      await tx.expenseDailyLedger.upsert({
        where: { branchId_date: { branchId: expense.branchId, date } },
        update: { totalExpenses: { increment: amount }, closingBalance: { decrement: amount } },
        create: { branchId: expense.branchId, date, totalExpenses: amount, closingBalance: -amount },
      });

      await tx.expenseDailyRollup.upsert({
        where: {
          branchId_date_categoryId: {
            branchId: expense.branchId,
            date,
            categoryId: expense.categoryId,
          },
        },
        update: { totalAmount: { increment: amount }, entryCount: { increment: 1 } },
        create: {
          branchId: expense.branchId,
          date,
          categoryId: expense.categoryId,
          totalAmount: amount,
          entryCount: 1,
        },
      });

      await tx.expenseMonthlyRollup.upsert({
        where: {
          branchId_year_month_categoryId: {
            branchId: expense.branchId,
            year,
            month,
            categoryId: expense.categoryId,
          },
        },
        update: { totalAmount: { increment: amount }, entryCount: { increment: 1 } },
        create: {
          branchId: expense.branchId,
          year,
          month,
          categoryId: expense.categoryId,
          totalAmount: amount,
          entryCount: 1,
        },
      });

      await tx.expenseAuditLog.create({
        data: {
          expenseId: id,
          action: 'APPROVE',
          performedById: userId,
          reason: notes || null,
          changes: { previousStatus: expense.status, newStatus: 'APPROVED', amount },
        },
      });

      return appRecord;
    });

    return updated;
  }

  // ─── 7. Reject Expense ───────────────────────────────────────────────────────
  static async rejectExpense(id: string, reason: string, userId: string) {
    const expense = await prisma.expenseEntry.findUnique({ where: { id } });
    if (!expense) throw new AppError('NOT_FOUND', 'Expense entry not found', 404);
    if (expense.isVoid) throw new AppError('BAD_REQUEST', 'Cannot reject a voided entry', 400);

    const updated = await prisma.$transaction(async (tx) => {
      const rec = await tx.expenseEntry.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: reason,
        },
      });

      await tx.expenseAuditLog.create({
        data: {
          expenseId: id,
          action: 'REJECT',
          performedById: userId,
          reason,
          changes: { previousStatus: expense.status, newStatus: 'REJECTED' },
        },
      });

      return rec;
    });

    return updated;
  }

  // ─── 8. Void Expense (Audit & Reversal) ───────────────────────────────────────
  static async voidExpense(id: string, reason: string, userId: string) {
    const expense = await prisma.expenseEntry.findUnique({ where: { id } });
    if (!expense) throw new AppError('NOT_FOUND', 'Expense entry not found', 404);
    if (expense.isVoid) throw new AppError('BAD_REQUEST', 'Expense is already voided', 400);

    const wasApproved = expense.status === 'APPROVED';
    const amount = expense.amount;
    const date = expense.date;
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    const voided = await prisma.$transaction(async (tx) => {
      const rec = await tx.expenseEntry.update({
        where: { id },
        data: {
          isVoid: true,
          voidReason: reason,
          voidedById: userId,
          voidedAt: new Date(),
        },
        include: { category: true, branch: true },
      });

      // If it was approved, reverse all financial movements!
      if (wasApproved) {
        await tx.branchCashBalance.update({
          where: { branchId: expense.branchId },
          data: { currentBalance: { increment: amount } },
        });

        await tx.expenseDailyLedger.update({
          where: { branchId_date: { branchId: expense.branchId, date } },
          data: {
            totalExpenses: { decrement: amount },
            closingBalance: { increment: amount },
          },
        });

        await tx.expenseDailyRollup.update({
          where: {
            branchId_date_categoryId: {
              branchId: expense.branchId,
              date,
              categoryId: expense.categoryId,
            },
          },
          data: {
            totalAmount: { decrement: amount },
            entryCount: { decrement: 1 },
          },
        });

        await tx.expenseMonthlyRollup.update({
          where: {
            branchId_year_month_categoryId: {
              branchId: expense.branchId,
              year,
              month,
              categoryId: expense.categoryId,
            },
          },
          data: {
            totalAmount: { decrement: amount },
            entryCount: { decrement: 1 },
          },
        });
      }

      await tx.expenseAuditLog.create({
        data: {
          expenseId: id,
          action: 'VOID',
          performedById: userId,
          reason,
          changes: { wasApproved, amount, reversed: wasApproved },
        },
      });

      return rec;
    });

    return voided;
  }

  // ─── 9. Daily Closing & Reconciliation ───────────────────────────────────────
  static async reconcileDaily(input: DailyReconciliationInput, userId: string) {
    const date = parseDateOnly(input.date);
    const physicalCount = amountToPaise(input.physicalCashCounted, input.physicalCashInPaise);

    const reconciled = await prisma.$transaction(async (tx) => {
      // Find or create the daily ledger
      let ledger = await tx.expenseDailyLedger.findUnique({
        where: { branchId_date: { branchId: input.branchId, date } },
      });

      if (!ledger) {
        ledger = await tx.expenseDailyLedger.create({
          data: {
            branchId: input.branchId,
            date,
            openingBalance: 0,
            cashReceived: 0,
            totalExpenses: 0,
            closingBalance: 0,
          },
        });
      }

      const variance = ledger.closingBalance - physicalCount;

      const updated = await tx.expenseDailyLedger.update({
        where: { id: ledger.id },
        data: {
          physicalCashCounted: physicalCount,
          variance,
          isReconciled: true,
          reconciledById: userId,
          reconciledAt: new Date(),
          reconciliationNotes: input.reconciliationNotes || null,
        },
        include: {
          reconciledBy: { select: { id: true, firstName: true, lastName: true } },
          branch: true,
        },
      });

      // Update branch cash balance lastReconciledAt
      await tx.branchCashBalance.upsert({
        where: { branchId: input.branchId },
        update: { lastReconciledAt: new Date() },
        create: {
          branchId: input.branchId,
          currentBalance: ledger.closingBalance,
          lastReconciledAt: new Date(),
        },
      });

      await tx.expenseAuditLog.create({
        data: {
          action: 'RECONCILE',
          performedById: userId,
          reason: input.reconciliationNotes || null,
          changes: {
            branchId: input.branchId,
            date: input.date,
            closingBalance: ledger.closingBalance,
            physicalCount,
            variance,
          },
        },
      });

      return updated;
    });

    return reconciled;
  }

  // ─── 10. Mid-Day Float Top-Up / Cash Addition ────────────────────────────────
  static async addFloatTopUp(input: FloatTopUpInput, userId: string) {
    const date = parseDateOnly(input.date);
    const amount = amountToPaise(input.amount, input.amountInPaise);

    const topUp = await prisma.$transaction(async (tx) => {
      const rec = await tx.expenseFloatTopUp.create({
        data: {
          branchId: input.branchId,
          date,
          amount,
          source: input.source,
          referenceNo: input.referenceNo || null,
          notes: input.notes || null,
          addedById: userId,
        },
        include: {
          branch: true,
          addedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // Increment live cash in hand
      await tx.branchCashBalance.upsert({
        where: { branchId: input.branchId },
        update: { currentBalance: { increment: amount }, lastEntryAt: new Date() },
        create: { branchId: input.branchId, currentBalance: amount, lastEntryAt: new Date() },
      });

      // Increment daily ledger cashReceived and closingBalance
      await tx.expenseDailyLedger.upsert({
        where: { branchId_date: { branchId: input.branchId, date } },
        update: {
          cashReceived: { increment: amount },
          closingBalance: { increment: amount },
        },
        create: {
          branchId: input.branchId,
          date,
          openingBalance: 0,
          cashReceived: amount,
          totalExpenses: 0,
          closingBalance: amount,
        },
      });

      await tx.expenseAuditLog.create({
        data: {
          action: 'FLOAT_TOPUP',
          performedById: userId,
          reason: input.notes || null,
          changes: {
            branchId: input.branchId,
            amount,
            source: input.source,
            referenceNo: input.referenceNo,
          },
        },
      });

      return rec;
    });

    return topUp;
  }

  // ─── 11. Category Master CRUD & Budget Tracking ──────────────────────────────
  static async getCategories(includeSpendForMonth?: { year: number; month: number; branchId?: string }) {
    let categories = await prisma.expenseCategory.findMany({
      where: { isDeleted: false },
      orderBy: { name: 'asc' },
    });

    if (categories.length === 0) {
      const defaultCategories = [
        { name: 'Logistics & Cartage', description: 'Tempo, courier, transport, and freight charges', monthlyBudgetLimit: 5000000 },
        { name: 'Packaging Materials', description: 'Bubble wrap, boxes, strapping, corrugated sheets', monthlyBudgetLimit: 3000000 },
        { name: 'Tea & Refreshments', description: 'Daily staff tea, snacks, coffee, water cans', monthlyBudgetLimit: 1500000 },
        { name: 'Site Hardware & Supplies', description: 'Screws, drill bits, tape, touchup paint, fasteners', monthlyBudgetLimit: 4000000 },
        { name: 'Tool & Machine Maintenance', description: 'Tool servicing, cutter blades, compressor repairs', monthlyBudgetLimit: 2500000 },
        { name: 'Electricity & Utilities', description: 'Monthly electricity bills, generator diesel, municipal charges', monthlyBudgetLimit: 3500000 },
        { name: 'Office Supplies & Stationery', description: 'Printing paper, invoice books, pens, staplers', monthlyBudgetLimit: 1000000 },
        { name: 'Staff Local Travel', description: 'Local conveyance, fuel allowance, bus/metro tickets', monthlyBudgetLimit: 2000000 },
        { name: 'Casual Daily Labor', description: 'Daily wage loading/unloading and site helper payments', monthlyBudgetLimit: 6000000 },
        { name: 'Miscellaneous Petty Cash', description: 'Emergency petty cash expenses and sundry costs', monthlyBudgetLimit: 1500000 },
      ];

      for (const cat of defaultCategories) {
        await prisma.expenseCategory.create({
          data: {
            name: cat.name,
            description: cat.description,
            monthlyBudgetLimit: cat.monthlyBudgetLimit,
            isActive: true,
          },
        }).catch(() => null);
      }

      categories = await prisma.expenseCategory.findMany({
        where: { isDeleted: false },
        orderBy: { name: 'asc' },
      });
    }

    if (!includeSpendForMonth) {
      return categories.map((c) => ({
        ...c,
        budgetRupees: c.monthlyBudgetLimit ? paiseToRupees(c.monthlyBudgetLimit) : null,
      }));
    }

    const { year, month, branchId } = includeSpendForMonth;
    const whereRollup: Prisma.ExpenseMonthlyRollupWhereInput = {
      year,
      month,
    };
    if (branchId) whereRollup.branchId = branchId;

    const rollups = await prisma.expenseMonthlyRollup.findMany({
      where: whereRollup,
    });

    const spendMap: Record<string, { totalAmount: number; count: number }> = {};
    rollups.forEach((r) => {
      if (!spendMap[r.categoryId]) {
        spendMap[r.categoryId] = { totalAmount: 0, count: 0 };
      }
      spendMap[r.categoryId].totalAmount += r.totalAmount;
      spendMap[r.categoryId].count += r.entryCount;
    });

    return categories.map((c) => {
      const spend = spendMap[c.id] || { totalAmount: 0, count: 0 };
      const budgetPaise = c.monthlyBudgetLimit;
      const percentUsed = budgetPaise && budgetPaise > 0 ? (spend.totalAmount / budgetPaise) * 100 : 0;

      return {
        ...c,
        budgetRupees: budgetPaise ? paiseToRupees(budgetPaise) : null,
        currentMonthSpendPaise: spend.totalAmount,
        currentMonthSpendRupees: paiseToRupees(spend.totalAmount),
        entriesCount: spend.count,
        percentUsed: Number(percentUsed.toFixed(1)),
        isOverBudget: budgetPaise ? spend.totalAmount > budgetPaise : false,
      };
    });
  }

  static async createCategory(data: {
    name: string;
    description?: string | null;
    monthlyBudgetLimit?: number | null;
    budgetInPaise?: boolean;
    isActive?: boolean;
  }) {
    const limitPaise = data.monthlyBudgetLimit
      ? amountToPaise(data.monthlyBudgetLimit, data.budgetInPaise)
      : null;

    const cat = await prisma.expenseCategory.create({
      data: {
        name: data.name.trim(),
        description: data.description || null,
        monthlyBudgetLimit: limitPaise,
        isActive: data.isActive ?? true,
      },
    });

    return cat;
  }

  static async updateCategory(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      monthlyBudgetLimit?: number | null;
      budgetInPaise?: boolean;
      isActive?: boolean;
    }
  ) {
    const updateData: Prisma.ExpenseCategoryUpdateInput = {};
    if (data.name) updateData.name = data.name.trim();
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.monthlyBudgetLimit !== undefined) {
      updateData.monthlyBudgetLimit = data.monthlyBudgetLimit
        ? amountToPaise(data.monthlyBudgetLimit, data.budgetInPaise)
        : null;
    }

    const updated = await prisma.expenseCategory.update({
      where: { id },
      data: updateData,
    });
    return updated;
  }

  static async deleteCategory(id: string) {
    // Soft delete
    return prisma.expenseCategory.update({
      where: { id },
      data: { isDeleted: true, isActive: false },
    });
  }

  // ─── 12. Rollup Analytics for Visual BI Dashboard ─────────────────────────────
  static async getRollupAnalytics(params: {
    branchId?: string;
    year?: number;
    month?: number;
    period?: 'month' | 'year';
  }) {
    const now = new Date();
    const year = params.year || now.getFullYear();
    const month = params.month || now.getMonth() + 1;

    const whereRollup: Prisma.ExpenseMonthlyRollupWhereInput = {
      year,
    };
    if (params.branchId) whereRollup.branchId = params.branchId;
    if (params.period === 'month') whereRollup.month = month;

    const [monthlyRollups, categories, branches] = await Promise.all([
      prisma.expenseMonthlyRollup.findMany({
        where: whereRollup,
        include: { category: true, branch: true },
      }),
      prisma.expenseCategory.findMany({ where: { isDeleted: false } }),
      prisma.branch.findMany({ where: { isActive: true, deletedAt: null } }),
    ]);

    // Category distribution
    const categoryTotals: Record<string, { name: string; amount: number; count: number }> = {};
    categories.forEach((c) => {
      categoryTotals[c.id] = { name: c.name, amount: 0, count: 0 };
    });

    // Monthly trends
    const monthTrends: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
      7: 0,
      8: 0,
      9: 0,
      10: 0,
      11: 0,
      12: 0,
    };

    let grandTotalPaise = 0;

    monthlyRollups.forEach((r) => {
      if (categoryTotals[r.categoryId]) {
        categoryTotals[r.categoryId].amount += r.totalAmount;
        categoryTotals[r.categoryId].count += r.entryCount;
      }
      monthTrends[r.month] = (monthTrends[r.month] || 0) + r.totalAmount;
      grandTotalPaise += r.totalAmount;
    });

    const categoryDistribution = Object.values(categoryTotals)
      .filter((c) => c.amount > 0)
      .map((c) => ({
        name: c.name,
        amountPaise: c.amount,
        amountRupees: paiseToRupees(c.amount),
        count: c.count,
        percentage: grandTotalPaise > 0 ? Number(((c.amount / grandTotalPaise) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.amountPaise - a.amountPaise);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trendData = monthNames.map((name, idx) => ({
      month: name,
      monthNum: idx + 1,
      amountRupees: paiseToRupees(monthTrends[idx + 1] || 0),
    }));

    return {
      year,
      month,
      grandTotalPaise,
      grandTotalRupees: paiseToRupees(grandTotalPaise),
      categoryDistribution,
      trendData,
      branchesCount: branches.length,
    };
  }

  // ─── 13. Build Excel Reports (Day / Week / Month / Year) ──────────────────────
  static async exportReport(query: {
    period: 'day' | 'week' | 'month' | 'year';
    branchId?: string;
    date?: string;
    startDate?: string;
    month?: number;
    year?: number;
  }) {
    const branch = query.branchId
      ? await prisma.branch.findUnique({ where: { id: query.branchId } })
      : null;
    const branchName = branch ? branch.name : 'All Branches (Consolidated)';

    if (query.period === 'day') {
      const selectedDate = parseDateOnly(query.date);
      const dateStr = selectedDate.toISOString().split('T')[0];

      const [ledger, topUps, entries, rollups] = await Promise.all([
        query.branchId
          ? prisma.expenseDailyLedger.findUnique({
              where: { branchId_date: { branchId: query.branchId, date: selectedDate } },
              include: { reconciledBy: true },
            })
          : null,
        prisma.expenseFloatTopUp.findMany({
          where: {
            ...(query.branchId ? { branchId: query.branchId } : {}),
            date: selectedDate,
          },
        }),
        prisma.expenseEntry.findMany({
          where: {
            ...(query.branchId ? { branchId: query.branchId } : {}),
            date: selectedDate,
            isVoid: false,
          },
          include: { category: true, addedBy: true, approvedBy: true },
          orderBy: { time: 'asc' },
        }),
        prisma.expenseDailyRollup.findMany({
          where: {
            ...(query.branchId ? { branchId: query.branchId } : {}),
            date: selectedDate,
          },
          include: { category: true },
        }),
      ]);

      const categoryTotals = rollups.map((r) => ({
        categoryName: r.category.name,
        amount: r.totalAmount,
        count: r.entryCount,
      }));

      return {
        workbook: await buildDayWiseWorkbook({
          date: dateStr,
          branchName,
          ledger,
          topUps,
          entries,
          categoryTotals,
        }),
        filename: `Cash_Expenses_Day_${dateStr}_${branch?.code || 'ALL'}.xlsx`,
      };
    }

    if (query.period === 'week') {
      const start = parseDateOnly(query.startDate);
      const weekDates: Date[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        weekDates.push(d);
      }
      const endDate = weekDates[6];
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

      const [ledgers, topUps, entries, rollups, categories] = await Promise.all([
        prisma.expenseDailyLedger.findMany({
          where: {
            ...(query.branchId ? { branchId: query.branchId } : {}),
            date: { gte: start, lte: endDate },
          },
        }),
        prisma.expenseFloatTopUp.findMany({
          where: {
            ...(query.branchId ? { branchId: query.branchId } : {}),
            date: { gte: start, lte: endDate },
          },
        }),
        prisma.expenseEntry.findMany({
          where: {
            ...(query.branchId ? { branchId: query.branchId } : {}),
            date: { gte: start, lte: endDate },
            isVoid: false,
          },
          include: { category: true },
          orderBy: [{ date: 'asc' }, { time: 'asc' }],
        }),
        prisma.expenseDailyRollup.findMany({
          where: {
            ...(query.branchId ? { branchId: query.branchId } : {}),
            date: { gte: start, lte: endDate },
          },
        }),
        prisma.expenseCategory.findMany({ where: { isDeleted: false } }),
      ]);

      const days = weekDates.map((d, idx) => {
        const dStr = d.toISOString().split('T')[0];
        const dayLedgers = ledgers.filter((l) => l.date.toISOString().split('T')[0] === dStr);
        const dayEntries = entries.filter((e) => e.date.toISOString().split('T')[0] === dStr);
        const dayTopUps = topUps.filter((t) => t.date.toISOString().split('T')[0] === dStr);

        const opening = dayLedgers.reduce((sum, l) => sum + l.openingBalance, 0);
        const received = dayTopUps.reduce((sum, t) => sum + t.amount, 0);
        const expenses = dayEntries
          .filter((e) => e.status === 'APPROVED')
          .reduce((sum, e) => sum + e.amount, 0);
        const closing = opening + received - expenses;
        const physical = dayLedgers.length && dayLedgers[0].physicalCashCounted != null
          ? dayLedgers.reduce((sum, l) => sum + (l.physicalCashCounted || 0), 0)
          : null;
        const variance = physical != null ? closing - physical : null;

        return {
          date: dStr,
          dayName: dayNames[idx],
          opening,
          received,
          expenses,
          closing,
          variance,
          count: dayEntries.length,
        };
      });

      const categoryBreakdown = categories.map((cat) => {
        const dayAmounts = weekDates.map((d) => {
          const dStr = d.toISOString().split('T')[0];
          const matched = rollups.filter(
            (r) => r.categoryId === cat.id && r.date.toISOString().split('T')[0] === dStr
          );
          return matched.reduce((sum, r) => sum + r.totalAmount, 0);
        });
        const total = dayAmounts.reduce((a, b) => a + b, 0);
        return {
          categoryName: cat.name,
          dayAmounts,
          total,
        };
      });

      return {
        workbook: await buildWeekWiseWorkbook({
          weekLabel: `${start.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
          branchName,
          days,
          categoryBreakdown,
          entries,
        }),
        filename: `Cash_Expenses_Week_${start.toISOString().split('T')[0]}_${branch?.code || 'ALL'}.xlsx`,
      };
    }

    if (query.period === 'month') {
      const now = new Date();
      const year = query.year || now.getFullYear();
      const month = query.month || now.getMonth() + 1;
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = monthNames[month - 1];

      const daysInMonth = new Date(year, month, 0).getDate();
      const monthStart = new Date(Date.UTC(year, month - 1, 1));
      const monthEnd = new Date(Date.UTC(year, month - 1, daysInMonth));

      const [ledgers, topUps, rollups, categories] = await Promise.all([
        prisma.expenseDailyLedger.findMany({
          where: {
            ...(query.branchId ? { branchId: query.branchId } : {}),
            date: { gte: monthStart, lte: monthEnd },
          },
          include: { reconciledBy: true },
          orderBy: { date: 'asc' },
        }),
        prisma.expenseFloatTopUp.findMany({
          where: {
            ...(query.branchId ? { branchId: query.branchId } : {}),
            date: { gte: monthStart, lte: monthEnd },
          },
        }),
        prisma.expenseDailyRollup.findMany({
          where: {
            ...(query.branchId ? { branchId: query.branchId } : {}),
            date: { gte: monthStart, lte: monthEnd },
          },
        }),
        prisma.expenseCategory.findMany({ where: { isDeleted: false }, orderBy: { name: 'asc' } }),
      ]);

      const categoryNames = categories.map((c) => c.name);
      const categoryTotals: Record<string, number> = {};
      categoryNames.forEach((n) => (categoryTotals[n] = 0));

      const days = Array.from({ length: daysInMonth }).map((_, idx) => {
        const dayNum = idx + 1;
        const d = new Date(Date.UTC(year, month - 1, dayNum));
        const dStr = d.toISOString().split('T')[0];

        const dayLedgers = ledgers.filter((l) => l.date.toISOString().split('T')[0] === dStr);
        const dayTopUps = topUps.filter((t) => t.date.toISOString().split('T')[0] === dStr);
        const dayRollups = rollups.filter((r) => r.date.toISOString().split('T')[0] === dStr);

        const categoryAmounts: Record<string, number> = {};
        let dayTotal = 0;

        categories.forEach((cat) => {
          const match = dayRollups.find((r) => r.categoryId === cat.id);
          const amt = match ? match.totalAmount : 0;
          categoryAmounts[cat.name] = amt;
          categoryTotals[cat.name] = (categoryTotals[cat.name] || 0) + amt;
          dayTotal += amt;
        });

        const topUpAmt = dayTopUps.reduce((sum, t) => sum + t.amount, 0);
        const closing = dayLedgers.reduce((sum, l) => sum + l.closingBalance, 0);
        const physical = dayLedgers.length && dayLedgers[0].physicalCashCounted != null
          ? dayLedgers.reduce((sum, l) => sum + (l.physicalCashCounted || 0), 0)
          : null;
        const variance = physical != null ? closing - physical : null;

        return {
          date: dStr,
          dayNum,
          categoryAmounts,
          dayTotal,
          topUps: topUpAmt,
          closing,
          physical,
          variance,
        };
      });

      return {
        workbook: await buildMonthWiseWorkbook({
          monthName,
          year,
          branchName,
          categoryNames,
          days,
          reconciliations: ledgers,
          categoryTotals,
        }),
        filename: `Cash_Expenses_Month_${year}-${String(month).padStart(2, '0')}_${branch?.code || 'ALL'}.xlsx`,
      };
    }

    // Period === 'year'
    const now = new Date();
    const year = query.year || now.getFullYear();

    const [monthlyRollups, ledgers, topUps, categories] = await Promise.all([
      prisma.expenseMonthlyRollup.findMany({
        where: {
          ...(query.branchId ? { branchId: query.branchId } : {}),
          year,
        },
      }),
      prisma.expenseDailyLedger.findMany({
        where: {
          ...(query.branchId ? { branchId: query.branchId } : {}),
          date: {
            gte: new Date(Date.UTC(year, 0, 1)),
            lte: new Date(Date.UTC(year, 11, 31)),
          },
        },
      }),
      prisma.expenseFloatTopUp.findMany({
        where: {
          ...(query.branchId ? { branchId: query.branchId } : {}),
          date: {
            gte: new Date(Date.UTC(year, 0, 1)),
            lte: new Date(Date.UTC(year, 11, 31)),
          },
        },
      }),
      prisma.expenseCategory.findMany({ where: { isDeleted: false }, orderBy: { name: 'asc' } }),
    ]);

    const categoryNames = categories.map((c) => c.name);
    const annualCategoryTotals: Record<string, number> = {};
    categoryNames.forEach((n) => (annualCategoryTotals[n] = 0));
    let annualGrandTotal = 0;

    const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const months = Array.from({ length: 12 }).map((_, idx) => {
      const monthNum = idx + 1;
      const monthRollups = monthlyRollups.filter((r) => r.month === monthNum);
      const categoryAmounts: Record<string, number> = {};
      let monthTotal = 0;

      categories.forEach((cat) => {
        const match = monthRollups.find((r) => r.categoryId === cat.id);
        const amt = match ? match.totalAmount : 0;
        categoryAmounts[cat.name] = amt;
        annualCategoryTotals[cat.name] = (annualCategoryTotals[cat.name] || 0) + amt;
        monthTotal += amt;
      });

      annualGrandTotal += monthTotal;

      const mTopUps = topUps.filter((t) => t.date.getMonth() + 1 === monthNum);
      const floatAdded = mTopUps.reduce((sum, t) => sum + t.amount, 0);

      const mLedgers = ledgers.filter((l) => l.date.getMonth() + 1 === monthNum);
      const endingBalance = mLedgers.length ? mLedgers[mLedgers.length - 1].closingBalance : 0;
      const netVariance = mLedgers.reduce((sum, l) => sum + (l.variance || 0), 0);
      const entryCount = monthRollups.reduce((sum, r) => sum + r.entryCount, 0);

      return {
        monthNum,
        monthName: monthShortNames[idx],
        categoryAmounts,
        monthTotal,
        floatAdded,
        endingBalance,
        netVariance,
        entryCount,
      };
    });

    return {
      workbook: await buildYearWiseWorkbook({
        year,
        branchName,
        categoryNames,
        months,
        annualCategoryTotals,
        annualGrandTotal,
      }),
      filename: `Cash_Expenses_Year_${year}_${branch?.code || 'ALL'}.xlsx`,
    };
  }

  // ─── 14. Settings Management ────────────────────────────────────────────────
  static async getSettings(branchId?: string) {
    return getEffectiveSettings(branchId);
  }

  static async updateSettings(
    branchId: string | null,
    data: {
      autoApprovalThreshold?: number;
      thresholdInPaise?: boolean;
      requireReceiptAbove?: number | null;
      receiptAboveInPaise?: boolean;
      alertNegativeBalance?: boolean;
      fiscalYearStartMonth?: number;
    }
  ) {
    const thresholdPaise = data.autoApprovalThreshold != null
      ? amountToPaise(data.autoApprovalThreshold, data.thresholdInPaise)
      : undefined;
    const receiptPaise = data.requireReceiptAbove != null
      ? amountToPaise(data.requireReceiptAbove, data.receiptAboveInPaise)
      : data.requireReceiptAbove === null
      ? null
      : undefined;

    const upsertData: Prisma.ExpenseSettingsCreateInput = {
      autoApprovalThreshold: thresholdPaise ?? 200000,
      requireReceiptAbove: receiptPaise,
      alertNegativeBalance: data.alertNegativeBalance ?? true,
      fiscalYearStartMonth: data.fiscalYearStartMonth ?? 4,
    };

    if (branchId) {
      return prisma.expenseSettings.upsert({
        where: { branchId },
        update: {
          ...(thresholdPaise !== undefined && { autoApprovalThreshold: thresholdPaise }),
          ...(receiptPaise !== undefined && { requireReceiptAbove: receiptPaise }),
          ...(data.alertNegativeBalance !== undefined && { alertNegativeBalance: data.alertNegativeBalance }),
          ...(data.fiscalYearStartMonth !== undefined && { fiscalYearStartMonth: data.fiscalYearStartMonth }),
        },
        create: {
          ...upsertData,
          branch: { connect: { id: branchId } },
        },
      });
    }

    const first = await prisma.expenseSettings.findFirst({ where: { branchId: null } });
    if (first) {
      return prisma.expenseSettings.update({
        where: { id: first.id },
        data: {
          ...(thresholdPaise !== undefined && { autoApprovalThreshold: thresholdPaise }),
          ...(receiptPaise !== undefined && { requireReceiptAbove: receiptPaise }),
          ...(data.alertNegativeBalance !== undefined && { alertNegativeBalance: data.alertNegativeBalance }),
          ...(data.fiscalYearStartMonth !== undefined && { fiscalYearStartMonth: data.fiscalYearStartMonth }),
        },
      });
    }

    return prisma.expenseSettings.create({
      data: upsertData,
    });
  }
}
