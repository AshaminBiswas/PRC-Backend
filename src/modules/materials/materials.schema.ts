import { z } from 'zod';

export const CreateMaterialSchema = z.object({
  name: z.string().min(1, 'Material name is required').max(100),
  slug: z.string().min(1, 'Slug is required').max(120).optional(),
  shortName: z.string().max(50).optional().nullable(),
  gradeBadge: z.string().max(50).optional().nullable(),
  description: z.string().optional().nullable(),
  tagline: z.string().optional().nullable(),
  specs: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  position: z.coerce.number().int().default(0),
});

export const UpdateMaterialSchema = CreateMaterialSchema.partial();

export const ListMaterialsQuerySchema = z.object({
  active: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type CreateMaterialInput = z.infer<typeof CreateMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof UpdateMaterialSchema>;
export type ListMaterialsQuery = z.infer<typeof ListMaterialsQuerySchema>;
