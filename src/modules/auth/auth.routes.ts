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
  VerifyOtpSchema,
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
router.post('/verify-otp', authLimiter, validate(VerifyOtpSchema), controller.verifyOtp);
router.post('/resend-verification', emailLimiter, validate(ResendVerificationSchema), controller.resendVerification);

// Protected routes
router.get('/me', authenticate, controller.getMe);
router.post('/logout', authenticate, validate(LogoutSchema), controller.logout);
router.post('/change-password', authenticate, validate(ChangePasswordSchema), controller.changePassword);

// ─── 2FA Routes (PUBLIC — used during login flow, no access token exists yet) ──
// These endpoints are called BEFORE the user has a valid access token.
// They validate the TOTP code using a temporary mfaToken issued at login.
router.post('/2fa/login', authLimiter, controller.verify2FaLogin);
router.post('/2fa/authenticate', authLimiter, controller.verify2FaLogin);

// ─── 2FA Account Management Routes (PROTECTED — requires valid access token) ──
router.post('/2fa/setup', authenticate, controller.setup2Fa);
router.post('/2fa/generate', authenticate, controller.setup2Fa);
router.post('/2fa/enable', authenticate, controller.enable2Fa);
router.post('/2fa/verify', authenticate, controller.verify2Fa);
router.post('/2fa/validate', authenticate, controller.verify2Fa);
router.post('/2fa/disable', authenticate, controller.disable2Fa);
router.get('/2fa/status', authenticate, controller.get2FaStatus);
router.get('/2fa/me', authenticate, controller.get2FaStatus);
router.get('/2fa', authenticate, controller.get2FaStatus);

export default router;

