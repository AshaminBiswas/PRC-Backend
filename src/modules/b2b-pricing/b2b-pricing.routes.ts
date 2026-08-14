import { Router } from 'express';
import * as controller from './b2b-pricing.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import {
  SetCustomerProductPriceSchema,
  BulkSetCustomerPricesSchema,
  ApplyFlatDiscountSchema,
  UuidParamSchema,
  UserProductParamSchema,
} from './b2b-pricing.schema';

const router = Router();

// All B2B pricing endpoints require authentication
router.use(authenticate);

// ─── Customer Self-Service Route ─────────────────────────────────────────────
router.get('/my-pricing', controller.getMyPricing);

// ─── Admin / Staff Management Routes ─────────────────────────────────────────
router.get(
  '/customer/:userId',
  authorize('users.read', 'quotes.read'),
  validate(UuidParamSchema, 'params'),
  controller.getCustomerPricingMatrix
);

router.post(
  '/customer/:userId',
  authorize('users.update', 'quotes.update'),
  validate(UuidParamSchema, 'params'),
  validate(SetCustomerProductPriceSchema),
  controller.setCustomerProductPrice
);

router.post(
  '/customer/:userId/bulk',
  authorize('users.update', 'quotes.update'),
  validate(UuidParamSchema, 'params'),
  validate(BulkSetCustomerPricesSchema),
  controller.bulkSetCustomerPrices
);

router.post(
  '/customer/:userId/discount',
  authorize('users.update', 'quotes.update'),
  validate(UuidParamSchema, 'params'),
  validate(ApplyFlatDiscountSchema),
  controller.applyFlatDiscount
);

router.delete(
  '/customer/:userId/:productId',
  authorize('users.update', 'quotes.update'),
  validate(UserProductParamSchema, 'params'),
  controller.deleteCustomerProductPrice
);

export default router;
