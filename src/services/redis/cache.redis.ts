import { getRedisClient } from '../../config/redis';

// ─── High-Performance Dual-Tier Caching Engine (In-Memory LRU + Redis) ────────

interface MemoryCacheEntry {
  data: any;
  expiresAt: number;
}

const MEMORY_CACHE_MAX_ITEMS = 500;
const memoryCache = new Map<string, MemoryCacheEntry>();

function cleanExpiredMemoryCache() {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt <= now) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Stores data in both Memory Cache (Tier 1) and Redis (Tier 2).
 */
export const setCache = async (key: string, data: any, ttlSeconds = 300): Promise<void> => {
  // 1. Tier 1: Local In-Memory Cache (Instant synchronous read for subsequent hits)
  if (memoryCache.size >= MEMORY_CACHE_MAX_ITEMS) {
    cleanExpiredMemoryCache();
    if (memoryCache.size >= MEMORY_CACHE_MAX_ITEMS) {
      const firstKey = memoryCache.keys().next().value;
      if (firstKey) memoryCache.delete(firstKey);
    }
  }

  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });

  // 2. Tier 2: Distributed Redis Cache (if available)
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
    // Non-blocking: memory cache already has it
  }
};

/**
 * Fetches cached data from Tier 1 (Memory) first, falling back to Tier 2 (Redis),
 * returning both the data and the tier name.
 */
export const getCacheWithTier = async <T = any>(
  key: string
): Promise<{ data: T; tier: 'memory' | 'redis' } | null> => {
  // 1. Check Tier 1 In-Memory Cache (< 0.1ms)
  const memEntry = memoryCache.get(key);
  if (memEntry) {
    if (memEntry.expiresAt > Date.now()) {
      return { data: memEntry.data as T, tier: 'memory' };
    }
    memoryCache.delete(key);
  }

  // 2. Check Tier 2 Distributed Redis Cache
  const client = getRedisClient();
  if (!client) return null;

  try {
    const raw = await client.get(key);
    if (!raw) return null;
    const value = typeof raw === 'string' ? raw : JSON.stringify(raw);
    const parsed = JSON.parse(value) as T;

    // Promote to Tier 1 In-Memory Cache for subsequent zero-latency hits
    memoryCache.set(key, {
      data: parsed,
      expiresAt: Date.now() + 60 * 1000, // 60s fast memory promotion
    });

    return { data: parsed, tier: 'redis' };
  } catch {
    return null;
  }
};

/**
 * Standard getCache returning T | null for universal compatibility.
 */
export const getCache = async <T = any>(key: string): Promise<T | null> => {
  const res = await getCacheWithTier<T>(key);
  return res ? res.data : null;
};

/**
 * Invalidates cache by exact key or wildcard pattern across both memory & Redis tiers.
 */
export const deleteCache = async (patternOrKey: string): Promise<void> => {
  // 1. Invalidate matching keys from Tier 1 In-Memory Cache
  if (patternOrKey.includes('*')) {
    const regexPattern = new RegExp('^' + patternOrKey.replace(/\*/g, '.*') + '$');
    for (const key of memoryCache.keys()) {
      if (regexPattern.test(key)) {
        memoryCache.delete(key);
      }
    }
  } else {
    memoryCache.delete(patternOrKey);
  }

  // 2. Invalidate matching keys from Tier 2 Redis
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
    // Non-blocking
  }
};
