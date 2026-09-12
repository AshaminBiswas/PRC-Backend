import prisma from '../../config/database';
import { logger } from '../../config/logger';
import { sendMail } from '../../utils/email.utils';
import { generateInstallerBillPdf, InstallerBillPdfData } from './installer-bill-pdf.service';
import { generateInstallerBillsExcel, ExportBillItem, ExportFilterSummary } from './installer-export.service';
import {
  CreateCubicleModelInput,
  UpdateCubicleModelInput,
  CreateCubicleInstallerInput,
  UpdateCubicleInstallerInput,
  CreateInstallerBillInput,
  UpdateInstallerBillInput,
  RecordPaymentInput,
  ListInstallerBillsQuery,
  ExportBillsQuery,
} from './installer-payments.schema';
import { Prisma } from '@prisma/client';

// ─── Sequence Generation ─────────────────────────────────────────────────────

/**
 * Generate an atomic, strictly incrementing Bill Number in format:
 * PPSI-00001
 * Uses PostgreSQL sequence 'ppsi_bill_seq' to guarantee thread-safe concurrency.
 */
export async function generateBillNumber(): Promise<string> {
  try {
    const res = await prisma.$queryRaw<{ nextval: bigint | number }[]>`
      SELECT nextval('ppsi_bill_seq') AS nextval;
    `;
    if (res && res.length > 0 && res[0].nextval) {
      const seqNum = Number(res[0].nextval);
      const billNo = `PPSI-${String(seqNum).padStart(5, '0')}`;
      logger.info(`[Installer Sequence] Generated Bill Number via Postgres sequence: ${billNo}`);
      return billNo;
    }
  } catch (err: any) {
    logger.warn(`[Installer Sequence] Raw nextval failed (${err?.message}). Falling back to atomic table increment.`);
  }

  // Fallback: Atomic sequence table upsert
  const seq = await prisma.installerBillSequence.upsert({
    where: { prefix: 'PPSI' },
    create: { prefix: 'PPSI', lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return `PPSI-${String(seq.lastNumber).padStart(5, '0')}`;
}

// ─── Cubicle Model Master Services (Super Admin Only) ────────────────────────

export async function listCubicleModels(activeOnly = false, category?: string) {
  const where: Prisma.CubicleModelWhereInput = {};
  if (activeOnly) {
    where.isActive = true;
  }
  if (category && category !== 'ALL') {
    where.category = category;
  }
  return await prisma.cubicleModel.findMany({
    where,
    orderBy: [{ category: 'asc' }, { isActive: 'desc' }, { modelName: 'asc' }],
    include: {
      _count: {
        select: { billItems: true },
      },
    },
  });
}

export async function createCubicleModel(data: CreateCubicleModelInput) {
  const existing = await prisma.cubicleModel.findUnique({
    where: { modelName: data.modelName },
  });
  if (existing) {
    const error: any = new Error(`Model "${data.modelName}" already exists`);
    error.statusCode = 409;
    throw error;
  }

  return await prisma.cubicleModel.create({
    data: {
      category: data.category || 'CUBICLE',
      modelName: data.modelName,
      installationPrice: new Prisma.Decimal(data.installationPrice),
      isActive: data.isActive ?? true,
    },
  });
}

export async function updateCubicleModel(id: string, data: UpdateCubicleModelInput) {
  const existing = await prisma.cubicleModel.findUnique({ where: { id } });
  if (!existing) {
    const error: any = new Error('Cubicle model not found');
    error.statusCode = 404;
    throw error;
  }

  if (data.modelName && data.modelName !== existing.modelName) {
    const duplicate = await prisma.cubicleModel.findUnique({
      where: { modelName: data.modelName },
    });
    if (duplicate && duplicate.id !== id) {
      const error: any = new Error(`Model name "${data.modelName}" is already taken`);
      error.statusCode = 409;
      throw error;
    }
  }

  return await prisma.cubicleModel.update({
    where: { id },
    data: {
      ...(data.category && { category: data.category }),
      ...(data.modelName && { modelName: data.modelName }),
      ...(data.installationPrice !== undefined && {
        installationPrice: new Prisma.Decimal(data.installationPrice),
      }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
}

/**
 * Soft delete / deactivate cubicle model.
 * Protects existing bills and historical audit records from breaking.
 */
export async function deactivateCubicleModel(id: string) {
  const existing = await prisma.cubicleModel.findUnique({ where: { id } });
  if (!existing) {
    const error: any = new Error('Cubicle model not found');
    error.statusCode = 404;
    throw error;
  }

  return await prisma.cubicleModel.update({
    where: { id },
    data: { isActive: false },
  });
}

// ─── Cubicle Installer Master Services (Directory) ──────────────────────────

export async function listCubicleInstallers(includeInactive = false) {
  return await prisma.cubicleInstaller.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { bills: true },
      },
    },
  });
}

export async function createCubicleInstaller(input: CreateCubicleInstallerInput) {
  const existing = await prisma.cubicleInstaller.findUnique({
    where: { email: input.email },
  });
  if (existing) {
    const error: any = new Error(`Installer with email "${input.email}" already exists`);
    error.statusCode = 409;
    throw error;
  }

  return await prisma.cubicleInstaller.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      isActive: input.isActive ?? true,
    },
  });
}

