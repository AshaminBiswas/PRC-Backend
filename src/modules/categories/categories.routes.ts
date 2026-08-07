import { Router } from 'express';
import * as controller from './categories.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize, optionalAuthenticate } from '../../middleware/auth.middleware';
import { cacheResponse } from '../../middleware/cache.middleware';
import {
  ListCategoriesQuerySchema,
  CreateCategorySchema,
  UpdateCategorySchema,
  UpdateCategoryStatusSchema,
  ReorderCategoriesSchema,
  CategoryProductsQuerySchema,
  UuidParamSchema,
  SlugParamSchema,
} from './categories.schema';

const router = Router();

// Public read routes
router.get('/tree', cacheResponse(300), controller.getCategoryTree);
router.get('/:slug', cacheResponse(300), validate(SlugParamSchema, 'params'), controller.getCategoryBySlug);

// Mixed — public listing, admin can see inactive too
router.get('/', cacheResponse(180), optionalAuthenticate, validate(ListCategoriesQuerySchema, 'query'), controller.listCategories);

// Protected admin routes
router.patch('/reorder', authenticate, authorize('categories.update'), validate(ReorderCategoriesSchema), controller.reorderCategories);
router.post('/', authenticate, authorize('categories.create'), validate(CreateCategorySchema), controller.createCategory);
router.patch('/:id/status', authenticate, authorize('categories.update'), validate(UuidParamSchema, 'params'), validate(UpdateCategoryStatusSchema), controller.updateCategoryStatus);
router.patch('/:id', authenticate, authorize('categories.update'), validate(UuidParamSchema, 'params'), validate(UpdateCategorySchema), controller.updateCategory);
router.delete('/:id', authenticate, authorize('categories.delete'), validate(UuidParamSchema, 'params'), controller.deleteCategory);
router.get('/:id/products', cacheResponse(60), validate(UuidParamSchema, 'params'), validate(CategoryProductsQuerySchema, 'query'), controller.getCategoryProducts);

export default router;
