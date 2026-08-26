import { Router } from 'express';
import {
  listMaterialsHandler,
  getMaterialHandler,
  createMaterialHandler,
  updateMaterialHandler,
  deleteMaterialHandler,
} from './materials.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';

const router = Router();

// Public routes for storefront
router.get('/', listMaterialsHandler);
router.get('/:idOrSlug', getMaterialHandler);

// Admin-only management routes
router.post('/', authenticate, authorize('admin', 'super_admin', 'super-admin', 'manager'), createMaterialHandler);
router.patch('/:id', authenticate, authorize('admin', 'super_admin', 'super-admin', 'manager'), updateMaterialHandler);
router.delete('/:id', authenticate, authorize('admin', 'super_admin', 'super-admin', 'manager'), deleteMaterialHandler);

export default router;
