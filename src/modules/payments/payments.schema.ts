import { z } from 'zod';

export const CreatePaymentOrderSchema = z.object({
  orderId: z.string().uuid({ message: 'Invalid order ID format' }),
  amount: z.number().positive().optional(),
  currency: z.string().default('INR').optional(),
});

export const VerifyPaymentSchema = z.object({
  orderId: z.string().uuid({ message: 'Invalid order ID format' }),
  razorpayOrderId: z.string().min(1, 'razorpayOrderId is required'),
  razorpayPaymentId: z.string().min(1, 'razorpayPaymentId is required'),
  razorpaySignature: z.string().min(1, 'razorpaySignature is required'),
});

export const OrderIdParamSchema = z.object({
  orderId: z.string().uuid({ message: 'Invalid order ID format' }),
});

export const RefundPaymentSchema = z.object({
  paymentId: z.string().uuid({ message: 'Invalid payment ID format' }),
  amount: z.number().positive().optional(),
  reason: z.string().max(500).optional(),
});

export type CreatePaymentOrderInput = z.infer<typeof CreatePaymentOrderSchema>;
export type VerifyPaymentInput = z.infer<typeof VerifyPaymentSchema>;
export type OrderIdParam = z.infer<typeof OrderIdParamSchema>;
export type RefundPaymentInput = z.infer<typeof RefundPaymentSchema>;
