import { Request, Response, NextFunction } from 'express';
import * as homepageService from './homepage.service';
import { sendSuccess } from '../../utils/response';

export const getHomepageData = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await homepageService.getHomepageData();
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const listSections = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await homepageService.listSections();
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const getSectionById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await homepageService.getSectionById(req.params.id);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const createSection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await homepageService.createSection(req.body);
    sendSuccess(res, data, 'Homepage section created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateSection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await homepageService.updateSection(req.params.id, req.body);
    sendSuccess(res, data, 'Homepage section updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteSection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await homepageService.deleteSection(req.params.id);
    sendSuccess(res, null, 'Homepage section deleted successfully');
  } catch (error) {
    next(error);
  }
};
