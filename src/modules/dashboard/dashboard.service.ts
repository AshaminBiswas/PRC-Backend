import prisma from '../../config/database';
import type { Prisma } from '@prisma/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export interface DateRange {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
}

export const getPeriodRange = (
  periodOrQuery?: string | { period?: string; startDate?: string; endDate?: string },
  startDateStr?: string,
  endDateStr?: string
): DateRange => {
  let period: string | undefined;
  if (typeof periodOrQuery === 'object' && periodOrQuery !== null) {
    period = periodOrQuery.period;
    startDateStr = periodOrQuery.startDate;
    endDateStr = periodOrQuery.endDate;
  } else {
    period = periodOrQuery;
  }

  const now = new Date();
  let start: Date;
  let end: Date = new Date(now);

  if (startDateStr && endDateStr) {
    start = new Date(startDateStr);
    end = new Date(endDateStr);
    const durationMs = Math.max(end.getTime() - start.getTime(), 86400000);
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationMs);
    return { start, end, prevStart, prevEnd };
  }

  const prevEnd = new Date(now);

  switch (period) {
    case 'today':
    case 'day':
    case 'daily': {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      prevEnd.setHours(0, 0, 0, 0);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - 1);
      return { start, end, prevStart, prevEnd };
    }
    case '7d':
    case 'week':
    case 'weekly': {
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      prevEnd.setDate(prevEnd.getDate() - 7);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - 7);
      return { start, end, prevStart, prevEnd };
    }
    case '90d':
    case 'quarter': {
      start = new Date(now);
      start.setDate(start.getDate() - 90);
      prevEnd.setDate(prevEnd.getDate() - 90);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - 90);
      return { start, end, prevStart, prevEnd };
    }
    case '1y':
    case 'year':
    case 'yearly':
    case 'ytd':
    case 'all': {
      start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      prevEnd.setFullYear(prevEnd.getFullYear() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setFullYear(prevStart.getFullYear() - 1);
      return { start, end, prevStart, prevEnd };
    }
    case '30d':
    case 'month':
    case 'monthly':
    default: {
      // 30d
      start = new Date(now);
      start.setDate(start.getDate() - 30);
      prevEnd.setDate(prevEnd.getDate() - 30);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - 30);
      return { start, end, prevStart, prevEnd };
    }
  }
};

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

const pctChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

// ─── Overview ─────────────────────────────────────────────────────────────────

export const getOverview = async (query?: string | { period?: string; startDate?: string; endDate?: string }) => {
  const queryObj = typeof query === 'object' && query !== null ? query : { period: query };
  const { start, end, prevStart, prevEnd } = getPeriodRange(queryObj);

  const customerWhere: Prisma.UserWhereInput = {
    deletedAt: null,
    OR: [
      {
        userRoles: {
          some: {
            role: {
              OR: [
                { slug: 'customer' },
                { slug: 'b2b-customer' },
                { slug: 'ROLE_CUSTOMER' },
                { name: { contains: 'Customer', mode: 'insensitive' } },
              ],
            },
          },
        },
      },
      {
        userRoles: {
          none: {
            role: {
              slug: { in: ['admin', 'super-admin'] },
            },
          },
        },
      },
    ],
  };

  const [
    paymentAgg,
    prevPaymentAgg,
    orderPaymentAgg,
    prevOrderPaymentAgg,
    orderCount,
    prevOrderCount,
    customerCount,
    prevCustomerCount,
    productCount,
    lowStockCount,
  ] = await prisma.$transaction([
    prisma.payment.aggregate({
      where: { status: 'COMPLETED', createdAt: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: 'COMPLETED', createdAt: { gte: prevStart, lt: prevEnd } },
      _sum: { amount: true },
    }),
    prisma.order.aggregate({
      where: { paymentStatus: 'COMPLETED', createdAt: { gte: start, lte: end } },
      _sum: { grandTotal: true },
    }),
    prisma.order.aggregate({
      where: { paymentStatus: 'COMPLETED', createdAt: { gte: prevStart, lt: prevEnd } },
      _sum: { grandTotal: true },
    }),
    prisma.order.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.order.count({ where: { createdAt: { gte: prevStart, lt: prevEnd } } }),
    prisma.user.count({ where: { ...customerWhere, createdAt: { gte: start, lte: end } } }),
    prisma.user.count({ where: { ...customerWhere, createdAt: { gte: prevStart, lt: prevEnd } } }),
    prisma.product.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
    prisma.product.count({ where: { deletedAt: null, status: 'ACTIVE', stock: { gt: 0, lte: 10 } } }),
  ]);

  const currentPaymentSum = Number((paymentAgg as any)._sum?.amount ?? 0);
  const currentOrderSum = Number((orderPaymentAgg as any)._sum?.grandTotal ?? 0);
  const revenue = Math.max(currentPaymentSum, currentOrderSum);

  const prevPaymentSum = Number((prevPaymentAgg as any)._sum?.amount ?? 0);
  const prevOrderSum = Number((prevOrderPaymentAgg as any)._sum?.grandTotal ?? 0);
  const prevRevenue = Math.max(prevPaymentSum, prevOrderSum);

  return {
    revenue: {
      current: Number(revenue.toFixed(2)),
      previous: Number(prevRevenue.toFixed(2)),
      change: pctChange(revenue, prevRevenue),
    },
    orders: {
      current: orderCount,
      previous: prevOrderCount,
      change: pctChange(orderCount, prevOrderCount),
    },
    customers: {
      current: customerCount,
      previous: prevCustomerCount,
      change: pctChange(customerCount, prevCustomerCount),
    },
    products: {
      totalActive: productCount,
      lowStock: lowStockCount,
    },
    period: queryObj.period || '30d',
    dateRange: { start, end },
  };
};