export async function updateCubicleInstaller(id: string, input: UpdateCubicleInstallerInput) {
  const existing = await prisma.cubicleInstaller.findUnique({ where: { id } });
  if (!existing) {
    const error: any = new Error('Cubicle installer not found');
    error.statusCode = 404;
    throw error;
  }

  if (input.email && input.email !== existing.email) {
    const duplicate = await prisma.cubicleInstaller.findUnique({
      where: { email: input.email },
    });
    if (duplicate && duplicate.id !== id) {
      const error: any = new Error(`Installer with email "${input.email}" already exists`);
      error.statusCode = 409;
      throw error;
    }
  }

  return await prisma.cubicleInstaller.update({
    where: { id },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.email && { email: input.email }),
      ...(input.phone !== undefined && { phone: input.phone || null }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });
}

export async function deactivateCubicleInstaller(id: string) {
  const existing = await prisma.cubicleInstaller.findUnique({ where: { id } });
  if (!existing) {
    const error: any = new Error('Cubicle installer not found');
    error.statusCode = 404;
    throw error;
  }

  return await prisma.cubicleInstaller.update({
    where: { id },
    data: { isActive: false },
  });
}

// ─── Installer Payment Bills Services ────────────────────────────────────────

export async function listInstallerBills(query: ListInstallerBillsQuery) {
  const { search, installerId, installerEmail, status, isNcr, startDate, endDate, page, limit } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.InstallerBillWhereInput = {
    deletedAt: null,
  };

  // Installer filter
  if (installerId) {
    where.OR = [
      { installerId },
      { installer: { id: installerId } },
    ];
  }
  if (installerEmail) {
    where.installerEmail = installerEmail.trim().toLowerCase();
  }

  // Status filter
  if (status && status !== 'ALL') {
    where.paymentStatus = status as any;
  }

  // NCR filter
  if (isNcr && isNcr !== 'all') {
    where.isNcr = isNcr === 'true';
  }

  // Date range filter
  if (startDate || endDate) {
    where.installDate = {};
    if (startDate) where.installDate.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.installDate.lte = end;
    }
  }

  // Search filter
  if (search && search.trim().length > 0) {
    const q = search.trim();
    where.OR = [
      { billNo: { contains: q, mode: 'insensitive' } },
      { installerName: { contains: q, mode: 'insensitive' } },
      { installerEmail: { contains: q, mode: 'insensitive' } },
      { siteAddress: { contains: q, mode: 'insensitive' } },
      { sitePin: { contains: q } },
      { items: { some: { modelName: { contains: q, mode: 'insensitive' } } } },
    ];
  }

  const [bills, totalCount] = await Promise.all([
    prisma.installerBill.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    }),
    prisma.installerBill.count({ where }),
  ]);

  // Aggregate high-level operational KPIs across matching records
  const allMatching = await prisma.installerBill.findMany({
    where,
    select: {
      total: true,
      amountPaid: true,
      balanceDue: true,
      paymentStatus: true,
    },
  });

  let totalAmount = 0;
  let totalPaid = 0;
  let totalDue = 0;
  let clearedCount = 0;
  let partialCount = 0;

  for (const b of allMatching) {
    totalAmount += Number(b.total || 0);
    totalPaid += Number(b.amountPaid || 0);
    totalDue += Number(b.balanceDue || 0);
    if (b.paymentStatus === 'CLEARED') {
      clearedCount++;
    } else {
      partialCount++;
    }
  }

  return {
    bills,
    total: totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit) || 1,
    kpis: {
      totalBills: totalCount,
      totalAmount,
      totalPaid,
      totalDue,
      clearedCount,
      partialCount,
    },
  };
}

