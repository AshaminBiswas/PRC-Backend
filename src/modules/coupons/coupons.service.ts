import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { buildPagination, getPaginationParams } from '../../utils/response';
import type { CreateCouponInput, UpdateCouponInput, ValidateCouponInput } from './coupons.schema';
import type { Prisma } from '@prisma/client';

const couponSelect = {
  id: true,
  code: true,
  description: true,
  discountType: true,
  discountValue: true,
  minOrderAmount: true,
  maxDiscountAmount: true,
  usageLimit: true,
  usedCount: true,
  perUserLimit: true,
  applicableProductIds: true,
  applicableCategoryIds: true,
  startDate: true,
  endDate: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const formatCoupon = <T extends {
  id: string;
  discountValue: Prisma.Decimal;
  minOrderAmount: Prisma.Decimal | null;
  maxDiscountAmount: Prisma.Decimal | null;
  endDate: Date | null;
  isActive: boolean;
}>(c: T) => {
  const now = new Date();
  const isExpired = c.endDate ? new Date(c.endDate) < now : false;
  return {
    ...c,
    discountValue: Number(c.discountValue),
    minOrderAmount: c.minOrderAmount !== null ? Number(c.minOrderAmount) : null,
    maxDiscountAmount: c.maxDiscountAmount !== null ? Number(c.maxDiscountAmount) : null,
    isExpired,
    computedStatus: !c.isActive ? 'INACTIVE' : isExpired ? 'EXPIRED' : 'ACTIVE',
  };
};

export const listCoupons = async (query: {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'ALL' | 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  isActive?: boolean | string;
  discountType?: 'PERCENTAGE' | 'FIXED_AMOUNT';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) => {
  const { page, limit, skip } = getPaginationParams(query);
  const now = new Date();

  const where: Prisma.CouponWhereInput = {};

  if (query.search) {
    where.OR = [
      { code: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  // Filter by dynamic or explicit status
  if (query.status) {
    if (query.status === 'ACTIVE') {
      where.isActive = true;
      where.AND = [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ];
    } else if (query.status === 'INACTIVE') {
      where.isActive = false;
    } else if (query.status === 'EXPIRED') {
      where.endDate = { lt: now };
    }
  } else if (query.isActive !== undefined) {
    const activeBool = String(query.isActive) === 'true';
    where.isActive = activeBool;
  }

  if (query.discountType) {
    where.discountType = query.discountType;
  }

  const orderByField = query.sortBy || 'createdAt';
  const orderDirection = query.sortOrder || 'desc';

  const [coupons, totalItems] = await prisma.$transaction([
    prisma.coupon.findMany({
      where,
      select: couponSelect,
      orderBy: { [orderByField]: orderDirection },
      skip,
      take: limit,
    }),
    prisma.coupon.count({ where }),
  ]);

  return {
    data: coupons.map(formatCoupon),
    pagination: buildPagination(page, limit, totalItems),
  };
};

export const getCouponStats = async () => {
  const now = new Date();

  const [totalCoupons, activeCoupons, expiredCoupons, totalUsagesCount, rawUsages] =
    await prisma.$transaction([
      prisma.coupon.count(),
      prisma.coupon.count({
        where: {
          isActive: true,
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
      }),
      prisma.coupon.count({
        where: {
          endDate: { lt: now },
        },
      }),
      prisma.couponUsage.count(),
      prisma.coupon.aggregate({
        _sum: {
          usedCount: true,
        },
      }),
    ]);

  const totalRedemptions = Math.max(totalUsagesCount, rawUsages._sum.usedCount || 0);

  return {
    totalCoupons,
    activeCoupons,
    expiredCoupons,
    inactiveCoupons: Math.max(0, totalCoupons - activeCoupons),
    totalRedemptions,
  };
};

export const getCouponUsages = async (couponId: string) => {
  const coupon = await prisma.coupon.findUnique({
    where: { id: couponId },
    select: { id: true, code: true, description: true, discountType: true, discountValue: true },
  });

  if (!coupon) {
    throw new AppError('NOT_FOUND', 'Coupon not found', 404);
  }

  const usages = await prisma.couponUsage.findMany({
    where: { couponId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          companyName: true,
          phone: true,
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          grandTotal: true,
          discountTotal: true,
          createdAt: true,
        },
      },
    },
    orderBy: { usedAt: 'desc' },
    take: 100,
  });

  return {
    coupon,
    usages: usages.map((u: any) => ({
      id: u.id,
      usedAt: u.usedAt,
      user: u.user,
      order: u.order
        ? {
            id: u.order.id,
            orderNumber: u.order.orderNumber,
            grandTotal: Number(u.order.grandTotal),
            discountAmount: u.order.discountTotal ? Number(u.order.discountTotal) : null,
            createdAt: u.order.createdAt,
          }
        : null,
    })),
  };
};

export const createCoupon = async (input: CreateCouponInput) => {
  const codeUpper = input.code.toUpperCase().trim();

  const existing = await prisma.coupon.findUnique({
    where: { code: codeUpper },
  });
  if (existing) {
    throw new AppError('CONFLICT', `A coupon with code "${codeUpper}" already exists`, 409);
  }

  const coupon = await prisma.coupon.create({
    data: {
      code: codeUpper,
      description: input.description,
      discountType: input.discountType,
      discountValue: input.discountValue,
      minOrderAmount: input.minOrderAmount,
      maxDiscountAmount: input.maxDiscountAmount,
      usageLimit: input.usageLimit,
      perUserLimit: input.perUserLimit ?? 1,
      applicableProductIds: input.applicableProductIds || [],
      applicableCategoryIds: input.applicableCategoryIds || [],
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      isActive: input.isActive ?? true,
    },
    select: couponSelect,
  });

  return formatCoupon(coupon);
};

export const getCouponByCodeOrId = async (identifier: string) => {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

  const coupon = await prisma.coupon.findFirst({
    where: isUuid
      ? { OR: [{ id: identifier }, { code: identifier.toUpperCase().trim() }] }
      : { code: identifier.toUpperCase().trim() },
    select: couponSelect,
  });

  if (!coupon) {
    throw new AppError('NOT_FOUND', 'Coupon not found', 404);
  }

  return formatCoupon(coupon);
};

export const updateCoupon = async (id: string, input: UpdateCouponInput) => {
  const coupon = await prisma.coupon.findUnique({
    where: { id },
  });
  if (!coupon) {
    throw new AppError('NOT_FOUND', 'Coupon not found', 404);
  }

  if (input.code && input.code.toUpperCase().trim() !== coupon.code) {
    const existing = await prisma.coupon.findUnique({
      where: { code: input.code.toUpperCase().trim() },
    });
    if (existing) {
      throw new AppError('CONFLICT', `A coupon with code "${input.code.toUpperCase().trim()}" already exists`, 409);
    }
  }

  const updateData: Prisma.CouponUpdateInput = {};

  if (input.code !== undefined) updateData.code = input.code.toUpperCase().trim();
  if (input.description !== undefined) updateData.description = input.description;
  if (input.discountType !== undefined) updateData.discountType = input.discountType;
  if (input.discountValue !== undefined) updateData.discountValue = input.discountValue;
  if (input.minOrderAmount !== undefined) updateData.minOrderAmount = input.minOrderAmount;
  if (input.maxDiscountAmount !== undefined) updateData.maxDiscountAmount = input.maxDiscountAmount;
  if (input.usageLimit !== undefined) updateData.usageLimit = input.usageLimit;
  if (input.perUserLimit !== undefined) updateData.perUserLimit = input.perUserLimit;
  if (input.applicableProductIds !== undefined) updateData.applicableProductIds = input.applicableProductIds;
  if (input.applicableCategoryIds !== undefined) updateData.applicableCategoryIds = input.applicableCategoryIds;
  if (input.startDate !== undefined) updateData.startDate = input.startDate ? new Date(input.startDate) : null;
  if (input.endDate !== undefined) updateData.endDate = input.endDate ? new Date(input.endDate) : null;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  const updated = await prisma.coupon.update({
    where: { id },
    data: updateData,
    select: couponSelect,
  });

  return formatCoupon(updated);
};

export const toggleCouponStatus = async (id: string) => {
  const coupon = await prisma.coupon.findUnique({
    where: { id },
    select: { id: true, isActive: true },
  });

  if (!coupon) {
    throw new AppError('NOT_FOUND', 'Coupon not found', 404);
  }

  const updated = await prisma.coupon.update({
    where: { id },
    data: { isActive: !coupon.isActive },
    select: couponSelect,
  });

  return formatCoupon(updated);
};

export const deleteCoupon = async (id: string) => {
  const coupon = await prisma.coupon.findUnique({
    where: { id },
  });
  if (!coupon) {
    throw new AppError('NOT_FOUND', 'Coupon not found', 404);
  }

  await prisma.coupon.delete({
    where: { id },
  });
};

export const validateCoupon = async (
  userId: string | undefined,
  codeOrInput: string | ValidateCouponInput,
  maybeOrderAmount?: number,
  maybeItems?: Array<{ productId: string; categoryId?: string | null; price: number; quantity: number }>
) => {
  let code: string;
  let orderAmount: number;
  let items: Array<{ productId: string; categoryId?: string | null; price: number; quantity: number }> | undefined;

  if (typeof codeOrInput === 'object') {
    code = codeOrInput.code;
    orderAmount = codeOrInput.orderAmount;
    items = codeOrInput.items as any;
  } else {
    code = codeOrInput;
    orderAmount = Number(maybeOrderAmount || 0);
    items = maybeItems;
  }

  const codeUpper = (code || '').toUpperCase().trim();

  const coupon = await prisma.coupon.findUnique({
    where: { code: codeUpper },
    select: couponSelect,
  });

  if (!coupon || !coupon.isActive) {
    throw new AppError('BAD_REQUEST', 'Invalid or inactive coupon code', 400);
  }

  const now = new Date();
  if (coupon.startDate && now < new Date(coupon.startDate)) {
    throw new AppError('BAD_REQUEST', 'Coupon promotion has not started yet', 400);
  }

  if (coupon.endDate && now > new Date(coupon.endDate)) {
    throw new AppError('BAD_REQUEST', 'Coupon promotion has expired', 400);
  }

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw new AppError('BAD_REQUEST', 'Coupon global usage limit has been reached', 400);
  }

  if (userId && coupon.perUserLimit !== null) {
    const userUsageCount = await prisma.couponUsage.count({
      where: { couponId: coupon.id, userId },
    });
    if (userUsageCount >= coupon.perUserLimit) {
      throw new AppError(
        'BAD_REQUEST',
        `You have reached the maximum limit (${coupon.perUserLimit} use) for this coupon`,
        400
      );
    }
  }

  // ── Selective Product / Category Offer Check ────────────────────────────────
  const hasProductFilter = (coupon.applicableProductIds || []).length > 0;
  const hasCategoryFilter = (coupon.applicableCategoryIds || []).length > 0;
  let eligibleSubtotal = orderAmount;

  if (hasProductFilter || hasCategoryFilter) {
    if (items && items.length > 0) {
      const eligibleItems = items.filter((item) => {
        const matchesProduct = hasProductFilter && coupon.applicableProductIds.includes(item.productId);
        const matchesCategory =
          hasCategoryFilter && item.categoryId && coupon.applicableCategoryIds.includes(item.categoryId);
        return matchesProduct || matchesCategory;
      });

      if (eligibleItems.length === 0) {
        throw new AppError(
          'BAD_REQUEST',
          'This offer is only valid for selected hardware items or categories in your cart',
          400
        );
      }

      eligibleSubtotal = eligibleItems.reduce(
        (sum, item) => sum + Number(item.price) * Number(item.quantity),
        0
      );
    }
  }

  if (coupon.minOrderAmount !== null && eligibleSubtotal < Number(coupon.minOrderAmount)) {
    throw new AppError(
      'BAD_REQUEST',
      `Minimum eligible order amount of ₹${Number(coupon.minOrderAmount).toLocaleString('en-IN')} is required for this offer`,
      400
    );
  }

  let discount = 0;
  if (coupon.discountType === 'PERCENTAGE') {
    discount = (eligibleSubtotal * Number(coupon.discountValue)) / 100;
    if (coupon.maxDiscountAmount !== null) {
      discount = Math.min(discount, Number(coupon.maxDiscountAmount));
    }
  } else {
    discount = Math.min(Number(coupon.discountValue), eligibleSubtotal);
  }

  discount = Math.round(discount * 100) / 100;
  const finalAmount = Math.max(0, Math.round((orderAmount - discount) * 100) / 100);

  return {
    valid: true,
    coupon: formatCoupon(coupon),
    discountAmount: discount,
    finalAmount,
    eligibleSubtotal,
    isSelectiveOffer: hasProductFilter || hasCategoryFilter,
  };
};

export const getPublicCoupons = async () => {
  try {
    const now = new Date();
    const coupons = await prisma.coupon.findMany({
      where: {
        isActive: true,
        OR: [{ startDate: null }, { startDate: { lte: now } }],
        AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
      },
      select: couponSelect,
      orderBy: { createdAt: 'desc' },
    });
    return coupons.map(formatCoupon);
  } catch (err) {
    console.warn('[Coupons Service] Failed to load public coupons:', err);
    return [];
  }
};
