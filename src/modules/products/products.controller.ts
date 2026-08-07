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

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await productsService.createProduct(req.body);
    clearResponseCache('products');
    sendSuccess(res, data, 'Product created successfully', 201);
  } catch (error) { next(error); }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await productsService.updateProduct(req.params.id, req.body);
    clearResponseCache('products');
    sendSuccess(res, data, 'Product updated successfully');
  } catch (error) { next(error); }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await productsService.deleteProduct(req.params.id);
    clearResponseCache('products');
    sendMessage(res, 'Product deleted successfully');
  } catch (error) { next(error); }
};
