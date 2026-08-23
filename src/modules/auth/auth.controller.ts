import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { sendSuccess, sendMessage } from '../../utils/response';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await authService.register(req.body);
    sendSuccess(res, data, 'Registration successful. Please verify your email.', 201);
  } catch (error) { next(error); }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await authService.login(req.body);
    sendSuccess(res, data);
  } catch (error) { next(error); }
};

export const adminLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await authService.adminLogin(req.body);

    // If 2FA is required, return mfaToken for the 2FA challenge step
    if ((data as any).requiresTwoFactor && (data as any).mfaToken) {
      sendSuccess(res, {
        requiresTwoFactor: true,
        mfaToken: (data as any).mfaToken,
        message: 'Please complete 2FA verification',
      });
      return;
    }

    sendSuccess(res, data);
  } catch (error) { next(error); }
};


export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await authService.getMe(req.user!.id);
    sendSuccess(res, data);
  } catch (error) { next(error); }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.logout(req.body?.refreshToken);
    sendMessage(res, 'Logged out successfully');
  } catch (error) { next(error); }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await authService.refreshTokens(req.body.refreshToken);
    sendSuccess(res, data);
  } catch (error) { next(error); }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.forgotPassword(req.body.email);
    sendMessage(res, 'Password reset instructions sent to your email');
  } catch (error) { next(error); }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.resetPassword(req.body);
    sendMessage(res, 'Password reset successful');
  } catch (error) { next(error); }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.changePassword(req.user!.id, req.body);
    sendMessage(res, 'Password changed successfully');
  } catch (error) { next(error); }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.verifyEmail(req.body.token);
    sendMessage(res, 'Email verified successfully');
  } catch (error) { next(error); }
};

export const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await authService.verifyOtp(req.body);
    sendSuccess(res, data, data.autoLogin ? 'Email verified. You are now logged in.' : 'Email verified successfully.');
  } catch (error) { next(error); }
};

export const resendVerification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.resendVerification(req.body.email);
    sendMessage(res, 'Verification email sent');
  } catch (error) { next(error); }
};

// ─── 2FA CONTROLLER HANDLERS ──────────────────────────────────────────────────

/**
 * PUBLIC — Called during login 2FA challenge flow (no access token yet).
 * Validates a TOTP code + mfaToken. Does NOT require authenticate middleware.
 */
export const verify2FaLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, mfaToken } = req.body;

    if (!code) {
      const { AppError } = await import('../../middleware/error.middleware');
      throw new AppError('BAD_REQUEST', '2FA code is required', 400);
    }

    if (!mfaToken) {
      const { AppError } = await import('../../middleware/error.middleware');
      throw new AppError('BAD_REQUEST', 'MFA token is required. Please login first to receive an mfaToken.', 400);
    }

    const cleanCode = String(code).trim();
    let userId: string | null = null;
    let userEmail: string | null = null;

    // Decode the mfaToken (temporary JWT issued at login when 2FA is required)
    try {
      const jwt = await import('jsonwebtoken');
      const { env } = await import('../../config/env');
      const decoded = jwt.default.verify(mfaToken, env.jwt.accessSecret) as any;
      userId = decoded?.userId || decoded?.id || null;
      userEmail = decoded?.email || null;
    } catch {
      const { AppError } = await import('../../middleware/error.middleware');
      throw new AppError('UNAUTHORIZED', 'Invalid or expired MFA token. Please login again.', 401);
    }

    if (!userId) {
      const { AppError } = await import('../../middleware/error.middleware');
      throw new AppError('UNAUTHORIZED', 'Invalid MFA token. Please login again.', 401);
    }

    // Verify the TOTP/backup code against this specific user's 2FA secret
    const twoFactorService = await import('./twoFactor.service');
    const isValid = await twoFactorService.verify2FaCode(userId, cleanCode);

    if (!isValid) {
      const { AppError } = await import('../../middleware/error.middleware');
      throw new AppError('UNAUTHORIZED', 'Invalid 2FA code. Please check your authenticator app and try again.', 401);
    }

    // Load user and issue real JWT tokens
    const prisma = (await import('../../config/database')).default;
    const { buildTokenPair, getPrimaryRoleSlug } = await import('./auth.service');

    const dbUser = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      include: { userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } },
    });

    if (!dbUser) {
      const { AppError } = await import('../../middleware/error.middleware');
      throw new AppError('NOT_FOUND', 'User not found', 404);
    }

    if (dbUser.status !== 'ACTIVE') {
      const { AppError } = await import('../../middleware/error.middleware');
      throw new AppError('ACCOUNT_INACTIVE', 'Account is not active', 403);
    }

    const roleSlug = getPrimaryRoleSlug(dbUser.userRoles);
    const { accessToken, refreshToken } = await buildTokenPair(dbUser.id, dbUser.email, roleSlug);
    const permissions = dbUser.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.slug));

    sendSuccess(
      res,
      {
        valid: true,
        verified: true,
        accessToken,
        refreshToken,
        expiresIn: 3600,
        tokenType: 'Bearer',
        user: {
          id: dbUser.id,
          email: dbUser.email,
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
          role: roleSlug,
          permissions,
          isTwoFactorEnabled: true,
        },
      },
      '2FA verification successful'
    );
  } catch (error) { next(error); }
};


export const setup2Fa = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const twoFactorService = await import('./twoFactor.service');
    const userEmail = (req.user as any)?.email || 'admin@prchardware.in';
    const data = await twoFactorService.setup2Fa(req.user!.id, userEmail);
    sendSuccess(res, data, '2FA setup generated successfully');
  } catch (error) { next(error); }
};

export const enable2Fa = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const twoFactorService = await import('./twoFactor.service');
    const data = await twoFactorService.enable2Fa(req.user!.id, req.body.code);
    sendSuccess(res, data, '2FA enabled successfully');
  } catch (error) { next(error); }
};

export const get2FaStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const twoFactorService = await import('./twoFactor.service');
    const data = await twoFactorService.get2FaStatus(req.user!.id);
    sendSuccess(res, data);
  } catch (error) { next(error); }
};

export const verify2Fa = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const twoFactorService = await import('./twoFactor.service');
    const isValid = await twoFactorService.verify2FaCode(req.user!.id, req.body.code);
    if (!isValid) {
      const { AppError } = await import('../../middleware/error.middleware');
      throw new AppError('BAD_REQUEST', 'Invalid 2FA code', 400);
    }
    sendSuccess(res, { valid: true }, '2FA code verified successfully');
  } catch (error) { next(error); }
};

export const disable2Fa = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const twoFactorService = await import('./twoFactor.service');
    const data = await twoFactorService.disable2Fa(req.user!.id, req.body.code);
    sendSuccess(res, data, '2FA disabled successfully');
  } catch (error) { next(error); }
};

