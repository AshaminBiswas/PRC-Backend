import { Router } from 'express';
import * as controller from './audit.controller';
import { authenticate, authorize } from '../../../middleware/auth.middleware';
import { requireVenture } from '../../../middleware/venture.middleware';
import { INVENTORY_PERMISSIONS } from '../shared/inventory.permissions';

const router = Router();

router.use(authenticate, requireVenture);

router.get('/activity', authorize(INVENTORY_PERMISSIONS.AUDIT_READ), controller.getActivityLogs);
router.get('/stock-activity', authorize(INVENTORY_PERMISSIONS.AUDIT_READ), controller.getStockActivityLogs);
router.get('/adjustments', authorize(INVENTORY_PERMISSIONS.AUDIT_READ), controller.getAdjustmentHistory);
router.get('/transfers', authorize(INVENTORY_PERMISSIONS.AUDIT_READ), controller.getTransferHistory);

export default router;
