import { z } from 'zod';
import { DispatchStatus } from '@prisma/client';

export const createDispatchSchema = z.object({
  orderId: z.string().uuid().optional(),
  posSaleId: z.string().uuid().optional(),
  warehouseId: z.string().uuid(),
  courierName: z.string().optional(),
  courierCode: z.string().optional(),
  trackingNumber: z.string().optional(),
  vehicleNumber: z.string().optional(),
  vehicleType: z.string().optional(),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      inventoryProductId: z.string().uuid(),
      orderedQty: z.number().int().positive(),
      dispatchedQty: z.number().int().positive(),
    })
  ).min(1),
});

export const updateDispatchStatusSchema = z.object({
  status: z.nativeEnum(DispatchStatus),
  courierName: z.string().optional(),
  trackingNumber: z.string().optional(),
  vehicleNumber: z.string().optional(),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateDispatchInput = z.infer<typeof createDispatchSchema>;
export type UpdateDispatchStatusInput = z.infer<typeof updateDispatchStatusSchema>;
