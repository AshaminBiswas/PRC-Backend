import { z } from 'zod';

export const BANNER_POSITIONS = [
  'HERO_SLIDER',
  'HOME_UPCOMING',
  'BESTSELLERS_TOP',
  'BESTSELLERS_MID',
  'NEW_ARRIVALS_TOP',
  'NEW_ARRIVALS_MID',
  'OFFERS_TOP',
  'OFFERS_SIDE',
  'SHOP_BY_AESTHETIC',
  'CUBICLE_COLLECTION',
  'LOCKER_COLLECTION',
  'ABOUT_HERO',
  'CONTACT_HERO',
  'FAQ_HERO',
  'HERO', // Legacy fallback
] as const;

export const BannerPositionEnum = z.enum(BANNER_POSITIONS);

export const CreateBannerSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  subtitle: z.string().optional().nullable(),
  badgeText: z.string().optional().nullable(),
  desktopImage: z.string().optional().nullable(),
  tabletImage: z.string().optional().nullable(),
  mobileImage: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  linkUrl: z.string().optional().nullable(),
  link: z.string().optional().nullable(),
  ctaText: z.string().optional().default('Explore Now'),
  position: z.string().default('HERO_SLIDER'),
  order: z.number().int().default(0),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().default(true),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

export const UpdateBannerSchema = CreateBannerSchema.partial();

export const ReorderBannersSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid('Invalid banner ID'),
      order: z.number().int(),
    })
  ).min(1, 'At least one item is required'),
});

export const ListBannersQuerySchema = z.object({
  position: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const UuidParamSchema = z.object({
  id: z.string().uuid('Invalid banner ID'),
});

export type CreateBannerInput = z.infer<typeof CreateBannerSchema>;
export type UpdateBannerInput = z.infer<typeof UpdateBannerSchema>;
export type ReorderBannersInput = z.infer<typeof ReorderBannersSchema>;
export type ListBannersQuery = z.infer<typeof ListBannersQuerySchema>;
