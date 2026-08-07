import { z } from 'zod';

export const AddCartItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID format'),
  variantId: z.string().uuid('Invalid variant ID format').optional().nullable(),
  quantity: z.number().int().positive('Quantity must be at least 1').optional().default(1),
});

export const UpdateCartItemSchema = z.object({
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
});

export const ApplyCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required'),
});

export const CartItemParamSchema = z.object({
  itemId: z.string().uuid('Invalid cart item ID format'),
});

export type AddCartItemInput = z.infer<typeof AddCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>;
export type ApplyCouponInput = z.infer<typeof ApplyCouponSchema>;
