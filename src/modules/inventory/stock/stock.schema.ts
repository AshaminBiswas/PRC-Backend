import { z } from 'zod';
import { StockMovementType } from '@prisma/client';

export const updateStockSchema = z.object({
  inventoryProductId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  quantity: z.number().int(), // new exact quantity or delta depending on op
  reason: z.string().optional(),
  notes: z.string().optional(),
});

export const adjustStockSchema = z.object({
  inventoryProductId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  qtyChanged: z.number().int(), // positive or negative
  movementType: z.nativeEnum(StockMovementType).optional().default(StockMovementType.ADJUSTMENT),
  reason: z.string().min(2),
  notes: z.string().optional(),
});

export const reconcileStockSchema = z.object({
  inventoryProductId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  physicalCount: z.number().int().min(0),
  reason: z.string().optional().default('Stock Reconciliation'),
  notes: z.string().optional(),
});

export type UpdateStockInput = z.infer<typeof updateStockSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type ReconcileStockInput = z.infer<typeof reconcileStockSchema>;
