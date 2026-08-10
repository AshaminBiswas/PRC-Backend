import { Queue } from 'bullmq';
import { env } from '../config/env';

// ─── BullMQ Redis Queues Configuration ───────────────────────────────────────

const getRedisConnection = () => {
  const url = env.redis.url || 'redis://localhost:6379';
  const urlObj = new URL(url.startsWith('redis') ? url : `redis://${url}`);

  return {
    host: urlObj.hostname || 'localhost',
    port: parseInt(urlObj.port || '6379', 10),
    password: urlObj.password || undefined,
  };
};

export const emailQueue = new Queue('email-queue', { connection: getRedisConnection() });
export const invoiceQueue = new Queue('invoice-queue', { connection: getRedisConnection() });
export const inventoryQueue = new Queue('inventory-queue', { connection: getRedisConnection() });
export const notificationQueue = new Queue('notification-queue', { connection: getRedisConnection() });

export const addEmailJob = async (jobName: string, data: any) => {
  return emailQueue.add(jobName, data, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
};

export const addInvoiceJob = async (jobName: string, data: any) => {
  return invoiceQueue.add(jobName, data, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
};

export const addInventoryJob = async (jobName: string, data: any) => {
  return inventoryQueue.add(jobName, data, { attempts: 5, backoff: { type: 'fixed', delay: 3000 } });
};
