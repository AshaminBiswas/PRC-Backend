import { z } from 'zod';

export const invoiceTypeEnum = z.enum([
  'TAX_INVOICE',
  'PROFORMA_INVOICE',
  'QUOTATION',
  'DELIVERY_CHALLAN',
  'PACKING_SLIP',
  'PURCHASE_ORDER',
  'CREDIT_NOTE',
  'DEBIT_NOTE',
  'COMMERCIAL_INVOICE',
]);

export const invoiceStatusEnum = z.enum([
  'DRAFT',
  'APPROVED',
  'PAID',
  'CANCELLED',
  'ARCHIVED',
]);

export const invoiceItemSchema = z.object({
  productId: z.string().optional(),
  sku: z.string().min(1, 'SKU is required'),
  productName: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  hsnCode: z.string().optional().default('8467'),
  unit: z.string().optional().default('PCS'),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().nonnegative('Unit price cannot be negative'),
  discount: z.number().nonnegative().optional().default(0),
  taxRate: z.number().nonnegative().optional().default(18),
  cessRate: z.number().nonnegative().optional().default(0),
});

export const createInvoiceSchema = z.object({
  invoiceType: invoiceTypeEnum.optional().default('TAX_INVOICE'),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  customerGstin: z.string().length(15, 'GSTIN must be 15 characters').optional(),
  placeOfSupply: z.string().optional().default('Karnataka'),
  supplierState: z.string().optional().default('Karnataka'),
  isReverseCharge: z.boolean().optional().default(false),
  warehouseId: z.string().optional(),
  orderId: z.string().optional(),
  shipmentId: z.string().optional(),
  paymentId: z.string().optional(),
  dueDate: z.string().or(z.date()).optional(),
  paymentTerms: z.string().optional().default('DUE_ON_RECEIPT'),
  branchCode: z.string().optional().default('MAIN'),
  notes: z.string().optional(),
  internalRemarks: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one line item is required'),
});

export const updateInvoiceSchema = createInvoiceSchema.partial();

export const listInvoicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  invoiceType: invoiceTypeEnum.optional(),
  status: invoiceStatusEnum.optional(),
  customerId: z.string().optional(),
  financialYear: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const cancelInvoiceSchema = z.object({
  reason: z.string().min(3, 'Cancellation reason is required'),
});

export const signInvoiceSchema = z.object({
  signedBy: z.string().min(2, 'Signer name is required'),
  designation: z.string().optional().default('Authorized Signatory'),
  certificateSerialNumber: z.string().optional(),
});

export const creditDebitNoteSchema = z.object({
  originalInvoiceId: z.string().min(1, 'Original Invoice ID is required'),
  reason: z.string().min(3, 'Adjustment reason is required'),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
  notes: z.string().optional(),
});

export const orderDocumentSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  notes: z.string().optional(),
});

export type InvoiceTypeInput = z.infer<typeof invoiceTypeEnum>;
export type InvoiceStatusInput = z.infer<typeof invoiceStatusEnum>;
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;
export type CreateInvoiceInput = z.input<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.input<typeof updateInvoiceSchema>;
export type ListInvoicesQueryInput = z.infer<typeof listInvoicesQuerySchema>;
export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;
export type SignInvoiceInput = z.infer<typeof signInvoiceSchema>;
export type CreditDebitNoteInput = z.infer<typeof creditDebitNoteSchema>;
export type OrderDocumentInput = z.infer<typeof orderDocumentSchema>;
