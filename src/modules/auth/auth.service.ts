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
  hashRefreshToken,
} from '../../utils/token.utils';
import {
  sendOtpEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendWelcomeEmail,
} from '../../utils/email.utils';
import {
  validateGstin,
  validatePhoneNumber,
  validateEmailDeliverability,
} from '../../utils/validation.utils';
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
  const { raw: rawRefresh, hash: refreshHash } = generateRefreshToken();
  const expiresAt = getRefreshTokenExpiry();
  // Store only the SHA-256 hash — never the raw token
  await prisma.refreshToken.create({ data: { token: refreshHash, userId, expiresAt } });
  return { accessToken, refreshToken: rawRefresh };
};

export const getPrimaryRoleSlug = (userRoles: Array<{ role: { slug: string } }>): string =>
  userRoles[0]?.role.slug ?? 'customer';

export const register = async (input: RegisterInput) => {
  // 1. Email deliverability & disposable blocker
  const emailCheck = await validateEmailDeliverability(input.email);
  if (!emailCheck.isValid) {
    throw new AppError('INVALID_EMAIL', emailCheck.error!, 400);
  }

  // 2. Phone number validation
  const phoneCheck = validatePhoneNumber(input.phone);
  if (!phoneCheck.isValid) {
    throw new AppError('INVALID_PHONE', phoneCheck.error!, 400);
  }
  const normalizedPhone = phoneCheck.normalized || input.phone.trim();

  // 3. Phone Number Multi-Account Limit (Max 3 accounts per phone number)
  const phoneAccountCount = await prisma.user.count({
    where: { phone: normalizedPhone, deletedAt: null },
  });
  if (phoneAccountCount >= 3) {
    throw new AppError(
      'PHONE_LIMIT_EXCEEDED',
      'This phone number is already linked to the maximum allowed limit of 3 accounts. Please use a different phone number.',
      400
    );
  }

  const isB2B = input.accountType === 'B2B' || input.accountType === 'B2B_CUSTOMER' || !!(input.companyName && input.gstin);

  // 4. GSTIN validation & duplicate check for B2B registrations
  if (isB2B) {
    if (!input.companyName?.trim()) {
      throw new AppError('COMPANY_REQUIRED', 'Company / Firm Name is required for B2B accounts', 400);
    }
    if (!input.gstin?.trim()) {
      throw new AppError('GSTIN_REQUIRED', 'GSTIN is required for B2B accounts', 400);
    }
    const gstCheck = validateGstin(input.gstin);
    if (!gstCheck.isValid) {
      throw new AppError('INVALID_GSTIN', gstCheck.error!, 400);
    }

    // Check duplicate GSTIN
    const existingGst = await prisma.user.findFirst({
      where: { gstin: input.gstin.trim().toUpperCase(), deletedAt: null },
    });
    if (existingGst) {
      throw new AppError(
        'GSTIN_ALREADY_EXISTS',
        `An account with GSTIN ${input.gstin.trim().toUpperCase()} already exists. Please log in or reset your password.`,
        409
      );
    }

    // Check duplicate Company Name (case-insensitive)
    const existingCompany = await prisma.user.findFirst({
      where: {
        companyName: { equals: input.companyName.trim(), mode: 'insensitive' },
        deletedAt: null,
      },
    });
    if (existingCompany) {
      throw new AppError(
        'COMPANY_ALREADY_EXISTS',
        `An account with Company Name "${input.companyName.trim()}" already exists. Please log in or reset your password.`,
        409
      );
    }
  }

  // 5. Check duplicate Email
  const existing = await prisma.user.findUnique({ where: { email: input.email.trim().toLowerCase() } });
  if (existing) {
    if (existing.deletedAt === null) {
      throw new AppError(
        'ACCOUNT_ALREADY_EXISTS',
        'An account with this email address already exists. Please log in or reset your password.',
        409
      );
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
      email: input.email.trim().toLowerCase(),
      passwordHash,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone: phoneCheck.normalized || input.phone.trim(),
      companyName: input.companyName?.trim() || null,
      gstin: input.gstin?.trim()?.toUpperCase() || null,
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
    const tokenHash = hashRefreshToken(refreshToken);
    await prisma.refreshToken.updateMany({ where: { token: tokenHash }, data: { revokedAt: new Date() } });
  }
};

export const refreshTokens = async (token: string) => {
  // Always look up by hash — raw token is never stored
  const tokenHash = hashRefreshToken(token);
  const stored = await prisma.refreshToken.findUnique({ where: { token: tokenHash } });

  if (!stored) {
    throw new AppError('INVALID_TOKEN', 'Invalid or expired refresh token', 401);
  }

  // ── Replay detection ─────────────────────────────────────────────────────────
  if (stored.revokedAt) {
    const gracePeriodMs = 30 * 1000;
    const timeSinceRevocation = Date.now() - new Date(stored.revokedAt).getTime();

    if (timeSinceRevocation <= gracePeriodMs) {
      // Within grace window — concurrent request race: reuse the latest active token
      const latestToken = await prisma.refreshToken.findFirst({
        where: { userId: stored.userId, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });

      const user = await prisma.user.findUnique({
        where: { id: stored.userId, deletedAt: null },
        include: { userRoles: { include: { role: true } } },
      });

      if (user && user.status === 'ACTIVE' && latestToken) {
        const roleSlug = getPrimaryRoleSlug(user.userRoles);
        const { accessToken } = await buildTokenPair(user.id, user.email, roleSlug);
        return { accessToken, refreshToken: token, expiresIn: 900 };
      }
    }

    // Definitive replay outside grace window — TREAT AS TOKEN THEFT
    // Immediately revoke every active session for this user
    logger.warn(`[Auth] Refresh token replay detected — revoking all sessions`, { userId: stored.userId });
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new AppError('INVALID_TOKEN', 'Session invalidated due to suspicious activity. Please log in again.', 401);
  }

  if (stored.expiresAt < new Date()) {
    throw new AppError('INVALID_TOKEN', 'Invalid or expired refresh token', 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: stored.userId, deletedAt: null },
    include: { userRoles: { include: { role: true } } },
  });
  if (!user || user.status !== 'ACTIVE')
    throw new AppError('UNAUTHORIZED', 'User not found or inactive', 401);

  // Rotate: revoke old token, issue new pair
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

  const roleSlug = getPrimaryRoleSlug(user.userRoles);
  const { accessToken, refreshToken: newRefresh } = await buildTokenPair(user.id, user.email, roleSlug);
  return { accessToken, refreshToken: newRefresh, expiresIn: 900 };
};

export const forgotPassword = async (rawIdentifier: string) => {
  const identifier = rawIdentifier.trim();
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier.toLowerCase() },
        { gstin: identifier.toUpperCase() },
      ],
      deletedAt: null,
    },
  });

  if (!user) {
    throw new AppError(
      'NOT_FOUND',
      'No registered account found matching this Email or GSTIN number.',
      404
    );
  }

  // Invalidate any existing unused password reset records
  await prisma.passwordReset.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  // Generate 6-digit numeric OTP
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes TTL

  // Store in Redis with reset prefix and in DB
  await storeOtpInRedis(`reset:${user.email}`, otp, 900);
  await prisma.passwordReset.create({
    data: { token: otp, userId: user.id, expiresAt },
  });

  try {
    await sendPasswordResetEmail(user.email, user.firstName, otp);
  } catch (err: any) {
    logger.error('[ForgotPassword] Failed to send reset email:', err?.message || err);
  }

  // Mask email e.g. "ra***l@example.com"
  const [userPart, domainPart] = user.email.split('@');
  const maskedUser =
    userPart.length > 2
      ? `${userPart[0]}***${userPart[userPart.length - 1]}`
      : `${userPart[0]}***`;
  const maskedEmail = `${maskedUser}@${domainPart}`;

  return {
    success: true,
    message: `A 6-digit password reset OTP has been sent to your registered email (${maskedEmail}).`,
    maskedEmail,
    email: user.email,
  };
};

