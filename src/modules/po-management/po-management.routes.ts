import { Router } from 'express';
import * as controller from './po-management.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  GetPoSubmissionsQuerySchema,
  UpdatePoStatusSchema,
  UpdatePoPrioritySchema,
  AssignPoSchema,
  ReclassifyPoSchema,
  UpdateCustomerPoSchema,
  AddInternalNoteSchema,
  InboundWebhookSchema,
} from './po-management.schema';

const router = Router();

// ─── Public Inbound Webhook Endpoint ──────────────────────────────────────────
router.post(
  '/inbound-webhook',
  validate(InboundWebhookSchema),
  controller.handleInboundWebhook
);

// ─── Protected Admin Operations ───────────────────────────────────────────────
router.use(authenticate);

router.get(
  '/',
  authorize('orders.read', 'quotes.read', 'products.read', 'po.manage'),
  validate(GetPoSubmissionsQuerySchema, 'query'),
  controller.listPoSubmissions
);

router.get(
  '/metrics',
  authorize('orders.read', 'quotes.read', 'products.read', 'po.manage'),
  controller.getPoMetrics
);

router.post(
  '/sync',
  authorize('orders.manage', 'quotes.manage', 'po.manage'),
  controller.syncInbound
);

router.get(
  '/:id',
  authorize('orders.read', 'quotes.read', 'products.read', 'po.manage'),
  controller.getPoSubmissionById
);

router.patch(
  '/:id/status',
  authorize('orders.manage', 'quotes.manage', 'po.manage'),
  validate(UpdatePoStatusSchema),
  controller.updateStatus
);

router.patch(
  '/:id/priority',
  authorize('orders.manage', 'quotes.manage', 'po.manage'),
  validate(UpdatePoPrioritySchema),
  controller.updatePriority
);

router.patch(
  '/:id/assign',
  authorize('orders.manage', 'quotes.manage', 'po.manage'),
  validate(AssignPoSchema),
  controller.assign
);

router.patch(
  '/:id/classification',
  authorize('orders.manage', 'quotes.manage', 'po.manage'),
  validate(ReclassifyPoSchema),
  controller.reclassify
);

router.patch(
  '/:id/customer-po-number',
  authorize('orders.manage', 'quotes.manage', 'po.manage'),
  validate(UpdateCustomerPoSchema),
  controller.updateCustomerPoNumber
);

router.post(
  '/:id/notes',
  authorize('orders.manage', 'quotes.manage', 'po.manage'),
  validate(AddInternalNoteSchema),
  controller.addInternalNote
);

router.delete(
  '/:id',
  authorize('orders.manage', 'quotes.manage', 'po.manage'),
  controller.deletePoSubmission
);

export default router;
