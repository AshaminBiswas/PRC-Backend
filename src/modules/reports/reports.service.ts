import prisma from '../../config/database';
import { buildPagination, getPaginationParams } from '../../utils/response';
import type { Prisma, OrderStatus } from '@prisma/client';

// ─── Helper ───────────────────────────────────────────────────────────────────

const formatGroupKey = (d: Date, groupBy: string): string => {
  const normGroup = groupBy === 'monthly' ? 'month' : groupBy === 'weekly' ? 'week' : groupBy === 'daily' ? 'day' : groupBy;
  if (normGroup === 'month') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  if (normGroup === 'week') {
    const target = new Date(d);
    const day = target.getDay();
    const diff = target.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(target.setDate(diff));
    return monday.toISOString().split('T')[0];
  }
  return d.toISOString().split('T')[0];
};

// ─── Sales Report ─────────────────────────────────────────────────────────────

export const getSalesReport = async (query: {
  startDate?: string;
  endDate?: string;
  status?: OrderStatus;
  groupBy: 'day' | 'week' | 'month' | 'daily' | 'weekly' | 'monthly';
  page: number;
  limit: number;
}) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: Prisma.OrderWhereInput = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.startDate || query.endDate) {
    where.createdAt = {
      ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
      ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
    };
  }

  const [orders, totalItems, summaryAgg] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        subtotal: true,
        discountTotal: true,
        taxTotal: true,
        shippingTotal: true,
        grandTotal: true,
        createdAt: true,
        status: true,
        paymentStatus: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.order.count({ where }),
    prisma.order.aggregate({
      where,
      _sum: {
        subtotal: true,
        discountTotal: true,
        taxTotal: true,
        shippingTotal: true,
        grandTotal: true,
      },
    }),
  ]);

  const allMatchingOrders = await prisma.order.findMany({
    where,
    select: {
      subtotal: true,
      discountTotal: true,
      taxTotal: true,
      shippingTotal: true,
      grandTotal: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const trendMap: Record<
    string,
    {
      grossSales: number;
      totalDiscounts: number;
      netSales: number;
      taxCollected: number;
      shippingFeesCollected: number;
      grandTotal: number;
      ordersCount: number;
    }
  > = {};

  allMatchingOrders.forEach((o) => {
    const key = formatGroupKey(o.createdAt, query.groupBy);
    if (!trendMap[key]) {
      trendMap[key] = {
        grossSales: 0,
        totalDiscounts: 0,
        netSales: 0,
        taxCollected: 0,
        shippingFeesCollected: 0,
        grandTotal: 0,
        ordersCount: 0,
      };
    }
    const sub = Number(o.subtotal);
    const disc = Number(o.discountTotal);
    const tax = Number(o.taxTotal);
    const ship = Number(o.shippingTotal);
    const grand = Number(o.grandTotal);

    trendMap[key].grossSales += sub;
    trendMap[key].totalDiscounts += disc;
    trendMap[key].netSales += sub - disc;
    trendMap[key].taxCollected += tax;
    trendMap[key].shippingFeesCollected += ship;
    trendMap[key].grandTotal += grand;
    trendMap[key].ordersCount += 1;
  });

  const totalGrossSales = Number(Number((summaryAgg as any)._sum?.subtotal ?? 0).toFixed(2));
  const totalDiscounts = Number(Number((summaryAgg as any)._sum?.discountTotal ?? 0).toFixed(2));
  const netSales = Number((totalGrossSales - totalDiscounts).toFixed(2));
  const taxCollected = Number(Number((summaryAgg as any)._sum?.taxTotal ?? 0).toFixed(2));
  const shippingFeesCollected = Number(Number((summaryAgg as any)._sum?.shippingTotal ?? 0).toFixed(2));
  const grandTotalSum = Number(Number((summaryAgg as any)._sum?.grandTotal ?? 0).toFixed(2));
  const totalOrdersCount = totalItems;
  const averageOrderValue = totalOrdersCount > 0 ? Number((grandTotalSum / totalOrdersCount).toFixed(2)) : 0;

  const trend = Object.entries(trendMap).map(([label, stats]) => ({
    label,
    date: label,
    grossSales: Number(stats.grossSales.toFixed(2)),
    totalDiscounts: Number(stats.totalDiscounts.toFixed(2)),
    netSales: Number(stats.netSales.toFixed(2)),
    taxCollected: Number(stats.taxCollected.toFixed(2)),
    shippingFeesCollected: Number(stats.shippingFeesCollected.toFixed(2)),
    grandTotal: Number(stats.grandTotal.toFixed(2)),
    ordersCount: stats.ordersCount,
  }));

  return {
    data: orders.map((o) => ({
      ...o,
      subtotal: Number(o.subtotal),
      discountTotal: Number(o.discountTotal),
      taxTotal: Number(o.taxTotal),
      shippingTotal: Number(o.shippingTotal),
      grandTotal: Number(o.grandTotal),
    })),
    pagination: buildPagination(page, limit, totalItems),
    summary: {
      totalOrders: totalOrdersCount,
      grossSales: totalGrossSales,
      totalDiscounts,
      netSales,
      taxCollected,
      shippingFeesCollected,
      grandTotal: grandTotalSum,
      averageOrderValue,
    },
    trend,
    groupBy: query.groupBy,
  };
};

// ─── Inventory Report ─────────────────────────────────────────────────────────

export const getInventoryReport = async (query: {
  lowStockThreshold: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  categoryId?: string;
  page: number;
  limit: number;
}) => {
  const { page, limit, skip } = getPaginationParams(query);

  const where: Prisma.ProductWhereInput = { deletedAt: null };
  if (query.status) where.status = query.status;
  if (query.categoryId) where.categoryId = query.categoryId;

  const [products, totalItems, categories, allMatchingProducts] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        reorderLevel: true,
        price: true,
        status: true,
        category: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { stock: 'asc' },
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
    prisma.category.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        products: {
          where: { deletedAt: null },
          select: { stock: true, price: true },
        },
      },
    }),
    prisma.product.findMany({
      where,
      select: { stock: true, price: true, categoryId: true },
    }),
  ]);

  const totalUnitsInStock = allMatchingProducts.reduce((sum, p) => sum + p.stock, 0);
  const totalStockValue = Number(
    allMatchingProducts.reduce((sum, p) => sum + p.stock * Number(p.price), 0).toFixed(2)
  );
  const outOfStockCount = allMatchingProducts.filter((p) => p.stock === 0).length;
  const lowStockCount = allMatchingProducts.filter((p) => p.stock > 0 && p.stock <= query.lowStockThreshold).length;

  const categoryBreakdown = categories
    .map((cat) => {
      const catProducts = cat.products;
      const catTotalProducts = catProducts.length;
      const catTotalUnits = catProducts.reduce((sum, p) => sum + p.stock, 0);
      const catStockValue = Number(
        catProducts.reduce((sum, p) => sum + p.stock * Number(p.price), 0).toFixed(2)
      );
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        categorySlug: cat.slug,
        totalProducts: catTotalProducts,
        totalUnits: catTotalUnits,
        totalStockValue: catStockValue,
      };
    })
    .filter((c) => c.totalProducts > 0);

  return {
    data: products.map((p) => {
      const priceNum = Number(p.price);
      const stockValue = Number((p.stock * priceNum).toFixed(2));
      return {
        ...p,
        price: priceNum,
        stockValue,
        stockStatus:
          p.stock === 0
            ? 'OUT_OF_STOCK'
            : p.stock <= (p.reorderLevel ?? query.lowStockThreshold)
            ? 'LOW_STOCK'
            : 'IN_STOCK',
      };
    }),
    pagination: buildPagination(page, limit, totalItems),
    summary: {
      totalProducts: totalItems,
      totalUnitsInStock,
      totalStockValue,
      outOfStockCount,
      lowStockCount,
      lowStockThreshold: query.lowStockThreshold,
    },
    categoryBreakdown,
  };
};

