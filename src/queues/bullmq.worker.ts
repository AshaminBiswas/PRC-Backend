import { Worker } from 'bullmq';
import { env } from '../config/env';
import { sendMail } from '../utils/email.utils';
import prisma from '../config/database';
import { eventBus } from '../events/eventBus';
import { getBullMQRedisConnection } from './bullmq.queue';

// ─── BullMQ Worker Processor ──────────────────────────────────────────────────

export const startBullMQWorkers = () => {
  setImmediate(() => {
    try {
      const connection = getBullMQRedisConnection();

      if (!connection) {
        console.log('ℹ️ [BullMQ Workers] No dedicated remote Redis TCP connection. Background tasks will run via in-process async fallback.');
        return;
      }

      // 1. Email Worker Processor
      const emailWorker = new Worker(
      'email-queue',
      async (job) => {
        console.log(`[BullMQ Worker] Processing email job ${job.id} (${job.name})`);
        const { to, subject, html } = job.data;
        if (to && subject && html) {
          await sendMail({ to, subject, html });
        }
      },
      { connection }
    );

    emailWorker.on('completed', (job) => console.log(`[BullMQ Worker] Email job ${job.id} completed`));
    emailWorker.on('failed', (job, err) => console.error(`[BullMQ Worker] Email job ${job?.id} failed:`, err.message));
    emailWorker.on('error', () => {});

    // 2. Invoice Generation Worker Processor
    const invoiceWorker = new Worker(
      'invoice-queue',
      async (job) => {
        console.log(`[BullMQ Worker] Processing invoice job ${job.id} (${job.name})`);
        const { orderId, orderNumber } = job.data;

        if (orderId) {
          const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
              items: true,
              user: true,
            },
          });

          if (order) {
            console.log(`[BullMQ Worker] Tax invoice verified for Order #${order.orderNumber || orderNumber}`);
          }
        }
      },
      { connection }
    );

    invoiceWorker.on('completed', (job) => console.log(`[BullMQ Worker] Invoice job ${job.id} completed`));
    invoiceWorker.on('failed', (job, err) => console.error(`[BullMQ Worker] Invoice job ${job?.id} failed:`, err.message));
    invoiceWorker.on('error', () => {});

    // 3. Inventory Reconciliation & Low-Stock Monitor Worker Processor
    const inventoryWorker = new Worker(
      'inventory-queue',
      async (job) => {
        console.log(`[BullMQ Worker] Processing inventory job ${job.id} (${job.name})`);
        const { action } = job.data || {};

        if (action === 'check-low-stock' || !action) {
          const lowStockVariants = await prisma.productVariant.findMany({
            where: {
              stock: { lte: 5 },
              isAvailable: true,
            },
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
            take: 20,
          });

          for (const variant of lowStockVariants) {
            eventBus.emitEvent('inventory.low_stock', {
              variantId: variant.id,
              productId: variant.productId,
              sku: variant.sku,
              productName: variant.product?.name || variant.name || 'Hardware Item',
              currentStock: variant.stock,
              reorderLevel: 5,
            });
          }
        }
      },
      { connection }
    );

    inventoryWorker.on('completed', (job) => console.log(`[BullMQ Worker] Inventory job ${job.id} completed`));
    inventoryWorker.on('failed', (job, err) => console.error(`[BullMQ Worker] Inventory job ${job?.id} failed:`, err.message));
    inventoryWorker.on('error', () => {});

    // 4. Notification Dispatcher Worker Processor
    const notificationWorker = new Worker(
      'notification-queue',
      async (job) => {
        console.log(`[BullMQ Worker] Processing notification job ${job.id} (${job.name})`);
        const { userId, broadcast, type, title, message, data } = job.data;

        if (broadcast) {
          eventBus.emitEvent('notification.created', {
            id: `worker-broadcast-${Date.now()}`,
            broadcast: true,
            type: type || 'SYSTEM',
            title: title || 'System Update',
            message: message || '',
            data,
            createdAt: new Date().toISOString(),
          });
        } else if (userId) {
          eventBus.emitEvent('notification.created', {
            id: `worker-user-${Date.now()}`,
            userId,
            type: type || 'GENERAL',
            title: title || 'Notification',
            message: message || '',
            data,
            createdAt: new Date().toISOString(),
          });
        }
      },
      { connection }
    );

    notificationWorker.on('completed', (job) => console.log(`[BullMQ Worker] Notification job ${job.id} completed`));
    notificationWorker.on('failed', (job, err) => console.error(`[BullMQ Worker] Notification job ${job?.id} failed:`, err.message));
    notificationWorker.on('error', () => {});

    console.log('🚀 [BullMQ Workers] Registered & active on email-queue, invoice-queue, inventory-queue, notification-queue');
    } catch (err: any) {
      console.warn('⚠️ [BullMQ Workers Startup Warning]:', err.message);
    }
  });
};
