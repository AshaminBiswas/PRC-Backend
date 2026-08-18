import { Request, Response, NextFunction } from 'express';
import { getCacheWithTier, setCache, deleteCache } from '../services/redis/cache.redis';

// ─── High-Performance Response Caching & Timing Middleware ───────────────────

interface CacheMiddlewareOptions {
  ttlSeconds?: number;
  keyPrefix?: string;
}

export const cacheMiddleware = (options: CacheMiddlewareOptions = {}) => {
  const ttl = options.ttlSeconds || 300;
  const prefix = options.keyPrefix || 'cache';

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const startHrTime = process.hrtime();
    const cacheKey = `${prefix}:${req.originalUrl || req.url}`;

    try {
      const cached = await getCacheWithTier(cacheKey);
      if (cached && cached.data) {
        const elapsedHrTime = process.hrtime(startHrTime);
        const elapsedMs = (elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6).toFixed(2);

        res.setHeader('X-Cache-Status', 'HIT');
        res.setHeader('X-Cache-Tier', cached.tier);
        res.setHeader('Server-Timing', `cache;dur=${elapsedMs}`);
        res.setHeader(
          'Cache-Control',
          `public, max-age=${Math.min(ttl, 60)}, stale-while-revalidate=30`
        );

        res.json(cached.data);
        return;
      }

      res.setHeader('X-Cache-Status', 'MISS');
      const originalJson = res.json.bind(res);

      res.json = (body: any): Response => {
        const elapsedHrTime = process.hrtime(startHrTime);
        const elapsedMs = (elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6).toFixed(2);
        res.setHeader('Server-Timing', `db;dur=${elapsedMs}`);

        if (res.statusCode >= 200 && res.statusCode < 300) {
          setCache(cacheKey, body, ttl).catch(() => {});
        }
        return originalJson(body);
      };

      next();
    } catch {
      next();
    }
  };
};

export const cacheResponse = (ttlSeconds = 300) => cacheMiddleware({ ttlSeconds });

export const clearResponseCache = async (pattern = '*'): Promise<void> => {
  await deleteCache(pattern);
};

// ─── Edge CDN Cache-Control Header Middleware ───────────────────────────────

export const edgeCacheControl = (publicMaxAgeSeconds = 300, staleWhileRevalidateSeconds = 60) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method === 'GET') {
      res.setHeader(
        'Cache-Control',
        `public, max-age=${publicMaxAgeSeconds}, s-maxage=${publicMaxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`
      );
    } else {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }
    next();
  };
};
