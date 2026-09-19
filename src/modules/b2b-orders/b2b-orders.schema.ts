import { z } from 'zod';

export const B2bOrderItemInputSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  sku: z.string().min(1, 'SKU is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  unitPrice: z.coerce.number().nonnegative('Unit price cannot be negative'),
  discount: z.coerce.number().nonnegative().optional().default(0),
  taxRate: z.coerce.number().nonnegative().optional(),
  taxPercent: z.coerce.number().nonnegative().optional(),
  configuration: z.record(z.any()).optional().nullable(),
});

export const SubmitB2bOrderSchema = z.object({
  clientRequestId: z.string().min(1, 'clientRequestId is required for idempotency'),
  branchId: z.string().min(1, 'Fulfilment branch ID is required'),
  sourceQuotationId: z.string().optional().nullable(),
  sourcePoId: z.string().optional().nullable(),
  sourcePiId: z.string().optional().nullable(),
  paymentMethod: z.string().optional().default('bank_transfer'),
  notes: z.string().optional(),
  items: z.array(B2bOrderItemInputSchema).min(1, 'At least one order line item is required'),
});

export const AdminCreateB2bOrderSchema = z.object({
  clientRequestId: z.string().min(1, 'clientRequestId is required for idempotency'),
  customerId: z.string().min(1, 'B2B Customer ID is required'),
  branchId: z.string().min(1, 'Fulfilment branch ID is required'),
  sourceQuotationId: z.string().optional().nullable(),
  sourcePoId: z.string().optional().nullable(),
  sourcePiId: z.string().optional().nullable(),
  paymentMethod: z.string().optional().default('bank_transfer'),
  items: z.array(B2bOrderItemInputSchema).min(1, 'At least one order line item is required'),
  notes: z.string().optional(),
});

export const RecordB2bOrderPaymentSchema = z.object({
  amountPaid: z.coerce.number().positive('Payment amount must be greater than 0'),
  paymentMode: z.string().min(1, 'Payment mode is required'),
  transactionRef: z.string().optional().nullable(),
  paymentDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const RejectB2bOrderSchema = z.object({
  reason: z.string().min(3, 'Rejection reason must be at least 3 characters'),
});

export const EditB2bOrderItemSchema = z.object({
  orderItemId: z.string().optional().nullable(),
  productId: z.string().min(1, 'Product ID is required'),
  sku: z.string().min(1, 'SKU is required'),
  quantity: z.coerce.number().nonnegative('Quantity cannot be negative'),
  unitPrice: z.coerce.number().nonnegative().optional(),
  discount: z.coerce.number().nonnegative().optional().default(0),
  taxRate: z.coerce.number().nonnegative().optional(),
  taxPercent: z.coerce.number().nonnegative().optional(),
  isRemoved: z.boolean().optional().default(false),
  configuration: z.record(z.any()).optional().nullable(),
});

export const EditB2bOrderSchema = z.object({
  items: z.array(EditB2bOrderItemSchema).min(1, 'At least one item is required'),
  notes: z.string().optional(),
});

export const CancelB2bOrderSchema = z.object({
  reason: z.string().optional().default('Cancelled by user'),
});

export const UpdateB2bOrderStatusSchema = z.object({
  status: z.enum(['processing', 'ready', 'completed']),
});

export const ListB2bOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z.string().optional(),
  branchId: z.string().optional(),
  search: z.string().optional(),
  customerId: z.string().optional(),
  source: z.string().optional(),
});

export type SubmitB2bOrderInput = z.infer<typeof SubmitB2bOrderSchema>;
export type AdminCreateB2bOrderInput = z.infer<typeof AdminCreateB2bOrderSchema>;
export type RejectB2bOrderInput = z.infer<typeof RejectB2bOrderSchema>;
export type EditB2bOrderInput = z.infer<typeof EditB2bOrderSchema>;
export type CancelB2bOrderInput = z.infer<typeof CancelB2bOrderSchema>;
export type UpdateB2bOrderStatusInput = z.infer<typeof UpdateB2bOrderStatusSchema>;
export type ListB2bOrdersQuery = z.infer<typeof ListB2bOrdersQuerySchema>;
export type RecordB2bOrderPaymentInput = z.infer<typeof RecordB2bOrderPaymentSchema>;
