import { Router } from 'express';
import * as controller from './warehouses.controller';
import { authenticate, authorize } from '../../../middleware/auth.middleware';
import { requireVenture } from '../../../middleware/venture.middleware';
import { validate } from '../../../middleware/validate.middleware';
import { createWarehouseSchema, updateWarehouseSchema } from './warehouses.schema';
import { INVENTORY_PERMISSIONS } from '../shared/inventory.permissions';

const router = Router();

router.use(authenticate, requireVenture);

router.get('/', authorize(INVENTORY_PERMISSIONS.WAREHOUSES_READ), controller.listWarehouses);
router.get('/:id', authorize(INVENTORY_PERMISSIONS.WAREHOUSES_READ), controller.getWarehouseById);
router.post('/', authorize(INVENTORY_PERMISSIONS.WAREHOUSES_CREATE), validate(createWarehouseSchema), controller.createWarehouse);
router.patch('/:id', authorize(INVENTORY_PERMISSIONS.WAREHOUSES_UPDATE), validate(updateWarehouseSchema), controller.updateWarehouse);
router.delete('/:id', authorize(INVENTORY_PERMISSIONS.WAREHOUSES_DELETE), controller.deleteWarehouse);

router.get('/:id/products', authorize(INVENTORY_PERMISSIONS.WAREHOUSES_READ), controller.getWarehouseProducts);
router.get('/:id/stock', authorize(INVENTORY_PERMISSIONS.WAREHOUSES_READ), controller.getWarehouseProducts);

export default router;
