import { Redis as UpstashRedis } from '@upstash/redis';
import Redis from 'ioredis';
import { env } from './env';

// ─── Dual Redis Client (Supports Docker TCP & Upstash HTTP REST) ───────────────

let upstashClient: UpstashRedis | null = null;
let ioredisClient: Redis | null = null;

export const getRedisClient = (): any => {
  // 1. Standard TCP Redis (Docker Container / Localhost / VPS)
  if (env.redis.url && (env.redis.url.startsWith('redis://') || env.redis.url.startsWith('rediss://'))) {
    if (!ioredisClient) {
      ioredisClient = new Redis(env.redis.url, {
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
      });

      ioredisClient.on('connect', () => console.log('[Redis] Standard TCP client connected →', env.redis.url));
      ioredisClient.on('error', (err) => console.error('[Redis] TCP connection error:', err?.message || err));
    }
    return ioredisClient;
  }

  // 2. Upstash HTTP REST Redis (Render / Serverless Production)
  if (env.redis.upstashUrl && env.redis.token) {
    if (!upstashClient) {
      upstashClient = new UpstashRedis({
        url: env.redis.upstashUrl,
        token: env.redis.token,
      });

      console.log('[Redis] Upstash HTTP REST client initialised →', env.redis.upstashUrl);
    }
    return upstashClient;
  }

  return null;
};

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

export const disconnectRedis = async (): Promise<void> => {
  if (ioredisClient) {
    await ioredisClient.quit();
    ioredisClient = null;
  }
  upstashClient = null;
  console.log('[Redis] Disconnected client');
};