// ─── Sales Chart ─────────────────────────────────────────────────────────────

export const getSalesChart = async (
  query?: string | { period?: string; startDate?: string; endDate?: string; groupBy?: string },
  groupByStr?: string
) => {
  const queryObj = typeof query === 'object' && query !== null ? query : { period: query, groupBy: groupByStr };
  const { start, end } = getPeriodRange(queryObj);
  const groupBy = queryObj.groupBy || 'day';

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: start, lte: end },
    },
    select: {
      id: true,
      grandTotal: true,
      paymentStatus: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const grouped: Record<string, { revenue: number; ordersCount: number }> = {};

  orders.forEach((order) => {
    const key = formatGroupKey(order.createdAt, groupBy);
    if (!grouped[key]) {
      grouped[key] = { revenue: 0, ordersCount: 0 };
    }
    grouped[key].ordersCount += 1;
    if (order.paymentStatus === 'COMPLETED') {
      grouped[key].revenue += Number(order.grandTotal);
    }
  });

  const data = Object.entries(grouped).map(([label, stats]) => ({
    label,
    date: label,
    revenue: Number(stats.revenue.toFixed(2)),
    ordersCount: stats.ordersCount,
  }));

  const totalRevenue = Number(data.reduce((s, d) => s + d.revenue, 0).toFixed(2));
  const totalOrders = data.reduce((s, d) => s + d.ordersCount, 0);

  return {
    data,
    summary: {
      totalRevenue,
      totalOrders,
      avgOrderValue: totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0,
    },
    period: queryObj.period || '30d',
    groupBy,
    dateRange: { start, end },
  };
};

// ─── Recent Orders ────────────────────────────────────────────────────────────

export const getRecentOrders = async (limit: number) => {
  const orders = await prisma.order.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      grandTotal: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          companyName: true,
        },
      },
    },
  });

  return orders.map((o) => ({
    ...o,
    grandTotal: Number(o.grandTotal),
  }));
};

// ─── Inventory Health / Inventory Overview ────────────────────────────────────

export const getInventory = async (lowStockThreshold: number) => {
  const [outOfStock, lowStock, activeProducts] = await prisma.$transaction([
    prisma.product.findMany({
      where: { deletedAt: null, stock: 0 },
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        reorderLevel: true,
        price: true,
        status: true,
        category: { select: { id: true, name: true } },
      },
      take: 50,
    }),
    prisma.product.findMany({
      where: {
        deletedAt: null,
        stock: { gt: 0, lte: lowStockThreshold },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        reorderLevel: true,
        price: true,
        status: true,
        category: { select: { id: true, name: true } },
      },
      take: 50,
    }),
    prisma.product.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      select: { stock: true, price: true },
    }),
  ]);

  const totalStockUnits = activeProducts.reduce((sum, p) => sum + p.stock, 0);
  const totalStockValue = Number(
    activeProducts.reduce((sum, p) => sum + p.stock * Number(p.price), 0).toFixed(2)
  );

  return {
    outOfStock: outOfStock.map((p) => ({ ...p, price: Number(p.price) })),
    lowStock: lowStock.map((p) => ({ ...p, price: Number(p.price) })),
    summary: {
      outOfStockCount: outOfStock.length,
      lowStockCount: lowStock.length,
      totalActiveProducts: activeProducts.length,
      totalStockUnits,
      totalStockValue,
      lowStockThreshold,
    },
  };
};

export const getInventoryHealth = getInventory;

// ─── Extra Helper Endpoints (Backwards Compatibility) ──────────────────────────

