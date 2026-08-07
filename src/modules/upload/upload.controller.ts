import { Request, Response, NextFunction } from 'express';
import * as uploadService from './upload.service';
import { sendSuccess, sendError } from '../../utils/response';

export const uploadAvatar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      sendError(res, { code: 'NO_FILE', message: 'No file provided' }, 400);
      return;
    }
    const url = await uploadService.uploadFile(req.file, 'avatars', req.user!.id);
    sendSuccess(res, { url }, 'Avatar uploaded successfully');
  } catch (error) { next(error); }
};

export const uploadProductImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      sendError(res, { code: 'NO_FILE', message: 'No file provided' }, 400);
      return;
    }
    const url = await uploadService.uploadFile(req.file, 'products');
    sendSuccess(res, { url }, 'Image uploaded successfully');
  } catch (error) { next(error); }
};

export const uploadCategoryImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      sendError(res, { code: 'NO_FILE', message: 'No file provided' }, 400);
      return;
    }
    const url = await uploadService.uploadFile(req.file, 'categories');
    sendSuccess(res, { url }, 'Image uploaded successfully');
  } catch (error) { next(error); }
};

export const uploadMultipleProductImages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      sendError(res, { code: 'NO_FILES', message: 'No files provided' }, 400);
      return;
    }
    const urls = await Promise.all(
      files.map((file) => uploadService.uploadFile(file, 'products'))
    );
    sendSuccess(res, { urls }, 'Images uploaded successfully');
  } catch (error) { next(error); }
};
