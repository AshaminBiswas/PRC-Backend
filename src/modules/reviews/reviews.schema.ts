import { z } from 'zod';
import { ReviewStatus } from '@prisma/client';

export const CreateReviewSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  rating: z.number().int().min(1, 'Rating must be between 1 and 5').max(5, 'Rating must be between 1 and 5'),
  title: z.string().max(200).optional(),
  comment: z.string().optional(),
});

export const UpdateReviewStatusSchema = z.object({
  status: z.nativeEnum(ReviewStatus, {
    errorMap: () => ({ message: 'Status must be PENDING, APPROVED, or REJECTED' }),
  }),
});

export const ListReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(ReviewStatus).optional(),
  productId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
});

export const ProductReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const UuidParamSchema = z.object({
  id: z.string().uuid('Invalid review ID'),
});

export const ProductIdParamSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
});

export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;
export type UpdateReviewStatusInput = z.infer<typeof UpdateReviewStatusSchema>;
export type ListReviewsQuery = z.infer<typeof ListReviewsQuerySchema>;
export type ProductReviewsQuery = z.infer<typeof ProductReviewsQuerySchema>;
