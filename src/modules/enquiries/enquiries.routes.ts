import { Router } from 'express';
import * as controller from './enquiries.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize, optionalAuthenticate } from '../../middleware/auth.middleware';
import {
  formSubmissionLimiter,
  publicTrackingLimiter,
  adminLimiter,
} from '../../middleware/rateLimit.middleware';
import {
  CreateEnquirySchema,
  UpdateEnquirySchema,
  ListEnquiriesQuerySchema,
  UuidParamSchema,
} from './enquiries.schema';

const router = Router();

// Public / Optional Auth submission
router.post(
  '/',
  optionalAuthenticate,
  formSubmissionLimiter,
  validate(CreateEnquirySchema),
  controller.submitEnquiry
);

// Public Ticket Tracking System routes (Lookup by Ticket ID or Email)
router.get(
  '/track/:id',
  publicTrackingLimiter,
  controller.trackEnquiry
);

router.get(
  '/track',
  publicTrackingLimiter,
  controller.trackEnquiry
);

// Admin routes
router.get(
  '/',
  authenticate,
  authorize('enquiries.read', 'enquiries.manage'),
  adminLimiter,
  validate(ListEnquiriesQuerySchema, 'query'),
  controller.listEnquiries
);

router.get(
  '/:id',
  authenticate,
  authorize('enquiries.read', 'enquiries.manage'),
  adminLimiter,
  validate(UuidParamSchema, 'params'),
  controller.getEnquiryById
);

// Admin update enquiry status & notes
router.patch(
  '/:id',
  authenticate,
  authorize('enquiries.update', 'enquiries.manage'),
  adminLimiter,
  validate(UuidParamSchema, 'params'),
  validate(UpdateEnquirySchema),
  controller.updateEnquiry
);

router.put(
  '/:id',
  authenticate,
  authorize('enquiries.update', 'enquiries.manage'),
  adminLimiter,
  validate(UuidParamSchema, 'params'),
  validate(UpdateEnquirySchema),
  controller.updateEnquiry
);

// Admin delete enquiry permanently from database
router.delete(
  '/:id',
  authenticate,
  authorize('enquiries.delete', 'enquiries.manage'),
  adminLimiter,
  validate(UuidParamSchema, 'params'),
  controller.deleteEnquiry
);

export default router;
