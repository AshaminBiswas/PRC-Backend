import { getRedisClient } from '../../config/redis';

// ─── Pure Redis (ioredis) OTP Storage & Verification ──────────────────────────

export const storeOtpInRedis = async (email: string, otp: string, ttlSeconds = 600): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;

  const normalized = email.toLowerCase().trim();
  const key = `otp:${normalized}`;
  const attemptsKey = `otp:attempts:${normalized}`;

  try {
    await client.setex(key, ttlSeconds, otp);
    await client.setex(attemptsKey, ttlSeconds, '0');
  } catch (err: any) {
    console.error(`[Redis OTP Store Error] email="${email}":`, err?.message || err);
  }
};

export const verifyOtpFromRedis = async (email: string, inputOtp: string): Promise<{ valid: boolean; message: string }> => {
  const client = getRedisClient();
  if (!client) {
    return { valid: false, message: 'Redis unavailable for OTP verification' };
  }

  const normalized = email.toLowerCase().trim();
  const key = `otp:${normalized}`;
  const attemptsKey = `otp:attempts:${normalized}`;

  try {
    const rawAttempts = await client.get(attemptsKey);
    const attempts = rawAttempts ? parseInt(rawAttempts, 10) : 0;

    if (attempts >= 5) {
      await client.del(key);
      await client.del(attemptsKey);
      return { valid: false, message: 'Too many failed verification attempts. Please request a new OTP code.' };
    }

    const storedOtp = await client.get(key);
    if (!storedOtp) {
      return { valid: false, message: 'Invalid or expired OTP. Please request a new code.' };
    }

    if (storedOtp.trim() !== inputOtp.trim()) {
      await client.incr(attemptsKey);
      return { valid: false, message: 'Incorrect OTP code. Please try again.' };
    }

    // OTP matched — delete from Redis to prevent reuse
    await client.del(key);
    await client.del(attemptsKey);
    return { valid: true, message: 'OTP verified successfully' };
  } catch (err: any) {
    console.error(`[Redis OTP Verify Error] email="${email}":`, err?.message || err);
    return { valid: false, message: 'Error during OTP verification' };
  }
};
