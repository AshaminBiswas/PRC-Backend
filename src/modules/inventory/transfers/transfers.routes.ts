import { Router } from 'express';
import * as controller from './transfers.controller';
import { authenticate, authorize } from '../../../middleware/auth.middleware';
import { requireVenture } from '../../../middleware/venture.middleware';
import { validate } from '../../../middleware/validate.middleware';
import { createStockTransferSchema, updateStockTransferStatusSchema } from './transfers.schema';
import { INVENTORY_PERMISSIONS } from '../shared/inventory.permissions';

const router = Router();

router.use(authenticate, requireVenture);

router.get('/', authorize(INVENTORY_PERMISSIONS.TRANSFERS_READ), controller.listTransfers);
router.get('/:id', authorize(INVENTORY_PERMISSIONS.TRANSFERS_READ), controller.getTransferById);
router.post('/', authorize(INVENTORY_PERMISSIONS.TRANSFERS_CREATE), validate(createStockTransferSchema), controller.createTransfer);
router.patch('/:id', authorize(INVENTORY_PERMISSIONS.TRANSFERS_APPROVE), validate(updateStockTransferStatusSchema), controller.updateTransfer);
router.post('/:id/approve', authorize(INVENTORY_PERMISSIONS.TRANSFERS_APPROVE), controller.approveTransfer);

export default router;
