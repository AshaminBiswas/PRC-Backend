import { Router } from 'express';
import * as controller from './reviews.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import {
  CreateReviewSchema,
  UpdateReviewStatusSchema,
  ListReviewsQuerySchema,
  ProductReviewsQuerySchema,
  UuidParamSchema,
  ProductIdParamSchema,
} from './reviews.schema';

const router = Router();

// Public routes
router.get(
  '/product/:productId',
  validate(ProductIdParamSchema, 'params'),
  validate(ProductReviewsQuerySchema, 'query'),
  controller.getProductReviews
);

// Authenticated customer route
router.post(
  '/',
  authenticate,
  validate(CreateReviewSchema),
  controller.createReview
);

// Admin routes
router.get(
  '/',
  authenticate,
  authorize('reviews.read', 'reviews.manage'),
  validate(ListReviewsQuerySchema, 'query'),
  controller.listAllReviews
);

router.patch(
  '/:id/status',
  authenticate,
  authorize('reviews.update', 'reviews.manage'),
  validate(UuidParamSchema, 'params'),
  validate(UpdateReviewStatusSchema),
  controller.updateReviewStatus
);

export default router;
