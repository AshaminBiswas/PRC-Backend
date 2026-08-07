import { z } from 'zod';
import { PurchaseOrderStatus } from '@prisma/client';

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      inventoryProductId: z.string().uuid(),
      orderedQty: z.number().int().positive(),
      unitPrice: z.number().positive(),
      taxRate: z.number().min(0).optional().default(18),
    })
  ).min(1),
});

export const receivePurchaseOrderSchema = z.object({
  notes: z.string().optional(),
  items: z.array(
    z.object({
      purchaseOrderItemId: z.string().uuid(),
      inventoryProductId: z.string().uuid(),
      receivedQty: z.number().int().positive(),
      acceptedQty: z.number().int().min(0),
      rejectedQty: z.number().int().min(0).optional().default(0),
    })
  ).min(1),
});

export const createPurchasePaymentSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  supplierId: z.string().uuid(),
  amount: z.number().positive(),
  paymentMethod: z.string().optional().default('BANK_TRANSFER'),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>;
export type CreatePurchasePaymentInput = z.infer<typeof createPurchasePaymentSchema>;
