import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';
import { logger } from '../../config/logger';
import { storeOtpInRedis, verifyOtpFromRedis } from '../../services/redis/otp.redis';
import {
  generateAccessToken,
  generateRefreshToken,
  generateSecureToken,
  getRefreshTokenExpiry,
  getEmailVerificationExpiry,
  getPasswordResetExpiry,
  verifyAccessToken,
} from '../../utils/token.utils';
import {
  sendOtpEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendWelcomeEmail,
} from '../../utils/email.utils';
import type {
  RegisterInput,
  LoginInput,
  AdminLoginInput,
  ResetPasswordInput,
  ChangePasswordInput,
  VerifyOtpInput,
} from './auth.schema';

const SALT_ROUNDS = 12;

const generateOtp = (): string => {
  const buf = crypto.randomBytes(3);
  const num = (buf.readUIntBE(0, 3) % 900000) + 100000;
  return String(num);
};

const getOtpExpiry = (): Date => new Date(Date.now() + env.auth.otpTtlSeconds * 1000);

export const buildTokenPair = async (userId: string, email: string, roleSlug: string) => {
  const accessToken = generateAccessToken({ userId, email, roleSlug });
  const rawRefresh = generateRefreshToken();
  const expiresAt = getRefreshTokenExpiry();
  await prisma.refreshToken.create({ data: { token: rawRefresh, userId, expiresAt } });
  return { accessToken, refreshToken: rawRefresh };
};

export const getPrimaryRoleSlug = (userRoles: Array<{ role: { slug: string } }>): string =>
  userRoles[0]?.role.slug ?? 'customer';

export const register = async (input: RegisterInput) => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    if (existing.deletedAt === null) {
      throw new AppError('EMAIL_TAKEN', 'An account with this email already exists', 409);
    }
    // User was soft-deleted: purge or anonymize old soft-deleted user to free the unique email constraint
    try {
      await prisma.user.delete({ where: { id: existing.id } });
    } catch (_err) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { email: `deleted_${Date.now()}_${existing.email}` },
      });
    }
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const isB2B = input.accountType === 'B2B' || input.accountType === 'B2B_CUSTOMER' || !!(input.companyName && input.gstin);
  const targetSlug = input.roleSlug ?? (isB2B ? 'b2b-customer' : 'customer');

  let assignedRole = await prisma.role.findFirst({
    where: {
      OR: [
        { slug: targetSlug },
        { slug: targetSlug.replace('_', '-') },
        { slug: targetSlug.replace('-', '_') },
      ],
    },
  });

  if (!assignedRole) {
    if (isB2B) {
      assignedRole = await prisma.role.create({
        data: {
          name: 'B2B Customer',
          slug: 'b2b-customer',
          description: 'Business-to-business customer with custom pricing & quote access',
          isSystem: true,
        },
      });
    } else {
      assignedRole = await prisma.role.create({
        data: { name: 'Customer', slug: 'customer', description: 'Regular B2C customer', isSystem: true },
      });
    }
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      companyName: input.companyName || null,
      gstin: input.gstin || null,
      twoFactorEnabled: false,
      twoFactorBackupCodes: [],
      userRoles: { create: { roleId: assignedRole.id } },
    },
  });

  const otp = generateOtp();
  logger.info(`[Auth] OTP generated for registration`, { email: user.email, userId: user.id, otp });

  await prisma.emailVerification.create({
    data: { token: otp, userId: user.id, expiresAt: getOtpExpiry() },
  });
  logger.info(`[Auth] OTP stored in DB`, { userId: user.id, expiresAt: getOtpExpiry() });

  await storeOtpInRedis(user.email, otp, env.auth.otpTtlSeconds);
  logger.info(`[Auth] OTP stored in Redis`, { email: user.email, ttl: env.auth.otpTtlSeconds });

  let emailDelivered = false;
  let emailError: string | null = null;
  try {
    await sendOtpEmail(user.email, user.firstName, otp);
    emailDelivered = true;
    logger.info(`[Auth] OTP email sent successfully`, { to: user.email });
  } catch (emailErr: any) {
    emailError = emailErr?.message || String(emailErr);
    logger.error(`[Auth] OTP email delivery FAILED`, { to: user.email, error: emailError });
  }

  return {
    userId: user.id,
    email: user.email,
    requiresVerification: true,
    emailDelivered,
    ...(emailError && { emailError: 'Email delivery failed. Use "Resend OTP" to try again.' }),
  };
};

