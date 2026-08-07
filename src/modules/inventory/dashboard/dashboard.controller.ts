import { Request, Response, NextFunction } from 'express';
import * as dashboardService from './dashboard.service';
import { sendSuccess } from '../../../utils/response';

export const getInventoryDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = await dashboardService.getInventoryDashboardMetrics(req.ventureId!);
    sendSuccess(res, metrics);
  } catch (error) {
    next(error);
  }
};
