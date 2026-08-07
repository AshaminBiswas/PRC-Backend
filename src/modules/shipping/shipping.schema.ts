import { z } from 'zod';

export const CreateShippingZoneSchema = z.object({
  name: z.string().min(1, 'Zone name is required'),
  countries: z.array(z.string()).optional().default(['India']),
  states: z.array(z.string()).optional().default([]),
  postalCodes: z.array(z.string()).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

export const UpdateShippingZoneSchema = CreateShippingZoneSchema.partial();

export const CreateShippingRateSchema = z.object({
  name: z.string().min(1, 'Rate name is required'),
  minWeight: z.number().nonnegative().optional().default(0),
  maxWeight: z.number().nonnegative().optional().nullable(),
  minOrderAmount: z.number().nonnegative().optional().nullable(),
  maxOrderAmount: z.number().nonnegative().optional().nullable(),
  rate: z.number().nonnegative('Rate must be non-negative'),
  estimatedDays: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const UpdateShippingRateSchema = CreateShippingRateSchema.partial();

export const CalculateShippingSchema = z.object({
  address: z
    .object({
      country: z.string().optional().default('India'),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      city: z.string().optional(),
    })
    .optional()
    .default({ country: 'India' }),
  weight: z.number().nonnegative().optional().default(0),
  orderAmount: z.number().nonnegative().optional().default(0),
});

export const ZoneIdParamSchema = z.object({
  id: z.string().uuid('Invalid zone ID format'),
});

export const RateIdParamSchema = z.object({
  id: z.string().uuid('Invalid rate ID format'),
});

export type CreateShippingZoneInput = z.infer<typeof CreateShippingZoneSchema>;
export type UpdateShippingZoneInput = z.infer<typeof UpdateShippingZoneSchema>;
export type CreateShippingRateInput = z.infer<typeof CreateShippingRateSchema>;
export type UpdateShippingRateInput = z.infer<typeof UpdateShippingRateSchema>;
export type CalculateShippingInput = z.infer<typeof CalculateShippingSchema>;
