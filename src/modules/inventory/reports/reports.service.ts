import prisma from '../../../config/database';

export const getCurrentStockReport = async (ventureId: string, query: any) => {
  const where: any = { ventureId };
  if (query.warehouseId) where.warehouseId = query.warehouseId;

  const stocks = await prisma.inventoryStock.findMany({
    where,
    include: {
      inventoryProduct: { include: { product: { select: { name: true, sku: true } } } },
      warehouse: { select: { name: true, code: true } },
    },
  });

  return stocks.map((s) => ({
    warehouseName: s.warehouse.name,
    warehouseCode: s.warehouse.code,
    sku: s.inventoryProduct.sku,
    productName: s.inventoryProduct.product.name,
    quantity: s.quantity,
    reservedQty: s.reservedQty,
    availableQty: Math.max(0, s.quantity - s.reservedQty),
    damagedQty: s.damagedQty,
  }));
};

export const getLowStockReport = async (ventureId: string) => {
  const products = await prisma.inventoryProduct.findMany({
    where: { ventureId, deletedAt: null },
    include: { product: { select: { name: true } } },
  });

  return products
    .filter((p) => p.currentStock <= p.reorderLevel)
    .map((p) => ({
      sku: p.sku,
      productName: p.product.name,
      currentStock: p.currentStock,
      reorderLevel: p.reorderLevel,
      minStock: p.minStock,
      reorderQty: p.reorderQty,
      deficit: Math.max(0, p.reorderLevel - p.currentStock),
    }));
};

export const getDeadStockReport = async (ventureId: string, days = 90) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const activeMovementProductIds = await prisma.stockMovement.findMany({
    where: { ventureId, createdAt: { gte: cutoff } },
    select: { inventoryProductId: true },
    distinct: ['inventoryProductId'],
  });

  const activeIds = activeMovementProductIds.map((m) => m.inventoryProductId);

  const deadProducts = await prisma.inventoryProduct.findMany({
    where: {
      ventureId,
      deletedAt: null,
      currentStock: { gt: 0 },
      id: { notIn: activeIds },
    },
    include: { product: { select: { name: true } } },
  });

  return deadProducts.map((p) => ({
    sku: p.sku,
    productName: p.product.name,
    currentStock: p.currentStock,
    purchasePrice: Number(p.purchasePrice),
    tiedUpCapital: p.currentStock * Number(p.purchasePrice),
  }));
};

export const getValuationReport = async (ventureId: string) => {
  const products = await prisma.inventoryProduct.findMany({
    where: { ventureId, deletedAt: null },
    include: { product: { select: { name: true } } },
  });

  let totalCostValuation = 0;
  let totalSellingValuation = 0;

  const rows = products.map((p) => {
    const costVal = p.currentStock * Number(p.purchasePrice);
    const sellVal = p.currentStock * Number(p.sellingPrice);
    totalCostValuation += costVal;
    totalSellingValuation += sellVal;

    return {
      sku: p.sku,
      productName: p.product.name,
      currentStock: p.currentStock,
      unitCost: Number(p.purchasePrice),
      unitPrice: Number(p.sellingPrice),
      costValuation: costVal,
      sellingValuation: sellVal,
    };
  });

  return {
    summary: { totalProducts: products.length, totalCostValuation, totalSellingValuation },
    items: rows,
  };
};

export const getMovementReport = async (ventureId: string, query: any) => {
  const where: any = { ventureId };
  if (query.startDate && query.endDate) {
    where.createdAt = { gte: new Date(query.startDate), lte: new Date(query.endDate) };
  }

  const movements = await prisma.stockMovement.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      inventoryProduct: { include: { product: { select: { name: true } } } },
      warehouse: { select: { name: true, code: true } },
    },
  });

  return movements.map((m) => ({
    movementId: m.movementId,
    timestamp: m.createdAt,
    type: m.movementType,
    channel: m.channel,
    sku: m.inventoryProduct.sku,
    productName: m.inventoryProduct.product.name,
    warehouse: m.warehouse.name,
    qtyBefore: m.qtyBefore,
    qtyChanged: m.qtyChanged,
    qtyAfter: m.qtyAfter,
    reason: m.reason,
  }));
};
