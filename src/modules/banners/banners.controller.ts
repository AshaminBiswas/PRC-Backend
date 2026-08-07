import { Request, Response, NextFunction } from 'express';
import * as bannersService from './banners.service';
import { sendSuccess } from '../../utils/response';

export const getPublicBanners = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const position = req.query.position as string | undefined;
    const data = await bannersService.getPublicBanners(position);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const listAdminBanners = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await bannersService.listAdminBanners(req.query as any);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const getBannerById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await bannersService.getBannerById(req.params.id);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const createBanner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await bannersService.createBanner(req.body);
    sendSuccess(res, data, 'Banner created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateBanner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await bannersService.updateBanner(req.params.id, req.body);
    sendSuccess(res, data, 'Banner updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteBanner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await bannersService.deleteBanner(req.params.id);
    sendSuccess(res, null, 'Banner deleted successfully');
  } catch (error) {
    next(error);
  }
};
