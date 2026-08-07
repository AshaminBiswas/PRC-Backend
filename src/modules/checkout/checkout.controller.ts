import { Request, Response, NextFunction } from 'express';
import * as checkoutService from './checkout.service';
import { sendSuccess } from '../../utils/response';

export const validateCheckout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await checkoutService.validateCheckout(req.user!.id);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const getShippingRates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await checkoutService.getShippingRates(req.user!.id, req.body);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const placeOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await checkoutService.placeOrder(req.user!.id, req.body);
    sendSuccess(res, data, 'Order placed successfully', 201);
  } catch (error) {
    next(error);
  }
};
