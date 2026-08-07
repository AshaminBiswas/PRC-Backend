import { Router } from 'express';
import * as controller from './suppliers.controller';
import { authenticate, authorize } from '../../../middleware/auth.middleware';
import { requireVenture } from '../../../middleware/venture.middleware';
import { validate } from '../../../middleware/validate.middleware';
import { createSupplierSchema, updateSupplierSchema } from './suppliers.schema';
import { INVENTORY_PERMISSIONS } from '../shared/inventory.permissions';

const router = Router();

router.use(authenticate, requireVenture);

router.get('/', authorize(INVENTORY_PERMISSIONS.SUPPLIERS_READ), controller.listSuppliers);
router.get('/:id', authorize(INVENTORY_PERMISSIONS.SUPPLIERS_READ), controller.getSupplierById);
router.post('/', authorize(INVENTORY_PERMISSIONS.SUPPLIERS_CREATE), validate(createSupplierSchema), controller.createSupplier);
router.patch('/:id', authorize(INVENTORY_PERMISSIONS.SUPPLIERS_UPDATE), validate(updateSupplierSchema), controller.updateSupplier);
router.delete('/:id', authorize(INVENTORY_PERMISSIONS.SUPPLIERS_DELETE), controller.deleteSupplier);

router.get('/:id/ledger', authorize(INVENTORY_PERMISSIONS.SUPPLIERS_READ), controller.getSupplierLedger);
router.get('/:id/purchase-history', authorize(INVENTORY_PERMISSIONS.SUPPLIERS_READ), controller.getSupplierPurchaseHistory);
router.get('/:id/payment-history', authorize(INVENTORY_PERMISSIONS.SUPPLIERS_READ), controller.getSupplierPaymentHistory);
router.get('/:id/outstanding', authorize(INVENTORY_PERMISSIONS.SUPPLIERS_READ), controller.getSupplierOutstanding);

export default router;
