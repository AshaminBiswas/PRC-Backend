import { z } from 'zod';

export const UpdateSettingItemSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  value: z.unknown(),
  group: z.string().optional(),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});

export const UpdateSettingsSchema = z.union([
  z.record(z.string(), z.unknown()),
  z.array(UpdateSettingItemSchema),
]);

export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;
export type UpdateSettingItem = z.infer<typeof UpdateSettingItemSchema>;