export const getRevenueTrend = async (
  periodOrQuery?: string | { period?: string; startDate?: string; endDate?: string; groupBy?: string },
  groupByStr?: string
) => {
  return getSalesChart(periodOrQuery, groupByStr);
};

export const getOrderStats = async (periodOrQuery?: string | { period?: string; startDate?: string; endDate?: string }) => {
  const { start, end } = getPeriodRange(periodOrQuery);

  const groupResult = await prisma.order.groupBy({
    by: ['status'],
    where: { createdAt: { gte: start, lte: end } },
    _count: { id: true },
  });

  const result: Record<string, number> = {
    PENDING: 0,
    PROCESSING: 0,
    SHIPPED: 0,
    DELIVERED: 0,
    CANCELLED: 0,
    RETURNED: 0,
    TOTAL: 0,
  };

  let total = 0;
  groupResult.forEach((g) => {
    result[g.status] = g._count.id;
    total += g._count.id;
  });
  result.TOTAL = total;

  return result;
};

export const getProductStats = async () => {
  const [active, inactive, draft, outOfStock, lowStock, total] = await prisma.$transaction([
    prisma.product.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
    prisma.product.count({ where: { deletedAt: null, status: 'INACTIVE' } }),
    prisma.product.count({ where: { deletedAt: null, status: 'DRAFT' } }),
    prisma.product.count({ where: { deletedAt: null, stock: 0 } }),
    prisma.product.count({ where: { deletedAt: null, stock: { gt: 0, lte: 10 } } }),
    prisma.product.count({ where: { deletedAt: null } }),
  ]);

  return { total, active, inactive, draft, outOfStock, lowStock };
};

export const getCustomerStats = async (periodOrQuery?: string | { period?: string; startDate?: string; endDate?: string }) => {
  const { start, end, prevStart, prevEnd } = getPeriodRange(periodOrQuery);
  const period = typeof periodOrQuery === 'object' && periodOrQuery !== null ? periodOrQuery.period || '30d' : periodOrQuery || '30d';

  const customerWhere: Prisma.UserWhereInput = { deletedAt: null };

  const [total, newCustomers, prevNewCustomers] = await prisma.$transaction([
    prisma.user.count({ where: customerWhere }),
    prisma.user.count({ where: { ...customerWhere, createdAt: { gte: start, lte: end } } }),
    prisma.user.count({ where: { ...customerWhere, createdAt: { gte: prevStart, lt: prevEnd } } }),
  ]);

  return {
    total,
    newCustomers,
    previousNewCustomers: prevNewCustomers,
    growth: pctChange(newCustomers, prevNewCustomers),
    period,
  };
};

export const getAnalytics = async (periodOrQuery?: string | { period?: string; startDate?: string; endDate?: string }) => {
  const { start, end } = getPeriodRange(periodOrQuery);
  const period = typeof periodOrQuery === 'object' && periodOrQuery !== null ? periodOrQuery.period || '30d' : periodOrQuery || '30d';

  const [totalOrders, totalCarts, topProductsGroup, orderItemsInPeriod] = await prisma.$transaction([
    prisma.order.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.cart.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.orderItem.groupBy({
      by: ['productId', 'productName'],
      where: { order: { createdAt: { gte: start, lte: end } } },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 5,
    }),
    prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: start, lte: end } } },
      select: {
        quantity: true,
        total: true,
        product: { select: { category: { select: { id: true, name: true } } } },
      },
    }),
  ]);

  const conversionRate = totalCarts > 0 ? Number(((totalOrders / totalCarts) * 100).toFixed(1)) : 0;
  const cartAbandonment = Number((100 - conversionRate).toFixed(1));

  const categoryMap = new Map<string, { categoryId: string; categoryName: string; totalQuantity: number; totalRevenue: number }>();

  orderItemsInPeriod.forEach((item) => {
    if (item.product?.category) {
      const catId = item.product.category.id;
      const catName = item.product.category.name;
      const existing = categoryMap.get(catId) || { categoryId: catId, categoryName: catName, totalQuantity: 0, totalRevenue: 0 };
      existing.totalQuantity += item.quantity;
      existing.totalRevenue += Number(item.total);
      categoryMap.set(catId, existing);
    }
  });

  const topCategories = Array.from(categoryMap.values())
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5)
    .map((c) => ({ ...c, totalRevenue: Number(c.totalRevenue.toFixed(2)) }));

  return {
    conversionRate,
    cartAbandonment,
    topProducts: topProductsGroup.map((p) => ({
      productId: p.productId,
      productName: p.productName,
      totalQuantity: (p as any)._sum?.quantity ?? 0,
      totalRevenue: Number((p as any)._sum?.total ?? 0),
    })),
    topCategories,
    period,
  };
};
