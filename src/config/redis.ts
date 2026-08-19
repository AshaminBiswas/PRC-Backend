import { Redis as UpstashRedis } from '@upstash/redis';
import Redis from 'ioredis';
import { env } from './env';

// ─── Universal Dual Redis Client (Supports Upstash REST & Pure TCP) ────────────

let upstashClient: UpstashRedis | null = null;
let ioredisClient: Redis | null = null;

export const getRedisClient = (): any => {
  // 1. Upstash HTTP REST Redis (Primary for Render Cloud & Serverless)
  if (env.redis.upstashUrl && env.redis.token) {
    if (!upstashClient) {
      upstashClient = new UpstashRedis({
        url: env.redis.upstashUrl,
        token: env.redis.token,
      });
      console.log('⚡ [Redis] Upstash HTTP REST client initialised →', env.redis.upstashUrl);
    }
    return upstashClient;
  }

  // 2. Standard TCP Redis (Docker Container / Localhost / Cloud VPS)
  const rawUrl = env.redis.url || process.env.REDIS_URL;
  if (rawUrl && (rawUrl.startsWith('redis://') || rawUrl.startsWith('rediss://'))) {
    // In production on Render / Cloud, skip localhost connection if no external Redis is supplied
    if (env.NODE_ENV === 'production' && (rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1'))) {
      if (!process.env.FORCE_LOCAL_REDIS) {
        return null;
      }
    }

    if (!ioredisClient) {
      const isTls = rawUrl.startsWith('rediss://');
      ioredisClient = new Redis(rawUrl, {
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
        lazyConnect: true,
        tls: isTls ? { rejectUnauthorized: false } : undefined,
        retryStrategy: (times) => (times <= 3 ? 1000 : null),
      });

      ioredisClient.on('connect', () => {
        console.log('⚡ [Redis] Standard TCP client connected →', rawUrl);
      });

      ioredisClient.on('error', (err) => {
        // Log cleanly without throwing unhandled exceptions
        if (!err.message.includes('ECONNREFUSED') && !err.message.includes('ECONNRESET')) {
          console.warn('⚠️ [Redis Warning]:', err?.message || err);
        }
      });

      ioredisClient.connect().catch(() => {
        // Connection handled gracefully
      });
    }
    return ioredisClient;
  }

  return null;
};

export const disconnectRedis = async (): Promise<void> => {
  if (ioredisClient) {
    try {
      await ioredisClient.quit();
    } catch {
      // ignore
    }
    ioredisClient = null;
  }
  upstashClient = null;
  console.log('🔌 [Redis] Client disconnected');
};
