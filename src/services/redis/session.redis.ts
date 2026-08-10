import { getRedisClient } from '../../config/redis';

// ─── Pure Redis (ioredis) Session & Token Management ──────────────────────────

export const storeUserSession = async (userId: string, sessionData: any, ttlSeconds = 86400): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;

  const key = `session:user:${userId}`;
  try {
    const serialized = JSON.stringify(sessionData);
    await client.setex(key, ttlSeconds, serialized);
  } catch (err: any) {
    console.error(`[Redis Session Store Error] userId="${userId}":`, err?.message || err);
  }
};

export const getUserSession = async <T = any>(userId: string): Promise<T | null> => {
  const client = getRedisClient();
  if (!client) return null;

  const key = `session:user:${userId}`;
  try {
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err: any) {
    console.error(`[Redis Session Get Error] userId="${userId}":`, err?.message || err);
    return null;
  }
};

export const clearUserSession = async (userId: string): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;

  const key = `session:user:${userId}`;
  try {
    await client.del(key);
  } catch (err: any) {
    console.error(`[Redis Session Clear Error] userId="${userId}":`, err?.message || err);
  }
};

export const revokeTokenInRedis = async (tokenId: string, ttlSeconds = 604800): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;

  const key = `token:revoked:${tokenId}`;
  try {
    await client.setex(key, ttlSeconds, 'true');
  } catch (err: any) {
    console.error(`[Redis Revoke Token Error] tokenId="${tokenId}":`, err?.message || err);
  }
};

export const isTokenRevokedInRedis = async (tokenId: string): Promise<boolean> => {
  const client = getRedisClient();
  if (!client) return false;

  const key = `token:revoked:${tokenId}`;
  try {
    const val = await client.get(key);
    return val !== null && val !== undefined;
  } catch (err: any) {
    console.error(`[Redis Check Revoked Error] tokenId="${tokenId}":`, err?.message || err);
    return false;
  }
};
