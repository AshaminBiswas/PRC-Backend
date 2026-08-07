import prisma from '../../../config/database';
import { AppError } from '../../../middleware/error.middleware';
import { buildPagination, getPaginationParams } from '../../../utils/response';
import { generateDocNumber } from '../shared/inventory.helpers';
import { recordStockMovement } from '../movement/movement.service';
import { PurchaseOrderStatus, StockMovementType } from '@prisma/client';
import type { CreatePurchaseOrderInput, ReceivePurchaseOrderInput, CreatePurchasePaymentInput } from './purchases.schema';

export const listPurchaseOrders = async (ventureId: string, query: any) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: any = { ventureId };

  if (query.supplierId) where.supplierId = query.supplierId;
  if (query.status) where.status = query.status;

  const [orders, totalItems] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        items: { include: { inventoryProduct: { include: { product: { select: { name: true } } } } } },
      },
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return { data: orders, pagination: buildPagination(page, limit, totalItems) };
};

export const getPurchaseOrderById = async (id: string) => {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      warehouse: true,
      items: { include: { inventoryProduct: { include: { product: true } } } },
      receives: { include: { items: true } },
      returns: true,
      payments: true,
    },
  });

  if (!po) throw new AppError('NOT_FOUND', 'Purchase order not found', 404);
  return po;
};

export const createPurchaseOrder = async (ventureId: string, input: CreatePurchaseOrderInput, userId: string) => {
  const poNumber = generateDocNumber('PO');

  let subtotal = 0;
  let taxTotal = 0;

  const preparedItems = input.items.map((item) => {
    const lineSub = item.unitPrice * item.orderedQty;
    const lineTax = (lineSub * (item.taxRate || 18)) / 100;
    subtotal += lineSub;
    taxTotal += lineTax;
    return {
      inventoryProductId: item.inventoryProductId,
      orderedQty: item.orderedQty,
      remainingQty: item.orderedQty,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate || 18,
      taxAmount: lineTax,
      totalPrice: lineSub + lineTax,
    };
  });

  const grandTotal = subtotal + taxTotal;

  return prisma.purchaseOrder.create({
    data: {
      ventureId,
      supplierId: input.supplierId,
      warehouseId: input.warehouseId,
      poNumber,
      status: PurchaseOrderStatus.DRAFT,
      expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
      subtotal,
      taxTotal,
      grandTotal,
      notes: input.notes,
      createdBy: userId,
      items: { create: preparedItems },
    },
    include: { items: true },
  });
};

export const receivePurchaseOrder = async (
  ventureId: string,
  purchaseOrderId: string,
  input: ReceivePurchaseOrderInput,
  userId: string
) => {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { items: true },
  });

  if (!po) throw new AppError('NOT_FOUND', 'Purchase order not found', 404);

  const grnNumber = generateDocNumber('GRN');

  return prisma.$transaction(async (tx) => {
    // Create Goods Receipt Note
    const grn = await tx.purchaseReceive.create({
      data: {
        purchaseOrderId,
        ventureId,
        warehouseId: po.warehouseId,
        grnNumber,
        notes: input.notes,
        createdBy: userId,
        items: {
          create: input.items.map((item) => {
            const poItem = po.items.find((i) => i.id === item.purchaseOrderItemId);
            return {
              purchaseOrderItemId: item.purchaseOrderItemId,
              inventoryProductId: item.inventoryProductId,
              receivedQty: item.receivedQty,
              acceptedQty: item.acceptedQty,
              rejectedQty: item.rejectedQty || 0,
              unitPrice: poItem ? Number(poItem.unitPrice) : 0,
            };
          }),
        },
      },
    });

    // Stock movement & PO item updates
    for (const item of input.items) {
      if (item.acceptedQty > 0) {
        await recordStockMovement(
          {
            ventureId,
            inventoryProductId: item.inventoryProductId,
            warehouseId: po.warehouseId,
            qtyChanged: item.acceptedQty,
            movementType: StockMovementType.PURCHASE,
            channel: 'SYSTEM',
            referenceType: 'PURCHASE',
            referenceId: grn.id,
            createdBy: userId,
            reason: `Purchase Receive GRN: ${grnNumber}`,
          },
          tx
        );
      }

      await tx.purchaseOrderItem.update({
        where: { id: item.purchaseOrderItemId },
        data: {
          receivedQty: { increment: item.receivedQty },
          remainingQty: { decrement: item.acceptedQty },
        },
      });
    }

    // Check if fully received or partially
    const updatedPoItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId } });
    const allReceived = updatedPoItems.every((item) => item.remainingQty <= 0);

    await tx.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        status: allReceived ? PurchaseOrderStatus.RECEIVED : PurchaseOrderStatus.PARTIALLY_RECEIVED,
        receivedDate: new Date(),
      },
    });

    return grn;
  });
};

export const createPurchasePayment = async (ventureId: string, input: CreatePurchasePaymentInput, userId: string) => {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.purchasePayment.create({
      data: {
        purchaseOrderId: input.purchaseOrderId,
        supplierId: input.supplierId,
        ventureId,
        amount: input.amount,
        paymentMethod: input.paymentMethod || 'BANK_TRANSFER',
        referenceNumber: input.referenceNumber,
        notes: input.notes,
        createdBy: userId,
      },
    });

    // Update supplier ledger
    const latestLedger = await tx.supplierLedger.findFirst({
      where: { supplierId: input.supplierId },
      orderBy: { createdAt: 'desc' },
    });

    const currentBalance = latestLedger ? Number(latestLedger.balance) : 0;
    const newBalance = currentBalance - input.amount;

    await tx.supplierLedger.create({
      data: {
        supplierId: input.supplierId,
        ventureId,
        entryType: 'DEBIT',
        amount: input.amount,
        balance: newBalance,
        referenceType: 'PAYMENT',
        referenceId: payment.id,
        description: `Payment for PO: ${input.purchaseOrderId}`,
      },
    });

    return payment;
  });
};
