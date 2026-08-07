import { Request, Response, NextFunction } from 'express';
import * as productsService from './products.service';
import { sendSuccess, sendPaginated, sendMessage } from '../../../utils/response';

export const listInventoryProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await productsService.listInventoryProducts(req.ventureId!, req.query);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getInventoryProductById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await productsService.getInventoryProductById(req.params.id);
    sendSuccess(res, item);
  } catch (error) {
    next(error);
  }
};

export const createInventoryProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await productsService.createInventoryProduct(req.ventureId!, req.body, req.user!.id);
    sendSuccess(res, item, 'Inventory product created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateInventoryProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await productsService.updateInventoryProduct(req.params.id, req.body);
    sendSuccess(res, item, 'Inventory product updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteInventoryProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await productsService.deleteInventoryProduct(req.params.id);
    sendMessage(res, 'Inventory product deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const getProductHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await productsService.getProductHistory(req.params.id, req.query);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const bulkUpdate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await productsService.bulkUpdateInventoryProducts(req.body);
    sendSuccess(res, result, 'Bulk update executed successfully');
  } catch (error) {
    next(error);
  }
};

export const archiveProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await productsService.archiveProduct(req.params.id);
    sendSuccess(res, item, 'Product archived successfully');
  } catch (error) {
    next(error);
  }
};

export const restoreProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await productsService.restoreProduct(req.params.id);
    sendSuccess(res, item, 'Product restored successfully');
  } catch (error) {
    next(error);
  }
};
