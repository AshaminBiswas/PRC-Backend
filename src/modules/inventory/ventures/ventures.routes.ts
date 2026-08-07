import { Router } from 'express';
import * as controller from './ventures.controller';
import { authenticate, authorize } from '../../../middleware/auth.middleware';
import { validate } from '../../../middleware/validate.middleware';
import { createVentureSchema, updateVentureSchema, addUserToVentureSchema } from './ventures.schema';
import { INVENTORY_PERMISSIONS } from '../shared/inventory.permissions';

const router = Router();

router.use(authenticate);

router.get('/', authorize(INVENTORY_PERMISSIONS.VENTURES_READ), controller.listVentures);
router.get('/:id', authorize(INVENTORY_PERMISSIONS.VENTURES_READ), controller.getVentureById);
router.post('/', authorize(INVENTORY_PERMISSIONS.VENTURES_CREATE), validate(createVentureSchema), controller.createVenture);
router.patch('/:id', authorize(INVENTORY_PERMISSIONS.VENTURES_UPDATE), validate(updateVentureSchema), controller.updateVenture);
router.delete('/:id', authorize(INVENTORY_PERMISSIONS.VENTURES_DELETE), controller.deleteVenture);

router.post('/:id/users', authorize(INVENTORY_PERMISSIONS.VENTURES_UPDATE), validate(addUserToVentureSchema), controller.addUserToVenture);
router.delete('/:id/users/:userId', authorize(INVENTORY_PERMISSIONS.VENTURES_UPDATE), controller.removeUserFromVenture);

export default router;
