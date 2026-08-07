import { Router } from 'express';
import * as controller from './barcode.controller';
import { authenticate, authorize } from '../../../middleware/auth.middleware';
import { INVENTORY_PERMISSIONS } from '../shared/inventory.permissions';

const router = Router();

router.use(authenticate);

router.post('/barcodes/generate', authorize(INVENTORY_PERMISSIONS.PRODUCTS_READ), controller.generateBarcode);
router.get('/barcodes/:productId/download', authorize(INVENTORY_PERMISSIONS.PRODUCTS_READ), controller.downloadBarcode);

router.post('/qr/generate', authorize(INVENTORY_PERMISSIONS.PRODUCTS_READ), controller.generateQR);
router.get('/qr/:productId/download', authorize(INVENTORY_PERMISSIONS.PRODUCTS_READ), controller.downloadQR);

export default router;
