import { Router } from 'express';
import * as controller from './po-management.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import multer from 'multer';
import {
  GetPoSubmissionsQuerySchema,
  UpdatePoStatusSchema,
  UpdatePoPrioritySchema,
  AssignPoSchema,
  ReclassifyPoSchema,
  UpdateCustomerPoSchema,
  AddInternalNoteSchema,
  InboundWebhookSchema,
  BulkDeletePoSchema,
  ReplyPoSubmissionSchema,
} from './po-management.schema';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
});

const router = Router();

// ─── Public Inbound Webhook Endpoint ──────────────────────────────────────────
router.post(
  '/inbound-webhook',
  validate(InboundWebhookSchema),
  controller.handleInboundWebhook
);

// ─── Attachment Download & Preview Endpoints (Public/Direct download) ─────────
router.get('/attachments/raw-:rawFile', controller.getAttachmentFile);
router.get('/attachments/:attachmentId/download', controller.getAttachmentFile);
router.get('/attachments/:attachmentId', controller.getAttachmentFile);

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

router.post(
  '/bulk-delete',
  authorize('orders.manage', 'quotes.manage', 'po.manage'),
  validate(BulkDeletePoSchema),
  controller.bulkDeletePoSubmissions
);

router.get(
  '/:id',
  authorize('orders.read', 'quotes.read', 'products.read', 'po.manage'),
  controller.getPoSubmissionById
);

router.post(
  '/:id/reply',
  authorize('orders.manage', 'quotes.manage', 'po.manage'),
  upload.array('attachments', 10),
  validate(ReplyPoSubmissionSchema),
  controller.replyPoSubmission
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
