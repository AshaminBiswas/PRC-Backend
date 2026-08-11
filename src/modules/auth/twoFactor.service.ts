import crypto from 'crypto';
import QRCode from 'qrcode';
import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { getCache, setCache, deleteCache } from '../../services/redis/cache.redis';

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const MEMORY_CACHE = new Map<string, any>();

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

// ─── Redis & In-Memory Caching Helpers ────────────────────────────────────────

async function setStoreCache(key: string, data: any, ttl = 600) {
  MEMORY_CACHE.set(key, data);
  await setCache(key, data, ttl);
}

async function getStoreCache<T = any>(key: string): Promise<T | null> {
  const fromRedis = await getCache<T>(key);
  if (fromRedis) return fromRedis;
  return (MEMORY_CACHE.get(key) as T) || null;
}

async function deleteStoreCache(key: string) {
  MEMORY_CACHE.delete(key);
  await deleteCache(key);
}

// ─── 2FA Service Methods ──────────────────────────────────────────────────────

export const setup2Fa = async (userId: string, userEmail: string) => {
  const secret = generateBase32Secret(20);
  const otpauthUrl = `otpauth://totp/PRC%20Hardware:${encodeURIComponent(userEmail)}?secret=${secret}&issuer=PRC%20Hardware`;
  const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);
  const backupCodes = generateBackupCodes(8);

  const setupData = {
    secret,
    backupCodes,
    createdAt: new Date().toISOString(),
  };

  // Cache pending setup in Redis for 10 minutes (600 seconds)
  await setStoreCache(`2fa:setup:${userId}`, setupData, 600);

  return {
    secret,
    qrCodeUrl,
    otpauthUrl,
    backupCodes,
  };
};

export const enable2Fa = async (userId: string, userCode: string) => {
  const setupData = await getStoreCache<{ secret: string; backupCodes: string[] }>(`2fa:setup:${userId}`);

  if (!setupData || !setupData.secret) {
    throw new AppError('BAD_REQUEST', '2FA setup session expired or not initialized. Please initiate 2FA setup first.', 400);
  }

  const isValid = verifyTotpCode(setupData.secret, userCode);
  if (!isValid) {
    throw new AppError('BAD_REQUEST', 'Invalid 2FA code. Please check your authenticator app and try again.', 400);
  }

  const enabledData = {
    secret: setupData.secret,
    backupCodes: setupData.backupCodes,
    enabledAt: new Date().toISOString(),
  };

  // Store enabled 2FA state in Redis cache (long TTL / persistent)
  await setStoreCache(`2fa:enabled:${userId}`, enabledData, 86400 * 365);
  await setStoreCache(`2fa:status:${userId}`, { enabled: true, enabledAt: enabledData.enabledAt }, 86400 * 365);

  // Clear setup cache
  await deleteStoreCache(`2fa:setup:${userId}`);

  return {
    success: true,
    message: '2FA enabled successfully',
    backupCodes: setupData.backupCodes,
  };
};

export const get2FaStatus = async (userId: string) => {
  const status = await getStoreCache<{ enabled: boolean; enabledAt?: string }>(`2fa:status:${userId}`);
  if (status && status.enabled) {
    return { enabled: true, enabledAt: status.enabledAt };
  }

  const enabledData = await getStoreCache(`2fa:enabled:${userId}`);
  if (enabledData && enabledData.secret) {
    return { enabled: true, enabledAt: enabledData.enabledAt };
  }

  return { enabled: false };
};

export const verify2FaCode = async (userId: string, code: string): Promise<boolean> => {
  if (!code) return false;

  const enabledData = await getStoreCache<{ secret: string; backupCodes: string[] }>(`2fa:enabled:${userId}`);
  if (!enabledData || !enabledData.secret) {
    return false;
  }

  // 1. Verify TOTP Code
  const isValidTotp = verifyTotpCode(enabledData.secret, code);
  if (isValidTotp) return true;

  // 2. Verify Single-Use Backup Recovery Code
  const cleanCode = code.trim().toUpperCase();
  if (enabledData.backupCodes && enabledData.backupCodes.includes(cleanCode)) {
    // Remove used backup code & update Redis cache
    enabledData.backupCodes = enabledData.backupCodes.filter((c) => c !== cleanCode);
    await setStoreCache(`2fa:enabled:${userId}`, enabledData, 86400 * 365);
    return true;
  }

  return false;
};

export const disable2Fa = async (userId: string, userCode?: string) => {
  if (userCode) {
    const isValid = await verify2FaCode(userId, userCode);
    if (!isValid) {
      throw new AppError('BAD_REQUEST', 'Invalid 2FA code', 400);
    }
  }

  await deleteStoreCache(`2fa:enabled:${userId}`);
  await deleteStoreCache(`2fa:status:${userId}`);
  await deleteStoreCache(`2fa:setup:${userId}`);

  return {
    success: true,
    message: '2FA disabled successfully',
  };
};
