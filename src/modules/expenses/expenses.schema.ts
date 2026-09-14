import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────────────
export const ExpensePaymentModeEnum = z.enum(['CASH', 'UPI', 'BANK_TRANSFER']);
export const ExpenseStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED']);

// Helper to sanitize amount into integer paise
export const amountToPaise = (amount: number, inPaise: boolean = false): number => {
  if (inPaise) {
    return Math.round(amount);
  }
  return Math.round(amount * 100);
};

// ─── Entry Creation Schema ───────────────────────────────────────────────────
export const CreateExpenseSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  amountInPaise: z.boolean().optional().default(false),
  categoryId: z.string().min(1, 'Category is required'),
  subCategory: z.string().optional().nullable(),
  paymentMode: ExpensePaymentModeEnum.default('CASH'),
  description: z.string().min(2, 'Description or note is required'),
  paidTo: z.string().min(2, 'Paid to (recipient/vendor) is required'),
  receiptAttachment: z.string().optional().nullable(),
  branchId: z.string().min(1, 'Branch ID is required'),
  departmentId: z.string().optional().nullable(),
  employeeId: z.string().optional().nullable(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Time must be in HH:mm or HH:mm:ss format')
    .optional(),
  clientTempId: z.string().optional().nullable(),
});

export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;

// ─── Batch Offline Sync Schema ───────────────────────────────────────────────
export const BatchSyncExpensesSchema = z.object({
  entries: z.array(CreateExpenseSchema).min(1, 'At least one entry required').max(100, 'Max 100 entries per batch'),
});

export type BatchSyncExpensesInput = z.infer<typeof BatchSyncExpensesSchema>;

// ─── Entry Update Schema ─────────────────────────────────────────────────────
export const UpdateExpenseSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0').optional(),
  amountInPaise: z.boolean().optional().default(false),
  categoryId: z.string().min(1).optional(),
  subCategory: z.string().optional().nullable(),
  paymentMode: ExpensePaymentModeEnum.optional(),
  description: z.string().min(2).optional(),
  paidTo: z.string().min(2).optional(),
  receiptAttachment: z.string().optional().nullable(),
  employeeId: z.string().optional().nullable(),
  changeReason: z.string().optional().default('Expense details updated'),
});

export type UpdateExpenseInput = z.infer<typeof UpdateExpenseSchema>;

export const DeleteExpenseSchema = z.object({
  reason: z.string().optional().default('Super Admin deleted expense entry'),
});

export type DeleteExpenseInput = z.infer<typeof DeleteExpenseSchema>;

// ─── Approval / Rejection Schema ─────────────────────────────────────────────
export const ApproveExpenseSchema = z.object({
  notes: z.string().optional(),
});

export const RejectExpenseSchema = z.object({
  rejectionReason: z.string().min(2, 'Rejection reason is required'),
});

// ─── Void Schema ─────────────────────────────────────────────────────────────
export const VoidExpenseSchema = z.object({
  voidReason: z.string().min(3, 'Mandatory void reason is required'),
});

// ─── Query Filter Schema ─────────────────────────────────────────────────────
export const ExpenseFilterQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  branchId: z.string().optional(),
  categoryId: z.string().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'VOIDED', 'ALL']).optional(),
  paymentMode: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'ALL']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid startDate format').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid endDate format').optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
  addedById: z.string().optional(),
  employeeId: z.string().optional(),
  search: z.string().optional(),
  isVoid: z.coerce.boolean().optional(),
  sortBy: z.enum(['date', 'amount', 'createdAt']).optional().default('date'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type ExpenseFilterQuery = z.infer<typeof ExpenseFilterQuerySchema>;

// ─── Daily Closing Reconciliation Schema ────────────────────────────────────
export const DailyReconciliationSchema = z.object({
  branchId: z.string().min(1, 'Branch ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  physicalCashCounted: z.number().min(0, 'Physical cash counted cannot be negative'),
  physicalCashInPaise: z.boolean().optional().default(false),
  reconciliationNotes: z.string().optional().nullable(),
});

export type DailyReconciliationInput = z.infer<typeof DailyReconciliationSchema>;

// ─── Mid-day Float Top-Up Schema ─────────────────────────────────────────────
export const FloatTopUpSchema = z.object({
  branchId: z.string().min(1, 'Branch ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  amount: z.number().positive('Top-up amount must be greater than 0'),
  amountInPaise: z.boolean().optional().default(false),
  source: z.string().min(2, 'Source of float cash is required (e.g. Bank Withdrawal, HQ Float)'),
  referenceNo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type FloatTopUpInput = z.infer<typeof FloatTopUpSchema>;

// ─── Category Master Schema ──────────────────────────────────────────────────
export const CreateCategorySchema = z.object({
  name: z.string().min(2, 'Category name must be at least 2 characters'),
  description: z.string().optional().nullable(),
  monthlyBudgetLimit: z.number().positive('Monthly budget limit must be positive').optional().nullable(),
  budgetInPaise: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

export const UpdateCategorySchema = z.object({
  name: z.string().min(2, 'Category name must be at least 2 characters').optional(),
  description: z.string().optional().nullable(),
  monthlyBudgetLimit: z.number().positive().optional().nullable(),
  budgetInPaise: z.boolean().optional().default(false),
  isActive: z.boolean().optional(),
});

// ─── Settings Schema ─────────────────────────────────────────────────────────
export const ExpenseSettingsSchema = z.object({
  branchId: z.string().optional().nullable(),
  autoApprovalThreshold: z.number().min(0, 'Threshold cannot be negative'),
  thresholdInPaise: z.boolean().optional().default(false),
  requireReceiptAbove: z.number().min(0).optional().nullable(),
  receiptAboveInPaise: z.boolean().optional().default(false),
  alertNegativeBalance: z.boolean().optional().default(true),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional().default(4),
});

export type ExpenseSettingsInput = z.infer<typeof ExpenseSettingsSchema>;

// ─── Report Export Query Schema ──────────────────────────────────────────────
export const ExportReportQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month', 'year']),
  branchId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'StartDate must be YYYY-MM-DD').optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export type ExportReportQuery = z.infer<typeof ExportReportQuerySchema>;
