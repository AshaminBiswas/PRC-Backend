import { Request, Response, NextFunction } from 'express';
import * as service from './dashboard.service';
import { sendSuccess } from '../../utils/response';

export const getOverview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getOverview(req.query as any);
    sendSuccess(res, data);
  } catch (e) {
    next(e);
  }
};

export const getSalesChart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getSalesChart(req.query as any);
    sendSuccess(res, data);
  } catch (e) {
    next(e);
  }
};

export const getRecentOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 100);
    const data = await service.getRecentOrders(limit);
    sendSuccess(res, data);
  } catch (e) {
    next(e);
  }
};

export const getInventory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const threshold = Number(req.query.lowStockThreshold) || 10;
    const data = await service.getInventory(threshold);
    sendSuccess(res, data);
  } catch (e) {
    next(e);
  }
};

export const getInventoryHealth = getInventory;

export const getRevenueTrend = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = (req.query.period as string) || '30d';
    const groupBy = (req.query.groupBy as string) || 'day';
    const data = await service.getRevenueTrend(period, groupBy);
    sendSuccess(res, data);
  } catch (e) {
    next(e);
  }
};

export const getOrderStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = (req.query.period as string) || '30d';
    const data = await service.getOrderStats(period);
    sendSuccess(res, data);
  } catch (e) {
    next(e);
  }
};

export const getProductStats = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getProductStats();
    sendSuccess(res, data);
  } catch (e) {
    next(e);
  }
};

export const getCustomerStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = (req.query.period as string) || '30d';
    const data = await service.getCustomerStats(period);
    sendSuccess(res, data);
  } catch (e) {
    next(e);
  }
};

export const getAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = (req.query.period as string) || '30d';
    const data = await service.getAnalytics(period);
    sendSuccess(res, data);
  } catch (e) {
    next(e);
  }
};
