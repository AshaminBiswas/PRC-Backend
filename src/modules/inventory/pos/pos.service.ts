import prisma from '../../../config/database';
import { AppError } from '../../../middleware/error.middleware';
import { buildPagination, getPaginationParams } from '../../../utils/response';
import { generateDocNumber } from '../shared/inventory.helpers';
import { recordStockMovement } from '../movement/movement.service';
import { PosSessionStatus, PosSaleStatus, StockMovementType, PosPaymentMethod } from '@prisma/client';
import type {
  CreatePosStoreInput,
  CreatePosTerminalInput,
  OpenPosSessionInput,
  ClosePosSessionInput,
  CreatePosSaleInput,
  CreatePosReturnInput,
} from './pos.schema';

// ─── POS Stores ───────────────────────────────────────────────────────────────

export const listPosStores = async (ventureId: string, query: any) => {
  const { page, limit, skip } = getPaginationParams(query);

  const [stores, totalItems] = await Promise.all([
    prisma.posStore.findMany({
      where: { ventureId },
      skip,
      take: limit,
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        terminals: true,
      },
    }),
    prisma.posStore.count({ where: { ventureId } }),
  ]);

  return { data: stores, pagination: buildPagination(page, limit, totalItems) };
};

export const createPosStore = async (ventureId: string, input: CreatePosStoreInput) => {
  const existing = await prisma.posStore.findUnique({ where: { code: input.code } });
  if (existing) throw new AppError('CONFLICT', 'Store code already exists', 409);

  return prisma.posStore.create({
    data: { ...input, ventureId, code: input.code.toUpperCase() },
  });
};

// ─── POS Terminals ────────────────────────────────────────────────────────────

export const listPosTerminals = async (ventureId: string, storeId?: string) => {
  const where: any = { ventureId };
  if (storeId) where.storeId = storeId;

  return prisma.posTerminal.findMany({ where, include: { store: true } });
};

export const createPosTerminal = async (ventureId: string, input: CreatePosTerminalInput) => {
  const existing = await prisma.posTerminal.findUnique({ where: { code: input.code } });
  if (existing) throw new AppError('CONFLICT', 'Terminal code already exists', 409);

  return prisma.posTerminal.create({
    data: { ...input, ventureId, code: input.code.toUpperCase() },
  });
};

// ─── POS Sessions (Shifts) ─────────────────────────────────────────────────────

export const openPosSession = async (ventureId: string, input: OpenPosSessionInput, cashierId: string) => {
  const [store, terminal] = await Promise.all([
    prisma.posStore.findUnique({ where: { id: input.storeId }, select: { id: true, ventureId: true } }),
    prisma.posTerminal.findUnique({ where: { id: input.terminalId }, select: { id: true, ventureId: true, storeId: true } }),
  ]);

  if (!store) throw new AppError('NOT_FOUND', 'POS store not found', 404);
  if (!terminal) throw new AppError('NOT_FOUND', 'POS terminal not found', 404);
  if (store.ventureId !== ventureId || terminal.ventureId !== ventureId || terminal.storeId !== store.id) {
    throw new AppError('BAD_REQUEST', 'POS store and terminal must belong to this venture', 400);
  }

  const activeSession = await prisma.posSession.findFirst({
    where: { terminalId: input.terminalId, status: PosSessionStatus.OPEN },
  });

  if (activeSession) {
    throw new AppError('CONFLICT', 'This terminal already has an open session', 409);
  }

  const session = await prisma.posSession.create({
    data: {
      ventureId,
      storeId: input.storeId,
      terminalId: input.terminalId,
      cashierId,
      openingBalance: input.openingBalance,
      status: PosSessionStatus.OPEN,
      notes: input.notes,
    },
  });

  await prisma.posTerminal.update({
    where: { id: input.terminalId },
    data: { lastOpenedAt: new Date() },
  });

  return session;
};

export const closePosSession = async (sessionId: string, input: ClosePosSessionInput) => {
  const session = await prisma.posSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new AppError('NOT_FOUND', 'Session not found', 404);
  if (session.status !== PosSessionStatus.OPEN) {
    throw new AppError('BAD_REQUEST', 'Session is already closed', 400);
  }

  const opening = Number(session.openingBalance);
  const cashSales = Number(session.totalCashSales);
  const expectedCash = opening + cashSales;
  const actualCash = input.actualCash;
  const cashDifference = actualCash - expectedCash;

  const closed = await prisma.posSession.update({
    where: { id: sessionId },
    data: {
      status: PosSessionStatus.CLOSED,
      closingBalance: actualCash,
      expectedCash,
      actualCash,
      cashDifference,
      closedAt: new Date(),
      notes: input.notes,
    },
  });

  await prisma.posTerminal.update({
    where: { id: session.terminalId },
    data: { lastClosedAt: new Date() },
  });

  return closed;
};

// ─── POS Sales (Billing) ──────────────────────────────────────────────────────

