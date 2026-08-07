import { Router } from 'express';
import * as controller from './homepage.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { cacheResponse } from '../../middleware/cache.middleware';
import {
  CreateHomepageSectionSchema,
  UpdateHomepageSectionSchema,
  UuidParamSchema,
} from './homepage.schema';

const router = Router();

// Public aggregated homepage endpoint
router.get('/', cacheResponse(120), controller.getHomepageData);

// Admin section CRUD routes
router.get(
  '/sections',
  authenticate,
  authorize('homepage.read', 'homepage.manage'),
  controller.listSections
);

router.get(
  '/sections/:id',
  authenticate,
  authorize('homepage.read', 'homepage.manage'),
  validate(UuidParamSchema, 'params'),
  controller.getSectionById
);

router.post(
  '/sections',
  authenticate,
  authorize('homepage.create', 'homepage.manage'),
  validate(CreateHomepageSectionSchema),
  controller.createSection
);

router.patch(
  '/sections/:id',
  authenticate,
  authorize('homepage.update', 'homepage.manage'),
  validate(UuidParamSchema, 'params'),
  validate(UpdateHomepageSectionSchema),
  controller.updateSection
);

router.delete(
  '/sections/:id',
  authenticate,
  authorize('homepage.delete', 'homepage.manage'),
  validate(UuidParamSchema, 'params'),
  controller.deleteSection
);

export default router;
