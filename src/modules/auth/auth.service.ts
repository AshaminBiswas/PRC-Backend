import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
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
} from './auth.schema';

const SALT_ROUNDS = 10;

// ─── Helper: build token pair ─────────────────────────────────────────────────

const buildTokenPair = async (userId: string, email: string, roleSlug: string) => {
  const accessToken = generateAccessToken({ userId, email, roleSlug });
  const rawRefresh = generateRefreshToken();
  const expiresAt = getRefreshTokenExpiry();

  await prisma.refreshToken.create({
    data: { token: rawRefresh, userId, expiresAt },
  });

  return { accessToken, refreshToken: rawRefresh };
};

// ─── Helper: get primary role slug ────────────────────────────────────────────

const getPrimaryRoleSlug = (userRoles: Array<{ role: { slug: string } }>): string => {
  return userRoles[0]?.role.slug ?? 'customer';
};

// ─── Register ─────────────────────────────────────────────────────────────────

export const register = async (input: RegisterInput) => {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) {
    throw new AppError('EMAIL_TAKEN', 'An account with this email already exists', 409);
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  // Ensure default regular B2C Customer role exists and assign to new user
  let customerRole = await prisma.role.findUnique({ where: { slug: 'customer' }, select: { id: true } });
  if (!customerRole) {
    customerRole = await prisma.role.create({
      data: {
        name: 'Customer',
        slug: 'customer',
        description: 'Regular B2C customer',
        isSystem: true,
      },
      select: { id: true },
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
      userRoles: {
        create: { roleId: customerRole.id },
      },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
    },
  });

  // Create email verification token
  const verifyToken = generateSecureToken();
  await prisma.emailVerification.create({
    data: {
      token: verifyToken,
      userId: user.id,
      expiresAt: getEmailVerificationExpiry(),
    },
  });

  // Send verification email asynchronously off the event loop
  setImmediate(() => {
    sendVerificationEmail(user.email, user.firstName, verifyToken).catch(console.error);
  });

  return { userId: user.id, email: user.email, requiresVerification: true };
};

// ─── Login ────────────────────────────────────────────────────────────────────

export const login = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email, deletedAt: null },
    include: {
      userRoles: { include: { role: true } },
    },
  });

  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  if (user.status === 'SUSPENDED') {
    throw new AppError('ACCOUNT_SUSPENDED', 'Your account has been suspended', 403);
  }
  if (user.status === 'INACTIVE') {
    throw new AppError('ACCOUNT_INACTIVE', 'Your account is inactive', 403);
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const roleSlug = getPrimaryRoleSlug(user.userRoles);
  const { accessToken, refreshToken } = await buildTokenPair(user.id, user.email, roleSlug);

  return {
    accessToken,
    refreshToken,
    expiresIn: 3600,
    tokenType: 'Bearer',
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: roleSlug,
      avatar: user.avatar,
      isVerified: user.isVerified,
    },
  };
};

// ─── Admin Login ──────────────────────────────────────────────────────────────

export const adminLogin = async (input: AdminLoginInput) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email, deletedAt: null },
    include: {
      userRoles: {
        include: {
          role: {
            include: { rolePermissions: { include: { permission: true } } },
          },
        },
      },
    },
  });

  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  const roleSlug = getPrimaryRoleSlug(user.userRoles);
  const adminRoles = ['super-admin', 'admin'];

  if (!adminRoles.includes(roleSlug)) {
    throw new AppError('FORBIDDEN', 'Admin access required', 403);
  }

  if (user.status !== 'ACTIVE') {
    throw new AppError('ACCOUNT_INACTIVE', 'Account is not active', 403);
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const permissions = user.userRoles.flatMap((ur) =>
    ur.role.rolePermissions.map((rp) => rp.permission.slug)
  );

  const { accessToken, refreshToken } = await buildTokenPair(user.id, user.email, roleSlug);

  return {
    accessToken,
    refreshToken,
    expiresIn: 3600,
    tokenType: 'Bearer',
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: roleSlug,
      permissions,
      avatar: user.avatar,
    },
    requiresTwoFactor: false, // 2FA stub — implement in future phase
  };
};

