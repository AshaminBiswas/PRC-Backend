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

  // 2. Standard TCP Redis (Docker Container / Localhost / VPS)
  if (env.redis.url && (env.redis.url.startsWith('redis://') || env.redis.url.startsWith('rediss://'))) {
    if (!ioredisClient) {
      ioredisClient = new Redis(env.redis.url, {
        maxRetriesPerRequest: 5,
        enableOfflineQueue: true,
      });

      ioredisClient.on('connect', () => {
        console.log('⚡ [Redis] Standard TCP client connected →', env.redis.url);
      });

      ioredisClient.on('error', (err) => {
        console.error('❌ [Redis Error]:', err?.message || err);
      });
    }
    return ioredisClient;
  }

  return null;
};

export const disconnectRedis = async (): Promise<void> => {
  if (ioredisClient) {
    await ioredisClient.quit();
    ioredisClient = null;
  }
  upstashClient = null;
  console.log('🔌 [Redis] Client disconnected');
};
