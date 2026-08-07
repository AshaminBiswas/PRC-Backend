import { Router } from 'express';
import * as controller from './coupons.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize, optionalAuthenticate } from '../../middleware/auth.middleware';
import {
  ListCouponsQuerySchema,
  CreateCouponSchema,
  UpdateCouponSchema,
  ValidateCouponSchema,
  CouponIdParamSchema,
  CouponCodeParamSchema,
} from './coupons.schema';

const router = Router();

// Validation route (Public / Authenticated users)
router.post('/validate', optionalAuthenticate, validate(ValidateCouponSchema), controller.validateCoupon);

// Admin routes
router.get(
  '/',
  authenticate,
  authorize('coupons.read'),
  validate(ListCouponsQuerySchema, 'query'),
  controller.listCoupons
);

router.post(
  '/',
  authenticate,
  authorize('coupons.create'),
  validate(CreateCouponSchema),
  controller.createCoupon
);

router.patch(
  '/:id',
  authenticate,
  authorize('coupons.update'),
  validate(CouponIdParamSchema, 'params'),
  validate(UpdateCouponSchema),
  controller.updateCoupon
);

router.delete(
  '/:id',
  authenticate,
  authorize('coupons.delete'),
  validate(CouponIdParamSchema, 'params'),
  controller.deleteCoupon
);

// Get single coupon details by code or ID
router.get('/:code', validate(CouponCodeParamSchema, 'params'), controller.getCouponByCodeOrId);

export default router;
