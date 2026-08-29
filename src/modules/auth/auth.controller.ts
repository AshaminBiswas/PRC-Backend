import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { sendSuccess, sendMessage } from '../../utils/response';
import { env } from '../../config/env';

// ─── Cookie Helpers ───────────────────────────────────────────────────────────

const REFRESH_COOKIE_NAME = 'prc_refresh';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

/**
 * Write the refresh token into an httpOnly, Secure, SameSite=Strict cookie.
 * The raw token is NEVER exposed in the JSON response body.
 */
function setRefreshCookie(res: Response, rawRefreshToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, rawRefreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_COOKIE_MAX_AGE,
    path: '/',
  });
}

/** Clear the refresh token cookie on logout. */
function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
}

/** Read refresh token from httpOnly cookie, with fallback to request body for backward compat. */
function readRefreshToken(req: Request): string | undefined {
  return req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
}

// ─── Auth Controllers ─────────────────────────────────────────────────────────

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await authService.register(req.body);
    sendSuccess(res, data, 'Registration successful. Please verify your email.', 201);
  } catch (error) { next(error); }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await authService.login(req.body);
    setRefreshCookie(res, data.refreshToken);
    // Strip refreshToken from body — client must use the cookie
    const { refreshToken: _rt, ...safeData } = data;
    sendSuccess(res, { ...safeData, expiresIn: 900 });
  } catch (error) { next(error); }
};

export const adminLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await authService.adminLogin(req.body);

    // 2FA required — return mfaToken challenge (no cookie yet)
    if ((data as any).requiresTwoFactor && (data as any).mfaToken) {
      sendSuccess(res, {
        requiresTwoFactor: true,
        mfaToken: (data as any).mfaToken,
        message: 'Please complete 2FA verification',
      });
      return;
    }

    const fullData = data as any;
    setRefreshCookie(res, fullData.refreshToken);
    const { refreshToken: _rt, ...safeData } = fullData;
    sendSuccess(res, { ...safeData, expiresIn: 900 });
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
    const refreshToken = readRefreshToken(req);
    await authService.logout(refreshToken);
    clearRefreshCookie(res);
    sendMessage(res, 'Logged out successfully');
  } catch (error) { next(error); }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = readRefreshToken(req);
    if (!token) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Refresh token is required' } });
      return;
    }
    const data = await authService.refreshTokens(token);
    setRefreshCookie(res, data.refreshToken);
    // Only return the new access token — refresh token stays in cookie
    sendSuccess(res, { accessToken: data.accessToken, expiresIn: 900, tokenType: 'Bearer' });
  } catch (error) { next(error); }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const identifier = req.body.identifier || req.body.email || req.body.gstin;
    const result = await authService.forgotPassword(identifier);
    sendSuccess(res, result, result?.message || 'Password reset OTP sent to your registered email');
  } catch (error) { next(error); }
};

export const verifyResetOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identifier, otp } = req.body;
    const result = await authService.verifyResetOtp(identifier, otp);
    sendSuccess(res, result, result.message);
  } catch (error) { next(error); }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.resetPassword(req.body);
    // Reset revokes all refresh tokens — clear the cookie too
    clearRefreshCookie(res);
    sendSuccess(res, result, result.message);
  } catch (error) { next(error); }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.changePassword(req.user!.id, req.body);
    // changePassword revokes all refresh tokens — force re-login
    clearRefreshCookie(res);
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
    if (data.autoLogin && (data as any).refreshToken) {
      setRefreshCookie(res, (data as any).refreshToken);
      const { refreshToken: _rt, ...safeData } = data as any;
      sendSuccess(res, { ...safeData, expiresIn: 900 }, 'Email verified. You are now logged in.');
      return;
    }
    sendSuccess(res, data, 'Email verified successfully.');
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

    // Decode the mfaToken (temporary JWT issued at login when 2FA is required)
    try {
      const jwt = await import('jsonwebtoken');
      const decoded = jwt.default.verify(mfaToken, env.jwt.accessSecret) as any;
      userId = decoded?.userId || decoded?.id || null;
    } catch {
      const { AppError } = await import('../../middleware/error.middleware');
      throw new AppError('UNAUTHORIZED', 'Invalid or expired MFA token. Please login again.', 401);
    }

    if (!userId) {
      const { AppError } = await import('../../middleware/error.middleware');
      throw new AppError('UNAUTHORIZED', 'Invalid MFA token. Please login again.', 401);
    }

    const twoFactorService = await import('./twoFactor.service');
    const isValid = await twoFactorService.verify2FaCode(userId, cleanCode);

    if (!isValid) {
      const { AppError } = await import('../../middleware/error.middleware');
      throw new AppError('UNAUTHORIZED', 'Invalid 2FA code. Please check your authenticator app and try again.', 401);
    }

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
    const { accessToken, refreshToken: rawRefresh } = await buildTokenPair(dbUser.id, dbUser.email, roleSlug);
    const permissions = dbUser.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.slug));

    setRefreshCookie(res, rawRefresh);

    sendSuccess(
      res,
      {
        valid: true,
        verified: true,
        accessToken,
        expiresIn: 900,
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
