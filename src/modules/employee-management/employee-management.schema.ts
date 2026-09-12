import { z } from 'zod';

// ─── Regex Formats ────────────────────────────────────────────────────────────
export const AADHAAR_REGEX = /^\d{12}$/;
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const VOTER_ID_REGEX = /^[A-Z]{3}[0-9]{7}$/;
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// ─── Enums ───────────────────────────────────────────────────────────────────
export const GovernmentIdTypeEnum = z.enum(['AADHAAR', 'PAN', 'VOTER_ID']);
export const EmployeeStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED']);
export const AttendanceStatusEnum = z.enum(['PRESENT', 'CL', 'EL', 'UL', 'HALF_DAY', 'LEAVE']);
export const PayrollStatusEnum = z.enum(['DRAFT', 'FINALIZED', 'PAID']);
export const LeaveTypeEnum = z.enum(['CL', 'EL']);
export const LeaveTransactionTypeEnum = z.enum(['ACCRUAL', 'USAGE', 'ADJUSTMENT']);

// ─── Master Data Schemas ──────────────────────────────────────────────────────
export const CreateEmployeeSchema = z
  .object({
    name: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Valid email address is required for payslips'),
    phone: z.string().min(10, 'Valid phone number is required'),
    address: z.string().min(5, 'Full residential address is required'),
    governmentIdType: GovernmentIdTypeEnum,
    governmentIdNumber: z.string().min(4, 'Government ID number is required'),
    bankAccountNumber: z
      .string()
      .optional()
      .nullable()
      .transform((val) => {
        if (!val) return null;
        const clean = val.trim();
        return clean && clean.toUpperCase() !== 'N/A' && clean.toUpperCase() !== 'NA' ? clean : null;
      }),
    bankIfsc: z
      .string()
      .optional()
      .nullable()
      .transform((val) => {
        if (!val) return null;
        const clean = val.trim().toUpperCase();
        return clean && clean !== 'N/A' && clean !== 'NA' && clean !== 'NONE' && clean !== 'NIL' ? clean : null;
      })
      .refine((val) => !val || IFSC_REGEX.test(val), {
        message: 'Invalid IFSC code format (e.g. SBIN0001234)',
      }),
    bankName: z
      .string()
      .optional()
      .nullable()
      .transform((val) => {
        if (!val) return null;
        const clean = val.trim();
        return clean && clean.toUpperCase() !== 'N/A' && clean.toUpperCase() !== 'NA' ? clean : null;
      }),
    bankAccountHolder: z
      .string()
      .optional()
      .nullable()
      .transform((val) => {
        if (!val) return null;
        const clean = val.trim();
        return clean && clean.toUpperCase() !== 'N/A' && clean.toUpperCase() !== 'NA' ? clean : null;
      }),
    designation: z.string().min(2, 'Designation is required'),
    department: z.string().min(2, 'Department is required'),
    responsibilities: z.string().optional().nullable(),
    monthlyCtc: z.coerce.number().positive('Monthly CTC must be greater than 0'),
    joiningDate: z.coerce.date({ invalid_type_error: 'Valid joining date is required' }),
    status: EmployeeStatusEnum.default('ACTIVE'),
  })
  .superRefine((data, ctx) => {
    const cleanId = data.governmentIdNumber.trim().toUpperCase();
    if (data.governmentIdType === 'AADHAAR' && !AADHAAR_REGEX.test(cleanId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['governmentIdNumber'],
        message: 'Aadhaar number must be exactly 12 numeric digits',
      });
    } else if (data.governmentIdType === 'PAN' && !PAN_REGEX.test(cleanId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['governmentIdNumber'],
        message: 'PAN must follow format: 5 letters, 4 numbers, 1 letter (e.g. ABCDE1234F)',
      });
    } else if (data.governmentIdType === 'VOTER_ID' && !VOTER_ID_REGEX.test(cleanId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['governmentIdNumber'],
        message: 'Voter ID must follow format: 3 letters followed by 7 numbers (e.g. ABC1234567)',
      });
    }
  });

