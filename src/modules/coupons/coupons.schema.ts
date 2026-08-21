import { z } from 'zod';

export const ListCouponsQuerySchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(20),
  search: z.string().optional(),
  status: z.enum(['ALL', 'ACTIVE', 'INACTIVE', 'EXPIRED']).optional(),
  isActive: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const CreateCouponSchema = z.object({
  code: z.string().min(2, 'Code must be at least 2 characters').max(50).transform((s) => s.toUpperCase().trim()),
  description: z.string().optional().nullable(),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
  discountValue: z.number().positive('Discount value must be positive'),
  minOrderAmount: z.number().nonnegative().optional().nullable(),
  maxDiscountAmount: z.number().nonnegative().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  perUserLimit: z.number().int().positive().optional().nullable().default(1),
  applicableProductIds: z.array(z.string()).optional().default([]),
  applicableCategoryIds: z.array(z.string()).optional().default([]),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const UpdateCouponSchema = z.object({
  code: z.string().min(2).max(50).transform((s) => s.toUpperCase().trim()).optional(),
  description: z.string().optional().nullable(),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).optional(),
  discountValue: z.number().positive().optional(),
  minOrderAmount: z.number().nonnegative().optional().nullable(),
  maxDiscountAmount: z.number().nonnegative().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  perUserLimit: z.number().int().positive().optional().nullable(),
  applicableProductIds: z.array(z.string()).optional(),
  applicableCategoryIds: z.array(z.string()).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const ValidateCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required'),
  orderAmount: z.number().nonnegative('Order amount must be a non-negative number'),
  items: z
    .array(
      z.object({
        productId: z.string(),
        categoryId: z.string().optional().nullable(),
        price: z.number().nonnegative(),
        quantity: z.number().int().positive(),
      })
    )
    .optional(),
});

export const CouponIdParamSchema = z.object({
  id: z.string().uuid('Invalid coupon ID format'),
});

export const CouponCodeParamSchema = z.object({
  code: z.string().min(1, 'Coupon code is required'),
});

export type CreateCouponInput = z.infer<typeof CreateCouponSchema>;
export type UpdateCouponInput = z.infer<typeof UpdateCouponSchema>;
export type ValidateCouponInput = z.infer<typeof ValidateCouponSchema>;
