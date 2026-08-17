import { z } from 'zod';

export const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PHONE_REGEX = /^[6-9]\d{9}$/;

export const QuoteItemInputSchema = z.object({
  productId: z.string().uuid({ message: 'Invalid product ID format' }),
  variantId: z.string().uuid().optional().nullable(),
  productNameSnapshot: z.string().optional(),
  unit: z.string().default('PCS'),
  quantity: z.number().int().min(1, { message: 'Quantity must be at least 1' }),
  rate: z.number().nonnegative().optional(),
  requestedPrice: z.number().nonnegative().optional(),
});

export const CreateB2BQuoteSchema = z.object({
  projectName: z.string().min(2, 'Project name is required').max(150, 'Project name is too long'),
  firstName: z.string().min(2, 'First name is required').max(50, 'First name is too long'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name is too long'),
  companyName: z.string().min(2, 'Company name is required').max(150, 'Company name is too long'),
  gstNo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(GSTIN_REGEX, 'Please enter a valid 15-digit Indian GSTIN format (e.g. 27AAAAA0000A1Z5)'),
  email: z.string().trim().email('Please enter a valid business email address'),
  phone: z
    .string()
    .trim()
    .transform((val) => {
      let digits = val.replace(/\D/g, '');
      if (digits.length === 12 && digits.startsWith('91')) {
        digits = digits.slice(2);
      } else if (digits.length === 11 && digits.startsWith('0')) {
        digits = digits.slice(1);
      }
      return digits;
    })
    .refine((val) => PHONE_REGEX.test(val), {
      message: 'Please enter a valid 10-digit Indian mobile number (e.g. 9876543210)',
    }),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional().nullable(),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms and conditions to submit' }),
  }),
  items: z.array(QuoteItemInputSchema).min(1, 'Please select at least one product for the quotation'),
});

export const TrackQuoteQuerySchema = z.object({
  query: z.string().min(2, 'Please enter a Reference No, Email, GSTIN, or Phone number to track'),
});

export const CustomerResponseSchema = z.object({
  response: z.enum(['accepted', 'declined'], {
    errorMap: () => ({ message: "Response must be either 'accepted' or 'declined'" }),
  }),
  notes: z.string().max(500, 'Response notes cannot exceed 500 characters').optional().nullable(),
});

export const AdminUpdateQuoteStatusSchema = z.object({
  status: z.enum(['SUBMITTED', 'UNDER_REVIEW', 'PENDING', 'APPROVED', 'REJECTED', 'CONVERTED']),
  statusReason: z.string().max(1000).optional().nullable(),
});

export const AdminUpdateQuoteItemsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        productId: z.string().uuid(),
        variantId: z.string().uuid().optional().nullable(),
        productNameSnapshot: z.string().optional(),
        unit: z.string().default('PCS'),
        quantity: z.number().int().min(1),
        rate: z.number().nonnegative(),
      })
    )
    .min(1, 'Quotation must have at least one line item'),
  shippingCost: z.number().nonnegative().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  adminNotes: z.string().max(1000).optional().nullable(),
  validUntil: z.string().datetime().or(z.date()).optional().nullable(),
});

export const SignQuoteSchema = z.object({
  adminNotes: z.string().max(1000).optional().nullable(),
  shippingCost: z.number().nonnegative().optional().nullable(),
});

export const VerifySignatureSchema = z.object({
  referenceNo: z.string().min(3, 'Reference number is required'),
  digitalSignature: z.string().optional(),
});

export const ListQuotesQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  includeDeleted: z.string().optional(),
});

export const QuoteIdParamSchema = z.object({
  id: z.string().uuid({ message: 'Invalid quote ID format' }),
});

export const TokenParamSchema = z.object({
  token: z.string().min(10, 'Invalid token format'),
});

export type CreateB2BQuoteInput = z.infer<typeof CreateB2BQuoteSchema>;
export type TrackQuoteQuery = z.infer<typeof TrackQuoteQuerySchema>;
export type CustomerResponseInput = z.infer<typeof CustomerResponseSchema>;
export type AdminUpdateQuoteStatusInput = z.infer<typeof AdminUpdateQuoteStatusSchema>;
export type AdminUpdateQuoteItemsInput = z.infer<typeof AdminUpdateQuoteItemsSchema>;
export type SignQuoteInput = z.infer<typeof SignQuoteSchema>;
export type VerifySignatureInput = z.infer<typeof VerifySignatureSchema>;
export type ListQuotesQuery = z.infer<typeof ListQuotesQuerySchema>;
