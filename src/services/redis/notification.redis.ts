import { getRedisClient } from '../../config/redis';

// ─── Redis Notifications Cache & Unread Count ────────────────────────────────

export const cacheNotification = async (userId: string, notification: any): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;

  const listKey = `notifications:${userId}`;
  const unreadKey = `notifications:unread:${userId}`;

  try {
    const payload = JSON.stringify(notification);
    if (typeof client.lpush === 'function') {
      await client.lpush(listKey, payload);
      await client.ltrim(listKey, 0, 49); // Keep latest 50 notifications
      await client.incr(unreadKey);
    }
  } catch (err: any) {
    console.error(`[Redis Notification Cache Error] userId="${userId}":`, err?.message || err);
  }
};

export const getCachedNotifications = async (userId: string): Promise<any[]> => {
  const client = getRedisClient();
  if (!client) return [];

  const listKey = `notifications:${userId}`;
  try {
    if (typeof client.lrange === 'function') {
      const rawList = await client.lrange(listKey, 0, 49);
      return rawList.map((item: string) => JSON.parse(item));
    }
    return [];
  } catch (err: any) {
    console.error(`[Redis Notification Get Error] userId="${userId}":`, err?.message || err);
    return [];
  }
};

export const getUnreadNotificationCount = async (userId: string): Promise<number> => {
  const client = getRedisClient();
  if (!client) return 0;

  const unreadKey = `notifications:unread:${userId}`;
  try {
    const count = await client.get(unreadKey);
    return count ? parseInt(String(count), 10) : 0;
  } catch (err: any) {
    console.error(`[Redis Notification Count Error] userId="${userId}":`, err?.message || err);
    return 0;
  }
};

export const resetUnreadNotificationCount = async (userId: string): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;

  const unreadKey = `notifications:unread:${userId}`;
  try {
    await client.del(unreadKey);
  } catch (err: any) {
    console.error(`[Redis Notification Reset Error] userId="${userId}":`, err?.message || err);
  }
};
