import { z } from 'zod';
import { OrderStatus } from '@prisma/client';

const optionalDateString = z
  .string()
  .optional()
  .refine((val) => !val || !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  });

export const SalesReportQuerySchema = z.object({
  startDate: optionalDateString,
  endDate: optionalDateString,
  status: z.nativeEnum(OrderStatus).optional(),
  groupBy: z.enum(['day', 'week', 'month', 'daily', 'weekly', 'monthly']).default('day'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const InventoryReportQuerySchema = z.object({
  lowStockThreshold: z.coerce.number().int().min(0).default(10),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT']).optional(),
  categoryId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const CustomerReportQuerySchema = z.object({
  startDate: optionalDateString,
  endDate: optionalDateString,
  groupBy: z.enum(['day', 'week', 'month', 'daily', 'weekly', 'monthly']).default('month'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const ProductReportQuerySchema = z.object({
  startDate: optionalDateString,
  endDate: optionalDateString,
  categoryId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
