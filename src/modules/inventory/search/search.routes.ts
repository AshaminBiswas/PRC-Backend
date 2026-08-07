import { Router } from 'express';
import * as controller from './search.controller';
import { authenticate, authorize } from '../../../middleware/auth.middleware';
import { requireVenture } from '../../../middleware/venture.middleware';
import { INVENTORY_PERMISSIONS } from '../shared/inventory.permissions';

const router = Router();

router.use(authenticate, requireVenture);

router.get('/products', authorize(INVENTORY_PERMISSIONS.PRODUCTS_READ), controller.searchProducts);
router.get('/sku', authorize(INVENTORY_PERMISSIONS.PRODUCTS_READ), controller.searchSKU);
router.get('/barcode', authorize(INVENTORY_PERMISSIONS.PRODUCTS_READ), controller.searchBarcode);
router.get('/qr', authorize(INVENTORY_PERMISSIONS.PRODUCTS_READ), controller.searchQR);
router.get('/suppliers', authorize(INVENTORY_PERMISSIONS.SUPPLIERS_READ), controller.searchSuppliers);

export default router;
