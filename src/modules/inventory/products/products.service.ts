import prisma from '../../../config/database';
import { AppError } from '../../../middleware/error.middleware';
import { buildPagination, getPaginationParams } from '../../../utils/response';
import { recordStockMovement } from '../movement/movement.service';
import { generateBarcodeBuffer, generateQRCodeDataUrl } from '../shared/inventory.helpers';
import { StockMovementType, InventoryProductStatus } from '@prisma/client';
import type { CreateInventoryProductInput, UpdateInventoryProductInput, BulkUpdateInventoryProductInput } from './products.schema';

export const listInventoryProducts = async (ventureId: string, query: any) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: any = { deletedAt: null };

  if (ventureId) where.ventureId = ventureId;

  if (query.search) {
    where.OR = [
      { sku: { contains: query.search, mode: 'insensitive' } },
      { barcode: { contains: query.search, mode: 'insensitive' } },
      { qrCode: { contains: query.search, mode: 'insensitive' } },
      { brand: { contains: query.search, mode: 'insensitive' } },
      { product: { name: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  if (query.status) where.status = query.status;
  if (query.lowStock === 'true') {
    where.currentStock = { lte: 10 };
  }

  const [products, totalItems] = await Promise.all([
    prisma.inventoryProduct.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: { id: true, name: true, slug: true, price: true, categoryId: true, category: { select: { name: true } } },
        },
        stocks: {
          include: { warehouse: { select: { id: true, name: true, code: true } } },
        },
      },
    }),
    prisma.inventoryProduct.count({ where }),
  ]);

  return { data: products, pagination: buildPagination(page, limit, totalItems) };
};

export const getInventoryProductById = async (id: string) => {
  const item = await prisma.inventoryProduct.findUnique({
    where: { id, deletedAt: null },
    include: {
      product: true,
      venture: { select: { id: true, name: true, code: true } },
      stocks: { include: { warehouse: true } },
    },
  });

  if (!item) throw new AppError('NOT_FOUND', 'Inventory product profile not found', 404);
  return item;
};

export const createInventoryProduct = async (ventureId: string, input: CreateInventoryProductInput, creatorId?: string) => {
  const existingSku = await prisma.inventoryProduct.findUnique({ where: { sku: input.sku } });
  if (existingSku) throw new AppError('CONFLICT', 'SKU already exists in inventory', 409);

  const [venture, product, warehouse] = await Promise.all([
    prisma.venture.findUnique({ where: { id: ventureId, deletedAt: null }, select: { id: true } }),
    prisma.product.findUnique({ where: { id: input.productId, deletedAt: null }, select: { id: true } }),
    input.warehouseId
      ? prisma.warehouse.findUnique({
          where: { id: input.warehouseId, deletedAt: null },
          select: { id: true, ventureId: true },
        })
      : Promise.resolve(null),
  ]);

  if (!venture) throw new AppError('NOT_FOUND', 'Venture not found', 404);
  if (!product) throw new AppError('NOT_FOUND', 'Product not found', 404);
  if (input.warehouseId && !warehouse) throw new AppError('NOT_FOUND', 'Warehouse not found', 404);
  if (warehouse && warehouse.ventureId !== ventureId) {
    throw new AppError('BAD_REQUEST', 'Warehouse does not belong to this venture', 400);
  }

  // Generate barcode and qrCode strings if not provided
  const barcode = input.barcode || `BC-${input.sku}`;
  const qrCode = input.qrCode || `QR-${input.sku}`;

  return prisma.$transaction(async (tx) => {
    const invProduct = await tx.inventoryProduct.create({
      data: {
        productId: input.productId,
        ventureId,
        sku: input.sku,
        barcode,
        qrCode,
        hsnCode: input.hsnCode,
        gstRate: input.gstRate,
        purchasePrice: input.purchasePrice,
        sellingPrice: input.sellingPrice,
        mrp: input.mrp,
        currentStock: 0,
        availableStock: 0,
        minStock: input.minStock,
        maxStock: input.maxStock,
        reorderLevel: input.reorderLevel,
        reorderQty: input.reorderQty,
        leadTimeDays: input.leadTimeDays,
        shelfLifeDays: input.shelfLifeDays,
        rack: input.rack,
        shelf: input.shelf,
        bin: input.bin,
        brand: input.brand,
        unitOfMeasure: input.unitOfMeasure,
        isBatchTracked: input.isBatchTracked,
        isSerialTracked: input.isSerialTracked,
        status: input.status,
      },
      include: { product: true },
    });

    // If initial stock provided, find or use specified warehouse
    if (input.initialStock && input.initialStock > 0) {
      let warehouseId = input.warehouseId;

      if (!warehouseId) {
        const defaultWh = await tx.warehouse.findFirst({
          where: { ventureId, isDefault: true, deletedAt: null },
        });
        if (defaultWh) warehouseId = defaultWh.id;
      }

      if (warehouseId) {
        await recordStockMovement(
          {
            ventureId,
            inventoryProductId: invProduct.id,
            warehouseId,
            qtyChanged: input.initialStock,
            movementType: StockMovementType.OPENING,
            channel: 'MANUAL',
            createdBy: creatorId,
            reason: 'Initial Opening Stock',
          },
          tx
        );
      }
    }

    return invProduct;
  });
};

export const updateInventoryProduct = async (id: string, input: UpdateInventoryProductInput) => {
  const item = await prisma.inventoryProduct.findUnique({ where: { id, deletedAt: null } });
  if (!item) throw new AppError('NOT_FOUND', 'Inventory product profile not found', 404);

  return prisma.inventoryProduct.update({
    where: { id },
    data: input,
  });
};

export const deleteInventoryProduct = async (id: string) => {
  const item = await prisma.inventoryProduct.findUnique({ where: { id, deletedAt: null } });
  if (!item) throw new AppError('NOT_FOUND', 'Inventory product profile not found', 404);

  await prisma.inventoryProduct.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};

export const getProductHistory = async (id: string, query: any) => {
  const { page, limit, skip } = getPaginationParams(query);

  const [movements, totalItems] = await Promise.all([
    prisma.stockMovement.findMany({
      where: { inventoryProductId: id },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { warehouse: { select: { id: true, name: true, code: true } } },
    }),
    prisma.stockMovement.count({ where: { inventoryProductId: id } }),
  ]);

  return { data: movements, pagination: buildPagination(page, limit, totalItems) };
};

export const bulkUpdateInventoryProducts = async (input: BulkUpdateInventoryProductInput) => {
  const result = await prisma.inventoryProduct.updateMany({
    where: { id: { in: input.productIds } },
    data: input.updates,
  });

  return { count: result.count };
};

export const archiveProduct = async (id: string) => {
  return prisma.inventoryProduct.update({
    where: { id },
    data: { status: InventoryProductStatus.ARCHIVED },
  });
};

export const restoreProduct = async (id: string) => {
  return prisma.inventoryProduct.update({
    where: { id },
    data: { status: InventoryProductStatus.ACTIVE },
  });
};
