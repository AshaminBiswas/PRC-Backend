import { Request, Response, NextFunction } from 'express';
import * as productsService from './products.service';
import { sendSuccess, sendPaginated, sendMessage } from '../../utils/response';
import { clearResponseCache } from '../../middleware/cache.middleware';

export const listProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await productsService.listProducts(req.query as any);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) { next(error); }
};

export const getProductBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await productsService.getProductBySlug(req.params.slug);
    sendSuccess(res, data);
  } catch (error) { next(error); }
};

export const getProductById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await productsService.getProductById(req.params.id);
    sendSuccess(res, data);
  } catch (error) { next(error); }
};

export const getFrequentlyPairedProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const identifier = req.params.id || req.params.idOrSlug || req.params.slug;
    const data = await productsService.getFrequentlyPairedProducts(identifier);
    sendSuccess(res, data, 'Frequently paired products retrieved successfully');
  } catch (error) { next(error); }
};

export const getProductsByCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const identifier = req.params.categoryId || req.params.slug || req.params.categoryIdentifier;
    const result = await productsService.getProductsByCategory(identifier, req.query as any);
    sendSuccess(res, result);
  } catch (error) { next(error); }
};

import { logAdminAction } from '../../utils/auditLogger';

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await productsService.createProduct(req.body);
    clearResponseCache('cache:*products*');
    clearResponseCache('cache:*categories*');
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'PRODUCT_CREATED',
      entity: 'PRODUCT',
      entityId: data.id,
      entityName: data.name,
      details: `Created new catalog product '${data.name}' (SKU: ${data.sku || 'N/A'}). Price: ₹${data.price || 0}.`,
      severity: 'SUCCESS',
      metadata: { productId: data.id, name: data.name, sku: data.sku, price: data.price },
      req,
    });
    sendSuccess(res, data, 'Product created successfully', 201);
  } catch (error) { next(error); }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await productsService.updateProduct(req.params.id, req.body);
    clearResponseCache('cache:*products*');
    clearResponseCache('cache:*categories*');
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'PRODUCT_UPDATED',
      entity: 'PRODUCT',
      entityId: data.id,
      entityName: data.name,
      details: `Updated catalog product '${data.name}' (SKU: ${data.sku || 'N/A'}).`,
      severity: 'INFO',
      metadata: { productId: data.id, name: data.name, sku: data.sku },
      req,
    });
    sendSuccess(res, data, 'Product updated successfully');
  } catch (error) { next(error); }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetProduct = await productsService.getProductById(req.params.id).catch(() => null);
    await productsService.deleteProduct(req.params.id);
    clearResponseCache('cache:*products*');
    clearResponseCache('cache:*categories*');
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'PRODUCT_DELETED',
      entity: 'PRODUCT',
      entityId: req.params.id,
      entityName: targetProduct?.name || req.params.id,
      details: `Deleted product '${targetProduct?.name || req.params.id}'.`,
      severity: 'CRITICAL',
      metadata: { productId: req.params.id, name: targetProduct?.name },
      req,
    });
    sendMessage(res, 'Product deleted successfully');
  } catch (error) { next(error); }
};
