import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';
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

const buildTokenPair = async (userId: string, email: string, roleSlug: string) => {
  const accessToken = generateAccessToken({ userId, email, roleSlug });
  const rawRefresh = generateRefreshToken();
  const expiresAt = getRefreshTokenExpiry();
  await prisma.refreshToken.create({ data: { token: rawRefresh, userId, expiresAt } });
  return { accessToken, refreshToken: rawRefresh };
};

const getPrimaryRoleSlug = (userRoles: Array<{ role: { slug: string } }>): string =>
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

  let customerRole = await prisma.role.findUnique({ where: { slug: 'customer' } });
  if (!customerRole) {
    customerRole = await prisma.role.create({
      data: { name: 'Customer', slug: 'customer', description: 'Regular B2C customer', isSystem: true },
    });
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      companyName: input.companyName,
      gstin: input.gstin,
      userRoles: { create: { roleId: customerRole.id } },
    },
  });

  const otp = generateOtp();
  await prisma.emailVerification.create({
    data: { token: otp, userId: user.id, expiresAt: getOtpExpiry() },
  });

  await storeOtpInRedis(user.email, otp, env.auth.otpTtlSeconds);

  try {
    await sendOtpEmail(user.email, user.firstName, otp);
  } catch (emailErr: any) {
    console.error('[Register] Failed to send OTP email:', emailErr?.message || emailErr);
  }

  return { userId: user.id, email: user.email, requiresVerification: true };
};

export const verifyOtp = async (input: VerifyOtpInput) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email, deletedAt: null },
    include: { userRoles: { include: { role: true } } },
  });

  if (!user) throw new AppError('NOT_FOUND', 'No account found with this email address', 404);
  if (user.isVerified) throw new AppError('ALREADY_VERIFIED', 'Email is already verified', 400);

  const redisResult = await verifyOtpFromRedis(input.email, input.otp);
  if (!redisResult.valid && redisResult.message.includes('attempts')) {
    throw new AppError('TOO_MANY_ATTEMPTS', redisResult.message, 429);
  }

  const record = await prisma.emailVerification.findFirst({
    where: { userId: user.id, token: input.otp, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) throw new AppError('INVALID_OTP', 'Invalid or expired OTP. Please request a new code.', 400);

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { isVerified: true, status: 'ACTIVE' } }),
    prisma.emailVerification.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  sendWelcomeEmail(user.email, user.firstName).catch((err) =>
    console.error('[VerifyOtp] Failed to send welcome email:', err?.message || err)
  );

  const roleSlug = getPrimaryRoleSlug(user.userRoles);

  if (roleSlug === 'customer') {
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const { accessToken, refreshToken } = await buildTokenPair(user.id, user.email, roleSlug);
    return {
      verified: true, autoLogin: true, accessToken, refreshToken,
      expiresIn: 3600, tokenType: 'Bearer',
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: roleSlug, avatar: user.avatar, isVerified: true },
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
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: roleSlug, avatar: user.avatar, isVerified: user.isVerified },
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

  const permissions = user.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.slug));
  const { accessToken, refreshToken } = await buildTokenPair(user.id, user.email, roleSlug);

  return {
    accessToken, refreshToken, expiresIn: 3600, tokenType: 'Bearer',
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: roleSlug, permissions, avatar: user.avatar },
    requiresTwoFactor: false,
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
    isVerified: user.isVerified, createdAt: user.createdAt, lastLoginAt: user.lastLoginAt,
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
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
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

  await prisma.emailVerification.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });

  const otp = generateOtp();
  await prisma.emailVerification.create({ data: { token: otp, userId: user.id, expiresAt: getOtpExpiry() } });
  await storeOtpInRedis(user.email, otp, env.auth.otpTtlSeconds);

  try {
    await sendOtpEmail(user.email, user.firstName, otp);
  } catch (err: any) {
    console.error('[ResendVerification] Failed to send OTP email:', err?.message || err);
  }
};
