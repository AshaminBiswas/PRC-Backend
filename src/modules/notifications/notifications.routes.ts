import { Router } from 'express';
import * as controller from './notifications.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { cacheMiddleware } from '../../middleware/cache.middleware';
import {
  ListNotificationsQuerySchema,
  SendNotificationSchema,
  UuidParamSchema,
  BulkDeleteNotificationsSchema,
} from './notifications.schema';

const router = Router();

// User routes — cached for 15s to eliminate repeated Supabase round-trips
router.get(
  '/',
  authenticate,
  validate(ListNotificationsQuerySchema, 'query'),
  cacheMiddleware({ ttlSeconds: 15, keyPrefix: 'notif' }),
  controller.getUserNotifications
);

router.patch(
  '/read-all',
  authenticate,
  controller.markAllAsRead
);

router.patch(
  '/:id/read',
  authenticate,
  validate(UuidParamSchema, 'params'),
  controller.markAsRead
);

router.post(
  '/bulk-delete',
  authenticate,
  validate(BulkDeleteNotificationsSchema),
  controller.bulkDeleteNotifications
);

router.delete(
  '/bulk',
  authenticate,
  validate(BulkDeleteNotificationsSchema),
  controller.bulkDeleteNotifications
);

router.delete(
  '/:id',
  authenticate,
  validate(UuidParamSchema, 'params'),
  controller.deleteNotification
);

// Admin route to send / broadcast notification
router.post(
  '/',
  authenticate,
  authorize('notifications.send', 'notifications.manage'),
  validate(SendNotificationSchema),
  controller.sendNotification
);

export default router;
