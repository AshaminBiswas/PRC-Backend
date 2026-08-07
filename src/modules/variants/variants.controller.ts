import { Request, Response, NextFunction } from 'express';
import * as variantsService from './variants.service';
import { sendSuccess, sendMessage } from '../../utils/response';

export const listVariants = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await variantsService.listVariants(req.params.productId);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const getVariantById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await variantsService.getVariantById(req.params.productId, req.params.id);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const createVariant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await variantsService.createVariant(req.params.productId, req.body);
    sendSuccess(res, data, 'Product variant created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateVariant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await variantsService.updateVariant(req.params.productId, req.params.id, req.body);
    sendSuccess(res, data, 'Product variant updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteVariant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await variantsService.deleteVariant(req.params.productId, req.params.id);
    sendMessage(res, 'Product variant deleted successfully');
  } catch (error) {
    next(error);
  }
};
