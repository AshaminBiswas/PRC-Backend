import { z } from 'zod';
import { TransferType, TransferStatus } from '@prisma/client';

export const createStockTransferSchema = z.object({
  fromWarehouseId: z.string().uuid(),
  toWarehouseId: z.string().uuid(),
  fromVentureId: z.string().uuid().optional(),
  toVentureId: z.string().uuid().optional(),
  transferType: z.nativeEnum(TransferType).optional().default(TransferType.WAREHOUSE_TO_WAREHOUSE),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      inventoryProductId: z.string().uuid(),
      requestedQty: z.number().int().positive(),
      notes: z.string().optional(),
    })
  ).min(1),
});

export const updateStockTransferStatusSchema = z.object({
  status: z.nativeEnum(TransferStatus),
  notes: z.string().optional(),
});

export type CreateStockTransferInput = z.infer<typeof createStockTransferSchema>;
export type UpdateStockTransferStatusInput = z.infer<typeof updateStockTransferStatusSchema>;
