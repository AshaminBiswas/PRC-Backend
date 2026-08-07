import { Router } from 'express';
import * as controller from './dispatches.controller';
import { authenticate, authorize } from '../../../middleware/auth.middleware';
import { requireVenture } from '../../../middleware/venture.middleware';
import { validate } from '../../../middleware/validate.middleware';
import { createDispatchSchema, updateDispatchStatusSchema } from './dispatches.schema';
import { INVENTORY_PERMISSIONS } from '../shared/inventory.permissions';

const router = Router();

router.use(authenticate, requireVenture);

router.get('/', authorize(INVENTORY_PERMISSIONS.DISPATCHES_READ), controller.listDispatches);
router.get('/:id', authorize(INVENTORY_PERMISSIONS.DISPATCHES_READ), controller.getDispatchById);
router.post('/', authorize(INVENTORY_PERMISSIONS.DISPATCHES_CREATE), validate(createDispatchSchema), controller.createDispatch);
router.patch('/:id', authorize(INVENTORY_PERMISSIONS.DISPATCHES_UPDATE), validate(updateDispatchStatusSchema), controller.updateDispatchStatus);

router.post('/:id/pack', authorize(INVENTORY_PERMISSIONS.DISPATCHES_UPDATE), controller.markPacked);
router.post('/:id/ship', authorize(INVENTORY_PERMISSIONS.DISPATCHES_UPDATE), controller.markShipped);
router.post('/:id/deliver', authorize(INVENTORY_PERMISSIONS.DISPATCHES_UPDATE), controller.markDelivered);
router.get('/:id/timeline', authorize(INVENTORY_PERMISSIONS.DISPATCHES_READ), controller.getDispatchTimeline);

export default router;
