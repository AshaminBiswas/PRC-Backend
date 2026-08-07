import { z } from 'zod';
import { SupplierStatus } from '@prisma/client';

export const createSupplierSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(20),
  contactPerson: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  gstin: z.string().max(15).optional(),
  pan: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankIfsc: z.string().optional(),
  creditDays: z.number().int().min(0).optional().default(30),
  creditLimit: z.number().positive().optional(),
  status: z.nativeEnum(SupplierStatus).optional().default(SupplierStatus.ACTIVE),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
