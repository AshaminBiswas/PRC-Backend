import { Request, Response, NextFunction } from 'express';
import * as categoriesService from './categories.service';
import { sendSuccess, sendPaginated, sendMessage } from '../../utils/response';

export const listCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await categoriesService.listCategories(req.query as any);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) { next(error); }
};

export const getCategoryTree = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await categoriesService.getCategoryTree();
    sendSuccess(res, data);
  } catch (error) { next(error); }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await categoriesService.createCategory(req.body);
    sendSuccess(res, data, 'Category created successfully', 201);
  } catch (error) { next(error); }
};

export const getCategoryBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await categoriesService.getCategoryBySlug(req.params.slug);
    sendSuccess(res, data);
  } catch (error) { next(error); }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await categoriesService.updateCategory(req.params.id, req.body);
    sendMessage(res, 'Category updated successfully');
  } catch (error) { next(error); }
};

export const updateCategoryStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await categoriesService.updateCategoryStatus(req.params.id, req.body.status);
    sendMessage(res, 'Category status updated');
  } catch (error) { next(error); }
};

export const reorderCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await categoriesService.reorderCategories(req.body.categories);
    sendMessage(res, 'Categories reordered successfully');
  } catch (error) { next(error); }
};

export const getCategoryProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await categoriesService.getCategoryProducts(req.params.id, req.query as any);
    res.json({ success: true, ...result });
  } catch (error) { next(error); }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await categoriesService.deleteCategory(req.params.id);
    sendMessage(res, 'Category deleted successfully');
  } catch (error) { next(error); }
};
