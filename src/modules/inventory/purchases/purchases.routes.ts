import { Router } from 'express';
import * as controller from './purchases.controller';
import { authenticate, authorize } from '../../../middleware/auth.middleware';
import { requireVenture } from '../../../middleware/venture.middleware';
import { validate } from '../../../middleware/validate.middleware';
import { createPurchaseOrderSchema, receivePurchaseOrderSchema, createPurchasePaymentSchema } from './purchases.schema';
import { INVENTORY_PERMISSIONS } from '../shared/inventory.permissions';

const router = Router();

router.use(authenticate, requireVenture);

router.get('/orders', authorize(INVENTORY_PERMISSIONS.PURCHASES_READ), controller.listPurchaseOrders);
router.get('/orders/:id', authorize(INVENTORY_PERMISSIONS.PURCHASES_READ), controller.getPurchaseOrderById);
router.post('/orders', authorize(INVENTORY_PERMISSIONS.PURCHASES_CREATE), validate(createPurchaseOrderSchema), controller.createPurchaseOrder);
router.post('/orders/:id/receive', authorize(INVENTORY_PERMISSIONS.PURCHASES_RECEIVE), validate(receivePurchaseOrderSchema), controller.receivePurchaseOrder);
router.post('/payments', authorize(INVENTORY_PERMISSIONS.PURCHASES_PAYMENT), validate(createPurchasePaymentSchema), controller.createPurchasePayment);

export default router;
