import { getRedisClient } from '../../config/redis';

// ─── Universal Redis Caching Layer (Upstash HTTP REST & ioredis TCP) ─────────

export const setCache = async (key: string, data: any, ttlSeconds = 300): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;

  try {
    const serialized = JSON.stringify(data);
    if (typeof client.setex === 'function') {
      await client.setex(key, ttlSeconds, serialized);
    } else if (typeof client.set === 'function') {
      await client.set(key, serialized, { ex: ttlSeconds });
    }
  } catch (err: any) {
    console.error(`[Redis Cache Set Error] key="${key}":`, err?.message || err);
  }
};

export const getCache = async <T = any>(key: string): Promise<T | null> => {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const raw = await client.get(key);
    if (!raw) return null;
    const value = typeof raw === 'string' ? raw : JSON.stringify(raw);
    return JSON.parse(value) as T;
  } catch (err: any) {
    console.error(`[Redis Cache Get Error] key="${key}":`, err?.message || err);
    return null;
  }
};

export const deleteCache = async (patternOrKey: string): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;

  try {
    if (patternOrKey.includes('*')) {
      if (typeof client.keys === 'function') {
        const keys: string[] = await client.keys(patternOrKey);
        if (keys.length > 0) {
          await client.del(...keys);
        }
      }
    } else {
      await client.del(patternOrKey);
    }
  } catch (err: any) {
    console.error(`[Redis Cache Delete Error] key="${patternOrKey}":`, err?.message || err);
  }
};
