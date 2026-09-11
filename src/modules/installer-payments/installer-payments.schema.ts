import { z } from 'zod';

// ─── Cubicle Model Schemas ───────────────────────────────────────────────────

export const CreateCubicleModelSchema = z.object({
  modelName: z.string().min(1, 'Model name is required').trim(),
  installationPrice: z.coerce.number().positive('Installation price must be greater than 0'),
  isActive: z.boolean().optional().default(true),
});

export type CreateCubicleModelInput = z.infer<typeof CreateCubicleModelSchema>;

export const UpdateCubicleModelSchema = z.object({
  modelName: z.string().min(1, 'Model name cannot be empty').trim().optional(),
  installationPrice: z.coerce.number().positive('Installation price must be greater than 0').optional(),
  isActive: z.boolean().optional(),
});

export type UpdateCubicleModelInput = z.infer<typeof UpdateCubicleModelSchema>;

// ─── Cubicle Installer Directory Schemas (Master) ───────────────────────────

export const CreateCubicleInstallerSchema = z.object({
  name: z.string().min(1, 'Installer name is required').trim(),
  email: z.string().email('Valid installer email is required').trim().toLowerCase(),
  phone: z.string().trim().optional(),
  isActive: z.boolean().optional().default(true),
});

export type CreateCubicleInstallerInput = z.infer<typeof CreateCubicleInstallerSchema>;

export const UpdateCubicleInstallerSchema = z.object({
  name: z.string().min(1, 'Installer name cannot be empty').trim().optional(),
  email: z.string().email('Valid installer email is required').trim().toLowerCase().optional(),
  phone: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateCubicleInstallerInput = z.infer<typeof UpdateCubicleInstallerSchema>;

// ─── Bill Line Item Schema ───────────────────────────────────────────────────

export const BillItemInputSchema = z.object({
  modelId: z.string().min(1, 'Cubicle model ID is required'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
});

export type BillItemInput = z.infer<typeof BillItemInputSchema>;

// ─── Installer Bill Schemas ──────────────────────────────────────────────────

export const CreateInstallerBillSchema = z
  .object({
    installerId: z.string().optional(),
    installerName: z.string().min(1, 'Installer name is required').trim(),
    installerEmail: z.string().email('Valid installer email is required').trim().toLowerCase(),
    installDate: z.string().min(1, 'Date of installation is required'),
    isNcr: z.boolean().default(false),
    travelExpenses: z.coerce.number().min(0, 'Travel expenses cannot be negative').default(0),
    siteAddress: z.string().min(3, 'Installation site address is required').trim(),
    sitePin: z
      .string()
      .regex(/^\d{6}$/, 'Site PIN must be a valid 6-digit Indian postal code')
      .trim(),
    items: z.array(BillItemInputSchema).min(1, 'At least one cubicle model is required'),
    initialAmountPaid: z.coerce.number().min(0).default(0).optional(),
    paymentDate: z.string().optional(),
    paymentMode: z.string().optional(),
    notes: z.string().min(1, 'Internal Notes are mandatory').trim(),
  })
  .superRefine((data, ctx) => {
    // If NCR is false, travelExpenses is enabled + required (must be >= 0, can be 0 or more, but when NCR is true, must be forced to 0)
    if (data.isNcr && data.travelExpenses > 0) {
      data.travelExpenses = 0;
    }
  });

export type CreateInstallerBillInput = z.infer<typeof CreateInstallerBillSchema>;

export const UpdateInstallerBillSchema = z.object({
  installerName: z.string().min(1).trim().optional(),
  installerEmail: z.string().email().trim().toLowerCase().optional(),
  installDate: z.string().optional(),
  isNcr: z.boolean().optional(),
  travelExpenses: z.coerce.number().min(0).optional(),
  siteAddress: z.string().min(3).trim().optional(),
  sitePin: z
    .string()
    .regex(/^\d{6}$/, 'Site PIN must be a valid 6-digit Indian postal code')
    .trim()
    .optional(),
  notes: z.string().optional(),
});

export type UpdateInstallerBillInput = z.infer<typeof UpdateInstallerBillSchema>;

// ─── Record Payment Installment Schema ───────────────────────────────────────

export const RecordPaymentSchema = z.object({
  amount: z.coerce.number().positive('Payment amount must be greater than 0'),
  paymentDate: z.string().min(1, 'Payment date is required'),
  paymentMode: z.string().min(1, 'Payment mode is required').default('BANK_TRANSFER'),
  referenceNote: z.string().optional(),
});

export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;

// ─── Query Schemas ───────────────────────────────────────────────────────────

export const ListInstallerBillsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ALL', 'PARTIAL', 'CLEARED']).optional().default('ALL'),
  isNcr: z.string().optional(), // 'all' | 'true' | 'false'
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListInstallerBillsQuery = z.infer<typeof ListInstallerBillsQuerySchema>;

export const ExportBillsQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2020).max(2099).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['ALL', 'PARTIAL', 'CLEARED']).optional().default('ALL'),
});

export type ExportBillsQuery = z.infer<typeof ExportBillsQuerySchema>;
