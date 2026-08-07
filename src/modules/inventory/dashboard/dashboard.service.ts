import prisma from '../../../config/database';

export const getInventoryDashboardMetrics = async (ventureId: string) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    totalProducts,
    allProducts,
    warehousesCount,
    suppliersCount,
    todayDispatches,
    todayPurchases,
    todayPosSales,
    pendingDispatches,
    pendingPurchases,
    pendingOrders,
    recentMovements,
    recentActivities,
  ] = await Promise.all([
    prisma.inventoryProduct.count({ where: { ventureId, deletedAt: null } }),
    prisma.inventoryProduct.findMany({
      where: { ventureId, deletedAt: null },
      select: {
        currentStock: true,
        reorderLevel: true,
        purchasePrice: true,
        sellingPrice: true,
        product: { select: { name: true, sku: true } },
      },
    }),
    prisma.warehouse.count({ where: { ventureId, deletedAt: null } }),
    prisma.supplier.count({ where: { ventureId, deletedAt: null } }),
    prisma.dispatch.count({ where: { ventureId, createdAt: { gte: startOfToday } } }),
    prisma.purchaseOrder.count({ where: { ventureId, createdAt: { gte: startOfToday } } }),
    prisma.posSale.aggregate({
      where: { ventureId, createdAt: { gte: startOfToday } },
      _sum: { grandTotal: true },
    }),
    prisma.dispatch.count({ where: { ventureId, status: 'PENDING' } }),
    prisma.purchaseOrder.count({ where: { ventureId, status: 'PENDING' } }),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.stockMovement.findMany({
      where: { ventureId },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        inventoryProduct: { include: { product: { select: { name: true } } } },
        warehouse: { select: { name: true, code: true } },
      },
    }),
    prisma.inventoryActivityLog.findMany({
      where: { ventureId },
      take: 10,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  let totalStock = 0;
  let totalInventoryValue = 0;
  let lowStockProducts = 0;
  let outOfStockProducts = 0;

  for (const p of allProducts) {
    totalStock += p.currentStock;
    totalInventoryValue += p.currentStock * Number(p.purchasePrice);
    if (p.currentStock <= p.reorderLevel) lowStockProducts++;
    if (p.currentStock === 0) outOfStockProducts++;
  }

  const todaySalesAmount = Number(todayPosSales._sum.grandTotal || 0);

  return {
    totalStock,
    totalInventoryValue,
    totalProducts,
    lowStockProducts,
    outOfStockProducts,
    todaysDispatch: todayDispatches,
    todaysSales: todaySalesAmount,
    todaysPurchase: todayPurchases,
    pendingDispatch: pendingDispatches,
    pendingPurchase: pendingPurchases,
    pendingOrders,
    warehouseCount: warehousesCount,
    supplierCount: suppliersCount,
    stockValue: totalInventoryValue,
    deadStock: 0, // Computed on demand in reports
    fastMovingItems: [],
    slowMovingItems: [],
    topSellingProducts: [],
    recentActivities,
    recentStockUpdates: recentMovements,
  };
};