export const verifyOtp = async (input: VerifyOtpInput) => {
  logger.info(`[Auth] OTP verification attempt`, { email: input.email });

  const user = await prisma.user.findUnique({
    where: { email: input.email, deletedAt: null },
    include: { userRoles: { include: { role: true } } },
  });

  if (!user) throw new AppError('NOT_FOUND', 'No account found with this email address', 404);
  if (user.isVerified) throw new AppError('ALREADY_VERIFIED', 'Email is already verified', 400);

  const redisResult = await verifyOtpFromRedis(input.email, input.otp);
  logger.info(`[Auth] Redis OTP check`, { email: input.email, valid: redisResult.valid, message: redisResult.message });

  if (!redisResult.valid) {
    if (redisResult.message.includes('attempts')) {
      throw new AppError('TOO_MANY_ATTEMPTS', redisResult.message, 429);
    }
    // Redis has the OTP and it didn't match — throw immediately with correct message
    if (redisResult.message.includes('Incorrect OTP')) {
      throw new AppError('INVALID_OTP', 'Incorrect OTP code. Please try again.', 400);
    }
    // Redis unavailable or expired — fall through to DB check
  }

  const record = await prisma.emailVerification.findFirst({
    where: { userId: user.id, token: input.otp, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) {
    logger.warn(`[Auth] OTP DB check failed — invalid or expired`, { email: input.email });
    throw new AppError('INVALID_OTP', 'Invalid or expired OTP. Please request a new code.', 400);
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { isVerified: true, status: 'ACTIVE' } }),
    prisma.emailVerification.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  logger.info(`[Auth] OTP verified — user activated`, { userId: user.id, email: user.email });

  sendWelcomeEmail(user.email, user.firstName).catch((err) =>
    logger.error(`[Auth] Welcome email failed`, { to: user.email, error: err?.message || err })
  );

  const roleSlug = getPrimaryRoleSlug(user.userRoles);

  if (roleSlug === 'customer') {
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const { accessToken, refreshToken } = await buildTokenPair(user.id, user.email, roleSlug);
    logger.info(`[Auth] Auto-login tokens issued post-verification`, { userId: user.id });
    return {
      verified: true, autoLogin: true, accessToken, refreshToken,
      expiresIn: 3600, tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        companyName: user.companyName,
        gstin: user.gstin,
        role: roleSlug,
        avatar: user.avatar,
        isVerified: true,
      },
    };
  }

  return { verified: true, autoLogin: false };
};

export const login = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email, deletedAt: null },
    include: { userRoles: { include: { role: true } } },
  });

  if (!user || !(await bcrypt.compare(input.password, user.passwordHash)))
    throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  if (!user.isVerified)
    throw new AppError('EMAIL_NOT_VERIFIED', 'Please verify your email address using the 6-digit OTP code sent to your email before logging in.', 403);
  if (user.status === 'SUSPENDED')
    throw new AppError('ACCOUNT_SUSPENDED', 'Your account has been suspended', 403);
  if (user.status === 'INACTIVE')
    throw new AppError('ACCOUNT_INACTIVE', 'Your account is inactive', 403);

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const roleSlug = getPrimaryRoleSlug(user.userRoles);
  const { accessToken, refreshToken } = await buildTokenPair(user.id, user.email, roleSlug);

  return {
    accessToken, refreshToken, expiresIn: 3600, tokenType: 'Bearer',
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      companyName: user.companyName,
      gstin: user.gstin,
      role: roleSlug,
      avatar: user.avatar,
      isVerified: user.isVerified,
      mustChangePassword: user.mustChangePassword ?? false,
    },
  };
};

export const adminLogin = async (input: AdminLoginInput) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email, deletedAt: null },
    include: { userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } },
  });

  if (!user || !(await bcrypt.compare(input.password, user.passwordHash)))
    throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);

  const roleSlug = getPrimaryRoleSlug(user.userRoles);
  if (!['super-admin', 'admin'].includes(roleSlug))
    throw new AppError('FORBIDDEN', 'Admin access required', 403);
  if (user.status !== 'ACTIVE')
    throw new AppError('ACCOUNT_INACTIVE', 'Account is not active', 403);

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  // ─── 2FA Check ──────────────────────────────────────────────────────────────
  if (user.twoFactorEnabled) {
    // Issue a short-lived MFA token (5 min) so frontend can complete the 2FA challenge
    const mfaToken = generateAccessToken({ userId: user.id, email: user.email, roleSlug });
    return {
      requiresTwoFactor: true,
      mfaToken,
    };
  }

  const permissions = user.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.slug));
  const { accessToken, refreshToken } = await buildTokenPair(user.id, user.email, roleSlug);

  return {
    accessToken, refreshToken, expiresIn: 3600, tokenType: 'Bearer',
    requiresTwoFactor: false,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      companyName: user.companyName,
      gstin: user.gstin,
      role: roleSlug,
      permissions,
      avatar: user.avatar,
      mustChangePassword: user.mustChangePassword ?? false,
    },
  };
};


