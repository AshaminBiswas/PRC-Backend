import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

interface CacheEntry {
  statusCode: number;
  body: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

const makeKey = (req: Request): string => {
  const authScope = req.headers.authorization ? `auth:${req.headers.authorization}` : 'public';
  return `${req.method}:${req.originalUrl}:${authScope}`;
};

const evictOldest = () => {
  const oldestKey = cache.keys().next().value;
  if (oldestKey) cache.delete(oldestKey);
};

export const clearResponseCache = (prefix?: string) => {
  if (!prefix) {
    cache.clear();
    return;
  }

  for (const key of cache.keys()) {
    if (key.includes(prefix)) cache.delete(key);
  }
};

export const cacheResponse = (ttlSeconds = env.cache.defaultTtlSeconds) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!env.cache.enabled || req.method !== 'GET' || ttlSeconds <= 0) {
      next();
      return;
    }

    const key = makeKey(req);
    const now = Date.now();
    const cached = cache.get(key);

    if (cached && cached.expiresAt > now) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      res.status(cached.statusCode).json(cached.body);
      return;
    }

    if (cached) cache.delete(key);

    const originalJson = res.json.bind(res);
    res.json = (body: unknown): Response => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (cache.size >= env.cache.maxEntries) evictOldest();
        cache.set(key, {
          statusCode: res.statusCode,
          body,
          expiresAt: now + ttlSeconds * 1000,
        });
        res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      }

      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
};
