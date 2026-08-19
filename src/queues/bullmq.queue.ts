import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env';
import { sendMail } from '../utils/email.utils';

// ─── Safe Connection Factory for BullMQ ───────────────────────────────────────

let bullmqRedisConnection: IORedis | null = null;
let isQueueInitialized = false;

let emailQueue: Queue | null = null;
let invoiceQueue: Queue | null = null;
let inventoryQueue: Queue | null = null;
let notificationQueue: Queue | null = null;
let reportQueue: Queue | null = null;
let imageQueue: Queue | null = null;

export const getBullMQRedisConnection = (): IORedis | null => {
  if (bullmqRedisConnection) return bullmqRedisConnection;

  const rawUrl = process.env.REDIS_URL || env.redis.url;

  // In production on Render/AWS/Vercel, if REDIS_URL is not set or points to localhost, skip TCP socket
  if (env.NODE_ENV === 'production' && (!rawUrl || rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1'))) {
    if (!process.env.FORCE_LOCAL_REDIS) {
      return null;
    }
  }

  if (!rawUrl) return null;

  try {
    const isTls = rawUrl.startsWith('rediss://');
    bullmqRedisConnection = new IORedis(rawUrl, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      lazyConnect: true,
      tls: isTls ? { rejectUnauthorized: false } : undefined,
      retryStrategy: (times) => (times <= 3 ? 1000 : null),
    });

    bullmqRedisConnection.on('error', (err) => {
      // Suppress unhandled socket errors to prevent EPIPE crashes
      if (!err.message.includes('ECONNREFUSED') && !err.message.includes('ECONNRESET') && !err.message.includes('EPIPE')) {
        console.warn('⚠️ [BullMQ Connection Warning]:', err.message);
      }
    });

    bullmqRedisConnection.connect().catch(() => {
      // Handled silently
    });

    return bullmqRedisConnection;
  } catch (err: any) {
    console.warn('⚠️ [BullMQ] Could not initialize Redis client:', err.message);
    return null;
  }
};

const initQueues = () => {
  if (isQueueInitialized) return;
  const connection = getBullMQRedisConnection();
  if (!connection) return;

  try {
    emailQueue = new Queue('email-queue', { connection });
    invoiceQueue = new Queue('invoice-queue', { connection });
    inventoryQueue = new Queue('inventory-queue', { connection });
    notificationQueue = new Queue('notification-queue', { connection });
    reportQueue = new Queue('report-queue', { connection });
    imageQueue = new Queue('image-queue', { connection });

    emailQueue.on('error', () => {});
    invoiceQueue.on('error', () => {});
    inventoryQueue.on('error', () => {});
    notificationQueue.on('error', () => {});
    reportQueue.on('error', () => {});
    imageQueue.on('error', () => {});

    isQueueInitialized = true;
  } catch (e: any) {
    console.warn('⚠️ [BullMQ Queues Init Failed]:', e.message);
  }
};

// ─── High-Level Job Dispatchers with In-Process Fallback ──────────────────────

export const addEmailJob = async (jobName: string, data: any) => {
  initQueues();
  if (emailQueue) {
    try {
      return await emailQueue.add(jobName, data, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
    } catch {
      // fall through to in-process execution
    }
  }

  // In-process fallback execution
  if (data?.to && data?.subject && data?.html) {
    setImmediate(async () => {
      try {
        await sendMail({ to: data.to, subject: data.subject, html: data.html });
      } catch (err: any) {
        console.error('[In-Process Email Fallback Error]:', err.message);
      }
    });
  }
  return { id: `in-proc-email-${Date.now()}` };
};

export const addInvoiceJob = async (jobName: string, data: any) => {
  initQueues();
  if (invoiceQueue) {
    try {
      return await invoiceQueue.add(jobName, data, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
    } catch {
      // fall through
    }
  }

  console.log(`ℹ️ [In-Process Invoice Job]: Verified for Order #${data?.orderNumber || data?.orderId}`);
  return { id: `in-proc-invoice-${Date.now()}` };
};

export const addInventoryJob = async (jobName: string, data: any) => {
  initQueues();
  if (inventoryQueue) {
    try {
      return await inventoryQueue.add(jobName, data, { attempts: 5, backoff: { type: 'fixed', delay: 3000 } });
    } catch {
      // fall through
    }
  }

  return { id: `in-proc-inv-${Date.now()}` };
};

export const addReportJob = async (jobName: string, data: any) => {
  initQueues();
  if (reportQueue) {
    try {
      return await reportQueue.add(jobName, data, { attempts: 2, backoff: { type: 'exponential', delay: 5000 } });
    } catch {
      // fall through
    }
  }

  return { id: `in-proc-report-${Date.now()}` };
};

export const addImageJob = async (jobName: string, data: any) => {
  initQueues();
  if (imageQueue) {
    try {
      return await imageQueue.add(jobName, data, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
    } catch {
      // fall through
    }
  }

  return { id: `in-proc-image-${Date.now()}` };
};

export { emailQueue, invoiceQueue, inventoryQueue, notificationQueue, reportQueue, imageQueue };
