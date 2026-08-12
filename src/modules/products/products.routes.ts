import { Router } from 'express';
import * as controller from './products.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { cacheResponse } from '../../middleware/cache.middleware';
import {
  ListProductsQuerySchema,
  CreateProductSchema,
  UpdateProductSchema,
  UuidParamSchema,
  SlugParamSchema,
} from './products.schema';

const router = Router();

// Public read routes
router.get('/', cacheResponse(45), validate(ListProductsQuerySchema, 'query'), controller.listProducts);
router.get('/category/slug/:slug', cacheResponse(60), validate(ListProductsQuerySchema, 'query'), controller.getProductsByCategory);
router.get('/category/:categoryId', cacheResponse(60), validate(ListProductsQuerySchema, 'query'), controller.getProductsByCategory);
router.get('/slug/:slug', cacheResponse(120), validate(SlugParamSchema, 'params'), controller.getProductBySlug);
router.get('/:id', cacheResponse(120), validate(UuidParamSchema, 'params'), controller.getProductById);

// Admin protected routes
router.post('/', authenticate, authorize('products.create'), validate(CreateProductSchema), controller.createProduct);
router.patch('/:id', authenticate, authorize('products.update'), validate(UuidParamSchema, 'params'), validate(UpdateProductSchema), controller.updateProduct);
router.delete('/:id', authenticate, authorize('products.delete'), validate(UuidParamSchema, 'params'), controller.deleteProduct);

export default router;