export const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    include: { userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } },
  });
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

  const permissions = user.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.slug));

  return {
    id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
    phone: user.phone, companyName: user.companyName, gstin: user.gstin,
    role: getPrimaryRoleSlug(user.userRoles), permissions, avatar: user.avatar,
    isVerified: user.isVerified, mustChangePassword: user.mustChangePassword ?? false,
    createdAt: user.createdAt, lastLoginAt: user.lastLoginAt,
  };
};

export const logout = async (refreshToken?: string) => {
  if (refreshToken) {
    await prisma.refreshToken.updateMany({ where: { token: refreshToken }, data: { revokedAt: new Date() } });
  }
};

export const refreshTokens = async (token: string) => {
  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date())
    throw new AppError('INVALID_TOKEN', 'Invalid or expired refresh token', 401);

  const user = await prisma.user.findUnique({
    where: { id: stored.userId, deletedAt: null },
    include: { userRoles: { include: { role: true } } },
  });
  if (!user || user.status !== 'ACTIVE')
    throw new AppError('UNAUTHORIZED', 'User not found or inactive', 401);

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

  const roleSlug = getPrimaryRoleSlug(user.userRoles);
  const { accessToken, refreshToken: newRefresh } = await buildTokenPair(user.id, user.email, roleSlug);
  return { accessToken, refreshToken: newRefresh, expiresIn: 3600 };
};

export const forgotPassword = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email, deletedAt: null } });
  if (!user) return;

  await prisma.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });

  const token = generateSecureToken();
  await prisma.passwordReset.create({ data: { token, userId: user.id, expiresAt: getPasswordResetExpiry() } });

  try {
    await sendPasswordResetEmail(user.email, user.firstName, token);
  } catch (err: any) {
    console.error('[ForgotPassword] Failed to send reset email:', err?.message || err);
  }
};

export const resetPassword = async (input: ResetPasswordInput) => {
  const record = await prisma.passwordReset.findUnique({ where: { token: input.token } });
  if (!record || record.usedAt || record.expiresAt < new Date())
    throw new AppError('INVALID_TOKEN', 'Invalid or expired reset token', 400);

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({ where: { userId: record.userId }, data: { revokedAt: new Date() } }),
  ]);
};

export const changePassword = async (userId: string, input: ChangePasswordInput) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

  const isMatch = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!isMatch) throw new AppError('INVALID_CREDENTIALS', 'Current password is incorrect', 401);

  const passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    }),
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);

  sendPasswordChangedEmail(user.email, user.firstName).catch(console.error);
};

export const verifyEmail = async (token: string) => {
  const record = await prisma.emailVerification.findUnique({ where: { token } });
  if (!record || record.usedAt || record.expiresAt < new Date())
    throw new AppError('INVALID_TOKEN', 'Invalid or expired verification token', 400);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { isVerified: true } }),
    prisma.emailVerification.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (user) sendWelcomeEmail(user.email, user.firstName).catch(console.error);
};

export const resendVerification = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email, deletedAt: null } });
  if (!user) return;
  if (user.isVerified) throw new AppError('ALREADY_VERIFIED', 'Email is already verified', 400);

  logger.info(`[Auth] Resending OTP`, { email: user.email, userId: user.id });

  // Invalidate all previous OTP records in DB
  await prisma.emailVerification.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });

  const otp = generateOtp();
  await prisma.emailVerification.create({ data: { token: otp, userId: user.id, expiresAt: getOtpExpiry() } });

  // Overwrite previous OTP in Redis (also resets failed-attempt counter)
  await storeOtpInRedis(user.email, otp, env.auth.otpTtlSeconds);
  logger.info(`[Auth] New OTP stored for resend`, { email: user.email, ttl: env.auth.otpTtlSeconds, otp });

  try {
    await sendOtpEmail(user.email, user.firstName, otp);
    logger.info(`[Auth] Resend OTP email sent successfully`, { to: user.email });
  } catch (err: any) {
    logger.error(`[Auth] Resend OTP email delivery FAILED`, { to: user.email, error: err?.message || err });
    throw new AppError('EMAIL_SEND_FAILED', 'Failed to deliver the OTP email. Please check your email address or try again.', 502);
  }
};
