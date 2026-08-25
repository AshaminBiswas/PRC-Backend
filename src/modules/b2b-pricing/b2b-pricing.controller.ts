import { Request, Response, NextFunction } from 'express';
import * as service from './b2b-pricing.service';
import { sendSuccess, sendMessage } from '../../utils/response';
import { logAdminAction } from '../../utils/auditLogger';

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
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'B2B_RATE_CONFIGURED',
      entity: 'CUSTOMER',
      entityId: req.params.userId,
      details: `Configured custom B2B rate for customer #${req.params.userId} on product #${req.body.productId}. Custom Price: ₹${req.body.customPrice}.`,
      severity: 'INFO',
      metadata: { customerId: req.params.userId, productId: req.body.productId, customPrice: req.body.customPrice },
      req,
    });
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
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'B2B_BULK_RATES_CONFIGURED',
      entity: 'CUSTOMER',
      entityId: req.params.userId,
      details: `Updated ${data.updatedCount} custom B2B product matrix rates for customer #${req.params.userId}.`,
      severity: 'INFO',
      metadata: { customerId: req.params.userId, updatedCount: data.updatedCount },
      req,
    });
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
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'B2B_FLAT_DISCOUNT_APPLIED',
      entity: 'CUSTOMER',
      entityId: req.params.userId,
      details: `Applied flat ${data.discountPercent}% discount across ${data.appliedCount} catalog products for customer #${req.params.userId}.`,
      severity: 'WARNING',
      metadata: { customerId: req.params.userId, discountPercent: data.discountPercent, count: data.appliedCount },
      req,
    });
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
