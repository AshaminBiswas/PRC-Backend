import { Request, Response, NextFunction } from 'express';
import * as cartService from './cart.service';
import { sendSuccess } from '../../utils/response';

export const getCart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cartService.getCart(req.user!.id);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const addCartItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cartService.addCartItem(req.user!.id, req.body);
    sendSuccess(res, data, 'Item added to cart successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateCartItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cartService.updateCartItem(req.user!.id, req.params.itemId, req.body.quantity);
    sendSuccess(res, data, 'Cart item quantity updated');
  } catch (error) {
    next(error);
  }
};

export const removeCartItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cartService.removeCartItem(req.user!.id, req.params.itemId);
    sendSuccess(res, data, 'Item removed from cart');
  } catch (error) {
    next(error);
  }
};

export const clearCart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cartService.clearCart(req.user!.id);
    sendSuccess(res, data, 'Cart cleared successfully');
  } catch (error) {
    next(error);
  }
};

export const applyCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cartService.applyCoupon(req.user!.id, req.body.code);
    sendSuccess(res, data, 'Coupon applied successfully');
  } catch (error) {
    next(error);
  }
};

export const removeCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cartService.removeCoupon(req.user!.id);
    sendSuccess(res, data, 'Coupon removed from cart');
  } catch (error) {
    next(error);
  }
};
