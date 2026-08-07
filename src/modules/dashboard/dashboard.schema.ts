import { z } from 'zod';

const optionalDateString = z
  .string()
  .optional()
  .refine((val) => !val || !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  });

export const DashboardOverviewQuerySchema = z.object({
  period: z.enum(['today', '7d', '30d', '90d', '1y']).optional().default('30d'),
  startDate: optionalDateString,
  endDate: optionalDateString,
});

export const SalesChartQuerySchema = z.object({
  period: z.enum(['today', '7d', '30d', '90d', '1y']).optional().default('30d'),
  startDate: optionalDateString,
  endDate: optionalDateString,
  groupBy: z.enum(['day', 'week', 'month', 'daily', 'weekly', 'monthly']).default('day'),
});

export const RecentOrdersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const DashboardInventoryQuerySchema = z.object({
  lowStockThreshold: z.coerce.number().int().min(0).default(10),
});

export const DashboardQuerySchema = DashboardOverviewQuerySchema;
export const RevenueQuerySchema = SalesChartQuerySchema;
export const InventoryQuerySchema = DashboardInventoryQuerySchema;
