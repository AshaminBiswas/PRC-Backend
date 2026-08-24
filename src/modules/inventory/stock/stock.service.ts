import prisma from '../../../config/database';
import { AppError } from '../../../middleware/error.middleware';
import { buildPagination, getPaginationParams } from '../../../utils/response';
import { recordStockMovement } from '../movement/movement.service';
import { StockMovementType } from '@prisma/client';
import type { UpdateStockInput, AdjustStockInput, ReconcileStockInput } from './stock.schema';

export const listStock = async (ventureId: string, query: any) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: any = { ventureId };

  if (query.warehouseId) where.warehouseId = query.warehouseId;
  if (query.search) {
    where.inventoryProduct = {
      OR: [
        { sku: { contains: query.search, mode: 'insensitive' } },
        { product: { name: { contains: query.search, mode: 'insensitive' } } },
      ],
    };
  }

  const [stocks, totalItems] = await Promise.all([
    prisma.inventoryStock.findMany({
      where,
      skip,
      take: limit,
      include: {
        inventoryProduct: {
          include: { product: { select: { id: true, name: true, slug: true, thumbnail: true } } },
        },
        warehouse: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.inventoryStock.count({ where }),
  ]);

  return { data: stocks, pagination: buildPagination(page, limit, totalItems) };
};

export const getStockByProduct = async (ventureId: string, productId: string) => {
  const stocks = await prisma.inventoryStock.findMany({
    where: { inventoryProductId: productId, ventureId },
    include: { warehouse: { select: { id: true, name: true, code: true } } },
  });

  return stocks;
};

export const increaseStock = async (ventureId: string, input: UpdateStockInput, userId: string) => {
  return prisma.$transaction(async (tx) => {
    return recordStockMovement(
      {
        ventureId,
        inventoryProductId: input.inventoryProductId,
        warehouseId: input.warehouseId,
        qtyChanged: Math.abs(input.quantity),
        movementType: StockMovementType.ADJUSTMENT,
        channel: 'MANUAL',
        createdBy: userId,
        reason: input.reason || 'Manual Increase',
        notes: input.notes,
      },
      tx
    );
  });
};

export const decreaseStock = async (ventureId: string, input: UpdateStockInput, userId: string) => {
  return prisma.$transaction(async (tx) => {
    return recordStockMovement(
      {
        ventureId,
        inventoryProductId: input.inventoryProductId,
        warehouseId: input.warehouseId,
        qtyChanged: -Math.abs(input.quantity),
        movementType: StockMovementType.ADJUSTMENT,
        channel: 'MANUAL',
        createdBy: userId,
        reason: input.reason || 'Manual Decrease',
        notes: input.notes,
      },
      tx
    );
  });
};

export const adjustStock = async (ventureId: string, input: AdjustStockInput, userId: string) => {
  return prisma.$transaction(async (tx) => {
    return recordStockMovement(
      {
        ventureId,
        inventoryProductId: input.inventoryProductId,
        warehouseId: input.warehouseId,
        qtyChanged: input.qtyChanged,
        movementType: input.movementType || StockMovementType.ADJUSTMENT,
        channel: 'MANUAL',
        createdBy: userId,
        reason: input.reason,
        notes: input.notes,
      },
      tx
    );
  });
};

export const reconcileStock = async (ventureId: string, input: ReconcileStockInput, userId: string) => {
  return prisma.$transaction(async (tx) => {
    const existingStock = await tx.inventoryStock.findUnique({
      where: {
        inventoryProductId_warehouseId: {
          inventoryProductId: input.inventoryProductId,
          warehouseId: input.warehouseId,
        },
      },
    });

    const currentQty = existingStock ? existingStock.quantity : 0;
    const diff = input.physicalCount - currentQty;

    if (diff === 0) {
      return { message: 'Stock quantity already matches physical count', currentQty };
    }

    return recordStockMovement(
      {
        ventureId,
        inventoryProductId: input.inventoryProductId,
        warehouseId: input.warehouseId,
        qtyChanged: diff,
        movementType: StockMovementType.ADJUSTMENT,
        channel: 'MANUAL',
        createdBy: userId,
        reason: input.reason,
        notes: `Reconciliation physical count: ${input.physicalCount}, previous: ${currentQty}`,
      },
      tx
    );
  });
};

export const getStockHistory = async (ventureId: string, query: any) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: any = { ventureId };

  if (query.inventoryProductId) where.inventoryProductId = query.inventoryProductId;
  if (query.warehouseId) where.warehouseId = query.warehouseId;
  if (query.movementType) where.movementType = query.movementType;

  const [movements, totalItems] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        inventoryProduct: { include: { product: { select: { name: true } } } },
        warehouse: { select: { name: true, code: true } },
      },
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return { data: movements, pagination: buildPagination(page, limit, totalItems) };
};

export const syncLegacyProducts = async (ventureId: string) => {
  let synced = 0;
  let skipped = 0;

  // Find primary warehouse for this venture
  const warehouse = await prisma.warehouse.findFirst({
    where: { ventureId, deletedAt: null },
    orderBy: { isDefault: 'desc' },
  });

  if (!warehouse) throw new AppError('NOT_FOUND', 'No warehouse found to sync stock into. Please create a warehouse first.', 404);

  // Find all products that DO NOT have an InventoryProduct linked to this venture
  const legacyProducts = await prisma.product.findMany({
    where: {
      deletedAt: null,
      inventoryProducts: { none: { ventureId } },
    },
  });

  for (const product of legacyProducts) {
    try {
      // Create the InventoryProduct profile (starts at 0; recordStockMovement will set real qty)
      const invProduct = await prisma.inventoryProduct.create({
        data: {
          productId: product.id,
          ventureId,
          sku: product.sku,
          barcode: `BC-${product.sku}`,
          purchasePrice: product.price,
          sellingPrice: product.salePrice ?? product.price,
          currentStock: 0,
          availableStock: 0,
          reorderLevel: product.reorderLevel,
        },
      });

      // Only call recordStockMovement if there is actual stock to record
      // This correctly updates InventoryProduct.currentStock + availableStock and logs the ledger
      if (product.stock > 0) {
        await recordStockMovement({
          ventureId,
          inventoryProductId: invProduct.id,
          warehouseId: warehouse.id,
          qtyChanged: product.stock,
          movementType: StockMovementType.OPENING,
          channel: 'SYSTEM',
          reason: 'Legacy product sync',
        });
      }

      synced++;
    } catch (err: any) {
      // SKU collision or other per-product error — skip and continue
      if (err?.code === 'P2002') {
        skipped++;
      } else {
        console.error(`[Inventory Sync] Failed to sync legacy product ${product.sku}:`, err);
        skipped++;
      }
    }
  }

  return { synced, skipped, totalFound: legacyProducts.length };
};
