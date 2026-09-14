import { Request, Response } from 'express';
import { ExpensesService } from './expenses.service';
import {
  CreateExpenseSchema,
  BatchSyncExpensesSchema,
  ExpenseFilterQuerySchema,
  ApproveExpenseSchema,
  RejectExpenseSchema,
  VoidExpenseSchema,
  DailyReconciliationSchema,
  FloatTopUpSchema,
  CreateCategorySchema,
  UpdateCategorySchema,
  ExpenseSettingsSchema,
  ExportReportQuerySchema,
} from './expenses.schema';
import { streamWorkbookToResponse } from './expenses-export.service';
import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';

export class ExpensesController {
  // ─── 1. Create Expense ───────────────────────────────────────────────────────
  static async createExpense(req: Request, res: Response) {
    const input = CreateExpenseSchema.parse(req.body);
    const userId = (req.user as any).id;

    const result = await ExpensesService.createExpense(input, userId);
    return res.status(201).json({
      success: true,
      message: result.isDuplicate
        ? 'Duplicate offline submission safely deduplicated'
        : 'Expense logged successfully',
      data: result.expense,
      budgetWarning: result.budgetWarning,
    });
  }

  // ─── 2. Batch Offline Sync ───────────────────────────────────────────────────
  static async batchSync(req: Request, res: Response) {
    const { entries } = BatchSyncExpensesSchema.parse(req.body);
    const userId = (req.user as any).id;

    const result = await ExpensesService.batchSync(entries, userId);
    return res.status(200).json({
      success: true,
      message: `Batch sync complete: ${result.syncedCount} inserted, ${result.duplicateCount} deduplicated, ${result.errorCount} errors.`,
      data: result,
    });
  }

  // ─── 3. List Expenses (Cursor-Based Pagination) ──────────────────────────────
  static async getExpenses(req: Request, res: Response) {
    const query = ExpenseFilterQuerySchema.parse(req.query);
    const result = await ExpensesService.getExpenses(query);
    return res.status(200).json({
      success: true,
      data: result.entries,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      totalCount: result.totalCount,
    });
  }

  // ─── 4. Live Running Balance & Today's Summary ───────────────────────────────
  static async getLiveBalance(req: Request, res: Response) {
    const branchId = req.params.branchId;
    if (!branchId) throw new AppError('VALIDATION_ERROR', 'Branch ID is required', 400);

    const balance = await ExpensesService.getLiveBalance(branchId);
    return res.status(200).json({
      success: true,
      data: balance,
    });
  }

  // ─── 5. Super Admin Multi-Branch Summary ─────────────────────────────────────
  static async getMultiBranchSummary(_req: Request, res: Response) {
    const summary = await ExpensesService.getMultiBranchSummary();
    return res.status(200).json({
      success: true,
      data: summary,
    });
  }

