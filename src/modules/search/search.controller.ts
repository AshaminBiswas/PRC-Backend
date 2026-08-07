import { Request, Response, NextFunction } from 'express';
import * as searchService from './search.service';
import { sendSuccess, sendPaginated } from '../../utils/response';

export const searchProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await searchService.searchProducts(req.query as any);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getSuggestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await searchService.getSearchSuggestions(req.query as any);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};