export async function getInstallerBillById(id: string) {
  const bill = await prisma.installerBill.findUnique({
    where: { id },
    include: {
      installer: true,
      items: {
        include: { model: true },
      },
      payments: {
        orderBy: { paymentDate: 'desc' },
      },
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  if (!bill || bill.deletedAt) {
    const error: any = new Error('Installer bill not found');
    error.statusCode = 404;
    throw error;
  }

  return bill;
}

export async function createInstallerBill(input: CreateInstallerBillInput, createdById?: string) {
  // 1. Fetch active models to pull snapshot installation prices
  const modelIds = input.items.map((i) => i.modelId);
  const models = await prisma.cubicleModel.findMany({
    where: { id: { in: modelIds } },
  });

  if (models.length !== modelIds.length) {
    const error: any = new Error('One or more selected installation models were not found');
    error.statusCode = 400;
    throw error;
  }

  const modelMap = new Map<string, (typeof models)[0]>();
  for (const m of models) {
    modelMap.set(m.id, m);
  }

  // 2. Validate installer if installerId is passed
  if (input.installerId) {
    const installerExists = await prisma.cubicleInstaller.findUnique({
      where: { id: input.installerId },
    });
    if (!installerExists) {
      logger.warn(`[Installer Bill] installerId "${input.installerId}" not found; proceeding with raw name and email.`);
    }
  }

  // 3. Compute itemized line totals and category breakdown
  let cubicleQuantity = 0;
  let cubicleTotal = 0;
  let umpQuantity = 0;
  let umpTotal = 0;
  let lockerQuantity = 0;
  let lockerTotal = 0;

  const itemsToCreate = input.items.map((item) => {
    const model = modelMap.get(item.modelId)!;
    const category = model.category || item.category || 'CUBICLE';
    const unitPrice = Number(model.installationPrice);
    const lineTotal = unitPrice * item.quantity;

    if (category === 'CUBICLE') {
      cubicleQuantity += item.quantity;
      cubicleTotal += lineTotal;
    } else if (category === 'UMP') {
      umpQuantity += item.quantity;
      umpTotal += lineTotal;
    } else if (category === 'LOCKER') {
      lockerQuantity += item.quantity;
      lockerTotal += lineTotal;
    }

    return {
      modelId: item.modelId,
      category,
      modelName: model.modelName,
      quantity: item.quantity,
      installationPrice: new Prisma.Decimal(unitPrice),
      lineTotal: new Prisma.Decimal(lineTotal),
    };
  });

  // Support legacy manual umpQuantity if no dynamic UMP items provided
  if (input.umpQuantity && Number(input.umpQuantity) > 0 && umpQuantity === 0) {
    const legacyUmpQty = Math.max(0, Number(input.umpQuantity));
    const legacyUmpRate = input.umpRate !== undefined ? Number(input.umpRate) : 0;
    umpQuantity = legacyUmpQty;
    umpTotal = legacyUmpQty * legacyUmpRate;
  }

  const subtotal = cubicleTotal + umpTotal + lockerTotal;

  // 4. Deductions, NCR travel expense logic, and totals calculation
  const travelExpenses = input.isNcr ? 0 : Number(input.travelExpenses || 0);
  const deductionAmount = Math.max(0, Number(input.deductionAmount || 0));
  const deductionReason = input.deductionReason?.trim() || null;
  const rawTotal = subtotal + travelExpenses - deductionAmount;
  const total = Math.max(0, rawTotal);
  const initialAmountPaid = Number(input.initialAmountPaid || 0);
  const balanceDue = Math.max(0, total - initialAmountPaid);
  const isCleared = balanceDue === 0 && initialAmountPaid >= total && total > 0;
  const paymentStatus = isCleared ? 'CLEARED' : 'PARTIAL';

  // 5. Generate atomic Bill No (PPSI-00001)
  const billNo = await generateBillNumber();

  // 6. Persist bill + items + optional initial payment in transaction
  const bill = await prisma.$transaction(async (tx) => {
    const createdBill = await tx.installerBill.create({
      data: {
        billNo,
        installerId: input.installerId || null,
        installerName: input.installerName,
        installerEmail: input.installerEmail,
        installDate: new Date(input.installDate),
        isNcr: input.isNcr,
        travelExpenses: new Prisma.Decimal(travelExpenses),
        siteAddress: input.siteAddress,
        sitePin: input.sitePin,
        cubicleQuantity,
        cubicleTotal: new Prisma.Decimal(cubicleTotal),
        umpQuantity,
        umpRate: new Prisma.Decimal(umpQuantity > 0 ? umpTotal / umpQuantity : 0),
        umpTotal: new Prisma.Decimal(umpTotal),
        lockerQuantity,
        lockerTotal: new Prisma.Decimal(lockerTotal),
        deductionAmount: new Prisma.Decimal(deductionAmount),
        deductionReason,
        subtotal: new Prisma.Decimal(subtotal),
        total: new Prisma.Decimal(total),
        amountPaid: new Prisma.Decimal(initialAmountPaid),
        balanceDue: new Prisma.Decimal(balanceDue),
        paymentStatus: paymentStatus as any,
        paymentDate: input.paymentDate
          ? new Date(input.paymentDate)
          : initialAmountPaid > 0
          ? new Date()
          : null,
        notes: input.notes,
        createdById,
        items: {
          create: itemsToCreate,
        },
      },
      include: {
        items: true,
      },
    });

    if (initialAmountPaid > 0) {
      await tx.installerBillPayment.create({
        data: {
          billId: createdBill.id,
          amount: new Prisma.Decimal(initialAmountPaid),
          paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
          paymentMode: input.paymentMode || 'BANK_TRANSFER',
          referenceNote: 'Initial payment upon bill creation',
          recordedById: createdById,
        },
      });
    }

    return createdBill;
  });

  // 7. Trigger auto-email to installer if requested (or cleared)
  if (input.sendEmailToInstaller !== false) {
    setImmediate(() => {
      dispatchClearanceEmailWithPdf(bill.id).catch((e) =>
        logger.error(`[Installer Email] Auto-dispatch failed on creation: ${e?.message || e}`)
      );
    });
  }

  return await getInstallerBillById(bill.id);
}

export async function recordBillPayment(billId: string, input: RecordPaymentInput, recordedById?: string) {
  const bill = await prisma.installerBill.findUnique({
    where: { id: billId },
    include: { payments: true },
  });

  if (!bill || bill.deletedAt) {
    const error: any = new Error('Installer bill not found');
    error.statusCode = 404;
    throw error;
  }

  const paymentAmount = Number(input.amount);
  const currentPaid = Number(bill.amountPaid || 0);
  const billTotal = Number(bill.total);
  const newAmountPaid = currentPaid + paymentAmount;
  const newBalanceDue = Math.max(0, billTotal - newAmountPaid);
  const newlyCleared = newAmountPaid >= billTotal && bill.paymentStatus !== 'CLEARED';
  const newStatus = newAmountPaid >= billTotal ? 'CLEARED' : 'PARTIAL';

  await prisma.$transaction(async (tx) => {
    await tx.installerBillPayment.create({
      data: {
        billId,
        amount: new Prisma.Decimal(paymentAmount),
        paymentDate: new Date(input.paymentDate),
        paymentMode: input.paymentMode,
        referenceNote: input.referenceNote,
        recordedById,
      },
    });

    await tx.installerBill.update({
      where: { id: billId },
      data: {
        amountPaid: new Prisma.Decimal(newAmountPaid),
        balanceDue: new Prisma.Decimal(newBalanceDue),
        paymentStatus: newStatus as any,
        paymentDate: new Date(input.paymentDate),
      },
    });
  });

  // Trigger auto-email if transitioning into CLEARED status
  if (newlyCleared) {
    setImmediate(() => {
      dispatchClearanceEmailWithPdf(billId).catch((e) =>
        logger.error(`[Installer Email] Auto-dispatch failed on clearance: ${e?.message || e}`)
      );
    });
  }

  return await getInstallerBillById(billId);
}

export async function updateInstallerBill(
  id: string,
  input: UpdateInstallerBillInput,
  editedById?: string,
  ipAddress?: string
) {
  const existing = await prisma.installerBill.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    const error: any = new Error('Installer bill not found');
    error.statusCode = 404;
    throw error;
  }

  // ── Snapshot "before" values for every field that may change ────────────
  type FieldBefore = Record<string, unknown>;
  const beforeSnapshot: FieldBefore = {};
  if (input.installerName !== undefined) beforeSnapshot.installerName = existing.installerName;
  if (input.installerEmail !== undefined) beforeSnapshot.installerEmail = existing.installerEmail;
  if (input.installDate !== undefined) beforeSnapshot.installDate = existing.installDate?.toISOString();
  if (input.siteAddress !== undefined) beforeSnapshot.siteAddress = existing.siteAddress;
  if (input.sitePin !== undefined) beforeSnapshot.sitePin = existing.sitePin;
  if (input.notes !== undefined) beforeSnapshot.notes = existing.notes;
  if (input.deductionReason !== undefined) beforeSnapshot.deductionReason = existing.deductionReason;
  if (input.isNcr !== undefined) beforeSnapshot.isNcr = existing.isNcr;
  if (input.travelExpenses !== undefined) beforeSnapshot.travelExpenses = Number(existing.travelExpenses);
  if (input.umpQuantity !== undefined) beforeSnapshot.umpQuantity = existing.umpQuantity;
  if (input.umpRate !== undefined) beforeSnapshot.umpRate = Number(existing.umpRate);
  if (input.deductionAmount !== undefined) beforeSnapshot.deductionAmount = Number(existing.deductionAmount);

  const updateData: Prisma.InstallerBillUpdateInput = {};
  if (input.installerName !== undefined) updateData.installerName = input.installerName;
  if (input.installerEmail !== undefined) updateData.installerEmail = input.installerEmail;
  if (input.installDate !== undefined) updateData.installDate = new Date(input.installDate);
  if (input.siteAddress !== undefined) updateData.siteAddress = input.siteAddress;
  if (input.sitePin !== undefined) updateData.sitePin = input.sitePin;
  if (input.notes !== undefined) updateData.notes = input.notes;
  if (input.deductionReason !== undefined) {
    updateData.deductionReason = input.deductionReason ? input.deductionReason.trim() : null;
  }

  // If NCR, Travel Expenses, UMP, or Deductions changed, recalculate total and balance
  if (
    input.isNcr !== undefined ||
    input.travelExpenses !== undefined ||
    input.umpQuantity !== undefined ||
    input.umpRate !== undefined ||
    input.deductionAmount !== undefined
  ) {
    const isNcr = input.isNcr !== undefined ? input.isNcr : existing.isNcr;
    const travelExpenses = isNcr
      ? 0
      : input.travelExpenses !== undefined
      ? input.travelExpenses
      : Number(existing.travelExpenses);

    const oldUmpTotal = Number(existing.umpTotal || 0);
    const modelsSubtotal = Number(existing.subtotal) - oldUmpTotal;

    const newUmpQuantity =
      input.umpQuantity !== undefined ? Number(input.umpQuantity) : Number(existing.umpQuantity || 0);
    const newUmpRate =
      input.umpRate !== undefined ? Number(input.umpRate) : Number(existing.umpRate || 0);
    const newUmpTotal = newUmpQuantity * newUmpRate;

    const newSubtotal = modelsSubtotal + newUmpTotal;
    const newDeduction = input.deductionAmount !== undefined
      ? Math.max(0, Number(input.deductionAmount))
      : Number(existing.deductionAmount || 0);

    const rawTotal = newSubtotal + travelExpenses - newDeduction;
    const newTotal = Math.max(0, rawTotal);
    const amountPaid = Number(existing.amountPaid);
    const newBalanceDue = Math.max(0, newTotal - amountPaid);
    const newStatus = (amountPaid >= newTotal && newTotal > 0) ? 'CLEARED' : 'PARTIAL';

    updateData.isNcr = isNcr;
    updateData.travelExpenses = new Prisma.Decimal(travelExpenses);
    updateData.umpQuantity = newUmpQuantity;
    updateData.umpRate = new Prisma.Decimal(newUmpRate);
    updateData.umpTotal = new Prisma.Decimal(newUmpTotal);
    updateData.subtotal = new Prisma.Decimal(newSubtotal);
    updateData.deductionAmount = new Prisma.Decimal(newDeduction);
    updateData.total = new Prisma.Decimal(newTotal);
    updateData.balanceDue = new Prisma.Decimal(newBalanceDue);
    updateData.paymentStatus = newStatus as any;
  }

  await prisma.installerBill.update({
    where: { id },
    data: updateData,
  });

  // ── Write Audit Log ───────────────────────────────────────────────────────
  if (editedById && Object.keys(beforeSnapshot).length > 0) {
    // Build after-values using resolved updateData values
    const afterSnapshot: FieldBefore = {};
    if (input.installerName !== undefined) afterSnapshot.installerName = input.installerName;
    if (input.installerEmail !== undefined) afterSnapshot.installerEmail = input.installerEmail;
    if (input.installDate !== undefined) afterSnapshot.installDate = new Date(input.installDate).toISOString();
    if (input.siteAddress !== undefined) afterSnapshot.siteAddress = input.siteAddress;
    if (input.sitePin !== undefined) afterSnapshot.sitePin = input.sitePin;
    if (input.notes !== undefined) afterSnapshot.notes = input.notes ?? null;
    if (input.deductionReason !== undefined) afterSnapshot.deductionReason = input.deductionReason ?? null;
    if (input.isNcr !== undefined) afterSnapshot.isNcr = updateData.isNcr as boolean;
    if (input.travelExpenses !== undefined) afterSnapshot.travelExpenses = Number(updateData.travelExpenses);
    if (input.umpQuantity !== undefined) afterSnapshot.umpQuantity = Number(updateData.umpQuantity);
    if (input.umpRate !== undefined) afterSnapshot.umpRate = Number(updateData.umpRate);
    if (input.deductionAmount !== undefined) afterSnapshot.deductionAmount = Number(updateData.deductionAmount);

    // Only log fields that actually changed
    const changedFields: Record<string, { before: unknown; after: unknown }> = {};
    for (const key of Object.keys(beforeSnapshot)) {
      const before = beforeSnapshot[key];
      const after = afterSnapshot[key];
      // Normalize for comparison
      const bStr = before === null || before === undefined ? '' : String(before);
      const aStr = after === null || after === undefined ? '' : String(after);
      if (bStr !== aStr) {
        changedFields[key] = { before, after };
      }
    }

    if (Object.keys(changedFields).length > 0) {
      await prisma.auditLog.create({
        data: {
          userId: editedById,
          action: 'UPDATE',
          entity: 'InstallerBill',
          entityId: id,
          ipAddress: ipAddress || null,
          changes: {
            billNo: existing.billNo,
            fields: changedFields,
          } as any,
        },
      }).catch((err: any) => {
        // Non-fatal: log but don't fail the update if audit write fails
        logger.warn(`[InstallerBill Audit] Failed to write audit log for bill ${id}: ${err?.message}`);
      });
    }
  }

  return await getInstallerBillById(id);
}

// ─── Bill Audit Log ───────────────────────────────────────────────────────────

/**
 * Retrieve the full edit history for a specific InstallerBill from the audit_logs table.
 * Includes the editor's name and email for display in the admin UI.
 */
export async function getBillAuditLogs(billId: string) {
  return await prisma.auditLog.findMany({
    where: {
      entity: 'InstallerBill',
      entityId: billId,
      action: 'UPDATE',
    },
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });
}



// ─── PDF Generation & Email Dispatch ─────────────────────────────────────────

export async function getBillPdfBuffer(billId: string): Promise<{ buffer: Buffer; billNo: string }> {
  const bill = await getInstallerBillById(billId);

  const pdfData: InstallerBillPdfData = {
    billNo: bill.billNo,
    installerName: bill.installerName,
    installerEmail: bill.installerEmail,
    installDate: bill.installDate,
    isNcr: bill.isNcr,
    travelExpenses: Number(bill.travelExpenses),
    umpQuantity: Number(bill.umpQuantity || 0),
    umpRate: Number(bill.umpRate || 0),
    umpTotal: Number(bill.umpTotal || 0),
    siteAddress: bill.siteAddress,
    sitePin: bill.sitePin,
    deductionAmount: Number(bill.deductionAmount || 0),
    deductionReason: bill.deductionReason,
    subtotal: Number(bill.subtotal),
    total: Number(bill.total),
    amountPaid: Number(bill.amountPaid),
    balanceDue: Number(bill.balanceDue),
    paymentStatus: bill.paymentStatus,
    paymentDate: bill.paymentDate,
    notes: bill.notes,
    items: bill.items.map((i) => ({
      category: i.category,
      modelName: i.modelName,
      quantity: i.quantity,
      installationPrice: Number(i.installationPrice),
      lineTotal: Number(i.lineTotal),
    })),
    payments: bill.payments.map((p) => ({
      amount: Number(p.amount),
      paymentDate: p.paymentDate,
      paymentMode: p.paymentMode,
      referenceNote: p.referenceNote,
    })),
  };

  const buffer = await generateInstallerBillPdf(pdfData);
  return { buffer, billNo: bill.billNo };
}

/**
 * Dispatch clearance or partial payment advice notification email with the bill PDF attached.
 * Supports customRecipient override and dynamically styles content for CLEARED vs PARTIAL bills.
 * Logs success/failure so admins can inspect or retry.
 */
export async function dispatchClearanceEmailWithPdf(
  billId: string,
  customRecipient?: string
): Promise<boolean> {
  const bill = await getInstallerBillById(billId);
  const targetEmail = (customRecipient || bill.installerEmail || '').trim().toLowerCase();

  if (!targetEmail || !targetEmail.includes('@')) {
    const errorMsg = `Invalid or missing installer email address: "${targetEmail}"`;
    logger.error(`[Installer Email] Cannot send email for Bill ${bill.billNo}: ${errorMsg}`);
    await prisma.installerBill.update({
      where: { id: billId },
      data: {
        emailSent: false,
        emailStatus: 'FAILED',
        emailError: errorMsg,
      },
    });
    return false;
  }

  logger.info(`[Installer Email] Preparing advice/clearance email for Bill ${bill.billNo} to ${targetEmail}`);

  try {
    const { buffer } = await getBillPdfBuffer(billId);

    const isCleared = bill.paymentStatus === 'CLEARED';
    const totalFormatted = `₹${Number(bill.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const paidFormatted = `₹${Number(bill.amountPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const balanceFormatted = `₹${Number(bill.balanceDue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const deductionAmountVal = Number(bill.deductionAmount || 0);
    const deductionFormatted = `-₹${deductionAmountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const deductionLabel = bill.deductionReason
      ? `Deductions / Penalties (${bill.deductionReason}):`
      : 'Deductions / Penalties:';
    const installDateFormatted = new Date(bill.installDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const subject = isCleared
      ? `Payment Cleared — Bill #${bill.billNo} — Pacific Restroom Cubicle & Locker Solutions`
      : `Payment Advice & Installation Bill #${bill.billNo} — Pacific Restroom Cubicle & Locker Solutions`;

    const statusBannerHtml = isCleared
      ? `
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 14px 18px; margin-bottom: 20px;">
          <h3 style="color: #166534; margin: 0 0 6px 0; font-size: 15px;">✓ Payment Full & Cleared</h3>
          <p style="margin: 0; font-size: 13.5px; color: #15803d;">
            Dear <strong>${bill.installerName}</strong>, your payment of <strong>${totalFormatted}</strong> for installation job <strong>#${bill.billNo}</strong> has been successfully cleared and disbursed.
          </p>
        </div>
      `
      : `
        <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 14px 18px; margin-bottom: 20px;">
          <h3 style="color: #92400e; margin: 0 0 6px 0; font-size: 15px;">Installation Payment Advice & Statement</h3>
          <p style="margin: 0; font-size: 13.5px; color: #b45309;">
            Dear <strong>${bill.installerName}</strong>, please find below your current payment statement and attached installation voucher for job <strong>#${bill.billNo}</strong>.
          </p>
        </div>
      `;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; color: #1e293b;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #0f172a; margin: 0 0 4px 0;">PACIFIC RESTROOM</h2>
          <p style="color: #64748b; font-size: 13px; margin: 0;">Cubicle & Locker Solutions • Installation Disbursement Advice & Voucher</p>
        </div>

        ${statusBannerHtml}

        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 0; color: #64748b;">Bill Number:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right;">${bill.billNo}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 0; color: #64748b;">Installation Date:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right;">${installDateFormatted}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 0; color: #64748b;">Site Address:</td>
            <td style="padding: 8px 0; text-align: right;">${bill.siteAddress} (${bill.sitePin})</td>
          </tr>
          ${deductionAmountVal > 0 ? `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 0; color: #dc2626;">${deductionLabel}</td>
            <td style="padding: 8px 0; font-weight: bold; color: #dc2626; text-align: right;">${deductionFormatted}</td>
          </tr>` : ''}
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 0; color: #64748b;">Net Disbursement Due:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #0f172a; text-align: right;">${totalFormatted}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 0; color: #64748b;">Amount Disbursed:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #047857; text-align: right;">${paidFormatted}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Outstanding Balance Due:</td>
            <td style="padding: 8px 0; font-weight: bold; color: ${Number(bill.balanceDue) > 0 ? '#b45309' : '#047857'}; text-align: right;">${balanceFormatted}</td>
          </tr>
        </table>

        <p style="font-size: 12.5px; color: #475569; line-height: 1.5; margin-bottom: 24px;">
          Please find attached your official payment voucher PDF (<strong>${bill.billNo}-Payment-Advice.pdf</strong>) for your records. Thank you for your continued partnership with Pacific Restroom.
        </p>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 11.5px; color: #94a3b8; text-align: center;">
          Pacific Restroom • Cubicle & Locker Solutions<br/>
          New Delhi HQ • support@prchardware.com
        </div>
      </div>
    `;

    await sendMail({
      to: targetEmail,
      subject,
      html: emailHtml,
      attachments: [
        {
          filename: `${bill.billNo}-Payment-Advice.pdf`,
          content: buffer,
          contentType: 'application/pdf',
        },
      ],
    });

    const updatePayload: Prisma.InstallerBillUpdateInput = {
      emailSent: true,
      emailSentAt: new Date(),
      emailStatus: 'SENT',
      emailError: null,
    };

    if (customRecipient && customRecipient !== bill.installerEmail) {
      updatePayload.installerEmail = customRecipient;
    }

    await prisma.installerBill.update({
      where: { id: billId },
      data: updatePayload,
    });

    logger.info(`[Installer Email] Successfully sent advice/clearance email for Bill ${bill.billNo} to ${targetEmail}`);
    return true;
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    logger.error(`[Installer Email] Error sending email for Bill ${bill.billNo}: ${errorMsg}`);

    await prisma.installerBill.update({
      where: { id: billId },
      data: {
        emailSent: false,
        emailStatus: 'FAILED',
        emailError: errorMsg,
      },
    });
    return false;
  }
}

// ─── Super Admin Full History Export ─────────────────────────────────────────

export async function getExportExcelBuffer(query: ExportBillsQuery): Promise<Buffer> {
  const where: Prisma.InstallerBillWhereInput = {
    deletedAt: null,
  };

  if (query.status && query.status !== 'ALL') {
    where.paymentStatus = query.status as any;
  }

  if (query.month && query.year) {
    const start = new Date(query.year, query.month - 1, 1);
    const end = new Date(query.year, query.month, 0, 23, 59, 59, 999);
    where.installDate = { gte: start, lte: end };
  } else if (query.year) {
    const start = new Date(query.year, 0, 1);
    const end = new Date(query.year, 11, 31, 23, 59, 59, 999);
    where.installDate = { gte: start, lte: end };
  } else if (query.startDate || query.endDate) {
    where.installDate = {};
    if (query.startDate) where.installDate.gte = new Date(query.startDate);
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      where.installDate.lte = end;
    }
  }

  let installerName: string | undefined;
  if (query.installerId) {
    const inst = await prisma.cubicleInstaller.findUnique({ where: { id: query.installerId } });
    if (inst) {
      installerName = `${inst.name} (${inst.email})`;
      where.OR = [
        { installerId: inst.id },
        { installerEmail: { equals: inst.email, mode: 'insensitive' } },
      ];
    } else {
      where.installerId = query.installerId;
    }
  }

  const bills = await prisma.installerBill.findMany({
    where,
    orderBy: { installDate: 'desc' },
    include: {
      items: true,
    },
  });

  const exportItems: ExportBillItem[] = bills.map((b) => {
    // Build the items array including legacy UMP/Locker stored at bill level (not as items)
    const lineItems: import('./installer-export.service').ExportBillItemLine[] = b.items.map((i) => ({
      category: i.category || 'CUBICLE',
      modelName: i.modelName,
      quantity: i.quantity,
      lineTotal: Number(i.lineTotal),
    }));

    // Legacy UMP stored at bill level (not as a line item)
    const hasUmpInItems = b.items.some((i) => i.category === 'UMP');
    if (b.umpQuantity && Number(b.umpQuantity) > 0 && !hasUmpInItems) {
      lineItems.push({
        category: 'UMP',
        modelName: 'Urinal Modesty Panel',
        quantity: Number(b.umpQuantity),
        lineTotal: Number(b.umpTotal || 0),
      });
    }

    // Legacy Locker stored at bill level (not as a line item)
    const hasLockerInItems = b.items.some((i) => i.category === 'LOCKER');
    if (b.lockerQuantity && Number(b.lockerQuantity) > 0 && !hasLockerInItems) {
      lineItems.push({
        category: 'LOCKER',
        modelName: 'Locker Unit',
        quantity: Number(b.lockerQuantity),
        lineTotal: Number(b.lockerTotal || 0),
      });
    }

    const totalQuantity = lineItems.reduce((acc, i) => acc + i.quantity, 0);

    return {
      billNo: b.billNo,
      installerName: b.installerName,
      installerEmail: b.installerEmail,
      installDate: b.installDate,
      isNcr: b.isNcr,
      travelExpenses: Number(b.travelExpenses),
      siteAddress: b.siteAddress,
      sitePin: b.sitePin,
      items: lineItems,
      deductionAmount: Number(b.deductionAmount || 0),
      deductionReason: b.deductionReason || null,
      totalQuantity,
      subtotal: Number(b.subtotal),
      total: Number(b.total),
      amountPaid: Number(b.amountPaid),
      balanceDue: Number(b.balanceDue),
      paymentStatus: b.paymentStatus,
      paymentDate: b.paymentDate,
      emailStatus: b.emailStatus,
      emailSentAt: b.emailSentAt,
      createdAt: b.createdAt,
    };
  });


  const filterSummary: ExportFilterSummary = {
    installerId: query.installerId,
    installerName,
    month: query.month,
    year: query.year,
    startDate: query.startDate,
    endDate: query.endDate,
    status: query.status,
  };

  return await generateInstallerBillsExcel(exportItems, filterSummary);
}

// ─── Installer-Wise Ledger & Payment Statement ───────────────────────────────

export async function getInstallerLedger(installerId: string) {
  const installer = await prisma.cubicleInstaller.findUnique({
    where: { id: installerId },
  });

  if (!installer) {
    const error: any = new Error('Installer not found');
    error.statusCode = 404;
    throw error;
  }

  const bills = await prisma.installerBill.findMany({
    where: {
      deletedAt: null,
      OR: [
        { installerId: installer.id },
        { installerEmail: { equals: installer.email, mode: 'insensitive' } },
      ],
    },
    orderBy: { installDate: 'desc' },
    include: {
      items: true,
      payments: {
        orderBy: { paymentDate: 'desc' },
      },
    },
  });

  let totalCubicleUnits = 0;
  let totalUmpUnits = 0;
  let totalLockerUnits = 0;
  let grossSubtotal = 0;
  let totalTravel = 0;
  let totalDeductions = 0;
  let netPayable = 0;
  let totalPaid = 0;
  let balanceDue = 0;
  let clearedCount = 0;
  let partialCount = 0;

  for (const b of bills) {
    const cUnits = b.cubicleQuantity || b.items.filter((i) => (i.category || 'CUBICLE') === 'CUBICLE').reduce((acc, i) => acc + i.quantity, 0);
    const uUnits = b.umpQuantity || b.items.filter((i) => i.category === 'UMP').reduce((acc, i) => acc + i.quantity, 0);
    const lUnits = b.lockerQuantity || b.items.filter((i) => i.category === 'LOCKER').reduce((acc, i) => acc + i.quantity, 0);

    totalCubicleUnits += cUnits;
    totalUmpUnits += uUnits;
    totalLockerUnits += lUnits;

    grossSubtotal += Number(b.subtotal || 0);
    totalTravel += Number(b.travelExpenses || 0);
    totalDeductions += Number(b.deductionAmount || 0);
    netPayable += Number(b.total || 0);
    totalPaid += Number(b.amountPaid || 0);
    balanceDue += Number(b.balanceDue || 0);

    if (b.paymentStatus === 'CLEARED') {
      clearedCount++;
    } else {
      partialCount++;
    }
  }

  return {
    installer,
    kpis: {
      totalBills: bills.length,
      totalCubicleUnits,
      totalUmpUnits,
      totalLockerUnits,
      totalUnits: totalCubicleUnits + totalUmpUnits + totalLockerUnits,
      grossSubtotal,
      totalTravel,
      totalDeductions,
      netPayable,
      totalPaid,
      balanceDue,
      clearedCount,
      partialCount,
    },
    bills,
  };
}

// ─── Super Admin Bill Deletion ───────────────────────────────────────────────

export async function deleteInstallerBill(billId: string, superAdminId?: string): Promise<boolean> {
  const existing = await prisma.installerBill.findUnique({
    where: { id: billId },
  });

  if (!existing || existing.deletedAt) {
    const error: any = new Error('Installer bill not found or already deleted');
    error.statusCode = 404;
    throw error;
  }

  await prisma.installerBill.update({
    where: { id: billId },
    data: {
      deletedAt: new Date(),
    },
  });

  logger.info(
    `[Installer Payments] Bill #${existing.billNo} (ID: ${billId}) soft-deleted by super admin ${superAdminId || 'unknown'}`
  );
  return true;
}

