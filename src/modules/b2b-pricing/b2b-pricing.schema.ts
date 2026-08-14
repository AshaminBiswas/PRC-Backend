import { z } from 'zod';

export const SetCustomerProductPriceSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  price: z.number().positive('Price must be greater than zero'),
  minQuantity: z.number().int().min(1, 'Minimum quantity must be at least 1').optional().default(1),
  notes: z.string().max(255).optional(),
});

export const BulkSetCustomerPricesSchema = z.object({
  prices: z.array(
    z.object({
      productId: z.string().uuid('Invalid product ID'),
      price: z.number().positive('Price must be greater than zero'),
      minQuantity: z.number().int().min(1).optional().default(1),
      notes: z.string().max(255).optional(),
    })
  ).min(1, 'At least one price item is required'),
});

export const ApplyFlatDiscountSchema = z.object({
  discountPercent: z.number().min(0.01, 'Discount must be greater than 0%').max(99.99, 'Discount cannot exceed 99.99%'),
  categoryId: z.string().uuid().optional(),
  minQuantity: z.number().int().min(1).optional().default(1),
});

export const UuidParamSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

export const UserProductParamSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  productId: z.string().uuid('Invalid product ID'),
});

export type SetCustomerProductPriceInput = z.infer<typeof SetCustomerProductPriceSchema>;
export type BulkSetCustomerPricesInput = z.infer<typeof BulkSetCustomerPricesSchema>;
export type ApplyFlatDiscountInput = z.infer<typeof ApplyFlatDiscountSchema>;
