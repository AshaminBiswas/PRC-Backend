import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('/api/v1'),
  INSTANCE_ID: z.string().default(process.env.HOSTNAME ?? `local-${process.pid}`),

  JWT_ACCESS_SECRET: z.string().default('super-secret-access-key-prc-hardware-api-2026'),
  JWT_REFRESH_SECRET: z.string().default('super-secret-refresh-key-prc-hardware-api-2026'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  SUPABASE_URL: z.string().default('https://example.supabase.co'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default('dummy-supabase-role-key'),
  SUPABASE_STORAGE_BUCKET_AVATARS: z.string().default('avatars'),
  SUPABASE_STORAGE_BUCKET_PRODUCTS: z.string().default('products'),
  SUPABASE_STORAGE_BUCKET_CATEGORIES: z.string().default('categories'),

  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.string().transform((v) => v === 'true').default('false'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM_NAME: z.string().default('PRC Hardware'),
  SMTP_FROM_EMAIL: z.string().default('noreply@pacifichardware.com'),

  FRONTEND_URL: z.string().default('http://localhost:5173'),
  ADMIN_FRONTEND_URL: z.string().default('http://localhost:5174'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(5),

  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),

  TRUST_PROXY: z.string().transform((v) => v === 'true').default('false'),
  CLUSTER_MODE: z.string().transform((v) => v === 'true').default('false'),
  WEB_CONCURRENCY: z.coerce.number().default(0),
  SHUTDOWN_GRACE_MS: z.coerce.number().default(10000),

  CACHE_ENABLED: z.string().transform((v) => v === 'true').default('true'),
  CACHE_DEFAULT_TTL_SECONDS: z.coerce.number().default(60),
  CACHE_MAX_ENTRIES: z.coerce.number().default(500),

  DATABASE_READ_URL: z.string().optional(),
  DATABASE_SHARDS: z.string().optional(),

  ASYNC_JOBS_ENABLED: z.string().transform((v) => v === 'true').default('true'),
  ASYNC_JOB_POLL_INTERVAL_MS: z.coerce.number().default(2000),
  ASYNC_JOB_BATCH_SIZE: z.coerce.number().default(10),
  ASYNC_JOB_MAX_ATTEMPTS: z.coerce.number().default(5),
  ASYNC_JOB_LOCK_SECONDS: z.coerce.number().default(60),

  OSRM_BASE_URL: z.string().default('http://localhost:5000'),
  OSRM_TIMEOUT_MS: z.coerce.number().default(5000),
  OSRM_MAX_RETRIES: z.coerce.number().default(3),
  OSRM_RETRY_DELAY_MS: z.coerce.number().default(500),
  OSRM_CACHE_TTL_SECONDS: z.coerce.number().default(3600),
  OSRM_FALLBACK_TO_HAVERSINE: z.string().transform((v) => v === 'true').default('true'),
  ALLOCATION_DEFAULT_STRATEGY: z.string().default('ROAD_DISTANCE'),

  REDIS_URL: z.string().nullable().optional().default(null),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Environment validation failed:', parsedEnv.error.format());
  throw new Error('Invalid environment configuration');
}

const rawEnv = parsedEnv.data;

export const env = {
  NODE_ENV: rawEnv.NODE_ENV,
  PORT: rawEnv.PORT,
  API_PREFIX: rawEnv.API_PREFIX,
  INSTANCE_ID: rawEnv.INSTANCE_ID,
  isDev: rawEnv.NODE_ENV !== 'production',

  jwt: {
    accessSecret: rawEnv.JWT_ACCESS_SECRET,
    refreshSecret: rawEnv.JWT_REFRESH_SECRET,
    accessExpiresIn: rawEnv.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: rawEnv.JWT_REFRESH_EXPIRES_IN,
    refreshExpiresInMs: 7 * 24 * 60 * 60 * 1000,
  },

  supabase: {
    url: rawEnv.SUPABASE_URL,
    serviceRoleKey: rawEnv.SUPABASE_SERVICE_ROLE_KEY,
    buckets: {
      avatars: rawEnv.SUPABASE_STORAGE_BUCKET_AVATARS,
      products: rawEnv.SUPABASE_STORAGE_BUCKET_PRODUCTS,
      categories: rawEnv.SUPABASE_STORAGE_BUCKET_CATEGORIES,
    },
  },

  smtp: {
    host: rawEnv.SMTP_HOST,
    port: rawEnv.SMTP_PORT,
    secure: rawEnv.SMTP_SECURE,
    user: rawEnv.SMTP_USER,
    pass: rawEnv.SMTP_PASS,
    fromName: rawEnv.SMTP_FROM_NAME,
    fromEmail: rawEnv.SMTP_FROM_EMAIL,
  },

  frontend: {
    url: rawEnv.FRONTEND_URL,
    adminUrl: rawEnv.ADMIN_FRONTEND_URL,
  },

  rateLimit: {
    windowMs: rawEnv.RATE_LIMIT_WINDOW_MS,
    maxRequests: rawEnv.RATE_LIMIT_MAX_REQUESTS,
    authMax: rawEnv.AUTH_RATE_LIMIT_MAX,
  },

  cors: {
    allowedOrigins: rawEnv.ALLOWED_ORIGINS.split(','),
  },

  scaling: {
    trustProxy: rawEnv.TRUST_PROXY,
    clusterMode: rawEnv.CLUSTER_MODE,
    workers: rawEnv.WEB_CONCURRENCY,
    shutdownGraceMs: rawEnv.SHUTDOWN_GRACE_MS,
  },

  cache: {
    enabled: rawEnv.CACHE_ENABLED,
    defaultTtlSeconds: rawEnv.CACHE_DEFAULT_TTL_SECONDS,
    maxEntries: rawEnv.CACHE_MAX_ENTRIES,
  },

  database: {
    readUrl: rawEnv.DATABASE_READ_URL,
    shardsJson: rawEnv.DATABASE_SHARDS,
  },

  asyncJobs: {
    enabled: rawEnv.ASYNC_JOBS_ENABLED,
    pollIntervalMs: rawEnv.ASYNC_JOB_POLL_INTERVAL_MS,
    batchSize: rawEnv.ASYNC_JOB_BATCH_SIZE,
    maxAttempts: rawEnv.ASYNC_JOB_MAX_ATTEMPTS,
    lockSeconds: rawEnv.ASYNC_JOB_LOCK_SECONDS,
  },

  osrm: {
    baseUrl: rawEnv.OSRM_BASE_URL,
    timeoutMs: rawEnv.OSRM_TIMEOUT_MS,
    maxRetries: rawEnv.OSRM_MAX_RETRIES,
    retryDelayMs: rawEnv.OSRM_RETRY_DELAY_MS,
    cacheTtlSeconds: rawEnv.OSRM_CACHE_TTL_SECONDS,
    fallbackToHaversine: rawEnv.OSRM_FALLBACK_TO_HAVERSINE,
    defaultStrategy: rawEnv.ALLOCATION_DEFAULT_STRATEGY,
  },

  redis: {
    url: rawEnv.REDIS_URL || null,
  },

  razorpay: {
    keyId: rawEnv.RAZORPAY_KEY_ID,
    keySecret: rawEnv.RAZORPAY_KEY_SECRET,
    webhookSecret: rawEnv.RAZORPAY_WEBHOOK_SECRET,
  },
} as const;

