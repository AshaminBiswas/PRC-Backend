import prisma from '../../../config/database';

export const getDailyAnalytics = async (ventureId: string) => {
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  const movements = await prisma.stockMovement.findMany({
    where: { ventureId, createdAt: { gte: last7Days } },
    select: { movementType: true, qtyChanged: true, createdAt: true },
  });

  return movements;
};

export const getFastMovingProducts = async (ventureId: string, limit = 10) => {
  const agg = await prisma.stockMovement.groupBy({
    by: ['inventoryProductId'],
    where: {
      ventureId,
      movementType: { in: ['SALE', 'POS_SALE'] },
    },
    _sum: { qtyChanged: true },
    orderBy: { _sum: { qtyChanged: 'asc' } }, // qtyChanged is negative for sales
    take: limit,
  });

  const productIds = agg.map((a) => a.inventoryProductId);

  const products = await prisma.inventoryProduct.findMany({
    where: { id: { in: productIds } },
    include: { product: { select: { name: true } } },
  });

  return agg.map((a) => {
    const p = products.find((prod) => prod.id === a.inventoryProductId);
    return {
      inventoryProductId: a.inventoryProductId,
      sku: p?.sku,
      productName: p?.product.name,
      totalUnitsSold: Math.abs(a._sum.qtyChanged || 0),
    };
  });
};

export const getSlowMovingProducts = async (ventureId: string, limit = 10) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const agg = await prisma.stockMovement.groupBy({
    by: ['inventoryProductId'],
    where: {
      ventureId,
      movementType: { in: ['SALE', 'POS_SALE'] },
      createdAt: { gte: cutoff },
    },
    _sum: { qtyChanged: true },
    orderBy: { _sum: { qtyChanged: 'desc' } }, // smallest sales volume
    take: limit,
  });

  const productIds = agg.map((a) => a.inventoryProductId);

  const products = await prisma.inventoryProduct.findMany({
    where: { id: { in: productIds } },
    include: { product: { select: { name: true } } },
  });

  return agg.map((a) => {
    const p = products.find((prod) => prod.id === a.inventoryProductId);
    return {
      inventoryProductId: a.inventoryProductId,
      sku: p?.sku,
      productName: p?.product.name,
      unitsSoldIn30Days: Math.abs(a._sum.qtyChanged || 0),
      currentStock: p?.currentStock || 0,
    };
  });
};

export const getTurnoverAnalytics = async (ventureId: string) => {
  const totalProducts = await prisma.inventoryProduct.count({ where: { ventureId, deletedAt: null } });
  const totalStockAgg = await prisma.inventoryProduct.aggregate({
    where: { ventureId, deletedAt: null },
    _sum: { currentStock: true },
  });

  const totalSoldAgg = await prisma.stockMovement.aggregate({
    where: { ventureId, movementType: { in: ['SALE', 'POS_SALE'] } },
    _sum: { qtyChanged: true },
  });

  const totalStock = totalStockAgg._sum.currentStock || 1;
  const totalSold = Math.abs(totalSoldAgg._sum.qtyChanged || 0);
  const turnoverRatio = Number((totalSold / totalStock).toFixed(2));

  return {
    totalProducts,
    totalStockUnits: totalStock,
    totalSoldUnits: totalSold,
    turnoverRatio,
  };
};
