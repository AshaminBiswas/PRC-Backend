import Redis from 'ioredis';
import { env } from './env';

// ─── Pure Open-Source Redis Client (ioredis TCP) ─────────────────────────────

let redisClient: Redis | null = null;

export const getRedisClient = (): Redis | null => {
  const redisUrl = env.redis.url || 'redis://localhost:6379';

  if (!redisClient) {
    try {
      redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 5,
        enableOfflineQueue: true,
        retryStrategy: (times) => Math.min(times * 100, 3000),
      });

      redisClient.on('connect', () => {
        console.log('⚡ [Redis] Pure open-source Redis client connected →', redisUrl);
      });

      redisClient.on('error', (err) => {
        console.error('❌ [Redis Error]:', err?.message || err);
      });
    } catch (err: any) {
      console.error('❌ [Redis Failed to initialise]:', err?.message || err);
      redisClient = null;
    }
  }

  return redisClient;
};

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('🔌 [Redis] Pure Redis client disconnected');
  }
};
