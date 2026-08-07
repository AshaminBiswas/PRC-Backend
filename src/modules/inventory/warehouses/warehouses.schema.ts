import { z } from 'zod';
import { WarehouseStatus } from '@prisma/client';

export const createWarehouseSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(20),
  type: z.string().optional().default('MAIN'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  managerId: z.string().optional(),
  contactPhone: z.string().optional(),
  isDefault: z.boolean().optional().default(false),
  status: z.nativeEnum(WarehouseStatus).optional().default(WarehouseStatus.ACTIVE),
});

export const updateWarehouseSchema = createWarehouseSchema.partial();

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