export const UpdateEmployeeSchema = z
  .object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(10).optional(),
    address: z.string().min(5).optional(),
    governmentIdType: GovernmentIdTypeEnum.optional(),
    governmentIdNumber: z.string().min(4).optional(),
    bankAccountNumber: z
      .string()
      .optional()
      .nullable()
      .transform((val) => {
        if (!val) return null;
        const clean = val.trim();
        return clean && clean.toUpperCase() !== 'N/A' && clean.toUpperCase() !== 'NA' ? clean : null;
      }),
    bankIfsc: z
      .string()
      .optional()
      .nullable()
      .transform((val) => {
        if (!val) return null;
        const clean = val.trim().toUpperCase();
        return clean && clean !== 'N/A' && clean !== 'NA' && clean !== 'NONE' && clean !== 'NIL' ? clean : null;
      })
      .refine((val) => !val || IFSC_REGEX.test(val), {
        message: 'Invalid IFSC code format (e.g. SBIN0001234)',
      }),
    bankName: z
      .string()
      .optional()
      .nullable()
      .transform((val) => {
        if (!val) return null;
        const clean = val.trim();
        return clean && clean.toUpperCase() !== 'N/A' && clean.toUpperCase() !== 'NA' ? clean : null;
      }),
    bankAccountHolder: z
      .string()
      .optional()
      .nullable()
      .transform((val) => {
        if (!val) return null;
        const clean = val.trim();
        return clean && clean.toUpperCase() !== 'N/A' && clean.toUpperCase() !== 'NA' ? clean : null;
      }),
    designation: z.string().min(2).optional(),
    department: z.string().min(2).optional(),
    responsibilities: z.string().optional().nullable(),
    monthlyCtc: z.coerce.number().positive().optional(),
    joiningDate: z.coerce.date().optional(),
    status: EmployeeStatusEnum.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.governmentIdType && data.governmentIdNumber) {
      const cleanId = data.governmentIdNumber.trim().toUpperCase();
      if (data.governmentIdType === 'AADHAAR' && !AADHAAR_REGEX.test(cleanId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['governmentIdNumber'],
          message: 'Aadhaar number must be exactly 12 numeric digits',
        });
      } else if (data.governmentIdType === 'PAN' && !PAN_REGEX.test(cleanId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['governmentIdNumber'],
          message: 'PAN must follow format: 5 letters, 4 numbers, 1 letter',
        });
      } else if (data.governmentIdType === 'VOTER_ID' && !VOTER_ID_REGEX.test(cleanId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['governmentIdNumber'],
          message: 'Voter ID must follow format: 3 letters followed by 7 numbers',
        });
      }
    }
  });

export const ListEmployeesQuerySchema = z.object({
  search: z.string().optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
  status: EmployeeStatusEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

// ─── Attendance Schemas ───────────────────────────────────────────────────────
export const RecordAttendanceItemSchema = z.object({
  employeeId: z.string().uuid('Invalid Employee ID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  status: AttendanceStatusEnum.default('PRESENT'),
  isSundayOverride: z.boolean().default(false),
  overtimeHours: z.coerce.number().min(0).max(24).default(0),
  notes: z.string().optional().nullable(),
});

export const BatchAttendanceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  records: z.array(
    z.object({
      employeeId: z.string().uuid(),
      status: AttendanceStatusEnum.default('PRESENT'),
      isSundayOverride: z.boolean().default(false),
      overtimeHours: z.coerce.number().min(0).max(24).default(0),
      notes: z.string().optional().nullable(),
    })
  ),
});

export const ListAttendanceQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
  employeeId: z.string().uuid().optional(),
});

// ─── Leave Ledger Schemas ─────────────────────────────────────────────────────
export const AdjustLeaveSchema = z.object({
  leaveType: LeaveTypeEnum,
  transactionType: LeaveTransactionTypeEnum,
  amount: z.coerce.number(),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
  reason: z.string().min(2, 'Reason for leave adjustment is required'),
});

export const AccrueMonthlyLeaveSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
});

