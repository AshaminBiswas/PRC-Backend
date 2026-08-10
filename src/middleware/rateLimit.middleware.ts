import { Request, Response, NextFunction } from 'express';
import { getCache, setCache } from '../services/redis/cache.redis';
import { sendError } from '../utils/response';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyPrefix?: string;
}

const memoryStore = new Map<string, { count: number; expiresAt: number }>();

/**
 * 🛡️ Redis-Backed Sliding Window Rate Limiting Middleware
 * Falls back safely to in-memory store if Redis is unavailable.
 */
export const createRateLimiter = (options: RateLimitOptions) => {
  const windowSeconds = Math.ceil(options.windowMs / 1000);
  const max = options.max;
  const prefix = options.keyPrefix || 'rate';

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Determine client IP safely behind proxy load balancers / Cloudflare
    const ip =
      (req.headers['cf-connecting-ip'] as string) ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1';

    const key = `rl:${prefix}:${ip}`;
    const now = Date.now();

    try {
      // 1. Try Redis sliding window counter
      const currentCountVal = await getCache<any>(key);
      const currentCount = currentCountVal ? parseInt(String(currentCountVal), 10) : 0;

      if (currentCount >= max) {
        res.setHeader('Retry-After', windowSeconds);
        sendError(
          res,
          {
            code: 'TOO_MANY_REQUESTS',
            message: options.message || 'Too many requests, please try again later.',
          },
          429
        );
        return;
      }

      await setCache(key, currentCount + 1, windowSeconds);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - (currentCount + 1)));
      return next();
    } catch (err) {
      // 2. Fallback to in-memory store if Redis connection is offline
      const memEntry = memoryStore.get(key);
      if (!memEntry || now > memEntry.expiresAt) {
        memoryStore.set(key, { count: 1, expiresAt: now + options.windowMs });
        return next();
      }

      if (memEntry.count >= max) {
        res.setHeader('Retry-After', windowSeconds);
        sendError(
          res,
          {
            code: 'TOO_MANY_REQUESTS',
            message: options.message || 'Too many requests, please try again later.',
          },
          429
        );
        return;
      }

      memEntry.count++;
      return next();
    }
  };
};

// ─── Rate Limiter Profiles ───────────────────────────────────────────────────

export const generalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 300,
  keyPrefix: 'general',
});

export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 10, // Max 10 attempts per 15 mins
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
  keyPrefix: 'auth',
});

export const otpLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // Max 3 OTP requests per minute
  message: 'OTP request rate limit exceeded. Please wait 60 seconds.',
  keyPrefix: 'otp',
});

export const uploadLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 15,
  message: 'File upload rate limit exceeded. Please try again in a minute.',
  keyPrefix: 'upload',
});

export const emailLimiter = authLimiter;