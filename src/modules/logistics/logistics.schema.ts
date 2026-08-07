import { z } from 'zod';

export const calculateLogisticsInputSchema = z.object({
  pincode: z.string().regex(/^\d{6}$/, 'Indian PIN code must be a 6-digit number'),
  weight: z.number().nonnegative('Weight must be non-negative (in kg)'),
  orderAmount: z.number().nonnegative().optional().default(0),
  isCod: z.boolean().optional().default(false),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().optional(),
        sku: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .optional(),
});

export const createCourierSchema = z.object({
  name: z.string().min(2, 'Courier name is required'),
  code: z.string().min(2, 'Courier code is required').toUpperCase(),
  isActive: z.boolean().optional().default(true),
  trackingUrl: z.string().optional(),
});

export const createWarehouseZoneMappingSchema = z.object({
  warehouseId: z.string().min(1, 'Warehouse ID is required'),
  zoneId: z.string().min(1, 'Zone ID is required'),
  pinStart: z.string().regex(/^\d{6}$/, 'pinStart must be 6 digits'),
  pinEnd: z.string().regex(/^\d{6}$/, 'pinEnd must be 6 digits'),
});

export const createCourierRateSchema = z.object({
  courierId: z.string().min(1, 'Courier ID is required'),
  zoneId: z.string().min(1, 'Zone ID is required'),
  weightFrom: z.number().nonnegative(),
  weightTo: z.number().positive(),
  baseRate: z.number().nonnegative(),
  additionalRate: z.number().nonnegative().optional().default(0),
  fuelSurcharge: z.number().nonnegative().optional().default(0),
  handlingCharge: z.number().nonnegative().optional().default(0),
  codCharge: z.number().nonnegative().optional().default(0),
  estimatedDeliveryDays: z.number().int().positive().optional().default(3),
  isActive: z.boolean().optional().default(true),
});

export type CalculateLogisticsInput = z.infer<typeof calculateLogisticsInputSchema>;
export type CreateCourierInput = z.infer<typeof createCourierSchema>;
export type CreateWarehouseZoneMappingInput = z.infer<typeof createWarehouseZoneMappingSchema>;
export type CreateCourierRateInput = z.infer<typeof createCourierRateSchema>;
