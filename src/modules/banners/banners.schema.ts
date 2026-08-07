import { z } from 'zod';

export const CreateBannerSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  subtitle: z.string().optional(),
  image: z.string().min(1, 'Image URL/path is required'),
  link: z.string().optional(),
  position: z.string().default('HERO'),
  order: z.number().int().default(0),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().default(true),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
});

export const UpdateBannerSchema = CreateBannerSchema.partial();

export const ListBannersQuerySchema = z.object({
  position: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const UuidParamSchema = z.object({
  id: z.string().uuid('Invalid banner ID'),
});

export type CreateBannerInput = z.infer<typeof CreateBannerSchema>;
export type UpdateBannerInput = z.infer<typeof UpdateBannerSchema>;
export type ListBannersQuery = z.infer<typeof ListBannersQuerySchema>;
