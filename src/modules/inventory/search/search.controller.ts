import { Request, Response, NextFunction } from 'express';
import * as searchService from './search.service';
import { sendSuccess } from '../../../utils/response';

export const searchProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q || req.query.query || '') as string;
    const results = await searchService.searchProducts(req.ventureId!, q);
    sendSuccess(res, results);
  } catch (error) {
    next(error);
  }
};

export const searchSKU = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q || req.query.sku || '') as string;
    const results = await searchService.searchBySKU(req.ventureId!, q);
    sendSuccess(res, results);
  } catch (error) {
    next(error);
  }
};

export const searchBarcode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = (req.query.q || req.query.barcode || '') as string;
    const result = await searchService.searchByBarcode(req.ventureId!, code);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const searchQR = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = (req.query.q || req.query.qr || '') as string;
    const result = await searchService.searchByQR(req.ventureId!, code);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const searchSuppliers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q || req.query.query || '') as string;
    const results = await searchService.searchSuppliers(req.ventureId!, q);
    sendSuccess(res, results);
  } catch (error) {
    next(error);
  }
};
