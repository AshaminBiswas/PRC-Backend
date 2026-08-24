import prisma from '../../../config/database';
import { AppError } from '../../../middleware/error.middleware';
import { buildPagination, getPaginationParams } from '../../../utils/response';
import { recordStockMovement } from '../movement/movement.service';
import { StockMovementType } from '@prisma/client';
import type { UpdateStockInput, AdjustStockInput, ReconcileStockInput } from './stock.schema';

export const listStock = async (ventureId: string, query: any) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: any = {};

  if (ventureId) {
    where.ventureId = ventureId;
  }

  if (query.warehouseId) where.warehouseId = query.warehouseId;
  if (query.search) {
    where.inventoryProduct = {
      OR: [
        { sku: { contains: query.search, mode: 'insensitive' } },
        { product: { name: { contains: query.search, mode: 'insensitive' } } },
      ],
    };
  }

  let [stocks, totalItems] = await Promise.all([
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

  // Auto-sync on first visit if inventory_stocks table is empty
  if (totalItems === 0 && !query.search) {
    await syncLegacyProducts(ventureId);
    [stocks, totalItems] = await Promise.all([
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
  }

  return { data: stocks, pagination: buildPagination(page, limit, totalItems) };
};

export const getStockByProduct = async (ventureId: string, productId: string) => {
  const stocks = await prisma.inventoryStock.findMany({
    where: { inventoryProductId: productId, ...(ventureId ? { ventureId } : {}) },
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
    const currentStock = await tx.inventoryStock.findUnique({
      where: {
        inventoryProductId_warehouseId: {
          inventoryProductId: input.inventoryProductId,
          warehouseId: input.warehouseId,
        },
      },
    });

    const currentQty = currentStock ? currentStock.quantity : 0;
    const qtyChanged = input.physicalCount - currentQty;

    return recordStockMovement(
      {
        ventureId,
        inventoryProductId: input.inventoryProductId,
        warehouseId: input.warehouseId,
        qtyChanged,
        movementType: StockMovementType.ADJUSTMENT,
        channel: 'MANUAL',
        createdBy: userId,
        reason: input.reason || 'Stock Reconciliation',
        notes: input.notes,
      },
      tx
    );
  });
};

export const getStockHistory = async (ventureId: string, query: any) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: any = { ...(ventureId ? { ventureId } : {}) };

  if (query.inventoryProductId) where.inventoryProductId = query.inventoryProductId;
  if (query.warehouseId) where.warehouseId = query.warehouseId;
  if (query.movementType) where.movementType = query.movementType;
  if (query.channel) where.channel = query.channel;

  const [movements, totalItems] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        inventoryProduct: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
        warehouse: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return { data: movements, pagination: buildPagination(page, limit, totalItems) };
};

export const syncLegacyProducts = async (ventureId?: string) => {
  let synced = 0;
  let skipped = 0;

  // 1. Resolve Venture (auto-create if missing)
  let venture = ventureId
    ? await prisma.venture.findUnique({ where: { id: ventureId } })
    : null;

  if (!venture) {
    venture = await prisma.venture.findFirst({ where: { deletedAt: null } });
  }

  if (!venture) {
    venture = await prisma.venture.create({
      data: {
        name: 'Pacific Hardware & Co.',
        slug: 'prc-main',
        code: 'PRC-MAIN',
        currency: 'INR',
        status: 'ACTIVE',
      },
    });
  }

  // 2. Resolve Warehouse (auto-create if missing)
  let warehouse = await prisma.warehouse.findFirst({
    where: { ventureId: venture.id, deletedAt: null },
    orderBy: { isDefault: 'desc' },
  });

  if (!warehouse) {
    warehouse = await prisma.warehouse.create({
      data: {
        name: 'Main Fulfillment Hub',
        code: 'WH-MAIN',
        ventureId: venture.id,
        isDefault: true,
        status: 'ACTIVE',
      },
    });
  }

  // 3. Find ALL products in the catalog
  const allProducts = await prisma.product.findMany({
    where: { deletedAt: null },
  });

  for (const product of allProducts) {
    try {
      // Find or create InventoryProduct
      let invProduct = await prisma.inventoryProduct.findFirst({
        where: { productId: product.id },
      });

      if (!invProduct) {
        invProduct = await prisma.inventoryProduct.findUnique({
          where: { sku: product.sku },
        });
      }

      if (!invProduct) {
        invProduct = await prisma.inventoryProduct.create({
          data: {
            productId: product.id,
            ventureId: venture.id,
            sku: product.sku,
            barcode: `BC-${product.sku}`,
            purchasePrice: product.price,
            sellingPrice: product.salePrice ?? product.price,
            currentStock: Number(product.stock) || 0,
            availableStock: Number(product.stock) || 0,
            reorderLevel: product.reorderLevel || 10,
          },
        });
      }

      // Ensure InventoryStock row exists in default warehouse
      const existingStock = await prisma.inventoryStock.findUnique({
        where: {
          inventoryProductId_warehouseId: {
            inventoryProductId: invProduct.id,
            warehouseId: warehouse.id,
          },
        },
      });

      const targetQty = Number(product.stock) || 0;

      if (!existingStock) {
        await prisma.inventoryStock.create({
          data: {
            inventoryProductId: invProduct.id,
            warehouseId: warehouse.id,
            ventureId: venture.id,
            quantity: targetQty,
            reservedQty: 0,
            damagedQty: 0,
          },
        });

        if (targetQty > 0) {
          await prisma.stockMovement.create({
            data: {
              ventureId: venture.id,
              inventoryProductId: invProduct.id,
              warehouseId: warehouse.id,
              movementType: StockMovementType.OPENING,
              qtyChanged: targetQty,
              qtyBefore: 0,
              qtyAfter: targetQty,
              channel: 'SYSTEM',
              reason: 'Initial opening stock sync from catalog',
            },
          });
        }
      }

      // Sync InventoryProduct counters with total stock
      await prisma.inventoryProduct.update({
        where: { id: invProduct.id },
        data: {
          currentStock: targetQty,
          availableStock: targetQty,
        },
      });

      synced++;
    } catch (err: any) {
      console.error(`[Inventory Sync] Skipped product ${product.sku}:`, err.message);
      skipped++;
    }
  }

  return { synced, skipped, totalFound: allProducts.length };
};