  // ─── 6. Single Expense Detail & Audit History ────────────────────────────────
  static async getExpenseById(req: Request, res: Response) {
    const { id } = req.params;
    const expense = await prisma.expenseEntry.findUnique({
      where: { id },
      include: {
        category: true,
        branch: true,
        addedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        voidedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        employee: { select: { id: true, employeeId: true, name: true, phone: true } },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          include: {
            performedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    if (!expense) throw new AppError('NOT_FOUND', 'Expense record not found', 404);

    return res.status(200).json({
      success: true,
      data: expense,
    });
  }

  // ─── 7. Approve Expense ──────────────────────────────────────────────────────
  static async approveExpense(req: Request, res: Response) {
    const { id } = req.params;
    const { notes } = ApproveExpenseSchema.parse(req.body || {});
    const userId = (req.user as any).id;

    const updated = await ExpensesService.approveExpense(id, userId, notes);
    return res.status(200).json({
      success: true,
      message: 'Expense approved and ledger balance updated',
      data: updated,
    });
  }

  // ─── 8. Reject Expense ───────────────────────────────────────────────────────
  static async rejectExpense(req: Request, res: Response) {
    const { id } = req.params;
    const { rejectionReason } = RejectExpenseSchema.parse(req.body);
    const userId = (req.user as any).id;

    const updated = await ExpensesService.rejectExpense(id, rejectionReason, userId);
    return res.status(200).json({
      success: true,
      message: 'Expense entry rejected',
      data: updated,
    });
  }

  // ─── 9. Void Expense ─────────────────────────────────────────────────────────
  static async voidExpense(req: Request, res: Response) {
    const { id } = req.params;
    const { voidReason } = VoidExpenseSchema.parse(req.body);
    const userId = (req.user as any).id;

    const voided = await ExpensesService.voidExpense(id, voidReason, userId);
    return res.status(200).json({
      success: true,
      message: 'Expense voided and balance reversal applied',
      data: voided,
    });
  }

  // ─── 10. Daily Closing Reconciliation ────────────────────────────────────────
  static async reconcileDaily(req: Request, res: Response) {
    const input = DailyReconciliationSchema.parse(req.body);
    const userId = (req.user as any).id;

    const reconciled = await ExpensesService.reconcileDaily(input, userId);
    return res.status(200).json({
      success: true,
      message: 'Daily closing reconciliation completed and locked',
      data: reconciled,
    });
  }

  // ─── 11. Mid-Day Float Top-Up ────────────────────────────────────────────────
  static async addFloatTopUp(req: Request, res: Response) {
    const input = FloatTopUpSchema.parse(req.body);
    const userId = (req.user as any).id;

    const topUp = await ExpensesService.addFloatTopUp(input, userId);
    return res.status(201).json({
      success: true,
      message: 'Cash float top-up recorded and added to cash-in-hand',
      data: topUp,
    });
  }

  // ─── 12. Category Master ─────────────────────────────────────────────────────
  static async getCategories(req: Request, res: Response) {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const month = req.query.month ? Number(req.query.month) : undefined;
    const branchId = req.query.branchId ? String(req.query.branchId) : undefined;

    const includeSpend = year && month ? { year, month, branchId } : undefined;
    const categories = await ExpensesService.getCategories(includeSpend);

    return res.status(200).json({
      success: true,
      data: categories,
    });
  }

  static async createCategory(req: Request, res: Response) {
    const input = CreateCategorySchema.parse(req.body);
    const cat = await ExpensesService.createCategory(input);
    return res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: cat,
    });
  }

  static async updateCategory(req: Request, res: Response) {
    const { id } = req.params;
    const input = UpdateCategorySchema.parse(req.body);
    const cat = await ExpensesService.updateCategory(id, input);
    return res.status(200).json({
      success: true,
      message: 'Category updated',
      data: cat,
    });
  }

  static async deleteCategory(req: Request, res: Response) {
    const { id } = req.params;
    const cat = await ExpensesService.deleteCategory(id);
    return res.status(200).json({
      success: true,
      message: 'Category deleted (soft-deleted to preserve ledger integrity)',
      data: cat,
    });
  }

  // ─── 13. Visual BI Rollup Analytics ──────────────────────────────────────────
  static async getAnalytics(req: Request, res: Response) {
    const branchId = req.query.branchId ? String(req.query.branchId) : undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;
    const month = req.query.month ? Number(req.query.month) : undefined;
    const period = req.query.period === 'year' ? 'year' : 'month';

    const analytics = await ExpensesService.getRollupAnalytics({
      branchId,
      year,
      month,
      period,
    });

    return res.status(200).json({
      success: true,
      data: analytics,
    });
  }

  // ─── 14. Excel Export Generator (Day / Week / Month / Year) ──────────────────
  static async exportExcel(req: Request, res: Response) {
    const query = ExportReportQuerySchema.parse(req.query);
    const { workbook, filename } = await ExpensesService.exportReport(query);

    return streamWorkbookToResponse(workbook, filename, res);
  }

  // ─── 15. Settings ────────────────────────────────────────────────────────────
  static async getSettings(req: Request, res: Response) {
    const branchId = req.query.branchId ? String(req.query.branchId) : undefined;
    const settings = await ExpensesService.getSettings(branchId);
    return res.status(200).json({
      success: true,
      data: settings,
    });
  }

  static async updateSettings(req: Request, res: Response) {
    const input = ExpenseSettingsSchema.parse(req.body);
    const settings = await ExpensesService.updateSettings(input.branchId || null, input);
    return res.status(200).json({
      success: true,
      message: 'Expense settings updated',
      data: settings,
    });
  }
}
