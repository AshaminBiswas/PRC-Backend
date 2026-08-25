import { z } from 'zod';

const optionalDateString = z
  .string()
  .optional()
  .refine((val) => !val || !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  });

const allowedPeriods = [
  'today', 'day', 'daily',
  '7d', 'week', 'weekly',
  '30d', 'month', 'monthly',
  '90d', 'quarter',
  '1y', 'year', 'yearly', 'ytd',
  'all', 'custom'
] as const;

export const DashboardOverviewQuerySchema = z.object({
  period: z.enum(allowedPeriods).optional().default('30d'),
  startDate: optionalDateString,
  endDate: optionalDateString,
});

export const SalesChartQuerySchema = z.object({
  period: z.enum(allowedPeriods).optional().default('30d'),
  startDate: optionalDateString,
  endDate: optionalDateString,
  groupBy: z.enum(['day', 'week', 'month', 'daily', 'weekly', 'monthly', 'year', 'yearly']).default('day'),
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
