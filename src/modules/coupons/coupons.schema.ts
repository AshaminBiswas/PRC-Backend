import { z } from 'zod';

export const ListCouponsQuerySchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(20),
  search: z.string().optional(),
  isActive: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).optional(),
});

export const CreateCouponSchema = z.object({
  code: z.string().min(2, 'Code must be at least 2 characters').max(50).transform((s) => s.toUpperCase()),
  description: z.string().optional().nullable(),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
  discountValue: z.number().positive('Discount value must be positive'),
  minOrderAmount: z.number().nonnegative().optional().nullable(),
  maxDiscountAmount: z.number().nonnegative().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  perUserLimit: z.number().int().positive().optional().nullable().default(1),
  startDate: z.string().datetime({ offset: true }).or(z.string()).optional().nullable(),
  endDate: z.string().datetime({ offset: true }).or(z.string()).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const UpdateCouponSchema = z.object({
  code: z.string().min(2).max(50).transform((s) => s.toUpperCase()).optional(),
  description: z.string().optional().nullable(),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).optional(),
  discountValue: z.number().positive().optional(),
  minOrderAmount: z.number().nonnegative().optional().nullable(),
  maxDiscountAmount: z.number().nonnegative().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  perUserLimit: z.number().int().positive().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const ValidateCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required'),
  orderAmount: z.number().nonnegative('Order amount must be a non-negative number'),
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
