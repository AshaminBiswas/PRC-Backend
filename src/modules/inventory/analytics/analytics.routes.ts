import { Router } from 'express';
import * as controller from './analytics.controller';
import { authenticate, authorize } from '../../../middleware/auth.middleware';
import { requireVenture } from '../../../middleware/venture.middleware';
import { INVENTORY_PERMISSIONS } from '../shared/inventory.permissions';

const router = Router();

router.use(authenticate, requireVenture);

router.get('/daily', authorize(INVENTORY_PERMISSIONS.ANALYTICS_READ), controller.getDailyAnalytics);
router.get('/daily-inventory', authorize(INVENTORY_PERMISSIONS.ANALYTICS_READ), controller.getDailyAnalytics);
router.get('/fast-moving', authorize(INVENTORY_PERMISSIONS.ANALYTICS_READ), controller.getFastMovingProducts);
router.get('/slow-moving', authorize(INVENTORY_PERMISSIONS.ANALYTICS_READ), controller.getSlowMovingProducts);
router.get('/turnover', authorize(INVENTORY_PERMISSIONS.ANALYTICS_READ), controller.getTurnoverAnalytics);
router.get('/inventory-turnover', authorize(INVENTORY_PERMISSIONS.ANALYTICS_READ), controller.getTurnoverAnalytics);

export default router;
