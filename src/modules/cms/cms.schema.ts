import { z } from 'zod';
import { ContentStatus } from '@prisma/client';

// ─── Pages Schemas ─────────────────────────────────────────────────────────────

export const CreateCmsPageSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  slug: z.string().optional(),
  content: z.string().min(1, 'Content is required'),
  status: z.nativeEnum(ContentStatus).default(ContentStatus.DRAFT),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  metaKeywords: z.string().optional(),
});

export const UpdateCmsPageSchema = CreateCmsPageSchema.partial();

export const ListCmsPagesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(ContentStatus).optional(),
  search: z.string().optional(),
});

// ─── Blog Schemas ──────────────────────────────────────────────────────────────

export const CreateBlogPostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  slug: z.string().optional(),
  content: z.string().min(1, 'Content is required'),
  excerpt: z.string().optional(),
  thumbnail: z.string().url().optional().or(z.literal('')),
  category: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  status: z.nativeEnum(ContentStatus).default(ContentStatus.DRAFT),
  publishedAt: z.string().datetime().optional().nullable(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  metaKeywords: z.string().optional(),
});

export const UpdateBlogPostSchema = CreateBlogPostSchema.partial();

export const ListBlogPostsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(ContentStatus).optional(),
  category: z.string().optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
});

// ─── FAQ Category Schemas ─────────────────────────────────────────────────────

export const CreateFaqCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string().optional(),
  description: z.string().optional(),
  position: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const UpdateFaqCategorySchema = CreateFaqCategorySchema.partial();

// ─── FAQ Schemas ──────────────────────────────────────────────────────────────

export const CreateFaqSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
  question: z.string().min(1, 'Question is required'),
  answer: z.string().min(1, 'Answer is required'),
  position: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const UpdateFaqSchema = CreateFaqSchema.partial();

export const ListFaqsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

// ─── Shared Params ─────────────────────────────────────────────────────────────

export const UuidParamSchema = z.object({
  id: z.string().uuid('Invalid ID'),
});

export const SlugParamSchema = z.object({
  slug: z.string().min(1),
});

export type CreateCmsPageInput = z.infer<typeof CreateCmsPageSchema>;
export type UpdateCmsPageInput = z.infer<typeof UpdateCmsPageSchema>;
export type ListCmsPagesQuery = z.infer<typeof ListCmsPagesQuerySchema>;

export type CreateBlogPostInput = z.infer<typeof CreateBlogPostSchema>;
export type UpdateBlogPostInput = z.infer<typeof UpdateBlogPostSchema>;
export type ListBlogPostsQuery = z.infer<typeof ListBlogPostsQuerySchema>;

export type CreateFaqCategoryInput = z.infer<typeof CreateFaqCategorySchema>;
export type UpdateFaqCategoryInput = z.infer<typeof UpdateFaqCategorySchema>;

export type CreateFaqInput = z.infer<typeof CreateFaqSchema>;
export type UpdateFaqInput = z.infer<typeof UpdateFaqSchema>;
export type ListFaqsQuery = z.infer<typeof ListFaqsQuerySchema>;
