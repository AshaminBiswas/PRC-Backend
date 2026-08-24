import EventEmitter from 'events';
import { sseService } from './sse.service';
import { addEmailJob, addInvoiceJob } from '../queues/bullmq.queue';
import { logger } from '../config/logger';

// ─── Domain Event Definitions & Payloads ─────────────────────────────────────

export interface OrderCreatedPayload {
  orderId: string;
  orderNumber: string;
  userId: string;
  totalAmount: number;
  itemsCount: number;
  customerName?: string;
  customerEmail?: string;
}

export interface OrderStatusChangedPayload {
  orderId: string;
  orderNumber: string;
  userId: string;
  previousStatus: string;
  newStatus: string;
}

export interface OrderPaidPayload {
  orderId: string;
  orderNumber: string;
  userId: string;
  paymentId: string;
  amount: number;
}

export interface QuoteCreatedPayload {
  quoteId: string;
  quoteNumber?: string;
  userId: string;
  customerName?: string;
  itemsCount: number;
  totalEstimated?: number;
}

export interface QuoteStatusChangedPayload {
  quoteId: string;
  userId: string;
  newStatus: string;
  approvedAmount?: number;
}

export interface LowStockPayload {
  variantId?: string;
  productId: string;
  sku: string;
  productName: string;
  currentStock: number;
  reorderLevel?: number;
}

export interface NotificationCreatedPayload {
  id: string;
  userId?: string;
  broadcast?: boolean;
  type: string;
  title: string;
  message: string;
  data?: any;
  createdAt: string;
}

export interface SystemAlertPayload {
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
}

export interface EnquirySubmittedPayload {
  enquiryId: string;
  name: string;
  email: string;
  subject: string;
}

export interface PaymentFailedPayload {
  orderId: string;
  orderNumber: string;
  paymentId?: string;
  amount: number;
  reason: string;
}

export type DomainEvents = {
  'order.created': OrderCreatedPayload;
  'order.status_changed': OrderStatusChangedPayload;
  'order.paid': OrderPaidPayload;
  'quote.created': QuoteCreatedPayload;
  'quote.status_changed': QuoteStatusChangedPayload;
  'inventory.low_stock': LowStockPayload;
  'notification.created': NotificationCreatedPayload;
  'system.alert': SystemAlertPayload;
  'enquiry.submitted': EnquirySubmittedPayload;
  'payment.failed': PaymentFailedPayload;
};

// ─── Type-Safe Domain Event Bus ──────────────────────────────────────────────

class DomainEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  public emitEvent<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]): boolean {
    logger.debug(`[Domain Event Bus] Emitting event: "${event}"`, payload as any);
    return this.emit(event, payload);
  }

  public onEvent<K extends keyof DomainEvents>(event: K, listener: (payload: DomainEvents[K]) => void): this {
    return this.on(event, listener);
  }
}

export const eventBus = new DomainEventBus();

// ─── Default Event Subscribers & Side-Effect Handlers ────────────────────────

