import { z } from 'zod';
import { VentureStatus } from '@prisma/client';

export const createVentureSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(20),
  type: z.string().optional().default('RETAIL'),
  address: z.string().optional(),
  gstin: z.string().max(15).optional(),
  pan: z.string().optional(),
  logo: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  currency: z.string().optional().default('INR'),
  timezone: z.string().optional().default('Asia/Kolkata'),
  financialYearStart: z.string().optional().default('04-01'),
  status: z.nativeEnum(VentureStatus).optional().default(VentureStatus.ACTIVE),
});

export const updateVentureSchema = createVentureSchema.partial();

export const addUserToVentureSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid().optional(),
  isDefault: z.boolean().optional().default(false),
});

export type CreateVentureInput = z.infer<typeof createVentureSchema>;
export type UpdateVentureInput = z.infer<typeof updateVentureSchema>;
export type AddUserToVentureInput = z.infer<typeof addUserToVentureSchema>;
