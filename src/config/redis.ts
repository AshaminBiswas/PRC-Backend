import { Redis } from '@upstash/redis';
import { env } from './env';

// ─── Upstash Redis Client (HTTP REST SDK) ─────────────────────────────────────
// Uses @upstash/redis which communicates over HTTPS — works in any environment
// including serverless and edge runtimes. No TCP connection required.

let redisClient: Redis | null = null;

export const getRedisClient = (): Redis | null => {
  if (!env.redis.url || !env.redis.token) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis({
      url: env.redis.url,
      token: env.redis.token,
    });

    console.log('[Redis] Upstash client initialised →', env.redis.url);
  }

  return redisClient;
};

// ─── Graceful shutdown (no-op for HTTP client — no persistent connection) ─────

export const disconnectRedis = async (): Promise<void> => {
  redisClient = null;
  console.log('[Redis] Upstash client cleared');
};
