import { z } from 'zod';

export const ListProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT']).optional(),
  inStock: z.coerce.boolean().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  isFeatured: z.coerce.boolean().optional(),
  isBestseller: z.coerce.boolean().optional(),
  isInOffer: z.coerce.boolean().optional(),
  isNewArrival: z.coerce.boolean().optional(),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const CreateProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200),
  description: z.string().optional(),
  shortDesc: z.string().optional(),
  sku: z.string().min(1, 'SKU is required'),
  price: z.number().min(0, 'Price must be positive'),
  salePrice: z.number().min(0).optional(),
  thumbnail: z.string().url().optional(),
  images: z.array(z.string().url()).optional(),
  categoryId: z.string().uuid().optional(),
  stock: z.number().int().min(0).optional(),
  reorderLevel: z.number().int().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT']).optional(),
  isVisible: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isBestseller: z.boolean().optional(),
  isInOffer: z.boolean().optional(),
  isNewArrival: z.boolean().optional(),
  compatibleFor: z.array(z.string()).optional(),
  warranty: z.string().optional(),
  weight: z.number().min(0).optional(),
  dimensions: z
    .object({
      length: z.number().min(0),
      width: z.number().min(0),
      height: z.number().min(0),
      unit: z.string().default('cm'),
    })
    .optional(),
  attributes: z.record(z.unknown()).optional(),
  specification: z.record(z.unknown()).optional(),
  productSpecification: z.record(z.unknown()).optional(),
  manufacturerInfo: z.record(z.unknown()).optional(),
  colours: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  seo: z
    .object({
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
      metaKeywords: z.string().optional(),
    })
    .optional(),
});

export const UpdateProductSchema = CreateProductSchema.partial();

export const UuidParamSchema = z.object({
  id: z.string().uuid('Invalid product ID'),
});

export const SlugParamSchema = z.object({
  slug: z.string().min(1),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
