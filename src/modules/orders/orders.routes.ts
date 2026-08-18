import { Router } from 'express';
import * as controller from './orders.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import {
  ListOrdersQuerySchema,
  OrderIdParamSchema,
  CancelOrderSchema,
  UpdateOrderStatusSchema,
} from './orders.schema';

const router = Router();

// GET / - Paginated list (Admin gets all, Customer gets own)
router.get(
  '/',
  authenticate,
  validate(ListOrdersQuerySchema, 'query'),
  controller.listOrders
);

// GET /my - Customer's own orders alias
router.get(
  '/my',
  authenticate,
  validate(ListOrdersQuerySchema, 'query'),
  controller.listOrders
);

// GET /:id - Full order details with items, shipping, payment
router.get(
  '/:id',
  authenticate,
  validate(OrderIdParamSchema, 'params'),
  controller.getOrderById
);

// GET /:id/invoice - Structured invoice JSON
router.get(
  '/:id/invoice',
  authenticate,
  validate(OrderIdParamSchema, 'params'),
  controller.getInvoice
);

// POST & PATCH /:id/cancel - Customer/Admin order cancellation (allowed ONLY if PENDING or PROCESSING)
router.post(
  '/:id/cancel',
  authenticate,
  validate(OrderIdParamSchema, 'params'),
  validate(CancelOrderSchema),
  controller.cancelOrder
);
router.patch(
  '/:id/cancel',
  authenticate,
  validate(OrderIdParamSchema, 'params'),
  validate(CancelOrderSchema),
  controller.cancelOrder
);

// PATCH /:id/status - Admin status update
router.patch(
  '/:id/status',
  authenticate,
  authorize('orders.update'),
  validate(OrderIdParamSchema, 'params'),
  validate(UpdateOrderStatusSchema),
  controller.updateOrderStatus
);

// GET /:id/tracking - Shipping tracking details stub
router.get(
  '/:id/tracking',
  authenticate,
  validate(OrderIdParamSchema, 'params'),
  controller.getTrackingDetails
);

// GET /:id/allocation - Order logistics allocation breakdown
router.get(
  '/:id/allocation',
  authenticate,
  validate(OrderIdParamSchema, 'params'),
  controller.getOrderAllocation
);

export default router;
