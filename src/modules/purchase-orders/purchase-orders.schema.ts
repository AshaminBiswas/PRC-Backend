import { z } from 'zod';

// ─── Address Schema ───────────────────────────────────────────────────────────

export const PoAddressSchema = z.object({
  attentionTo: z.string().min(1, 'Contact / Attention person name is required'),
  companyName: z.string().optional().default(''),
  addressLine1: z.string().min(1, 'Address line 1 is required'),
  addressLine2: z.string().optional().default(''),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State / Province is required'),
  postalCode: z.string().min(1, 'Postal / ZIP code is required'),
  country: z.string().min(1, 'Country is required').default('IN'),
  phone: z.string().min(5, 'Valid phone number is required'),
  email: z.string().email('Valid email address is required'),
});

// ─── PO Creation Schema ───────────────────────────────────────────────────────

export const CreatePurchaseOrderSchema = z.object({
  quotationId: z.string().min(1, 'Quotation ID is required'),
  advancePercentage: z.coerce.number().min(1).max(100).optional(),
  customerPoReferenceNumber: z.string().max(100).optional(),
  billingAddress: PoAddressSchema,
  deliveryAddress: PoAddressSchema.optional(),
  sameAsBilling: z.boolean().optional().default(false),
  deliveryInstructions: z.string().max(500).optional(),
  requestedDeliveryDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional()),
  saveBillingAddress: z.boolean().optional().default(false),
  saveDeliveryAddress: z.boolean().optional().default(false),
  billingAddressLabel: z.string().optional(),
  deliveryAddressLabel: z.string().optional(),
}).refine(
  (data) => data.sameAsBilling || !!data.deliveryAddress,
  {
    message: 'Delivery address is required when different from billing address',
    path: ['deliveryAddress'],
  }
);

// ─── Admin Payment Acknowledgment Schema ──────────────────────────────────────

export const AcknowledgeReceiptSchema = z.object({
  amountReceived: z.coerce.number().positive('Amount received must be greater than 0'),
  paymentDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional()),
  paymentReference: z.string().min(1, 'Payment reference (UTR / Transaction ID / Cheque No) is required'),
  paymentMethod: z.string().min(1, 'Payment method (e.g. NEFT, RTGS, IMPS, UPI, Cheque) is required').default('NEFT/RTGS'),
  remarks: z.string().max(500).optional(),
});

// ─── Admin Receipt Verification Schema ────────────────────────────────────────

export const VerifyReceiptSchema = z
  .object({
    confirmedAmount: z.coerce.number().optional(),
    verificationNotes: z.string().max(500).optional(),
    confirmBankCredit: z.boolean().optional(),
    confirmVerifiedAgainstBank: z.boolean().optional(),
  })
  .refine((d) => d.confirmBankCredit === true || d.confirmVerifiedAgainstBank === true, {
    message: 'You must explicitly confirm verification against the bank statement',
    path: ['confirmBankCredit'],
  });

export const AdminUpdatePurchaseOrderSchema = z.object({
  customerPoReferenceNumber: z.string().max(100).optional(),
  requestedDeliveryDate: z.string().optional().nullable(),
  deliveryInstructions: z.string().max(500).optional().nullable(),
  deliveryAddress: PoAddressSchema.partial().optional(),
  billingAddress: PoAddressSchema.partial().optional(),
  advancePercentage: z.coerce.number().min(0.01).max(100).optional(),
  shippingCost: z.coerce.number().min(0).optional(),
  adminNotes: z.string().max(500).optional(),
});

// ─── Admin Reject Receipt Schema ──────────────────────────────────────────────

export const RejectReceiptSchema = z.object({
  rejectionReason: z.string().min(3, 'Rejection reason is required (minimum 3 characters)'),
});

// ─── Admin Reopen Receipt Schema ──────────────────────────────────────────────

export const ReopenReceiptSchema = z.object({
  reason: z.string().min(3, 'Reason for reopening the receipt is required'),
});

// ─── Admin Reject Purchase Order Schema ───────────────────────────────────────

export const RejectPurchaseOrderSchema = z.object({
  rejectionReason: z.string().min(3, 'Rejection reason is required (minimum 3 characters)'),
});

// ─── Advance Payment Setting Schema ───────────────────────────────────────────

export const AdvancePaymentSettingSchema = z.object({
  defaultPercentage: z.coerce.number().min(0.01, 'Percentage must be > 0').max(100, 'Percentage cannot exceed 100'),
  minPercentage: z.coerce.number().min(0.01).max(100).default(10),
  maxPercentage: z.coerce.number().min(0.01).max(100).default(100),
  allowPerPoOverride: z.boolean().default(true),
});

// ─── Bank Account Setting Schema ──────────────────────────────────────────────

export const BankAccountSettingSchema = z.object({
  accountHolderName: z.string().min(1, 'Account holder name is required'),
  bankName: z.string().min(1, 'Bank name is required'),
  accountNumber: z.string().min(4, 'Valid account number is required'),
  ifscOrRoutingNumber: z.string().min(4, 'IFSC / Routing number is required'),
  swiftCode: z.string().optional().default(''),
  branch: z.string().optional().default(''),
  currency: z.string().default('INR'),
  isActive: z.boolean().default(true),
});

// ─── Saved Address Schema ─────────────────────────────────────────────────────

export const SavedAddressSchema = z.object({
  label: z.string().min(1, 'Address label is required').default('Default'),
  attentionTo: z.string().min(1, 'Contact person name is required'),
  companyName: z.string().optional().default(''),
  addressLine1: z.string().min(1, 'Address line 1 is required'),
  addressLine2: z.string().optional().default(''),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State / Province is required'),
  postalCode: z.string().min(1, 'Postal / ZIP code is required'),
  country: z.string().min(1, 'Country is required').default('IN'),
  phone: z.string().min(5, 'Valid phone number is required'),
  email: z.string().email('Valid email address is required'),
  isDefaultBilling: z.boolean().default(false),
  isDefaultDelivery: z.boolean().default(false),
});

// ─── Dispatch Schema ─────────────────────────────────────────────────────────

export const RecordDispatchSchema = z.object({
  carrierName: z.string().min(1, 'Carrier name is required (e.g. BlueDart, DTDC, VRL Logistics, Self Fleet)'),
  trackingNumber: z.string().optional(),
  dispatchedAt: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional()),
  dispatchNotes: z.string().max(500).optional(),
});

export const RegenerateInvoiceSchema = z.object({
  reason: z.string().optional(),
});

export type CreatePurchaseOrderInput = z.infer<typeof CreatePurchaseOrderSchema>;
export type AcknowledgeReceiptInput = z.infer<typeof AcknowledgeReceiptSchema>;
export type VerifyReceiptInput = z.infer<typeof VerifyReceiptSchema>;
export type RejectReceiptInput = z.infer<typeof RejectReceiptSchema>;
export type AdvancePaymentSettingInput = z.infer<typeof AdvancePaymentSettingSchema>;
export type BankAccountSettingInput = z.infer<typeof BankAccountSettingSchema>;
export type SavedAddressInput = z.infer<typeof SavedAddressSchema>;
export type RecordDispatchInput = z.infer<typeof RecordDispatchSchema>;
export type RegenerateInvoiceInput = z.infer<typeof RegenerateInvoiceSchema>;

