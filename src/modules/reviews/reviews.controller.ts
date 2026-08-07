import { Request, Response, NextFunction } from 'express';
import * as reviewsService from './reviews.service';
import { sendSuccess, sendPaginated } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';

export const createReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const data = await reviewsService.createReview(req.user.id, req.body, req.user.roleSlug);
    sendSuccess(res, data, 'Review submitted successfully and is pending approval', 201);
  } catch (error) {
    next(error);
  }
};

export const updateReviewStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reviewsService.updateReviewStatus(req.params.id, req.body);
    sendSuccess(res, data, 'Review status updated successfully');
  } catch (error) {
    next(error);
  }
};

export const getProductReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await reviewsService.getProductReviews(req.params.productId, req.query as any);
    res.status(200).json({
      success: true,
      data: result.data,
      summary: result.summary,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

export const listAllReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await reviewsService.listAllReviews(req.query as any);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};
