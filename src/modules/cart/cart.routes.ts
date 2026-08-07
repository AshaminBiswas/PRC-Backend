import { Router } from 'express';
import * as controller from './cart.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import {
  AddCartItemSchema,
  UpdateCartItemSchema,
  ApplyCouponSchema,
  CartItemParamSchema,
} from './cart.schema';

const router = Router();

router.use(authenticate);

router.get('/', controller.getCart);
router.post('/items', validate(AddCartItemSchema), controller.addCartItem);

router.post('/coupon', validate(ApplyCouponSchema), controller.applyCoupon);
router.delete('/coupon', controller.removeCoupon);

router.delete('/clear', controller.clearCart);

router.patch(
  '/items/:itemId',
  validate(CartItemParamSchema, 'params'),
  validate(UpdateCartItemSchema),
  controller.updateCartItem
);

router.delete('/items/:itemId', validate(CartItemParamSchema, 'params'), controller.removeCartItem);

export default router;
