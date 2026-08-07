import { Request, Response, NextFunction } from "express";

// ─── Rate Limiting Disabled / Commented Out ──────────────────────────────────
// Express rate limiting middleware is commented out as requested.
// Redis connection remains fully active in src/config/redis.ts for caching and queues.

export const generalLimiter = (_req: Request, _res: Response, next: NextFunction): void => {
  next();
};

export const authLimiter = (_req: Request, _res: Response, next: NextFunction): void => {
  next();
};

export const emailLimiter = (_req: Request, _res: Response, next: NextFunction): void => {
  next();
};