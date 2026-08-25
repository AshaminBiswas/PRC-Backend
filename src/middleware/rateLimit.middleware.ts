import { Request, Response, NextFunction } from 'express';
import { getCache, setCache } from '../services/redis/cache.redis';
import { sendError } from '../utils/response';
import { verifyAccessToken } from '../utils/token.utils';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyPrefix?: string;
  keyGenerator?: (req: Request) => string;
}

const memoryStore = new Map<string, { count: number; expiresAt: number }>();

/**
 * 🛡️ Redis-Backed Sliding Window Rate Limiting Middleware
 * - Intelligently keys by authenticated User ID (when available) or Client IP.
 * - Auto-decodes Authorization Bearer token to identify user & role before route middleware.
 * - Bypasses super-admin and executive admin console traffic to prevent dashboard lockouts.
 * - Falls back safely to in-memory store if Redis is unavailable.
 * - Bypasses localhost in local development.
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

    // ── Dev bypass: skip rate limiting for localhost traffic entirely.
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
      return next();
    }

    // Inspect user from request or decode Authorization header if not yet populated
    let userId = (req as any).user?.id;
    let roleSlug = (req as any).user?.roleSlug || (req as any).user?.role;

    if (!userId) {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ')
        ? authHeader.substring(7)
        : typeof req.query.token === 'string'
        ? req.query.token
        : undefined;

      if (token) {
        try {
          const decoded: any = verifyAccessToken(token);
          if (decoded?.userId) {
            userId = decoded.userId;
            roleSlug = decoded.roleSlug || decoded.role;
            (req as any).user = decoded;
          }
        } catch (e) {
          // Token invalid or expired — fall back to IP identifier
        }
      }
    }

    // ── Super-Admin & Executive Admin Bypass: Never rate-limit management dashboard traffic
    if (roleSlug === 'super-admin' || roleSlug === 'admin' || roleSlug === 'manager') {
      return next();
    }

    // Scale allowance for verified B2B customers and authenticated users
    const effectiveMax =
      roleSlug === 'b2b-customer' || roleSlug === 'contractor' || roleSlug === 'architect' || roleSlug === 'dealer'
        ? Math.max(options.max * 8, 1500)
        : userId
        ? Math.max(options.max * 4, 800)
        : max;

    // Key by custom generator, authenticated user ID, or client IP
    const identifier = options.keyGenerator
      ? options.keyGenerator(req)
      : userId
      ? `usr:${userId}`
      : `ip:${ip}`;

    const key = `rl:${prefix}:${identifier}`;
    const now = Date.now();

    try {
      // 1. Try Redis sliding window counter
      const currentCountVal = await getCache<any>(key);
      const currentCount = currentCountVal ? parseInt(String(currentCountVal), 10) : 0;

      if (currentCount >= effectiveMax) {
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
      res.setHeader('X-RateLimit-Limit', effectiveMax);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, effectiveMax - (currentCount + 1)));
      return next();
    } catch (err) {
      // 2. Fallback to in-memory store if Redis connection is offline
      const memEntry = memoryStore.get(key);
      if (!memEntry || now > memEntry.expiresAt) {
        memoryStore.set(key, { count: 1, expiresAt: now + options.windowMs });
        return next();
      }

      if (memEntry.count >= effectiveMax) {
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


// ─── Standard Rate Limiter Profiles ──────────────────────────────────────────

/** 1. Strict Authentication & Credential Protection (Login, Register, OTP, 2FA) */
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 60,
  message: 'Too many authentication attempts. Please try again after a few minutes.',
  keyPrefix: 'auth',
});

/** 2. Email & SMS Flood Protection (Forgot Password, Resend Verification) */
export const emailLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 20,
  message: 'Too many password reset or verification requests. Please try again later.',
  keyPrefix: 'email',
});

export const passwordResetLimiter = emailLimiter;

export const otpLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'OTP request rate limit exceeded. Please wait 60 seconds.',
  keyPrefix: 'otp',
});

/** 3. Financial & High-Value Order Transactions (Place Order, Razorpay Create Order & Verify) */
export const checkoutLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 100,
  message: 'Checkout / payment transaction limit reached. Please wait before retrying.',
  keyPrefix: 'checkout',
});

/** 4. Form & Lead Submission Anti-Spam (B2B Quote Request, Revisions, Booking, Enquiries, Reviews) */
export const formSubmissionLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 60,
  message: 'Submission limit reached. Please wait a few minutes before submitting again.',
  keyPrefix: 'form-submit',
});

/** 5. Public Tracking & Token Access (Quotation Track, Token View, Enquiry Track, Appointment Track) */
export const publicTrackingLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 300,
  message: 'Tracking request limit exceeded. Please try again in a few minutes.',
  keyPrefix: 'tracking',
});

/** 6. Media & File Uploads (Avatar, Products, Category images) */
export const uploadLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 100,
  message: 'File upload rate limit exceeded. Please try again in a few minutes.',
  keyPrefix: 'upload',
});

/** 7. Fast Public Search & Suggestions (Catalog & Stock Search) */
export const searchLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  message: 'Search query rate limit exceeded. Please slow down your requests.',
  keyPrefix: 'search',
});

/** 8. Real-time SSE Stream Connection Setup */
export const sseLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute window (prevents long lockouts)
  max: 300, // 300 reconnect attempts per minute
  message: 'Too many real-time connection attempts. Please wait 60 seconds.',
  keyPrefix: 'sse',
});

/** 9. Payment Webhooks (High-throughput gateway ingestion) */
export const webhookLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 2000,
  message: 'Webhook ingestion limit exceeded.',
  keyPrefix: 'webhook',
});

/** 10. High-Throughput Admin, Inventory, POS & Management Console */
export const adminLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 5000,
  keyPrefix: 'admin',
});

/** 11. Global General Umbrella (Public Catalog Reads & Generic Fallback) */
export const generalLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute sliding window
  max: 1200, // 1200 req/min per client
  keyPrefix: 'general',
});