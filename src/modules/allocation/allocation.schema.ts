import { z } from 'zod';

export const allocationItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional(),
  sku: z.string().min(1, 'SKU is required'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
});

export const allocateOrderSchema = z.object({
  pincode: z.string().regex(/^\d{6}$/, 'Indian PIN code must be a 6-digit number'),
  items: z.array(allocationItemSchema).optional(),
  reserveStock: z.boolean().optional(),
  ventureId: z.string().optional(),
  orderId: z.string().optional(),
  strategy: z.string().optional(),
});

export const allocateByPincodeSchema = z.object({
  pincode: z.string().regex(/^\d{6}$/, 'Indian PIN code must be a 6-digit number'),
  orderId: z.string().optional(),
  strategy: z.string().optional(),
});

export const pincodeLookupSchema = z.object({
  pincode: z.string().regex(/^\d{6}$/, 'Indian PIN code must be a 6-digit number'),
});

export const createPincodeSchema = z.object({
  pincode: z.string().regex(/^\d{6}$/, 'Indian PIN code must be a 6-digit number'),
  postOffice: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  district: z.string().min(1, 'District is required'),
  state: z.string().min(1, 'State is required'),
  latitude: z.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  longitude: z.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
  isServiceable: z.boolean().optional(),
  country: z.string().optional(),
});

export const bulkImportPincodeSchema = z.object({
  records: z.array(createPincodeSchema).min(1, 'At least one PIN code record is required'),
});

export const nearestWarehousesQuerySchema = z.object({
  pincode: z.string().regex(/^\d{6}$/, 'Indian PIN code must be a 6-digit number'),
  limit: z.coerce.number().int().positive().optional(),
  ventureId: z.string().optional(),
});

export const createAdminWarehouseSchema = z.object({
  name: z.string().min(1, 'Warehouse name is required'),
  code: z.string().min(1, 'Warehouse code is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  priority: z.number().int().optional(),
  contactPhone: z.string().optional(),
  isActive: z.boolean().optional(),
  ventureId: z.string().optional(),
});

export const updateAdminWarehouseSchema = createAdminWarehouseSchema.partial();

export const allocationLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
  warehouseId: z.string().optional(),
  pincode: z.string().optional(),
});

export type AllocationItemInput = z.infer<typeof allocationItemSchema>;
export type AllocateOrderInput = z.input<typeof allocateOrderSchema>;
export type AllocateByPincodeInput = z.input<typeof allocateByPincodeSchema>;
export type CreatePincodeInput = z.infer<typeof createPincodeSchema>;
export type BulkImportPincodeInput = z.infer<typeof bulkImportPincodeSchema>;
export type NearestWarehousesQueryInput = z.infer<typeof nearestWarehousesQuerySchema>;
export type CreateAdminWarehouseInput = z.infer<typeof createAdminWarehouseSchema>;
export type UpdateAdminWarehouseInput = z.infer<typeof updateAdminWarehouseSchema>;
export type AllocationLogQueryInput = z.infer<typeof allocationLogQuerySchema>;
