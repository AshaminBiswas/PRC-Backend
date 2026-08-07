import { z } from 'zod';

export const SearchProductsQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  categoryId: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  brand: z.string().optional(),
  availability: z.enum(['in_stock', 'all']).optional(),
  inStock: z.coerce.boolean().optional(),
  sortBy: z
    .enum(['price_asc', 'price_desc', 'newest', 'rating', 'name_asc', 'name_desc', 'relevance'])
    .default('relevance'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const SearchSuggestionsQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export type SearchProductsQuery = z.infer<typeof SearchProductsQuerySchema>;
export type SearchSuggestionsQuery = z.infer<typeof SearchSuggestionsQuerySchema>;