export const verifyResetOtp = async (rawIdentifier: string, otp: string) => {
  const identifier = rawIdentifier.trim();
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier.toLowerCase() },
        { gstin: identifier.toUpperCase() },
      ],
      deletedAt: null,
    },
  });

  if (!user) {
    throw new AppError('NOT_FOUND', 'No registered account found matching this Email or GSTIN.', 404);
  }

  const redisResult = await verifyOtpFromRedis(`reset:${user.email}`, otp);
  if (!redisResult.valid && redisResult.message.includes('attempts')) {
    throw new AppError('TOO_MANY_ATTEMPTS', redisResult.message, 429);
  }

  const record = await prisma.passwordReset.findFirst({
    where: {
      userId: user.id,
      token: otp,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!record && !redisResult.valid) {
    throw new AppError('INVALID_OTP', 'Invalid or expired 6-digit OTP code.', 400);
  }

  // Generate secure single-use reset token
  const resetToken = generateSecureToken();
  await prisma.passwordReset.create({
    data: {
      token: resetToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  if (record) {
    await prisma.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  }

  return {
    valid: true,
    resetToken,
    email: user.email,
    message: 'OTP verified successfully. Please enter your new password.',
  };
};

export const resetPassword = async (input: ResetPasswordInput) => {
  let userId: string | null = null;
  let resetRecordId: string | null = null;

  if (input.token) {
    const record = await prisma.passwordReset.findUnique({ where: { token: input.token } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new AppError('INVALID_TOKEN', 'Invalid or expired password reset token.', 400);
    }
    userId = record.userId;
    resetRecordId = record.id;
  } else if (input.identifier && input.otp) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: input.identifier.trim().toLowerCase() },
          { gstin: input.identifier.trim().toUpperCase() },
        ],
        deletedAt: null,
      },
    });
    if (!user) {
      throw new AppError('NOT_FOUND', 'User not found.', 404);
    }
    const record = await prisma.passwordReset.findFirst({
      where: {
        userId: user.id,
        token: input.otp.trim(),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) {
      throw new AppError('INVALID_OTP', 'Invalid or expired 6-digit OTP code.', 400);
    }
    userId = user.id;
    resetRecordId = record.id;
  } else {
    throw new AppError('BAD_REQUEST', 'Missing reset token or OTP credentials.', 400);
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    }),
    ...(resetRecordId
      ? [prisma.passwordReset.update({ where: { id: resetRecordId }, data: { usedAt: new Date() } })]
      : []),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user) {
    sendPasswordChangedEmail(user.email, user.firstName).catch((err) =>
      logger.error('[ResetPassword] Failed to send password changed email:', err?.message || err)
    );
  }

  return { success: true, message: 'Password reset successfully. You can now log in with your new password.' };
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
