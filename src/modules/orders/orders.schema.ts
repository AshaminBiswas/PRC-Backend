import { z } from 'zod';
import { OrderStatus } from '@prisma/client';

export const ListOrdersQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  userId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export const OrderIdParamSchema = z.object({
  id: z.string().uuid({ message: 'Invalid order ID format' }),
});

export const CancelOrderSchema = z.object({
  reason: z
    .string({ required_error: 'Cancellation reason is required' })
    .trim()
    .min(1, 'Cancellation reason cannot be empty')
    .max(500, 'Reason must be at most 500 characters'),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus, {
    errorMap: () => ({ message: 'Invalid order status' }),
  }),
  comment: z.string().max(500).optional(),
  trackingNumber: z.string().max(100).optional(),
  carrier: z.string().max(100).optional(),
});

export type ListOrdersQuery = z.infer<typeof ListOrdersQuerySchema>;
export type OrderIdParam = z.infer<typeof OrderIdParamSchema>;
export type CancelOrderInput = z.infer<typeof CancelOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;
