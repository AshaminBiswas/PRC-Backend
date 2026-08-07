import { Request, Response, NextFunction } from 'express';
import * as analyticsService from './analytics.service';
import { sendSuccess } from '../../../utils/response';

export const getDailyAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await analyticsService.getDailyAnalytics(req.ventureId!);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const getFastMovingProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await analyticsService.getFastMovingProducts(req.ventureId!, Number(req.query.limit || 10));
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const getSlowMovingProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await analyticsService.getSlowMovingProducts(req.ventureId!, Number(req.query.limit || 10));
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const getTurnoverAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await analyticsService.getTurnoverAnalytics(req.ventureId!);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};
