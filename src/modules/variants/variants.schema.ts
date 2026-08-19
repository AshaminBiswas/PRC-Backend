import { z } from 'zod';

export const ListVariantsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  productId: z.string().uuid('Invalid product ID format').optional(),
  inStock: z.enum(['true', 'false']).optional(),
  isAvailable: z.enum(['true', 'false']).optional(),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const CreateVariantSchema = z.object({
  productId: z.string().uuid('Invalid product ID format').optional(),
  sku: z.string().min(1, 'SKU is required').max(100),
  name: z.string().max(200).optional().nullable(),
  price: z.number().nonnegative('Price must be a non-negative number'),
  salePrice: z.number().nonnegative('Sale price must be a non-negative number').optional().nullable(),
  offerPrice: z.number().nonnegative('Offer price must be a non-negative number').optional().nullable(),
  stock: z.number().int().nonnegative('Stock must be a non-negative integer').optional().default(0),
  attributes: z.record(z.unknown()).default({}),
  image: z.string().optional().nullable(),
  isAvailable: z.boolean().optional().default(true),
});

export const UpdateVariantSchema = z.object({
  productId: z.string().uuid('Invalid product ID format').optional(),
  sku: z.string().min(1).max(100).optional(),
  name: z.string().max(200).optional().nullable(),
  price: z.number().nonnegative('Price must be a non-negative number').optional(),
  salePrice: z.number().nonnegative('Sale price must be a non-negative number').optional().nullable(),
  offerPrice: z.number().nonnegative('Offer price must be a non-negative number').optional().nullable(),
  stock: z.number().int().nonnegative('Stock must be a non-negative integer').optional(),
  attributes: z.record(z.unknown()).optional(),
  image: z.string().optional().nullable(),
  isAvailable: z.boolean().optional(),
});

export const ProductIdParamSchema = z.object({
  productId: z.string().uuid('Invalid product ID format').optional(),
});

export const VariantParamsSchema = z.object({
  productId: z.string().uuid('Invalid product ID format').optional(),
  id: z.string().uuid('Invalid variant ID format'),
});

export type ListVariantsQuery = z.infer<typeof ListVariantsQuerySchema>;
export type CreateVariantInput = z.infer<typeof CreateVariantSchema>;
export type UpdateVariantInput = z.infer<typeof UpdateVariantSchema>;
