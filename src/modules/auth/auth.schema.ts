import { z } from 'zod';

export const RegisterSchema = z
  .object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    firstName: z.string().min(1, 'First name is required').max(50),
    lastName: z.string().min(1, 'Last name is required').max(50),
    phone: z
      .string({ required_error: 'Phone number is required' })
      .min(10, 'Phone number must be at least 10 digits')
      .max(15, 'Phone number cannot exceed 15 digits'),
    accountType: z.enum(['B2C', 'B2B', 'CUSTOMER', 'B2B_CUSTOMER']).optional().default('B2C'),
    roleSlug: z.string().optional(),
    companyName: z.string().optional(),
    gstin: z.string().max(15, 'GSTIN cannot exceed 15 characters').optional().or(z.literal('')),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});

export const AdminLoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  twoFactorCode: z
    .string()
    .length(6, 'Two-factor code must be 6 digits')
    .optional(),
});

// Refresh token now lives in an httpOnly cookie — body field is optional backward-compat fallback
export const RefreshTokenSchema = z.object({
  refreshToken: z.string().optional(),
});

export const LogoutSchema = z.object({
  refreshToken: z.string().optional(),
});

export const ForgotPasswordSchema = z
  .object({
    email: z.string().optional(),
    gstin: z.string().optional(),
    identifier: z.string().optional(),
  })
  .refine((data) => Boolean(data.identifier?.trim() || data.email?.trim() || data.gstin?.trim()), {
    message: 'Please provide either a registered Email Address or GSTIN Number',
  });

export const VerifyResetOtpSchema = z.object({
  identifier: z.string().min(1, 'Email or GSTIN is required'),
  otp: z
    .string()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must contain only digits'),
});

export const ResetPasswordSchema = z
  .object({
    token: z.string().optional(),
    identifier: z.string().optional(),
    otp: z
      .string()
      .length(6, 'OTP must be exactly 6 digits')
      .regex(/^\d{6}$/, 'OTP must contain only digits')
      .optional(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().optional(),
  })
  .transform((data) => ({
    ...data,
    confirmPassword: data.confirmPassword || data.password,
  }))
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => Boolean(data.token?.trim() || (data.identifier?.trim() && data.otp?.trim())), {
    message: 'Either reset token or identifier and OTP must be provided',
  });

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().optional(),
  })
  .transform((data) => ({
    ...data,
    confirmPassword: data.confirmPassword || data.newPassword,
  }))
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const VerifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export const VerifyOtpSchema = z.object({
  email: z.string().email('Invalid email format'),
  otp: z
    .string()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must contain only digits'),
});

export const ResendVerificationSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const Enable2faSchema = z.object({
  code: z.string().min(1, '2FA Code is required'),
});

export const Verify2faSchema = z.object({
  code: z.string().min(1, '2FA Code is required'),
});

export const Disable2faSchema = z.object({
  code: z.string().optional(),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type AdminLoginInput = z.infer<typeof AdminLoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
