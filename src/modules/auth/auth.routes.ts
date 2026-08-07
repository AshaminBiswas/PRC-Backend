import { Router } from 'express';
import * as controller from './auth.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import { authLimiter, emailLimiter } from '../../middleware/rateLimit.middleware';
import {
  RegisterSchema,
  LoginSchema,
  AdminLoginSchema,
  RefreshTokenSchema,
  LogoutSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
  VerifyEmailSchema,
  ResendVerificationSchema,
} from './auth.schema';

const router = Router();

// Public routes
router.post('/register', authLimiter, validate(RegisterSchema), controller.register);
router.post('/login', authLimiter, validate(LoginSchema), controller.login);
router.post('/admin/login', authLimiter, validate(AdminLoginSchema), controller.adminLogin);
router.post('/refresh-token', validate(RefreshTokenSchema), controller.refreshToken);
router.post('/forgot-password', emailLimiter, validate(ForgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password', validate(ResetPasswordSchema), controller.resetPassword);
router.post('/verify-email', validate(VerifyEmailSchema), controller.verifyEmail);
router.post('/resend-verification', emailLimiter, validate(ResendVerificationSchema), controller.resendVerification);

// Protected routes
router.get('/me', authenticate, controller.getMe);
router.post('/logout', authenticate, validate(LogoutSchema), controller.logout);
router.post('/change-password', authenticate, validate(ChangePasswordSchema), controller.changePassword);

export default router;
