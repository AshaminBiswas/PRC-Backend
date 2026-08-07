import { Router } from 'express';
import * as controller from './checkout.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import { GetShippingRatesSchema, PlaceOrderSchema } from './checkout.schema';

const router = Router();

router.use(authenticate);

router.post('/validate', controller.validateCheckout);
router.post('/shipping-rates', validate(GetShippingRatesSchema), controller.getShippingRates);
router.post('/place-order', validate(PlaceOrderSchema), controller.placeOrder);

export default router;
