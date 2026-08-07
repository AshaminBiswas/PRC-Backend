import { Request, Response, NextFunction } from 'express';
import * as auditService from './audit.service';
import { sendPaginated } from '../../../utils/response';

export const getActivityLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await auditService.getActivityLogs(req.ventureId!, req.query);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getStockActivityLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await auditService.getStockActivityLogs(req.ventureId!, req.query);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getAdjustmentHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await auditService.getAdjustmentHistory(req.ventureId!, req.query);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getTransferHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await auditService.getTransferHistory(req.ventureId!, req.query);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};
