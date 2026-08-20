/**
 * po-submissions.routes.ts
 *
 * Route definitions for PO Submissions module (Customer + Admin).
 */

import { Router } from 'express';
import multer from 'multer';
import { poSubmissionsController } from './po-submissions.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  CreateFormPoSchema,
  CreatePdfPoSchema,
  AdminUpsertLineItemsSchema,
  AdminApproveSchema,
  AdminRejectSchema,
  AdminRequestChangesSchema,
  AdminAssignSchema,
  AdminInternalNoteSchema,
  AdminQueueQuerySchema,
  CustomerListQuerySchema,
  IdParamSchema,
} from './po-submissions.schema';

// ── Multer Configuration (10 MB strict limit, PDF only) ──────────────────────
const storage = multer.memoryStorage();
const uploadPdf = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB maximum
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF documents are allowed for PO upload'));
    }
  },
});

// ── Customer Router ──────────────────────────────────────────────────────────
export const customerPoSubmissionsRouter = Router();

// Public token stream (iframe PDF viewer)
customerPoSubmissionsRouter.get('/view-attachment', poSubmissionsController.viewAttachmentByToken);

// Sequential number generator (customer/intake)
customerPoSubmissionsRouter.get('/next-po-number', poSubmissionsController.getNextSequentialPoNumber);

// Customer endpoints
customerPoSubmissionsRouter.post(
  '/',
  authenticate,
  validate(CreateFormPoSchema, 'body'),
  poSubmissionsController.createFormPo
);

customerPoSubmissionsRouter.post(
  '/upload',
  authenticate,
  uploadPdf.single('file'),
  validate(CreatePdfPoSchema, 'body'),
  poSubmissionsController.createPdfPo
);

customerPoSubmissionsRouter.get(
  '/',
  authenticate,
  validate(CustomerListQuerySchema, 'query'),
  poSubmissionsController.getMySubmissions
);

customerPoSubmissionsRouter.get(
  '/:id/tracking',
  authenticate,
  validate(IdParamSchema, 'params'),
  poSubmissionsController.getPoTracking
);

customerPoSubmissionsRouter.get(
  '/:id/acknowledgement',
  authenticate,
  validate(IdParamSchema, 'params'),
  poSubmissionsController.downloadAcknowledgement
);

customerPoSubmissionsRouter.get(
  '/attachments/:id',
  authenticate,
  validate(IdParamSchema, 'params'),
  poSubmissionsController.downloadAttachment
);

customerPoSubmissionsRouter.get(
  '/:id',
  authenticate,
  validate(IdParamSchema, 'params'),
  poSubmissionsController.getSubmissionById
);

customerPoSubmissionsRouter.delete(
  '/:id',
  authenticate,
  validate(IdParamSchema, 'params'),
  poSubmissionsController.deleteSubmission
);

// ── Admin Router ─────────────────────────────────────────────────────────────
export const adminPoSubmissionsRouter = Router();

adminPoSubmissionsRouter.get(
  '/',
  authenticate,
  validate(AdminQueueQuerySchema, 'query'),
  poSubmissionsController.adminGetQueue
);

adminPoSubmissionsRouter.get(
  '/:id/tracking',
  authenticate,
  validate(IdParamSchema, 'params'),
  poSubmissionsController.getPoTracking
);

adminPoSubmissionsRouter.get(
  '/:id',
  authenticate,
  validate(IdParamSchema, 'params'),
  poSubmissionsController.getSubmissionById
);

adminPoSubmissionsRouter.get(
  '/:id/pdf-signed-url',
  authenticate,
  validate(IdParamSchema, 'params'),
  poSubmissionsController.getPdfSignedUrl
);

adminPoSubmissionsRouter.get(
  '/:id/acknowledgement',
  authenticate,
  validate(IdParamSchema, 'params'),
  poSubmissionsController.downloadAcknowledgement
);

adminPoSubmissionsRouter.get(
  '/attachments/:id',
  authenticate,
  validate(IdParamSchema, 'params'),
  poSubmissionsController.downloadAttachment
);

adminPoSubmissionsRouter.post(
  '/:id/review',
  authenticate,
  validate(IdParamSchema, 'params'),
  poSubmissionsController.adminStartReview
);

adminPoSubmissionsRouter.patch(
  '/:id/line-items',
  authenticate,
  validate(IdParamSchema, 'params'),
  validate(AdminUpsertLineItemsSchema, 'body'),
  poSubmissionsController.adminUpsertLineItems
);

adminPoSubmissionsRouter.post(
  '/:id/approve',
  authenticate,
  validate(IdParamSchema, 'params'),
  validate(AdminApproveSchema, 'body'),
  poSubmissionsController.adminApprove
);

adminPoSubmissionsRouter.post(
  '/:id/acknowledge',
  authenticate,
  validate(IdParamSchema, 'params'),
  poSubmissionsController.adminIssueAcknowledgement
);

adminPoSubmissionsRouter.post(
  '/:id/reject',
  authenticate,
  validate(IdParamSchema, 'params'),
  validate(AdminRejectSchema, 'body'),
  poSubmissionsController.adminReject
);

adminPoSubmissionsRouter.post(
  '/:id/request-changes',
  authenticate,
  validate(IdParamSchema, 'params'),
  validate(AdminRequestChangesSchema, 'body'),
  poSubmissionsController.adminRequestChanges
);

adminPoSubmissionsRouter.post(
  '/:id/assign',
  authenticate,
  validate(IdParamSchema, 'params'),
  validate(AdminAssignSchema, 'body'),
  poSubmissionsController.adminAssign
);

adminPoSubmissionsRouter.post(
  '/:id/note',
  authenticate,
  validate(IdParamSchema, 'params'),
  validate(AdminInternalNoteSchema, 'body'),
  poSubmissionsController.adminAddInternalNote
);

export default customerPoSubmissionsRouter;
