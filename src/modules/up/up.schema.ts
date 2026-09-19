import { z } from 'zod';

export const CreateUpExpenseSchema = z.object({
  expenseDate: z.string().min(1, 'Expense date is required'),
  amount: z.coerce.number().positive('Expense amount must be greater than 0'),
  categoryId: z.string().uuid('Valid Category ID is required'),
  paymentMode: z.string().default('cash'),
  paidTo: z.string().trim().min(1, 'Paid-to/Vendor name is required').max(255),
  note: z.string().max(1000).optional().nullable(),
  receiptPath: z.string().optional().nullable(),
});

export type CreateUpExpenseInput = z.infer<typeof CreateUpExpenseSchema>;

export const UpdateUpExpenseSchema = z.object({
  expenseDate: z.string().optional(),
  amount: z.coerce.number().positive('Expense amount must be greater than 0').optional(),
  categoryId: z.string().uuid().optional(),
  paymentMode: z.string().optional(),
  paidTo: z.string().trim().min(1).max(255).optional(),
  note: z.string().max(1000).optional().nullable(),
  receiptPath: z.string().optional().nullable(),
});

export type UpdateUpExpenseInput = z.infer<typeof UpdateUpExpenseSchema>;

export const ListUpExpensesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  categoryId: z.string().optional(),
  paymentMode: z.string().optional(),
  verified: z.string().optional(), // 'true', 'false', 'all'
  search: z.string().optional(),
});

export type ListUpExpensesQuery = z.infer<typeof ListUpExpensesQuerySchema>;

export const CreateUpCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(100),
  sortOrder: z.coerce.number().int().default(0),
});

export type CreateUpCategoryInput = z.infer<typeof CreateUpCategorySchema>;

export const UpdateUpCategorySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export type UpdateUpCategoryInput = z.infer<typeof UpdateUpCategorySchema>;

export const GrantUpAccessSchema = z.object({
  adminId: z.string().uuid('Valid Admin ID is required'),
});

export type GrantUpAccessInput = z.infer<typeof GrantUpAccessSchema>;

export const ReconcileCashSchema = z.object({
  cashDate: z.string().min(1, 'Cash date is required'),
  openingBalance: z.coerce.number().min(0, 'Opening balance cannot be negative').optional(),
  actualClosing: z.coerce.number().min(0, 'Actual closing balance cannot be negative').optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  closed: z.boolean().optional(),
});

export type ReconcileCashInput = z.infer<typeof ReconcileCashSchema>;
