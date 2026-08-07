import { Request, Response, NextFunction } from 'express';
import * as wishlistService from './wishlist.service';
import { sendSuccess } from '../../utils/response';

export const getWishlist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await wishlistService.getWishlist(req.user!.id);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const addToWishlist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await wishlistService.addToWishlist(req.user!.id, req.body);
    sendSuccess(res, data, 'Item added to wishlist successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const removeFromWishlist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await wishlistService.removeFromWishlist(req.user!.id, req.params.itemId);
    sendSuccess(res, data, 'Item removed from wishlist');
  } catch (error) {
    next(error);
  }
};

export const clearWishlist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await wishlistService.clearWishlist(req.user!.id);
    sendSuccess(res, data, 'Wishlist cleared successfully');
  } catch (error) {
    next(error);
  }
};
