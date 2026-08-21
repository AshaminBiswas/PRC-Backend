import { Router } from 'express';
import * as controller from './logistics.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { adminLimiter } from '../../middleware/rateLimit.middleware';
import {
  calculateLogisticsInputSchema,
  createCourierRateSchema,
  createWarehouseZoneMappingSchema,
} from './logistics.schema';

const router = Router();

// ─── Public / Authenticated calculation endpoint ──────────────────────────────
router.post(
  '/calculate',
  validate(calculateLogisticsInputSchema),
  controller.calculateShipping
);

// Get zones & rates
router.get('/zones', controller.listZones);
router.get('/rates', controller.listRates);

// ─── Admin Configuration Endpoints ────────────────────────────────────────────
router.use('/admin', authenticate, adminLimiter);
router.post(
  '/admin/shipping-rate',
  authenticate,
  authorize('shipping.manage', 'settings.manage'),
  validate(createCourierRateSchema),
  controller.createShippingRate
);

router.post(
  '/admin/warehouse-zone',
  authenticate,
  authorize('shipping.manage', 'settings.manage'),
  validate(createWarehouseZoneMappingSchema),
  controller.createWarehouseZoneMapping
);

export default router;
