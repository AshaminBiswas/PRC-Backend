import { Router } from 'express';
import * as controller from './pos.controller';
import { authenticate, authorize } from '../../../middleware/auth.middleware';
import { requireVenture } from '../../../middleware/venture.middleware';
import { validate } from '../../../middleware/validate.middleware';
import {
  createPosStoreSchema,
  createPosTerminalSchema,
  openPosSessionSchema,
  closePosSessionSchema,
  createPosSaleSchema,
  createPosReturnSchema,
} from './pos.schema';
import { INVENTORY_PERMISSIONS } from '../shared/inventory.permissions';

const router = Router();

router.use(authenticate, requireVenture);

// Stores
router.get('/stores', authorize(INVENTORY_PERMISSIONS.POS_MANAGE), controller.listPosStores);
router.post('/stores', authorize(INVENTORY_PERMISSIONS.POS_MANAGE), validate(createPosStoreSchema), controller.createPosStore);

// Terminals
router.get('/terminals', authorize(INVENTORY_PERMISSIONS.POS_MANAGE), controller.listPosTerminals);
router.post('/terminals', authorize(INVENTORY_PERMISSIONS.POS_MANAGE), validate(createPosTerminalSchema), controller.createPosTerminal);

// Sessions (Shifts)
router.post('/sessions/open', authorize(INVENTORY_PERMISSIONS.POS_SELL), validate(openPosSessionSchema), controller.openPosSession);
router.post('/sessions/:id/close', authorize(INVENTORY_PERMISSIONS.POS_SELL), validate(closePosSessionSchema), controller.closePosSession);

// Sales & Billing
router.post('/sales', authorize(INVENTORY_PERMISSIONS.POS_SELL), validate(createPosSaleSchema), controller.createPosSale);
router.get('/sales', authorize(INVENTORY_PERMISSIONS.POS_SELL), controller.listPosSales);
router.get('/sales/:id/receipt', authorize(INVENTORY_PERMISSIONS.POS_SELL), controller.getPosSaleReceipt);

// Returns
router.post('/returns', authorize(INVENTORY_PERMISSIONS.POS_RETURN), validate(createPosReturnSchema), controller.createPosReturn);

export default router;
