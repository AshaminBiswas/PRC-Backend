import { Request, Response, NextFunction } from 'express';
import * as purchasesService from './purchases.service';
import { sendSuccess, sendPaginated } from '../../../utils/response';

export const listPurchaseOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await purchasesService.listPurchaseOrders(req.ventureId!, req.query);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getPurchaseOrderById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const po = await purchasesService.getPurchaseOrderById(req.params.id);
    sendSuccess(res, po);
  } catch (error) {
    next(error);
  }
};

export const createPurchaseOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const po = await purchasesService.createPurchaseOrder(req.ventureId!, req.body, req.user!.id);
    sendSuccess(res, po, 'Purchase order created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const receivePurchaseOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const grn = await purchasesService.receivePurchaseOrder(req.ventureId!, req.params.id, req.body, req.user!.id);
    sendSuccess(res, grn, 'Goods received and stock updated successfully');
  } catch (error) {
    next(error);
  }
};

export const createPurchasePayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await purchasesService.createPurchasePayment(req.ventureId!, req.body, req.user!.id);
    sendSuccess(res, payment, 'Payment recorded successfully', 201);
  } catch (error) {
    next(error);
  }
};
