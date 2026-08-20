import { z } from 'zod';

export const AddressSchema = z.object({
  attentionTo: z.string().min(1, 'Attention to / Contact person is required'),
  companyName: z.string().optional().nullable(),
  addressLine1: z.string().min(1, 'Address line 1 is required'),
  addressLine2: z.string().optional().nullable(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal / PIN code is required'),
  country: z.string().default('IN'),
  phone: z.string().min(6, 'Valid phone number is required'),
  email: z.string().email('Valid email is required').optional().nullable(),
});

export const FormLineItemInputSchema = z.object({
  description: z.string().min(1, 'Product description is required'),
  sku: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
  variantId: z.string().optional().nullable(),
  unit: z.string().default('PCS'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.coerce.number().min(0, 'Unit price cannot be negative'),
  taxRate: z.coerce.number().min(0).max(100).optional().nullable(),
});

export const CreateFormPoSchema = z.object({
  customerPoNumber: z.string().optional().nullable(),
  customerPoDate: z.string().optional().nullable(),
  currency: z.string().default('INR'),
  expectedDeliveryDate: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  customerNote: z.string().optional().nullable(),
  billToAddress: AddressSchema,
  shipToAddress: AddressSchema,
  lineItems: z.array(FormLineItemInputSchema).min(1, 'At least one line item is required'),
});

export const CreatePdfPoSchema = z.object({
  customerPoNumber: z.string().optional().nullable(),
  customerPoDate: z.string().optional().nullable(),
  statedTotal: z.coerce.number().min(0).optional().nullable(),
  currency: z.string().default('INR'),
  expectedDeliveryDate: z.string().optional().nullable(),
  customerNote: z.string().optional().nullable(),
});

export const AdminMappedLineItemSchema = z.object({
  id: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
  variantId: z.string().optional().nullable(),
  description: z.string().min(1, 'Description is required'),
  sku: z.string().optional().nullable(),
  unit: z.string().default('PCS'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.coerce.number().min(0, 'Unit price cannot be negative'),
  taxRate: z.coerce.number().min(0).max(100).optional().nullable(),
});

export const AdminUpsertLineItemsSchema = z.object({
  items: z.array(AdminMappedLineItemSchema).min(1, 'At least one line item is required'),
});

export const AdminApproveSchema = z.object({
  confirmMismatch: z.boolean().optional().default(false),
  note: z.string().optional().nullable(),
});

export const AdminRejectSchema = z.object({
  reason: z.string().min(3, 'Rejection reason is required (minimum 3 characters)'),
});

export const AdminRequestChangesSchema = z.object({
  reason: z.string().min(3, 'Change request reason is required (minimum 3 characters)'),
});

export const AdminAssignSchema = z.object({
  adminUserId: z.string().min(1, 'Admin user ID is required'),
});

export const AdminInternalNoteSchema = z.object({
  note: z.string().min(1, 'Note content cannot be empty'),
});

export const AdminQueueQuerySchema = z.object({
  status: z.string().optional(),
  sourceType: z.string().optional(),
  search: z.string().optional(),
  customerId: z.string().optional(),
  assignedTo: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(15),
});

export const CustomerListQuerySchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(15),
});

export const IdParamSchema = z.object({
  id: z.string().min(1, 'ID parameter is required'),
});

export type CreateFormPoInput = z.infer<typeof CreateFormPoSchema>;
export type CreatePdfPoInput = z.infer<typeof CreatePdfPoSchema>;
export type AdminMappedLineItemInput = z.infer<typeof AdminMappedLineItemSchema>;
export type AdminUpsertLineItemsInput = z.infer<typeof AdminUpsertLineItemsSchema>;
export type AdminApproveInput = z.infer<typeof AdminApproveSchema>;
export type AdminRejectInput = z.infer<typeof AdminRejectSchema>;
export type AdminRequestChangesInput = z.infer<typeof AdminRequestChangesSchema>;
export type AdminAssignInput = z.infer<typeof AdminAssignSchema>;
export type AdminInternalNoteInput = z.infer<typeof AdminInternalNoteSchema>;
export type AdminQueueQuery = z.infer<typeof AdminQueueQuerySchema>;
export type CustomerListQuery = z.infer<typeof CustomerListQuerySchema>;
