import { Router } from 'express';
import * as controller from './reports.controller';
import { authenticate, authorize } from '../../../middleware/auth.middleware';
import { requireVenture } from '../../../middleware/venture.middleware';
import { INVENTORY_PERMISSIONS } from '../shared/inventory.permissions';

const router = Router();

router.use(authenticate, requireVenture);

router.get('/current-stock', authorize(INVENTORY_PERMISSIONS.REPORTS_READ), controller.getCurrentStockReport);
router.get('/low-stock', authorize(INVENTORY_PERMISSIONS.REPORTS_READ), controller.getLowStockReport);
router.get('/dead-stock', authorize(INVENTORY_PERMISSIONS.REPORTS_READ), controller.getDeadStockReport);
router.get('/valuation', authorize(INVENTORY_PERMISSIONS.REPORTS_READ), controller.getValuationReport);
router.get('/inventory-valuation', authorize(INVENTORY_PERMISSIONS.REPORTS_READ), controller.getValuationReport);
router.get('/movement', authorize(INVENTORY_PERMISSIONS.REPORTS_READ), controller.getMovementReport);
router.get('/stock-movement', authorize(INVENTORY_PERMISSIONS.REPORTS_READ), controller.getMovementReport);

export default router;
