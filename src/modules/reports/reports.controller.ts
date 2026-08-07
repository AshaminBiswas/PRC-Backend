import { Request, Response, NextFunction } from 'express';
import * as service from './reports.service';
import { sendSuccess } from '../../utils/response';

export const getSalesReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getSalesReport(req.query as any);
    sendSuccess(res, data);
  } catch (e) {
    next(e);
  }
};

export const getInventoryReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getInventoryReport(req.query as any);
    sendSuccess(res, data);
  } catch (e) {
    next(e);
  }
};

export const getCustomerReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getCustomerReport(req.query as any);
    sendSuccess(res, data);
  } catch (e) {
    next(e);
  }
};

export const getProductReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getProductReport(req.query as any);
    sendSuccess(res, data);
  } catch (e) {
    next(e);
  }
};
