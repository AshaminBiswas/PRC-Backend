import { Request, Response, NextFunction } from 'express';
import * as stockService from './stock.service';
import { sendSuccess, sendPaginated } from '../../../utils/response';

export const syncLegacyProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await stockService.syncLegacyProducts(req.ventureId!);
    sendSuccess(res, result, 'Legacy products synchronized successfully');
  } catch (error) {
    next(error);
  }
};

export const listStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await stockService.listStock(req.ventureId!, req.query);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getStockByProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await stockService.getStockByProduct(req.ventureId!, req.params.productId);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const increaseStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await stockService.increaseStock(req.ventureId!, req.body, req.user!.id);
    sendSuccess(res, result, 'Stock increased successfully');
  } catch (error) {
    next(error);
  }
};

export const decreaseStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await stockService.decreaseStock(req.ventureId!, req.body, req.user!.id);
    sendSuccess(res, result, 'Stock decreased successfully');
  } catch (error) {
    next(error);
  }
};

export const adjustStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await stockService.adjustStock(req.ventureId!, req.body, req.user!.id);
    sendSuccess(res, result, 'Stock adjusted successfully');
  } catch (error) {
    next(error);
  }
};

export const reconcileStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await stockService.reconcileStock(req.ventureId!, req.body, req.user!.id);
    sendSuccess(res, result, 'Stock reconciled successfully');
  } catch (error) {
    next(error);
  }
};

export const getStockHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await stockService.getStockHistory(req.ventureId!, req.query);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};
