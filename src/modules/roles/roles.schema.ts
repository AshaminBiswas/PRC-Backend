import { z } from 'zod';

export const CreateRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required').max(50),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional().default([]),
});

export const UpdateRoleSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
});

export const UpdateRolePermissionsSchema = z.object({
  permissions: z.array(z.string()),
});

export const UuidParamSchema = z.object({
  id: z.string().uuid('Invalid ID'),
});

export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;
