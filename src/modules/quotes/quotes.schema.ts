import { z } from 'zod';
import { QuoteStatus, PaymentMethod } from '@prisma/client';

export const ListQuotesQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z.nativeEnum(QuoteStatus).optional(),
  userId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export const QuoteItemInputSchema = z.object({
  productId: z.string().uuid({ message: 'Invalid product ID format' }),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().positive({ message: 'Quantity must be at least 1' }),
  requestedPrice: z.number().nonnegative().optional(),
});

export const CreateQuoteSchema = z.object({
  items: z.array(QuoteItemInputSchema).min(1, 'At least one item is required in a quote request'),
  notes: z.string().max(1000).optional(),
});

export const QuoteIdParamSchema = z.object({
  id: z.string().uuid({ message: 'Invalid quote ID format' }),
});

export const UpdateQuoteStatusSchema = z.object({
  status: z.nativeEnum(QuoteStatus, {
    errorMap: () => ({ message: 'Invalid quote status' }),
  }),
  adminNotes: z.string().max(1000).optional(),
});

export const ConvertQuoteSchema = z.object({
  shippingAddressId: z.string().uuid().optional(),
  billingAddressId: z.string().uuid().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  notes: z.string().max(1000).optional(),
});

export const UpdateQuotePricingItemSchema = z.object({
  id: z.string().uuid(),
  offeredPrice: z.number().nonnegative({ message: 'Offered price cannot be negative' }),
});

export const UpdateQuotePricingSchema = z.object({
  items: z.array(UpdateQuotePricingItemSchema).optional(),
  subtotal: z.number().nonnegative().optional(),
  discountTotal: z.number().nonnegative().optional(),
  taxTotal: z.number().nonnegative().optional(),
  grandTotal: z.number().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
  adminNotes: z.string().max(1000).optional(),
  validUntil: z.string().datetime().or(z.date()).optional(),
});

export type ListQuotesQuery = z.infer<typeof ListQuotesQuerySchema>;
export type CreateQuoteInput = z.infer<typeof CreateQuoteSchema>;
export type QuoteIdParam = z.infer<typeof QuoteIdParamSchema>;
export type UpdateQuoteStatusInput = z.infer<typeof UpdateQuoteStatusSchema>;
export type ConvertQuoteInput = z.infer<typeof ConvertQuoteSchema>;
export type UpdateQuotePricingInput = z.infer<typeof UpdateQuotePricingSchema>;
