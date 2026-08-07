import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { env } from "../config/env";

// Each rate limiter requires its own RedisStore with a unique prefix.
// The Redis client is shared across all three limiters but each store gets a unique prefix.
// If REDIS_URL is not set, returns undefined so express-rate-limit uses its in-memory store.
const makeStore = (prefix: string): RedisStore | undefined => {
  if (!env.redis.url) return undefined;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Redis = require("ioredis");
  const client = new Redis(env.redis.url, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => Math.min(times * 200, 2000),
  });

  client.on("error", (err: Error) => {
    console.error(`[Redis] rate-limit (${prefix}) error:`, err.message);
  });

  return new RedisStore({
    prefix,
    sendCommand: (...args: string[]) => client.call(...args),
  });
};

export const generalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("rl:general:"),
  message: "Too many requests, please try again later.",
});

export const authLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("rl:auth:"),
  message: "Too many authentication attempts, please try again later.",
});

export const emailLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("rl:email:"),
  message: "Too many email requests, please try again later.",
});