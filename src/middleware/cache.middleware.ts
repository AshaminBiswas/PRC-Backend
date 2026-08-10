import { Request, Response, NextFunction } from 'express';
import { getCache, setCache } from '../services/redis/cache.redis';

// ─── Redis Automatic Response Caching Middleware ──────────────────────────────

interface CacheMiddlewareOptions {
  ttlSeconds?: number;
  keyPrefix?: string;
}

export const cacheMiddleware = (options: CacheMiddlewareOptions = {}) => {
  const ttl = options.ttlSeconds || 300;
  const prefix = options.keyPrefix || 'cache';

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = `${prefix}:${req.originalUrl || req.url}`;

    try {
      const cachedData = await getCache(cacheKey);
      if (cachedData) {
        res.setHeader('X-Cache-Status', 'HIT');
        res.json(cachedData);
        return;
      }

      res.setHeader('X-Cache-Status', 'MISS');
      const originalJson = res.json.bind(res);

      res.json = (body: any): Response => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          setCache(cacheKey, body, ttl).catch((err) =>
            console.error(`[Cache Middleware Set Error] key="${cacheKey}":`, err?.message || err)
          );
        }
        return originalJson(body);
      };

      next();
    } catch (err: any) {
      console.error(`[Cache Middleware Error] key="${cacheKey}":`, err?.message || err);
      next();
    }
  };
};

export const cacheResponse = (ttlSeconds = 300) => cacheMiddleware({ ttlSeconds });

export const clearResponseCache = async (pattern = '*'): Promise<void> => {
  const { deleteCache } = await import('../services/redis/cache.redis');
  await deleteCache(pattern);
};
