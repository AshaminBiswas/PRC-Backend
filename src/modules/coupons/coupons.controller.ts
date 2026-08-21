import { Request, Response, NextFunction } from 'express';
import * as couponsService from './coupons.service';
import { sendSuccess, sendPaginated, sendMessage } from '../../utils/response';

export const listCoupons = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await couponsService.listCoupons(req.query as any);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getCouponStats = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await couponsService.getCouponStats();
    sendSuccess(res, stats);
  } catch (error) {
    next(error);
  }
};

export const getCouponUsages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await couponsService.getCouponUsages(req.params.id);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const getCouponByCodeOrId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await couponsService.getCouponByCodeOrId(req.params.code);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const createCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await couponsService.createCoupon(req.body);
    sendSuccess(res, data, 'Coupon offer created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await couponsService.updateCoupon(req.params.id, req.body);
    sendSuccess(res, data, 'Coupon offer updated successfully');
  } catch (error) {
    next(error);
  }
};

export const toggleCouponStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await couponsService.toggleCouponStatus(req.params.id);
    sendSuccess(res, data, `Coupon offer is now ${data.isActive ? 'Active' : 'Inactive'}`);
  } catch (error) {
    next(error);
  }
};

export const deleteCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await couponsService.deleteCoupon(req.params.id);
    sendMessage(res, 'Coupon offer deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const validateCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const data = await couponsService.validateCoupon(userId, req.body);
    sendSuccess(res, data, 'Coupon promotion applied successfully');
  } catch (error) {
    next(error);
  }
};

export const getPublicCoupons = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await couponsService.getPublicCoupons();
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};
