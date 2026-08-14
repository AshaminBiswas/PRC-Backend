import { Request, Response, NextFunction } from 'express';
import * as service from './b2b-pricing.service';
import { sendSuccess, sendMessage } from '../../utils/response';

export const getCustomerPricingMatrix = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await service.getCustomerPricingMatrix(req.params.userId);
    sendSuccess(res, data, 'Customer pricing matrix retrieved');
  } catch (error) {
    next(error);
  }
};

export const setCustomerProductPrice = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await service.setCustomerProductPrice(req.params.userId, req.body);
    sendSuccess(res, data, 'Customer product price set successfully');
  } catch (error) {
    next(error);
  }
};

export const bulkSetCustomerPrices = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await service.bulkSetCustomerPrices(req.params.userId, req.body);
    sendSuccess(res, data, `${data.updatedCount} product prices updated successfully`);
  } catch (error) {
    next(error);
  }
};

export const applyFlatDiscount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await service.applyFlatDiscount(req.params.userId, req.body);
    sendSuccess(res, data, `Flat ${data.discountPercent}% discount applied to ${data.appliedCount} products`);
  } catch (error) {
    next(error);
  }
};

export const deleteCustomerProductPrice = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await service.deleteCustomerProductPrice(req.params.userId, req.params.productId);
    sendSuccess(res, data, data.message);
  } catch (error) {
    next(error);
  }
};

export const getMyPricing = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await service.getMyPricing(req.user!.id);
    sendSuccess(res, data, 'Your custom B2B product pricing');
  } catch (error) {
    next(error);
  }
};
