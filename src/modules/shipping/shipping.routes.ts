import { Router } from 'express';
import * as controller from './shipping.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { cacheResponse } from '../../middleware/cache.middleware';
import {
  CreateShippingZoneSchema,
  UpdateShippingZoneSchema,
  CreateShippingRateSchema,
  UpdateShippingRateSchema,
  CalculateShippingSchema,
  ZoneIdParamSchema,
  RateIdParamSchema,
} from './shipping.schema';

const router = Router();

// Calculation route (Public / Authenticated)
router.post('/calculate', validate(CalculateShippingSchema), controller.calculateShipping);

// Zone routes
router.get('/zones', cacheResponse(300), controller.listZones);

router.post(
  '/zones',
  authenticate,
  authorize('shipping.manage'),
  validate(CreateShippingZoneSchema),
  controller.createZone
);

router.patch(
  '/zones/:id',
  authenticate,
  authorize('shipping.manage'),
  validate(ZoneIdParamSchema, 'params'),
  validate(UpdateShippingZoneSchema),
  controller.updateZone
);

router.delete(
  '/zones/:id',
  authenticate,
  authorize('shipping.manage'),
  validate(ZoneIdParamSchema, 'params'),
  controller.deleteZone
);

// Zone Rates sub-routes
router.get('/zones/:id/rates', cacheResponse(300), validate(ZoneIdParamSchema, 'params'), controller.getZoneRates);

router.post(
  '/zones/:id/rates',
  authenticate,
  authorize('shipping.manage'),
  validate(ZoneIdParamSchema, 'params'),
  validate(CreateShippingRateSchema),
  controller.createZoneRate
);

// Individual Rate management
router.patch(
  '/rates/:id',
  authenticate,
  authorize('shipping.manage'),
  validate(RateIdParamSchema, 'params'),
  validate(UpdateShippingRateSchema),
  controller.updateRate
);

router.delete(
  '/rates/:id',
  authenticate,
  authorize('shipping.manage'),
  validate(RateIdParamSchema, 'params'),
  controller.deleteRate
);

export default router;
