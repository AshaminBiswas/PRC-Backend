import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { buildPagination, getPaginationParams } from '../../utils/response';
import type { CreateCouponInput, UpdateCouponInput } from './coupons.schema';
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
}>(c: T) => ({
  ...c,
  discountValue: Number(c.discountValue),
  minOrderAmount: c.minOrderAmount !== null ? Number(c.minOrderAmount) : null,
  maxDiscountAmount: c.maxDiscountAmount !== null ? Number(c.maxDiscountAmount) : null,
});

export const listCoupons = async (query: {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean | string;
  discountType?: 'PERCENTAGE' | 'FIXED_AMOUNT';
}) => {
  const { page, limit, skip } = getPaginationParams(query);

  const where: Prisma.CouponWhereInput = {};

  if (query.search) {
    where.OR = [
      { code: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.isActive !== undefined) {
    const activeBool = String(query.isActive) === 'true';
    where.isActive = activeBool;
  }

  if (query.discountType) {
    where.discountType = query.discountType;
  }

  const [coupons, totalItems] = await prisma.$transaction([
    prisma.coupon.findMany({
      where,
      select: couponSelect,
      orderBy: { createdAt: 'desc' },
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

export const createCoupon = async (input: CreateCouponInput) => {
  const codeUpper = input.code.toUpperCase();

  const existing = await prisma.coupon.findUnique({
    where: { code: codeUpper },
  });
  if (existing) {
    throw new AppError('CONFLICT', 'A coupon with this code already exists', 409);
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
      ? { OR: [{ id: identifier }, { code: identifier.toUpperCase() }] }
      : { code: identifier.toUpperCase() },
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

  if (input.code && input.code.toUpperCase() !== coupon.code) {
    const existing = await prisma.coupon.findUnique({
      where: { code: input.code.toUpperCase() },
    });
    if (existing) {
      throw new AppError('CONFLICT', 'A coupon with this code already exists', 409);
    }
  }

  const updateData: Prisma.CouponUpdateInput = {};

  if (input.code !== undefined) updateData.code = input.code.toUpperCase();
  if (input.description !== undefined) updateData.description = input.description;
  if (input.discountType !== undefined) updateData.discountType = input.discountType;
  if (input.discountValue !== undefined) updateData.discountValue = input.discountValue;
  if (input.minOrderAmount !== undefined) updateData.minOrderAmount = input.minOrderAmount;
  if (input.maxDiscountAmount !== undefined) updateData.maxDiscountAmount = input.maxDiscountAmount;
  if (input.usageLimit !== undefined) updateData.usageLimit = input.usageLimit;
  if (input.perUserLimit !== undefined) updateData.perUserLimit = input.perUserLimit;
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
  code: string,
  orderAmount: number
) => {
  const codeUpper = code.toUpperCase();
  const coupon = await prisma.coupon.findUnique({
    where: { code: codeUpper },
    select: couponSelect,
  });

  if (!coupon || !coupon.isActive) {
    throw new AppError('BAD_REQUEST', 'Invalid or inactive coupon code', 400);
  }

  const now = new Date();
  if (coupon.startDate && now < new Date(coupon.startDate)) {
    throw new AppError('BAD_REQUEST', 'Coupon is not active yet', 400);
  }

  if (coupon.endDate && now > new Date(coupon.endDate)) {
    throw new AppError('BAD_REQUEST', 'Coupon has expired', 400);
  }

  if (coupon.minOrderAmount !== null && orderAmount < Number(coupon.minOrderAmount)) {
    throw new AppError(
      'BAD_REQUEST',
      `Minimum order amount of ₹${Number(coupon.minOrderAmount)} is required for this coupon`,
      400
    );
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
        'You have reached the maximum allowed usage limit for this coupon',
        400
      );
    }
  }

  let discount = 0;
  if (coupon.discountType === 'PERCENTAGE') {
    discount = (orderAmount * Number(coupon.discountValue)) / 100;
    if (coupon.maxDiscountAmount !== null) {
      discount = Math.min(discount, Number(coupon.maxDiscountAmount));
    }
  } else {
    discount = Math.min(Number(coupon.discountValue), orderAmount);
  }

  discount = Number(discount.toFixed(2));
  const finalAmount = Number(Math.max(0, orderAmount - discount).toFixed(2));

  return {
    valid: true,
    coupon: formatCoupon(coupon),
    discountAmount: discount,
    finalAmount,
  };
};

export const getPublicCoupons = async () => {
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
};
