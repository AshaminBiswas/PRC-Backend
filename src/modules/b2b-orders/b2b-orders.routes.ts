import { Router } from 'express';
import { authenticate, requireSuperAdmin } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import * as controller from './b2b-orders.controller';
import {
  SubmitB2bOrderSchema,
  AdminCreateB2bOrderSchema,
  RejectB2bOrderSchema,
  EditB2bOrderSchema,
  CancelB2bOrderSchema,
  UpdateB2bOrderStatusSchema,
  ListB2bOrdersQuerySchema,
  RecordB2bOrderPaymentSchema,
} from './b2b-orders.schema';

const router = Router();

// ─── Customer Endpoints ───────────────────────────────────────────────────────

// POST /api/v1/b2b-orders/submit - Customer self-service submission (lands as pending_approval)
router.post(
  '/submit',
  authenticate,
  validate(SubmitB2bOrderSchema),
  controller.submitOrder
);

// GET /api/v1/b2b-orders/my-orders - Customer order list
router.get(
  '/my-orders',
  authenticate,
  validate(ListB2bOrdersQuerySchema, 'query'),
  controller.getMyOrders
);

// POST /api/v1/b2b-orders/my-orders/:id/cancel - Customer self-cancellation for pending_approval
router.post(
  '/my-orders/:id/cancel',
  authenticate,
  controller.customerCancelOrder
);

// ─── Shared Utilities ─────────────────────────────────────────────────────────

// GET /api/v1/b2b-orders/check-stock - Live available stock (stock - reservedQuantity)
router.get(
  '/check-stock',
  authenticate,
  controller.checkStock
);

// ─── Super Admin Endpoints ────────────────────────────────────────────────────

// POST /api/v1/b2b-orders/admin-create - Offline order placement (Super Admin only, auto-confirm)
router.post(
  '/admin-create',
  authenticate,
  requireSuperAdmin,
  validate(AdminCreateB2bOrderSchema),
  controller.adminCreateOrder
);

// POST /api/v1/b2b-orders/:id/approve - Approve pending order (Super Admin only)
router.post(
  '/:id/approve',
  authenticate,
  requireSuperAdmin,
  controller.approveOrder
);

// POST /api/v1/b2b-orders/:id/reject - Reject pending order (Super Admin only)
router.post(
  '/:id/reject',
  authenticate,
  requireSuperAdmin,
  validate(RejectB2bOrderSchema),
  controller.rejectOrder
);

// POST /api/v1/b2b-orders/:id/cancel - Soft-cancel confirmed order & restore stock (Super Admin only)
router.post(
  '/:id/cancel',
  authenticate,
  requireSuperAdmin,
  validate(CancelB2bOrderSchema),
  controller.adminCancelOrder
);

// PATCH /api/v1/b2b-orders/:id/edit - Edit items on confirmed order (Super Admin only)
router.patch(
  '/:id/edit',
  authenticate,
  requireSuperAdmin,
  validate(EditB2bOrderSchema),
  controller.adminEditOrder
);

// PATCH /api/v1/b2b-orders/:id/status - Status progress (processing, ready, completed)
router.patch(
  '/:id/status',
  authenticate,
  validate(UpdateB2bOrderStatusSchema),
  controller.updateOrderStatus
);

// POST /api/v1/b2b-orders/:id/record-payment - Super Admin record payment & sync PI
router.post(
  '/:id/record-payment',
  authenticate,
  requireSuperAdmin,
  validate(RecordB2bOrderPaymentSchema),
  controller.recordPayment
);

// ─── General Read Endpoints ───────────────────────────────────────────────────

// GET /api/v1/b2b-orders - List all B2B orders (Admin & Staff view)
router.get(
  '/',
  authenticate,
  validate(ListB2bOrdersQuerySchema, 'query'),
  controller.listOrders
);

// GET /api/v1/b2b-orders/:id - Get order details
router.get(
  '/:id',
  authenticate,
  controller.getOrderById
);

export default router;