export const createPosSale = async (ventureId: string, input: CreatePosSaleInput, cashierId: string) => {
  const store = await prisma.posStore.findUnique({ where: { id: input.storeId } });
  if (!store) throw new AppError('NOT_FOUND', 'Store not found', 404);

  const saleNumber = generateDocNumber('POS');

  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;

  const preparedItems = input.items.map((item) => {
    const lineSub = item.unitPrice * item.quantity;
    const lineDisc = item.discountAmt || (lineSub * (item.discountPct || 0)) / 100;
    const taxable = lineSub - lineDisc;
    const lineTax = (taxable * (item.taxPct || 18)) / 100;
    const lineTotal = taxable + lineTax;

    subtotal += lineSub;
    discountTotal += lineDisc;
    taxTotal += lineTax;

    return {
      inventoryProductId: item.inventoryProductId,
      productName: item.productName,
      sku: item.sku,
      barcode: item.barcode,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      mrp: item.mrp || item.unitPrice,
      discountPct: item.discountPct || 0,
      discountAmt: lineDisc,
      taxPct: item.taxPct || 18,
      taxAmt: lineTax,
      lineTotal,
    };
  });

  const grandTotal = subtotal - discountTotal + taxTotal;
  const changeAmount = Math.max(0, input.paidAmount - grandTotal);
  const dueAmount = Math.max(0, grandTotal - input.paidAmount);

  return prisma.$transaction(async (tx) => {
    // 1. Create Sale
    const sale = await tx.posSale.create({
      data: {
        ventureId,
        storeId: input.storeId,
        terminalId: input.terminalId,
        sessionId: input.sessionId,
        saleNumber,
        customerId: input.customerId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerGstin: input.customerGstin,
        status: PosSaleStatus.COMPLETED,
        channel: input.channel || 'WALK_IN',
        subtotal,
        discountTotal,
        taxTotal,
        grandTotal,
        paidAmount: input.paidAmount,
        changeAmount,
        dueAmount,
        paymentMethod: input.paymentMethod || PosPaymentMethod.CASH,
        paymentReference: input.paymentReference,
        notes: input.notes,
        createdBy: cashierId,
        items: { create: preparedItems },
      },
      include: { items: true },
    });

    // 2. Deduct Stock + Record POS_SALE Movement Logs
    for (const item of input.items) {
      await recordStockMovement(
        {
          ventureId,
          inventoryProductId: item.inventoryProductId,
          warehouseId: store.warehouseId,
          qtyChanged: -item.quantity,
          movementType: StockMovementType.POS_SALE,
          channel: 'POS',
          referenceType: 'POS_SALE',
          referenceId: sale.id,
          createdBy: cashierId,
          reason: `POS Sale: ${saleNumber}`,
        },
        tx
      );
    }

    // 3. Update POS Session Totals
    const sessionUpdate: any = {
      totalSales: { increment: grandTotal },
    };
    if (input.paymentMethod === PosPaymentMethod.CASH) {
      sessionUpdate.totalCashSales = { increment: grandTotal };
    } else if (input.paymentMethod === PosPaymentMethod.CARD) {
      sessionUpdate.totalCardSales = { increment: grandTotal };
    } else if (input.paymentMethod === PosPaymentMethod.UPI) {
      sessionUpdate.totalUpiSales = { increment: grandTotal };
    }

    await tx.posSession.update({
      where: { id: input.sessionId },
      data: sessionUpdate,
    });

    return sale;
  });
};

export const listPosSales = async (ventureId: string, query: any) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: any = { ventureId };

  if (query.storeId) where.storeId = query.storeId;
  if (query.sessionId) where.sessionId = query.sessionId;

  const [sales, totalItems] = await Promise.all([
    prisma.posSale.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { items: true, store: { select: { name: true, code: true } } },
    }),
    prisma.posSale.count({ where }),
  ]);

  return { data: sales, pagination: buildPagination(page, limit, totalItems) };
};

export const getPosSaleReceipt = async (saleId: string) => {
  const sale = await prisma.posSale.findUnique({
    where: { id: saleId },
    include: {
      store: true,
      terminal: true,
      items: true,
    },
  });

  if (!sale) throw new AppError('NOT_FOUND', 'POS Sale not found', 404);
  return sale;
};

// ─── POS Returns ──────────────────────────────────────────────────────────────

export const createPosReturn = async (ventureId: string, input: CreatePosReturnInput, cashierId: string) => {
  const sale = await prisma.posSale.findUnique({
    where: { id: input.originalSaleId },
    include: { store: true, items: true },
  });

  if (!sale) throw new AppError('NOT_FOUND', 'Original POS Sale not found', 404);

  const returnNumber = generateDocNumber('RET');

  return prisma.$transaction(async (tx) => {
    const posReturn = await tx.posReturn.create({
      data: {
        originalSaleId: input.originalSaleId,
        ventureId,
        storeId: sale.storeId,
        sessionId: input.sessionId,
        returnNumber,
        reason: input.reason,
        refundMethod: input.refundMethod || 'CASH',
        refundAmount: input.refundAmount,
        createdBy: cashierId,
      },
    });

    // Restore Stock + Record RETURN Movement Logs
    for (const item of sale.items) {
      await recordStockMovement(
        {
          ventureId,
          inventoryProductId: item.inventoryProductId,
          warehouseId: sale.store.warehouseId,
          qtyChanged: item.quantity,
          movementType: StockMovementType.RETURN,
          channel: 'POS',
          referenceType: 'POS_RETURN',
          referenceId: posReturn.id,
          createdBy: cashierId,
          reason: `POS Return: ${returnNumber}`,
        },
        tx
      );
    }

    await tx.posSale.update({
      where: { id: input.originalSaleId },
      data: { status: PosSaleStatus.RETURNED },
    });

    return posReturn;
  });
};