// ─── Advances & Deductions Schemas ───────────────────────────────────────────
export const CreateAdvanceSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  amount: z.coerce.number().positive('Advance amount must be greater than 0'),
  reason: z.string().min(2, 'Advance reason is required'),
  advanceDate: z.coerce.date().default(() => new Date()),
  recoveryMonth: z.coerce.number().int().min(1).max(12),
  recoveryYear: z.coerce.number().int().min(2020).max(2100),
});

export const UpdateAdvanceSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  reason: z.string().min(2).optional(),
  advanceDate: z.coerce.date().optional(),
  recoveryMonth: z.coerce.number().int().min(1).max(12).optional(),
  recoveryYear: z.coerce.number().int().min(2020).max(2100).optional(),
  isRecovered: z.boolean().optional(),
});

export const ListAdvancesQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  recoveryMonth: z.coerce.number().int().min(1).max(12).optional(),
  recoveryYear: z.coerce.number().int().min(2020).max(2100).optional(),
  isRecovered: z
    .string()
    .optional()
    .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
});

export const CreateDeductionSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  amount: z.coerce.number().positive('Deduction amount must be greater than 0'),
  reason: z.string().min(2, 'Deduction reason is required'),
  applyMonth: z.coerce.number().int().min(1).max(12),
  applyYear: z.coerce.number().int().min(2020).max(2100),
});

export const UpdateDeductionSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  reason: z.string().min(2).optional(),
  applyMonth: z.coerce.number().int().min(1).max(12).optional(),
  applyYear: z.coerce.number().int().min(2020).max(2100).optional(),
  isApplied: z.boolean().optional(),
});

export const ListDeductionsQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  applyMonth: z.coerce.number().int().min(1).max(12).optional(),
  applyYear: z.coerce.number().int().min(2020).max(2100).optional(),
  isApplied: z
    .string()
    .optional()
    .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
});

// ─── Payroll Calculation & Run Schemas ────────────────────────────────────────
export const CalculatePayrollSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
  employeeId: z.string().uuid().optional(),
  previewOnly: z.boolean().default(false),
});

export const MarkPayrollPaidSchema = z.object({
  paymentMode: z.string().min(1, 'Payment mode is required (e.g. Bank Transfer, UPI, Cheque, Cash)'),
  paymentReference: z.string().optional().nullable(),
  paymentNotes: z.string().optional().nullable(),
  paidAt: z.coerce.date().default(() => new Date()),
});

export const ListPayrollQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
  employeeId: z.string().uuid().optional(),
  status: PayrollStatusEnum.optional(),
});

export const ResendPayslipEmailSchema = z.object({
  recipientEmail: z.string().email().optional(),
});

// ─── TypeScript Types ─────────────────────────────────────────────────────────
export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeSchema>;
export type ListEmployeesQuery = z.infer<typeof ListEmployeesQuerySchema>;

export type RecordAttendanceItemInput = z.infer<typeof RecordAttendanceItemSchema>;
export type BatchAttendanceInput = z.infer<typeof BatchAttendanceSchema>;
export type ListAttendanceQuery = z.infer<typeof ListAttendanceQuerySchema>;

export type AdjustLeaveInput = z.infer<typeof AdjustLeaveSchema>;
export type AccrueMonthlyLeaveInput = z.infer<typeof AccrueMonthlyLeaveSchema>;

export type CreateAdvanceInput = z.infer<typeof CreateAdvanceSchema>;
export type UpdateAdvanceInput = z.infer<typeof UpdateAdvanceSchema>;
export type ListAdvancesQuery = z.infer<typeof ListAdvancesQuerySchema>;

export type CreateDeductionInput = z.infer<typeof CreateDeductionSchema>;
export type UpdateDeductionInput = z.infer<typeof UpdateDeductionSchema>;
export type ListDeductionsQuery = z.infer<typeof ListDeductionsQuerySchema>;

export type CalculatePayrollInput = z.infer<typeof CalculatePayrollSchema>;
export type MarkPayrollPaidInput = z.infer<typeof MarkPayrollPaidSchema>;
export type ListPayrollQuery = z.infer<typeof ListPayrollQuerySchema>;
