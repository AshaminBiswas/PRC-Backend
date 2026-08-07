import { z } from 'zod';

export const ListCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  parentId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export const CreateCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional(),
  parentId: z.string().uuid().optional(),
  image: z.string().url().optional(),
  icon: z.string().optional(),
  position: z.number().int().min(0).optional().default(0),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional().default('ACTIVE'),
  isVisible: z.boolean().optional().default(true),
  seo: z
    .object({
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
      metaKeywords: z.string().optional(),
    })
    .optional(),
});

export const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  parentId: z.string().uuid().nullable().optional(),
  image: z.string().url().nullable().optional(),
  icon: z.string().nullable().optional(),
  position: z.number().int().min(0).optional(),
  isVisible: z.boolean().optional(),
  seo: z
    .object({
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
      metaKeywords: z.string().optional(),
    })
    .optional(),
});

export const UpdateCategoryStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

export const ReorderCategoriesSchema = z.object({
  categories: z.array(
    z.object({
      id: z.string().uuid(),
      position: z.number().int().min(0),
      parentId: z.string().uuid().nullable().optional(),
    })
  ).min(1),
});

export const CategoryProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStock: z.coerce.boolean().optional(),
});

export const UuidParamSchema = z.object({
  id: z.string().uuid('Invalid category ID'),
});

export const SlugParamSchema = z.object({
  slug: z.string().min(1),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
