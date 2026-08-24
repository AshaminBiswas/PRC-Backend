import { Router } from 'express';
import * as controller from './stock.controller';
import { authenticate, authorize } from '../../../middleware/auth.middleware';
import { requireVenture } from '../../../middleware/venture.middleware';
import { validate } from '../../../middleware/validate.middleware';
import { updateStockSchema, adjustStockSchema, reconcileStockSchema } from './stock.schema';
import { INVENTORY_PERMISSIONS } from '../shared/inventory.permissions';

const router = Router();

router.use(authenticate, requireVenture);

router.post('/sync-legacy', authorize(INVENTORY_PERMISSIONS.STOCK_UPDATE), controller.syncLegacyProducts);
router.get('/sync-legacy', authorize(INVENTORY_PERMISSIONS.STOCK_UPDATE), controller.syncLegacyProducts);
router.get('/', authorize(INVENTORY_PERMISSIONS.STOCK_READ), controller.listStock);
router.get('/history', authorize(INVENTORY_PERMISSIONS.STOCK_READ), controller.getStockHistory);
router.get('/movement', authorize(INVENTORY_PERMISSIONS.STOCK_READ), controller.getStockHistory);
router.get('/:productId', authorize(INVENTORY_PERMISSIONS.STOCK_READ), controller.getStockByProduct);

router.post('/increase', authorize(INVENTORY_PERMISSIONS.STOCK_UPDATE), validate(updateStockSchema), controller.increaseStock);
router.post('/decrease', authorize(INVENTORY_PERMISSIONS.STOCK_UPDATE), validate(updateStockSchema), controller.decreaseStock);
router.post('/update', authorize(INVENTORY_PERMISSIONS.STOCK_UPDATE), validate(updateStockSchema), controller.increaseStock);
router.post('/adjustment', authorize(INVENTORY_PERMISSIONS.STOCK_ADJUST), validate(adjustStockSchema), controller.adjustStock);
router.post('/reconciliation', authorize(INVENTORY_PERMISSIONS.STOCK_RECONCILE), validate(reconcileStockSchema), controller.reconcileStock);

export default router;
