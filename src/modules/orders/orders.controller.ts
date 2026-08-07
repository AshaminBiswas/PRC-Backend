import { Request, Response, NextFunction } from 'express';
import * as ordersService from './orders.service';
import { sendSuccess, sendPaginated } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';

export const listOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const result = await ordersService.listOrders(req.query as any, req.user);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const data = await ordersService.getOrderById(req.params.id, req.user);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const getInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const data = await ordersService.generateInvoice(req.params.id, req.user);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const cancelOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const { reason } = req.body;
    const data = await ordersService.cancelOrder(req.params.id, req.user, reason);
    sendSuccess(res, data, 'Order cancelled successfully');
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const { status, comment, trackingNumber, carrier } = req.body;
    const data = await ordersService.updateOrderStatus(
      req.params.id,
      status,
      req.user,
      comment,
      trackingNumber,
      carrier
    );
    sendSuccess(res, data, 'Order status updated successfully');
  } catch (error) {
    next(error);
  }
};

export const getTrackingDetails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const data = await ordersService.getTrackingDetails(req.params.id, req.user);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const getOrderAllocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const data = await ordersService.getOrderAllocation(req.params.id, req.user);
    sendSuccess(res, data, 'Order allocation details retrieved');
  } catch (error) {
    next(error);
  }
};
