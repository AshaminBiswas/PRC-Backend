import { Request, Response, NextFunction } from 'express';
import * as paymentsService from './payments.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';

export const createPaymentOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const data = await paymentsService.createPaymentOrder(req.user.id, req.body);
    sendSuccess(res, data, 'Payment order created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const verifyPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const data = await paymentsService.verifyPayment(req.user.id, req.body);
    sendSuccess(res, data, 'Payment verified successfully');
  } catch (error) {
    next(error);
  }
};

export const getPaymentByOrderId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const data = await paymentsService.getPaymentByOrderId(req.params.orderId, req.user);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const refundPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const data = await paymentsService.refundPayment(req.user, req.body);
    sendSuccess(res, data, 'Refund processed successfully');
  } catch (error) {
    next(error);
  }
};
