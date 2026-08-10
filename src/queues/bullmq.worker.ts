import { Worker } from 'bullmq';
import { env } from '../config/env';
import { sendMail } from '../utils/email.utils';

// ─── BullMQ Worker Processor ──────────────────────────────────────────────────

const getRedisConnection = () => {
  const url = env.redis.url || 'redis://localhost:6379';
  const urlObj = new URL(url.startsWith('redis') ? url : `redis://${url}`);

  return {
    host: urlObj.hostname || 'localhost',
    port: parseInt(urlObj.port || '6379', 10),
    password: urlObj.password || undefined,
  };
};

export const startBullMQWorkers = () => {
  const connection = getRedisConnection();

  // 1. Email Worker Processor
  const emailWorker = new Worker(
    'email-queue',
    async (job) => {
      console.log(`[BullMQ Worker] Processing email job ${job.id} (${job.name})`);
      const { to, subject, html } = job.data;
      await sendMail({ to, subject, html });
    },
    { connection }
  );

  emailWorker.on('completed', (job) => console.log(`[BullMQ Worker] Email job ${job.id} completed`));
  emailWorker.on('failed', (job, err) => console.error(`[BullMQ Worker] Email job ${job?.id} failed:`, err.message));

  // 2. Invoice Worker Processor
  const invoiceWorker = new Worker(
    'invoice-queue',
    async (job) => {
      console.log(`[BullMQ Worker] Processing invoice job ${job.id} (${job.name})`);
    },
    { connection }
  );

  invoiceWorker.on('failed', (job, err) => console.error(`[BullMQ Worker] Invoice job ${job?.id} failed:`, err.message));

  // 3. Inventory Worker Processor
  const inventoryWorker = new Worker(
    'inventory-queue',
    async (job) => {
      console.log(`[BullMQ Worker] Processing inventory job ${job.id} (${job.name})`);
    },
    { connection }
  );

  inventoryWorker.on('failed', (job, err) => console.error(`[BullMQ Worker] Inventory job ${job?.id} failed:`, err.message));

  console.log('🚀 [BullMQ Workers] Registered & active on email-queue, invoice-queue, inventory-queue');
};
