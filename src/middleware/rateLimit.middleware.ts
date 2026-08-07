import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { env } from "../config/env";
import { getRedisClient } from "../config/redis";

const makeStore = (prefix: string): RedisStore | undefined => {
  if (!env.redis.url) return undefined;

  const client = getRedisClient();
  if (!client) return undefined;

  return new RedisStore({
    prefix,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendCommand: (command: string, ...args: string[]): Promise<any> => {
      return client.call(command, ...args) as Promise<any>;
    },
  });
};

export const generalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true, // Gracefully fallback to memory if Redis socket drops
  store: makeStore("rl:general:"),
  message: "Too many requests, please try again later.",
});

export const authLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true, // Gracefully fallback to memory if Redis socket drops
  store: makeStore("rl:auth:"),
  message: "Too many authentication attempts, please try again later.",
});

export const emailLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true, // Gracefully fallback to memory if Redis socket drops
  store: makeStore("rl:email:"),
  message: "Too many email requests, please try again later.",
});