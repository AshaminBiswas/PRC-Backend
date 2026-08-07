import { z } from 'zod';

export const CreateHomepageSectionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  subtitle: z.string().optional(),
  type: z.string().min(1, 'Type is required'),
  configuration: z.record(z.unknown()).optional(),
  position: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const UpdateHomepageSectionSchema = CreateHomepageSectionSchema.partial();

export const UuidParamSchema = z.object({
  id: z.string().uuid('Invalid section ID'),
});

export type CreateHomepageSectionInput = z.infer<typeof CreateHomepageSectionSchema>;
export type UpdateHomepageSectionInput = z.infer<typeof UpdateHomepageSectionSchema>;
