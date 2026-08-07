import { Router } from 'express';
import * as controller from './products.controller';
import { authenticate, authorize } from '../../../middleware/auth.middleware';
import { requireVenture } from '../../../middleware/venture.middleware';
import { validate } from '../../../middleware/validate.middleware';
import { createInventoryProductSchema, updateInventoryProductSchema, bulkUpdateInventoryProductSchema } from './products.schema';
import { INVENTORY_PERMISSIONS } from '../shared/inventory.permissions';

const router = Router();

router.use(authenticate, requireVenture);

router.get('/', authorize(INVENTORY_PERMISSIONS.PRODUCTS_READ), controller.listInventoryProducts);
router.post('/bulk-update', authorize(INVENTORY_PERMISSIONS.PRODUCTS_UPDATE), validate(bulkUpdateInventoryProductSchema), controller.bulkUpdate);
router.get('/:id', authorize(INVENTORY_PERMISSIONS.PRODUCTS_READ), controller.getInventoryProductById);
router.post('/', authorize(INVENTORY_PERMISSIONS.PRODUCTS_CREATE), validate(createInventoryProductSchema), controller.createInventoryProduct);
router.patch('/:id', authorize(INVENTORY_PERMISSIONS.PRODUCTS_UPDATE), validate(updateInventoryProductSchema), controller.updateInventoryProduct);
router.delete('/:id', authorize(INVENTORY_PERMISSIONS.PRODUCTS_DELETE), controller.deleteInventoryProduct);

router.get('/:id/history', authorize(INVENTORY_PERMISSIONS.PRODUCTS_READ), controller.getProductHistory);
router.get('/:id/movement', authorize(INVENTORY_PERMISSIONS.PRODUCTS_READ), controller.getProductHistory);
router.post('/:id/archive', authorize(INVENTORY_PERMISSIONS.PRODUCTS_UPDATE), controller.archiveProduct);
router.post('/:id/restore', authorize(INVENTORY_PERMISSIONS.PRODUCTS_UPDATE), controller.restoreProduct);

export default router;
