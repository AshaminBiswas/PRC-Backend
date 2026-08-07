import { Request, Response, NextFunction } from 'express';
import * as settingsService from './settings.service';
import { sendSuccess } from '../../utils/response';

export const getPublicSettings = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await settingsService.getPublicSettings();
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const getAllSettings = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await settingsService.getAllSettings();
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await settingsService.updateSettings(req.body);
    sendSuccess(res, data, 'Settings updated successfully');
  } catch (error) {
    next(error);
  }
};
