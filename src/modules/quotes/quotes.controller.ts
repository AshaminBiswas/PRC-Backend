import { Request, Response, NextFunction } from 'express';
import * as quotesService from './quotes.service';
import { sendSuccess, sendPaginated } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';

export const listQuotes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const result = await quotesService.listQuotes(req.query as any, req.user);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const createQuote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const data = await quotesService.createQuote(req.user.id, req.body);
    sendSuccess(res, data, 'Quote request submitted successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const getQuoteById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const data = await quotesService.getQuoteById(req.params.id, req.user);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const updateQuoteStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const data = await quotesService.updateQuoteStatus(req.params.id, req.body, req.user);
    sendSuccess(res, data, 'Quote status updated successfully');
  } catch (error) {
    next(error);
  }
};

export const convertQuote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const data = await quotesService.convertQuoteToOrder(req.params.id, req.user, req.body);
    sendSuccess(res, data, 'Approved quote converted to order successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateQuotePricing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const data = await quotesService.updateQuotePricing(req.params.id, req.body, req.user);
    sendSuccess(res, data, 'Quote pricing and details updated successfully');
  } catch (error) {
    next(error);
  }
};

export const updateCustomerQuote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const data = await quotesService.updateCustomerQuote(req.params.id, req.user.id, req.body);
    sendSuccess(res, data, 'Quotation updated successfully');
  } catch (error) {
    next(error);
  }
};

