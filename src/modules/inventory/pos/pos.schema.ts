import { z } from 'zod';
import { PosPaymentMethod, PosSaleStatus } from '@prisma/client';

export const createPosStoreSchema = z.object({
  warehouseId: z.string().uuid(),
  name: z.string().min(2),
  code: z.string().min(2).max(20),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  managerId: z.string().optional(),
  gstNumber: z.string().optional(),
});

export const createPosTerminalSchema = z.object({
  storeId: z.string().uuid(),
  name: z.string().min(2),
  code: z.string().min(2).max(20),
});

export const openPosSessionSchema = z.object({
  storeId: z.string().uuid(),
  terminalId: z.string().uuid(),
  openingBalance: z.number().min(0),
  notes: z.string().optional(),
});

export const closePosSessionSchema = z.object({
  actualCash: z.number().min(0),
  notes: z.string().optional(),
});

export const createPosSaleSchema = z.object({
  storeId: z.string().uuid(),
  terminalId: z.string().uuid(),
  sessionId: z.string().uuid(),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerGstin: z.string().optional(),
  channel: z.string().optional().default('WALK_IN'),
  items: z.array(
    z.object({
      inventoryProductId: z.string().uuid(),
      productName: z.string(),
      sku: z.string(),
      barcode: z.string().optional(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().positive(),
      mrp: z.number().optional(),
      discountPct: z.number().min(0).optional().default(0),
      discountAmt: z.number().min(0).optional().default(0),
      taxPct: z.number().min(0).optional().default(18),
    })
  ).min(1),
  paidAmount: z.number().positive(),
  paymentMethod: z.nativeEnum(PosPaymentMethod).optional().default(PosPaymentMethod.CASH),
  paymentReference: z.string().optional(),
  notes: z.string().optional(),
});

export const createPosReturnSchema = z.object({
  originalSaleId: z.string().uuid(),
  sessionId: z.string().uuid(),
  reason: z.string().min(2),
  refundMethod: z.string().optional().default('CASH'),
  refundAmount: z.number().positive(),
});

export type CreatePosStoreInput = z.infer<typeof createPosStoreSchema>;
export type CreatePosTerminalInput = z.infer<typeof createPosTerminalSchema>;
export type OpenPosSessionInput = z.infer<typeof openPosSessionSchema>;
export type ClosePosSessionInput = z.infer<typeof closePosSessionSchema>;
export type CreatePosSaleInput = z.infer<typeof createPosSaleSchema>;
export type CreatePosReturnInput = z.infer<typeof createPosReturnSchema>;
