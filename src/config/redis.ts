import Redis from "ioredis";
import { env } from "./env";

let redisClient: Redis | null = null;

export const getRedisClient = (): Redis | null => {
  const url = env.redis.url;
  if (!url) return null;

  if (!redisClient) {
    const isTls = url.startsWith("rediss://");

    redisClient = new Redis(url, {
      maxRetriesPerRequest: null, // Required by rate-limit-redis to prevent MaxRetriesPerRequestError
      retryStrategy: (times: number) => Math.min(times * 200, 2000),
      keepAlive: 10000, // Send TCP keepalive packets every 10s to prevent ECONNRESET
      tls: isTls ? { rejectUnauthorized: false } : undefined,
    });

    redisClient.on("error", (err: Error) => {
      // Suppress connection retry noise in console
      if (!err.message.includes("ECONNRESET") && !err.message.includes("max retries")) {
        console.error("[Redis] Connection error:", err.message);
      }
    });

    redisClient.once("connect", () => {
      console.log("[Redis] Connected successfully");
    });
  }

  return redisClient;
};

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
};
