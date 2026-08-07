import { z } from 'zod';

export const ListNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isRead: z.coerce.boolean().optional(),
});

export const SendNotificationSchema = z.object({
  userId: z.string().optional(),
  orderId: z.string().optional(),
  broadcast: z.boolean().default(false),
  type: z.string().default('SYSTEM'),
  title: z.string().min(1, 'Title is required').max(200),
  message: z.string().min(1, 'Message is required'),
  data: z.record(z.unknown()).optional(),
});

export const UuidParamSchema = z.object({
  id: z.string().uuid('Invalid notification ID'),
});

export type ListNotificationsQuery = z.infer<typeof ListNotificationsQuerySchema>;
export type SendNotificationInput = z.infer<typeof SendNotificationSchema>;