// ─── Customer Report ──────────────────────────────────────────────────────────

export const getCustomerReport = async (query: {
  startDate?: string;
  endDate?: string;
  groupBy: 'day' | 'week' | 'month' | 'daily' | 'weekly' | 'monthly';
  page: number;
  limit: number;
}) => {
  const { page, limit, skip } = getPaginationParams(query);
  const userWhere: Prisma.UserWhereInput = { deletedAt: null };

  if (query.startDate || query.endDate) {
    userWhere.createdAt = {
      ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
      ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
    };
  }

  const [customers, totalItems, totalDbCustomers, allUsersOrderStats, topSpendingAgg] =
    await prisma.$transaction([
      prisma.user.findMany({
        where: userWhere,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          companyName: true,
          status: true,
          createdAt: true,
          _count: { select: { orders: true } },
          orders: {
            select: { grandTotal: true, paymentStatus: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where: userWhere }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          _count: { select: { orders: true } },
        },
      }),
      prisma.order.groupBy({
        by: ['userId'],
        where: {
          paymentStatus: 'COMPLETED',
          ...(query.startDate || query.endDate
            ? {
                createdAt: {
                  ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
                  ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
                },
              }
            : {}),
        },
        _sum: { grandTotal: true },
        _count: { _all: true },
        orderBy: { _sum: { grandTotal: 'desc' } },
        take: 10,
      }),
    ]);

  // Top spending customer hydration
  const topUserIds = topSpendingAgg.map((t) => t.userId);
  const topUsers = await prisma.user.findMany({
    where: { id: { in: topUserIds } },
    select: { id: true, firstName: true, lastName: true, email: true, companyName: true },
  });
  const topUserMap = new Map(topUsers.map((u) => [u.id, u]));

  const topSpendingCustomers = topSpendingAgg.map((t) => {
    const user = topUserMap.get(t.userId);
    const totalSpent = Number(Number((t as any)._sum?.grandTotal ?? 0).toFixed(2));
    const orderCount = typeof t._count === 'number' ? t._count : (t._count as any)?._all ?? 0;
    return {
      userId: t.userId,
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      email: user?.email ?? '',
      companyName: user?.companyName ?? null,
      totalSpent,
      orderCount,
      avgOrderValue: orderCount > 0 ? Number((totalSpent / orderCount).toFixed(2)) : 0,
    };
  });

  // Order Frequencies Distribution
  let singleOrderCount = 0;
  let repeatTwoToFive = 0;
  let repeatSixToTen = 0;
  let repeatTenPlus = 0;
  let totalWithOrders = 0;

  allUsersOrderStats.forEach((u) => {
    const count = u._count.orders;
    if (count > 0) totalWithOrders++;
    if (count === 1) singleOrderCount++;
    else if (count >= 2 && count <= 5) repeatTwoToFive++;
    else if (count >= 6 && count <= 10) repeatSixToTen++;
    else if (count > 10) repeatTenPlus++;
  });

  const repeatCustomersCount = repeatTwoToFive + repeatSixToTen + repeatTenPlus;
  const repeatCustomerRate = totalWithOrders > 0 ? Number(((repeatCustomersCount / totalWithOrders) * 100).toFixed(1)) : 0;

  const orderFrequencies = {
    oneOrder: singleOrderCount,
    twoToFiveOrders: repeatTwoToFive,
    sixToTenOrders: repeatSixToTen,
    moreThanTenOrders: repeatTenPlus,
    totalWithOrders,
  };

  // Trend
  const allRegistrations = await prisma.user.findMany({
    where: userWhere,
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const trendMap: Record<string, number> = {};
  allRegistrations.forEach((u) => {
    const key = formatGroupKey(u.createdAt, query.groupBy);
    trendMap[key] = (trendMap[key] || 0) + 1;
  });

  const trend = Object.entries(trendMap).map(([label, count]) => ({
    label,
    date: label,
    newRegistrations: count,
  }));

  return {
    data: customers.map((c) => {
      const totalSpent = c.orders.reduce((sum, o) => sum + Number(o.grandTotal), 0);
      return {
        id: c.id,
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        companyName: c.companyName,
        status: c.status,
        createdAt: c.createdAt,
        orderCount: c._count.orders,
        totalSpent: Number(totalSpent.toFixed(2)),
      };
    }),
    pagination: buildPagination(page, limit, totalItems),
    summary: {
      totalCustomers: totalDbCustomers,
      newRegistrationsCount: totalItems,
      customersWithOrdersCount: totalWithOrders,
      repeatCustomersCount,
      repeatCustomerRate,
    },
    topSpendingCustomers,
    orderFrequencies,
    trend,
    groupBy: query.groupBy,
  };
};

// ─── Product Performance Report ───────────────────────────────────────────────

export const getProductReport = async (query: {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  limit: number;
  page?: number;
}) => {
  const page = query.page || 1;
  const limit = query.limit || 20;

  const orderItemWhere: Prisma.OrderItemWhereInput = {};

  if (query.startDate || query.endDate) {
    orderItemWhere.order = {
      createdAt: {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      },
    };
  }

  if (query.categoryId) {
    orderItemWhere.product = { categoryId: query.categoryId };
  }

  const [topByQuantityGroup, topByRevenueGroup, topRatedProductsList] = await prisma.$transaction([
    prisma.orderItem.groupBy({
      by: ['productId', 'productName', 'sku'],
      where: orderItemWhere,
      _sum: { quantity: true, total: true },
      _count: { _all: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    }),
    prisma.orderItem.groupBy({
      by: ['productId', 'productName', 'sku'],
      where: orderItemWhere,
      _sum: { quantity: true, total: true },
      _count: { _all: true },
      orderBy: { _sum: { total: 'desc' } },
      take: limit,
    }),
    prisma.product.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      },
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        rating: true,
        reviewCount: true,
        thumbnail: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ rating: 'desc' }, { reviewCount: 'desc' }],
      take: limit,
    }),
  ]);

  const allProductIds = Array.from(
    new Set([
      ...topByQuantityGroup.map((p) => p.productId),
      ...topByRevenueGroup.map((p) => p.productId),
    ])
  );

  const productDetails = await prisma.product.findMany({
    where: { id: { in: allProductIds } },
    select: {
      id: true,
      thumbnail: true,
      rating: true,
      reviewCount: true,
      category: { select: { id: true, name: true } },
    },
  });
  const productMap = new Map(productDetails.map((p) => [p.id, p]));

  const mapGroupedProduct = (p: typeof topByQuantityGroup[0]) => {
    const detail = productMap.get(p.productId);
    const totalQty = (p as any)._sum?.quantity ?? 0;
    const totalRev = Number(Number((p as any)._sum?.total ?? 0).toFixed(2));
    const ordersCount = typeof p._count === 'number' ? p._count : (p._count as any)?._all ?? 0;
    return {
      productId: p.productId,
      productName: p.productName,
      sku: p.sku,
      thumbnail: detail?.thumbnail ?? null,
      rating: detail ? Number(detail.rating) : 0,
      reviewCount: detail?.reviewCount ?? 0,
      category: detail?.category ?? null,
      totalQuantitySold: totalQty,
      totalRevenue: totalRev,
      ordersCount,
    };
  };

  const topSellingByQuantity = topByQuantityGroup.map(mapGroupedProduct);
  const topSellingByRevenue = topByRevenueGroup.map(mapGroupedProduct);
  const topRatedProducts = topRatedProductsList.map((p) => ({
    ...p,
    price: Number(p.price),
    rating: Number(p.rating),
  }));

  const totalQuantitySold = topSellingByRevenue.reduce((s, p) => s + p.totalQuantitySold, 0);
  const totalRevenue = Number(topSellingByRevenue.reduce((s, p) => s + p.totalRevenue, 0).toFixed(2));

  return {
    data: topSellingByRevenue,
    topSellingByQuantity,
    topSellingByRevenue,
    topRatedProducts,
    summary: {
      totalProductsAnalyzed: allProductIds.length,
      totalRevenue,
      totalQuantitySold,
    },
    pagination: buildPagination(page, limit, topSellingByRevenue.length),
  };
};
