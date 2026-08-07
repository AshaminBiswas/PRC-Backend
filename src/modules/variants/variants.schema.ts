import { z } from 'zod';

export const CreateVariantSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().optional().nullable(),
  price: z.number().nonnegative('Price must be a non-negative number'),
  salePrice: z.number().nonnegative('Sale price must be a non-negative number').optional().nullable(),
  stock: z.number().int().nonnegative('Stock must be a non-negative integer').optional().default(0),
  attributes: z.record(z.unknown()),
  image: z.string().optional().nullable(),
  isAvailable: z.boolean().optional().default(true),
});

export const UpdateVariantSchema = CreateVariantSchema.partial();

export const ProductIdParamSchema = z.object({
  productId: z.string().uuid('Invalid product ID format'),
});

export const VariantParamsSchema = z.object({
  productId: z.string().uuid('Invalid product ID format').optional(),
  id: z.string().uuid('Invalid variant ID format'),
});

export type CreateVariantInput = z.infer<typeof CreateVariantSchema>;
export type UpdateVariantInput = z.infer<typeof UpdateVariantSchema>;
