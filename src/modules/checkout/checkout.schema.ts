import { z } from 'zod';

export const AddressSchema = z.object({
  addressLine1: z.string().min(1, 'Address line 1 is required'),
  addressLine2: z.string().optional().nullable(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().optional().default('India'),
});

export const GetShippingRatesSchema = z.object({
  shippingAddressId: z.string().uuid('Invalid shipping address ID format').optional(),
  address: AddressSchema.optional(),
});

export const PlaceOrderSchema = z.object({
  shippingAddressId: z.string().uuid('Invalid shipping address ID format').optional(),
  billingAddressId: z.string().uuid('Invalid billing address ID format').optional(),
  shippingAddress: AddressSchema.optional(),
  billingAddress: AddressSchema.optional(),
  paymentMethod: z
    .enum(['RAZORPAY', 'COD', 'BANK_TRANSFER', 'CREDIT_CARD', 'UPI'])
    .optional()
    .default('RAZORPAY'),
  shippingRateId: z.string().optional(),
  notes: z.string().optional().nullable(),
});

export type AddressInput = z.infer<typeof AddressSchema>;
export type GetShippingRatesInput = z.infer<typeof GetShippingRatesSchema>;
export type PlaceOrderInput = z.infer<typeof PlaceOrderSchema>;
