import { z } from 'zod';
import { InventoryProductStatus } from '@prisma/client';

export const createInventoryProductSchema = z.object({
  productId: z.string().uuid(),
  sku: z.string().min(2),
  barcode: z.string().optional(),
  qrCode: z.string().optional(),
  hsnCode: z.string().optional(),
  gstRate: z.number().optional().default(18.0),
  purchasePrice: z.number().positive(),
  sellingPrice: z.number().positive(),
  mrp: z.number().positive().optional(),
  initialStock: z.number().min(0).optional().default(0),
  warehouseId: z.string().uuid().optional(),
  minStock: z.number().min(0).optional().default(5),
  maxStock: z.number().min(1).optional().default(500),
  reorderLevel: z.number().min(0).optional().default(10),
  reorderQty: z.number().min(1).optional().default(20),
  leadTimeDays: z.number().min(0).optional().default(7),
  shelfLifeDays: z.number().optional(),
  rack: z.string().optional(),
  shelf: z.string().optional(),
  bin: z.string().optional(),
  brand: z.string().optional(),
  unitOfMeasure: z.string().optional().default('PCS'),
  isBatchTracked: z.boolean().optional().default(false),
  isSerialTracked: z.boolean().optional().default(false),
  status: z.nativeEnum(InventoryProductStatus).optional().default(InventoryProductStatus.ACTIVE),
});

export const updateInventoryProductSchema = createInventoryProductSchema.omit({ productId: true }).partial();

export const bulkUpdateInventoryProductSchema = z.object({
  productIds: z.array(z.string().uuid()),
  updates: z.object({
    status: z.nativeEnum(InventoryProductStatus).optional(),
    minStock: z.number().optional(),
    maxStock: z.number().optional(),
    reorderLevel: z.number().optional(),
    gstRate: z.number().optional(),
    brand: z.string().optional(),
  }),
});

export type CreateInventoryProductInput = z.infer<typeof createInventoryProductSchema>;
export type UpdateInventoryProductInput = z.infer<typeof updateInventoryProductSchema>;
export type BulkUpdateInventoryProductInput = z.infer<typeof bulkUpdateInventoryProductSchema>;
