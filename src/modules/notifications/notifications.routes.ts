import { Router } from 'express';
import * as controller from './notifications.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import {
  ListNotificationsQuerySchema,
  SendNotificationSchema,
  UuidParamSchema,
} from './notifications.schema';

const router = Router();

// User routes
router.get(
  '/',
  authenticate,
  validate(ListNotificationsQuerySchema, 'query'),
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
