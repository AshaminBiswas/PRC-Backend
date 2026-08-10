import { getRedisClient } from '../../config/redis';

// ─── Pure Redis (ioredis) Caching Layer ───────────────────────────────────────

export const setCache = async (key: string, data: any, ttlSeconds = 300): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;

  try {
    const serialized = JSON.stringify(data);
    await client.setex(key, ttlSeconds, serialized);
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
    return JSON.parse(raw) as T;
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
      const keys = await client.keys(patternOrKey);
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } else {
      await client.del(patternOrKey);
    }
  } catch (err: any) {
    console.error(`[Redis Cache Delete Error] key="${patternOrKey}":`, err?.message || err);
  }
};
