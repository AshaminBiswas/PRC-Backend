import crypto from 'crypto';
import QRCode from 'qrcode';
import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { getCache, setCache, deleteCache } from '../../services/redis/cache.redis';

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// ─── TOTP RFC 6238 Core Implementation ────────────────────────────────────────

export function generateBase32Secret(length = 20): string {
  const bytes = crypto.randomBytes(length);
  let secret = '';
  for (let i = 0; i < bytes.length; i++) {
    secret += BASE32_CHARS[bytes[i] % 32];
  }
  return secret;
}

export function base32ToBuffer(base32: string): Buffer {
  const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_CHARS.indexOf(clean[i]);
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTotpCode(secretBase32: string, timeStepWindow = 0): string {
  const secretBuffer = base32ToBuffer(secretBase32);
  const timeStep = 30; // 30 seconds
  const counter = Math.floor(Date.now() / 1000 / timeStep) + timeStepWindow;

  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(counter), 0);

  const hmac = crypto.createHmac('sha1', secretBuffer);
  hmac.update(buffer);
  const hmacResult = hmac.digest();

  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const code =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  return (code % 1000000).toString().padStart(6, '0');
}

export function verifyTotpCode(secretBase32: string, userCode: string, window = 1): boolean {
  if (!secretBase32 || !userCode) return false;
  const cleanUserCode = userCode.trim();
  for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
    const generated = generateTotpCode(secretBase32, errorWindow);
    if (generated === cleanUserCode) {
      return true;
    }
  }
  return false;
}

export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

// ─── Redis Cache Helpers (cache-aside pattern) ─────────────────────────────────

async function cacheSet(key: string, data: any, ttl = 600) {
  try { await setCache(key, data, ttl); } catch {}
}

async function cacheGet<T = any>(key: string): Promise<T | null> {
  try { return await getCache<T>(key); } catch { return null; }
}

async function cacheDel(key: string) {
  try { await deleteCache(key); } catch {}
}

// ─── 2FA Service Methods ──────────────────────────────────────────────────────

/**
 * Step 1: Initiate 2FA setup — generates secret + QR code.
 * Stores the pending setup in Redis (not yet saved to DB until user confirms with a valid code).
 */
export const setup2Fa = async (userId: string, userEmail: string) => {
  const secret = generateBase32Secret(20);
  const otpauthUrl = `otpauth://totp/PRC%20Hardware:${encodeURIComponent(userEmail)}?secret=${secret}&issuer=PRC%20Hardware`;
  const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);
  const backupCodes = generateBackupCodes(8);

  // Cache pending setup in Redis for 10 minutes (not written to DB yet)
  await cacheSet(`2fa:setup:${userId}`, { secret, backupCodes }, 600);

  return { secret, qrCodeUrl, otpauthUrl, backupCodes };
};

/**
 * Step 2: Confirm 2FA enable — verifies user's first TOTP code,
 * then persists 2FA secret + backup codes to the database.
 */
export const enable2Fa = async (userId: string, userCode: string) => {
  const setupData = await cacheGet<{ secret: string; backupCodes: string[] }>(`2fa:setup:${userId}`);

  if (!setupData || !setupData.secret) {
    throw new AppError('BAD_REQUEST', '2FA setup session expired or not initialized. Please initiate 2FA setup again.', 400);
  }

  const isValid = verifyTotpCode(setupData.secret, userCode);
  if (!isValid) {
    throw new AppError('BAD_REQUEST', 'Invalid 2FA code. Please check your authenticator app and try again.', 400);
  }

  // ✅ Persist to database (primary source of truth)
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: setupData.secret,
      twoFactorBackupCodes: setupData.backupCodes,
    },
  });

  // Cache the enabled state for fast reads
  await cacheSet(`2fa:enabled:${userId}`, { secret: setupData.secret, backupCodes: setupData.backupCodes }, 86400);

  // Clear pending setup cache
  await cacheDel(`2fa:setup:${userId}`);

  return {
    success: true,
    message: '2FA enabled successfully',
    backupCodes: setupData.backupCodes,
  };
};

/**
 * Get 2FA status — checks DB first (source of truth), falls back to Redis cache.
 */
export const get2FaStatus = async (userId: string) => {
  // Primary: check database
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabled: true },
  });

  if (user) {
    return { enabled: user.twoFactorEnabled };
  }

  return { enabled: false };
};

/**
 * Verify a TOTP code or backup code for a user.
 * Loads secret from DB (primary), with Redis cache as fast path.
 */
export const verify2FaCode = async (userId: string, code: string): Promise<boolean> => {
  if (!code) return false;

  // 1. Try Redis cache first (fast path)
  let secret: string | null = null;
  let backupCodes: string[] = [];

  const cached = await cacheGet<{ secret: string; backupCodes: string[] }>(`2fa:enabled:${userId}`);
  if (cached?.secret) {
    secret = cached.secret;
    backupCodes = cached.backupCodes || [];
  } else {
    // 2. Load from database (source of truth)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true, twoFactorSecret: true, twoFactorBackupCodes: true },
    });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return false;
    }

    secret = user.twoFactorSecret;
    backupCodes = user.twoFactorBackupCodes || [];

    // Repopulate Redis cache
    await cacheSet(`2fa:enabled:${userId}`, { secret, backupCodes }, 86400);
  }

  if (!secret) return false;

  // 3. Verify TOTP code (±1 window = ±30s clock drift tolerance)
  const isValidTotp = verifyTotpCode(secret, code);
  if (isValidTotp) return true;

  // 4. Verify single-use backup recovery code
  const cleanCode = code.trim().toUpperCase();
  if (backupCodes.includes(cleanCode)) {
    // Remove used backup code from DB
    const updatedCodes = backupCodes.filter((c) => c !== cleanCode);
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorBackupCodes: updatedCodes },
    });
    // Update Redis cache
    await cacheSet(`2fa:enabled:${userId}`, { secret, backupCodes: updatedCodes }, 86400);
    return true;
  }

  return false;
};

/**
 * Disable 2FA — removes from DB and clears Redis cache.
 */
export const disable2Fa = async (userId: string, userCode?: string) => {
  if (userCode) {
    const isValid = await verify2FaCode(userId, userCode);
    if (!isValid) {
      throw new AppError('BAD_REQUEST', 'Invalid 2FA code. Cannot disable 2FA.', 400);
    }
  }

  // Remove from database
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: [],
    },
  });

  // Clear all Redis cache entries
  await cacheDel(`2fa:enabled:${userId}`);
  await cacheDel(`2fa:setup:${userId}`);

  return { success: true, message: '2FA disabled successfully' };
};
