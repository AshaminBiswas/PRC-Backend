import { Router } from 'express';
import * as controller from './banners.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { cacheResponse } from '../../middleware/cache.middleware';
import {
  CreateBannerSchema,
  UpdateBannerSchema,
  ReorderBannersSchema,
  ListBannersQuerySchema,
  UuidParamSchema,
} from './banners.schema';

const router = Router();

// ─── Public Routes ─────────────────────────────────────────────────────────────

// GET /api/v1/banners (Filter by ?position=BESTSELLERS_TOP)
router.get('/', cacheResponse(120), controller.getPublicBanners);

// ─── Admin Routes ──────────────────────────────────────────────────────────────

// GET /api/v1/banners/all or /api/v1/banners/admin
router.get(
  '/all',
  authenticate,
  authorize('banners.read', 'banners.manage'),
  validate(ListBannersQuerySchema, 'query'),
  controller.listAdminBanners
);

router.get(
  '/admin',
  authenticate,
  authorize('banners.read', 'banners.manage'),
  validate(ListBannersQuerySchema, 'query'),
  controller.listAdminBanners
);

// PATCH /api/v1/banners/reorder (Bulk reorder display position)
router.patch(
  '/reorder',
  authenticate,
  authorize('banners.update', 'banners.manage'),
  validate(ReorderBannersSchema),
  controller.reorderBanners
);

// GET /api/v1/banners/:id
router.get(
  '/:id',
  validate(UuidParamSchema, 'params'),
  controller.getBannerById
);

// POST /api/v1/banners
router.post(
  '/',
  authenticate,
  authorize('banners.create', 'banners.manage'),
  validate(CreateBannerSchema),
  controller.createBanner
);

// PUT & PATCH /api/v1/banners/:id
router.put(
  '/:id',
  authenticate,
  authorize('banners.update', 'banners.manage'),
  validate(UuidParamSchema, 'params'),
  validate(UpdateBannerSchema),
  controller.updateBanner
);

router.patch(
  '/:id',
  authenticate,
  authorize('banners.update', 'banners.manage'),
  validate(UuidParamSchema, 'params'),
  validate(UpdateBannerSchema),
  controller.updateBanner
);

// DELETE /api/v1/banners/:id
router.delete(
  '/:id',
  authenticate,
  authorize('banners.delete', 'banners.manage'),
  validate(UuidParamSchema, 'params'),
  controller.deleteBanner
);

export default router;
