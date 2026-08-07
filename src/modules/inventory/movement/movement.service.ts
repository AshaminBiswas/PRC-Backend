import prisma from '../../../config/database';
import { StockMovementType, Prisma } from '@prisma/client';
import { AppError } from '../../../middleware/error.middleware';

export interface CreateMovementParams {
  ventureId: string;
  inventoryProductId: string;
  warehouseId: string;
  qtyChanged: number; // positive for increase, negative for decrease
  movementType: StockMovementType;
  channel?: string; // ONLINE, POS, MANUAL, SYSTEM
  referenceType?: string; // ORDER, POS_SALE, PURCHASE, TRANSFER, ADJUSTMENT
  referenceId?: string;
  createdBy?: string;
  reason?: string;
  notes?: string;
}

export const recordStockMovement = async (
  params: CreateMovementParams,
  tx?: Prisma.TransactionClient
) => {
  const db = tx || prisma;

  const [venture, inventoryProduct, warehouse] = await Promise.all([
    db.venture.findUnique({ where: { id: params.ventureId, deletedAt: null }, select: { id: true } }),
    db.inventoryProduct.findUnique({
      where: { id: params.inventoryProductId, deletedAt: null },
      select: { id: true, ventureId: true },
    }),
    db.warehouse.findUnique({
      where: { id: params.warehouseId, deletedAt: null },
      select: { id: true, ventureId: true },
    }),
  ]);

  if (!venture) throw new AppError('NOT_FOUND', 'Venture not found', 404);
  if (!inventoryProduct) throw new AppError('NOT_FOUND', 'Inventory product not found', 404);
  if (!warehouse) throw new AppError('NOT_FOUND', 'Warehouse not found', 404);
  if (inventoryProduct.ventureId !== params.ventureId || warehouse.ventureId !== params.ventureId) {
    throw new AppError('BAD_REQUEST', 'Inventory product and warehouse must belong to this venture', 400);
  }

  // 1. Fetch current stock for inventoryProduct + warehouse
  const existingStock = await db.inventoryStock.findUnique({
    where: {
      inventoryProductId_warehouseId: {
        inventoryProductId: params.inventoryProductId,
        warehouseId: params.warehouseId,
      },
    },
  });

  const qtyBefore = existingStock ? existingStock.quantity : 0;
  const qtyAfter = qtyBefore + params.qtyChanged;

  if (qtyAfter < 0 && params.movementType !== StockMovementType.ADJUSTMENT) {
    throw new AppError(
      'BAD_REQUEST',
      `Insufficient stock. Current: ${qtyBefore}, requested change: ${params.qtyChanged}`,
      400
    );
  }

  // 2. Upsert InventoryStock for warehouse
  const updatedStock = await db.inventoryStock.upsert({
    where: {
      inventoryProductId_warehouseId: {
        inventoryProductId: params.inventoryProductId,
        warehouseId: params.warehouseId,
      },
    },
    create: {
      inventoryProductId: params.inventoryProductId,
      warehouseId: params.warehouseId,
      ventureId: params.ventureId,
      quantity: Math.max(0, qtyAfter),
    },
    update: {
      quantity: Math.max(0, qtyAfter),
    },
  });

  // 3. Update total stock on InventoryProduct across all warehouses
  const stockAgg = await db.inventoryStock.aggregate({
    where: { inventoryProductId: params.inventoryProductId },
    _sum: { quantity: true },
  });

  const totalStock = stockAgg._sum.quantity || 0;

  const invProduct = await db.inventoryProduct.findUnique({
    where: { id: params.inventoryProductId },
    select: { reservedStock: true },
  });

  const reservedStock = invProduct?.reservedStock || 0;
  const availableStock = Math.max(0, totalStock - reservedStock);

  await db.inventoryProduct.update({
    where: { id: params.inventoryProductId },
    data: {
      currentStock: totalStock,
      availableStock,
    },
  });

  // 4. Create immutable StockMovement log
  const movement = await db.stockMovement.create({
    data: {
      ventureId: params.ventureId,
      inventoryProductId: params.inventoryProductId,
      warehouseId: params.warehouseId,
      qtyBefore,
      qtyChanged: params.qtyChanged,
      qtyAfter: Math.max(0, qtyAfter),
      movementType: params.movementType,
      channel: params.channel || 'SYSTEM',
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      createdBy: params.createdBy,
      reason: params.reason,
      notes: params.notes,
    },
  });

  return { movement, updatedStock, totalStock, availableStock };
};
