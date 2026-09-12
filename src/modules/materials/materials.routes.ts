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
router.post('/', authenticate, authorize('materials.create', 'materials.manage', 'admin'), createMaterialHandler);
router.patch('/:id', authenticate, authorize('materials.update', 'materials.manage', 'admin'), updateMaterialHandler);
router.delete('/:id', authenticate, authorize('materials.delete', 'materials.manage', 'admin'), deleteMaterialHandler);

export default router;
