import { getRedisClient } from '../../config/redis';

// ─── Redis Pub/Sub Adapter for Real-Time WebSocket Scaling ───────────────────

export const publishEvent = async (channel: string, message: any): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;

  try {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    if (typeof client.publish === 'function') {
      await client.publish(channel, payload);
    }
  } catch (err: any) {
    console.error(`[Redis PubSub Publish Error] channel="${channel}":`, err?.message || err);
  }
};

export const subscribeToChannel = (channel: string, callback: (message: string) => void): void => {
  const client = getRedisClient();
  if (!client || typeof client.duplicate !== 'function') return;

  try {
    const subscriber = client.duplicate();
    subscriber.subscribe(channel, (err?: Error) => {
      if (err) {
        console.error(`[Redis PubSub Subscribe Error] channel="${channel}":`, err.message);
      } else {
        console.log(`[Redis PubSub Subscribed] channel="${channel}"`);
      }
    });

    subscriber.on('message', (chan: string, msg: string) => {
      if (chan === channel) {
        callback(msg);
      }
    });
  } catch (err: any) {
    console.error(`[Redis PubSub Subscribe Error] channel="${channel}":`, err?.message || err);
  }
};