export const initEventBus = () => {
  logger.info('[Domain Event Bus] Initialising event subscribers & real-time dispatchers...');

  // 1. Order Created Subscriber
  eventBus.onEvent('order.created', async (payload) => {
    // A. Push real-time event to Admin consoles
    sseService.sendToRoles(['super_admin', 'admin', 'sales_manager', 'inventory_manager'], 'order:new', {
      type: 'ORDER_CREATED',
      title: `New Order Received #${payload.orderNumber}`,
      message: `Order #${payload.orderNumber} for ₹${payload.totalAmount.toLocaleString()} placed by ${payload.customerName || 'Customer'}.`,
      data: payload,
      timestamp: new Date().toISOString(),
    });

    // B. Push event to the specific customer
    sseService.sendToUser(payload.userId, 'order:created', {
      type: 'ORDER_CREATED',
      title: 'Order Confirmed',
      message: `Your order #${payload.orderNumber} has been received and is being processed.`,
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
    });

    // C. Enqueue Background Invoice Generation Job
    try {
      await addInvoiceJob('generate-tax-invoice', {
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
      });
    } catch (err: any) {
      logger.error('[EventBus] Failed to enqueue invoice job: ' + err.message);
    }
  });

  // 2. Order Status Changed Subscriber
  eventBus.onEvent('order.status_changed', (payload) => {
    sseService.sendToUser(payload.userId, 'order:status_updated', {
      type: 'ORDER_STATUS',
      title: `Order Status Updated: ${payload.newStatus}`,
      message: `Your order #${payload.orderNumber} status is now ${payload.newStatus}.`,
      orderId: payload.orderId,
      newStatus: payload.newStatus,
    });

    sseService.sendToRoles(['super_admin', 'admin'], 'order:status_updated', payload);
  });

  // 3. Quote Created Subscriber
  eventBus.onEvent('quote.created', (payload) => {
    sseService.sendToRoles(['super_admin', 'admin', 'sales_manager'], 'quote:new', {
      type: 'QUOTE_CREATED',
      title: 'New B2B Price Quote Request',
      message: `Customer ${payload.customerName || 'B2B Client'} requested a bulk quotation (${payload.itemsCount} items).`,
      data: payload,
      timestamp: new Date().toISOString(),
    });
  });

  // 4. Low Stock Alert Subscriber
  eventBus.onEvent('inventory.low_stock', (payload) => {
    sseService.sendToRoles(['super_admin', 'admin', 'inventory_manager'], 'inventory:low_stock', {
      type: 'LOW_STOCK_ALERT',
      title: `Low Stock Alert: ${payload.sku}`,
      message: `Product "${payload.productName}" (SKU: ${payload.sku}) is low on stock (${payload.currentStock} units remaining).`,
      data: payload,
      timestamp: new Date().toISOString(),
    });
  });

  // 5. In-App Notification Created Subscriber
  eventBus.onEvent('notification.created', (payload) => {
    if (payload.broadcast) {
      sseService.broadcastAll('notification:broadcast', payload);
    } else if (payload.userId) {
      sseService.sendToUser(payload.userId, 'notification:new', payload);
    }
  });

  // 6. System Alert Subscriber
  eventBus.onEvent('system.alert', (payload) => {
    sseService.broadcastAll('system:alert', payload);
  });

  // 7. Admin Notifications for Edge Cases
  eventBus.onEvent('enquiry.submitted', async (payload) => {
    const { notifyAdmins } = await import('../modules/notifications/admin-notification.service');
    await notifyAdmins(
      'New Customer Enquiry',
      `A new enquiry has been submitted by ${payload.name} (${payload.email}). Subject: ${payload.subject}`,
      'ENQUIRY_SUBMITTED',
      payload
    );
  });

  eventBus.onEvent('payment.failed', async (payload) => {
    const { notifyAdmins } = await import('../modules/notifications/admin-notification.service');
    await notifyAdmins(
      'Payment Failed',
      `A payment of ₹${payload.amount} failed for Order #${payload.orderNumber}. Reason: ${payload.reason}`,
      'PAYMENT_FAILED',
      payload
    );
  });

  // Also hook into existing events for Admin emails
  eventBus.onEvent('quote.created', async (payload) => {
    const { notifyAdmins } = await import('../modules/notifications/admin-notification.service');
    await notifyAdmins(
      'New Quotation Request',
      `A new B2B quotation request has been submitted by ${payload.customerName || 'a customer'} for ${payload.itemsCount} items.`,
      'QUOTE_CREATED',
      payload
    );
  });

  eventBus.onEvent('inventory.low_stock', async (payload) => {
    const { notifyAdmins } = await import('../modules/notifications/admin-notification.service');
    await notifyAdmins(
      'Low Stock Alert',
      `Product "${payload.productName}" (SKU: ${payload.sku}) is running low. Only ${payload.currentStock} units remaining.`,
      'LOW_STOCK',
      payload
    );
  });

  logger.info('[Domain Event Bus] Subscribers active: order.created, order.status_changed, quote.created, inventory.low_stock, notification.created, system.alert, enquiry.submitted, payment.failed');
};