// ─── Get Me ───────────────────────────────────────────────────────────────────

export const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    include: {
      userRoles: {
        include: {
          role: {
            include: { rolePermissions: { include: { permission: true } } },
          },
        },
      },
    },
  });

  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

  const permissions = user.userRoles.flatMap((ur) =>
    ur.role.rolePermissions.map((rp) => rp.permission.slug)
  );

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    companyName: user.companyName,
    gstin: user.gstin,
    role: getPrimaryRoleSlug(user.userRoles),
    permissions,
    avatar: user.avatar,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
};

// ─── Logout ───────────────────────────────────────────────────────────────────

export const logout = async (refreshToken?: string) => {
  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revokedAt: new Date() },
    });
  }
};

// ─── Refresh Token ────────────────────────────────────────────────────────────

export const refreshTokens = async (token: string) => {
  const stored = await prisma.refreshToken.findUnique({ where: { token } });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new AppError('INVALID_TOKEN', 'Invalid or expired refresh token', 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: stored.userId, deletedAt: null },
    include: { userRoles: { include: { role: true } } },
  });

  if (!user || user.status !== 'ACTIVE') {
    throw new AppError('UNAUTHORIZED', 'User not found or inactive', 401);
  }

  // Revoke old token (rotation)
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const roleSlug = getPrimaryRoleSlug(user.userRoles);
  const { accessToken, refreshToken: newRefresh } = await buildTokenPair(
    user.id,
    user.email,
    roleSlug
  );

  return { accessToken, refreshToken: newRefresh, expiresIn: 3600 };
};

// ─── Forgot Password ──────────────────────────────────────────────────────────

export const forgotPassword = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email, deletedAt: null } });

  // Always return success to prevent email enumeration
  if (!user) return;

  // Invalidate existing resets
  await prisma.passwordReset.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = generateSecureToken();
  await prisma.passwordReset.create({
    data: { token, userId: user.id, expiresAt: getPasswordResetExpiry() },
  });

  await sendPasswordResetEmail(user.email, user.firstName, token);
};

// ─── Reset Password ───────────────────────────────────────────────────────────

export const resetPassword = async (input: ResetPasswordInput) => {
  const record = await prisma.passwordReset.findUnique({ where: { token: input.token } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError('INVALID_TOKEN', 'Invalid or expired reset token', 400);
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({
      where: { userId: record.userId },
      data: { revokedAt: new Date() },
    }),
  ]);
};

// ─── Change Password ──────────────────────────────────────────────────────────

export const changePassword = async (userId: string, input: ChangePasswordInput) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

  const isMatch = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!isMatch) {
    throw new AppError('INVALID_CREDENTIALS', 'Current password is incorrect', 401);
  }

  const passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  sendPasswordChangedEmail(user.email, user.firstName).catch(console.error);
};

// ─── Verify Email ─────────────────────────────────────────────────────────────

export const verifyEmail = async (token: string) => {
  const record = await prisma.emailVerification.findUnique({ where: { token } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError('INVALID_TOKEN', 'Invalid or expired verification token', 400);
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { isVerified: true } }),
    prisma.emailVerification.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (user) sendWelcomeEmail(user.email, user.firstName).catch(console.error);
};

// ─── Resend Verification ──────────────────────────────────────────────────────

export const resendVerification = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email, deletedAt: null } });

  if (!user) return; // Prevent email enumeration

  if (user.isVerified) {
    throw new AppError('ALREADY_VERIFIED', 'Email is already verified', 400);
  }

  // Invalidate existing tokens
  await prisma.emailVerification.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = generateSecureToken();
  await prisma.emailVerification.create({
    data: { token, userId: user.id, expiresAt: getEmailVerificationExpiry() },
  });

  sendVerificationEmail(user.email, user.firstName, token).catch(console.error);
};
