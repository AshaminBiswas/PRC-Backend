import { Router } from 'express';
import * as controller from './dashboard.controller';
import { authenticate, authorize } from '../../../middleware/auth.middleware';
import { requireVenture } from '../../../middleware/venture.middleware';
import { INVENTORY_PERMISSIONS } from '../shared/inventory.permissions';

const router = Router();

router.use(authenticate, requireVenture);

router.get('/', authorize(INVENTORY_PERMISSIONS.DASHBOARD_READ), controller.getInventoryDashboard);

export default router;
