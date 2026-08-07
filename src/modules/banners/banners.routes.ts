import { Router } from 'express';
import * as controller from './banners.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { cacheResponse } from '../../middleware/cache.middleware';
import {
  CreateBannerSchema,
  UpdateBannerSchema,
  ListBannersQuerySchema,
  UuidParamSchema,
} from './banners.schema';

const router = Router();

// Public routes
router.get('/', cacheResponse(120), controller.getPublicBanners);

// Admin routes
router.get(
  '/admin',
  authenticate,
  authorize('banners.read', 'banners.manage'),
  validate(ListBannersQuerySchema, 'query'),
  controller.listAdminBanners
);

router.get(
  '/:id',
  authenticate,
  authorize('banners.read', 'banners.manage'),
  validate(UuidParamSchema, 'params'),
  controller.getBannerById
);

router.post(
  '/',
  authenticate,
  authorize('banners.create', 'banners.manage'),
  validate(CreateBannerSchema),
  controller.createBanner
);

router.patch(
  '/:id',
  authenticate,
  authorize('banners.update', 'banners.manage'),
  validate(UuidParamSchema, 'params'),
  validate(UpdateBannerSchema),
  controller.updateBanner
);

router.delete(
  '/:id',
  authenticate,
  authorize('banners.delete', 'banners.manage'),
  validate(UuidParamSchema, 'params'),
  controller.deleteBanner
);

export default router;
