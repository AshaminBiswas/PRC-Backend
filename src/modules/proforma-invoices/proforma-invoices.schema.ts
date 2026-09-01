import { z } from 'zod';

export const proformaItemSchema = z.object({
  productId: z.string().optional().nullable(),
  sku: z.string().min(1, 'SKU is required').default('SKU-001'),
  productName: z.string().min(1, 'Product name is required'),
  description: z.string().optional().nullable(),
  hsnCode: z.string().optional().nullable().default('8302'),
  unit: z.string().optional().default('PCS'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitRate: z.number().nonnegative('Unit rate must be >= 0'),
  discountPercent: z.number().min(0).max(100).optional().default(0),
  gstRate: z.number().min(0).max(100).optional().default(18),
});

export const createProformaInvoiceSchema = z.object({
  quoteId: z.string().optional().nullable(),
  quoteNumber: z.string().optional().nullable(),
  poId: z.string().optional().nullable(),
  poNumber: z.string().optional().nullable(),
  customerPoNumber: z.string().optional().nullable(),
  orderId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  customerName: z.string().min(1, 'Customer name is required'),
  companyName: z.string().optional().nullable(),
  customerEmail: z.string().email('Valid customer email is required').or(z.literal('')).optional().nullable().default('billing@pacifichardware.com'),
  customerPhone: z.string().optional().nullable(),
  gstin: z.string().max(15).optional().nullable(),
  pan: z.string().max(10).optional().nullable(),
  billingAddress: z.string().optional().nullable(),
  shippingAddress: z.string().optional().nullable(),
  placeOfSupply: z.string().optional().default('Delhi'),
  supplierState: z.string().optional().default('Delhi'),
  branchCode: z.string().optional().default('DELHI_WORKS'),
  advancePercentage: z.number().min(0).max(100).optional().default(30),
  paymentTerms: z.string().optional().nullable(),
  deliveryTimeline: z.string().optional().nullable(),
  validUntil: z.string().or(z.date()).optional().nullable(),
  shippingCost: z.number().nonnegative().optional().default(0),
  notes: z.string().optional().nullable(),
  termsAndConditions: z.string().optional().nullable(),
  bankDetails: z.record(z.any()).optional().nullable(),
  items: z.array(proformaItemSchema).min(1, 'At least one line item is required'),
});

export const updateProformaInvoiceSchema = z.object({
  customerName: z.string().min(1).optional(),
  companyName: z.string().optional().nullable(),
  customerEmail: z.string().email().or(z.literal('')).optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  gstin: z.string().max(15).optional().nullable(),
  pan: z.string().max(10).optional().nullable(),
  billingAddress: z.string().optional().nullable(),
  shippingAddress: z.string().optional().nullable(),
  placeOfSupply: z.string().optional(),
  advancePercentage: z.number().min(0).max(100).optional(),
  paymentTerms: z.string().optional().nullable(),
  deliveryTimeline: z.string().optional().nullable(),
  validUntil: z.string().or(z.date()).optional().nullable(),
  shippingCost: z.number().nonnegative().optional(),
  notes: z.string().optional().nullable(),
  termsAndConditions: z.string().optional().nullable(),
  bankDetails: z.record(z.any()).optional().nullable(),
});

export const updateProformaInvoiceItemsSchema = z.object({
  items: z.array(proformaItemSchema).min(1, 'At least one line item is required'),
  supplierState: z.string().optional().default('Delhi'),
  placeOfSupply: z.string().optional(),
  shippingCost: z.number().nonnegative().optional(),
  advancePercentage: z.number().min(0).max(100).optional(),
});

export const updateProformaInvoiceStatusSchema = z.object({
  status: z.enum([
    'DRAFT',
    'ISSUED',
    'SENT',
    'APPROVED',
    'ACCEPTED',
    'ADVANCE_RECEIVED',
    'CONVERTED_TO_INVOICE',
    'CANCELLED',
    'EXPIRED',
  ]),
  notes: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
});

export const signProformaInvoiceSchema = z.object({
  signerName: z.string().optional().default('Authorized Signatory'),
  signerDesignation: z.string().optional().default('Commercial Operations Desk'),
  notes: z.string().optional().nullable(),
});

export const listProformaInvoicesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.string().optional(),
  status: z.string().optional(),
  financialYear: z.string().optional(),
  customerId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const sendProformaInvoiceEmailSchema = z.object({
  email: z.string().email('Valid recipient email is required').optional(),
  cc: z.array(z.string().email()).optional(),
  message: z.string().max(1000).optional(),
  subject: z.string().max(200).optional(),
});

export const verifySignatureSchema = z.object({
  piNumber: z.string().min(1),
  documentHash: z.string().min(1),
  signature: z.string().min(1).optional(),
  digitalSignature: z.string().min(1).optional(),
  signedAt: z.string().or(z.date()).optional(),
});

export const customerFeedbackSchema = z.object({
  action: z.enum(['ACCEPT', 'REQUEST_CHANGE', 'QUERY', 'PAYMENT_SUBMITTED']),
  feedbackComments: z.string().min(1, 'Comments are required'),
  advancePaymentRef: z.string().optional().nullable(),
  paymentReceiptUrl: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
});

export const validateTamperSchema = z.object({
  query: z.string().min(1, 'Token, verification ID, hash, or invoice number is required'),
  claimedTotal: z.number().optional(),
  claimedAdvance: z.number().optional(),
  claimedGstin: z.string().optional(),
  claimedCustomer: z.string().optional(),
  claimedItemsCount: z.number().optional(),
  claimedSignature: z.string().optional(),
});

export type ProformaItemInput = z.infer<typeof proformaItemSchema>;
export type CreateProformaInvoiceInput = z.infer<typeof createProformaInvoiceSchema>;
export type UpdateProformaInvoiceInput = z.infer<typeof updateProformaInvoiceSchema>;
export type UpdateProformaInvoiceItemsInput = z.infer<typeof updateProformaInvoiceItemsSchema>;
export type UpdateProformaInvoiceStatusInput = z.infer<typeof updateProformaInvoiceStatusSchema>;
export type SignProformaInvoiceInput = z.infer<typeof signProformaInvoiceSchema>;
export type ListProformaInvoicesQuery = z.infer<typeof listProformaInvoicesQuerySchema>;
export type SendProformaInvoiceEmailInput = z.infer<typeof sendProformaInvoiceEmailSchema>;
export type VerifySignatureInput = z.infer<typeof verifySignatureSchema>;
export type CustomerFeedbackInput = z.infer<typeof customerFeedbackSchema>;
export type ValidateTamperInput = z.infer<typeof validateTamperSchema>;

