import { Request, Response, NextFunction } from 'express';
import * as cmsService from './cms.service';
import { sendSuccess, sendPaginated } from '../../utils/response';

// ─── PAGES ────────────────────────────────────────────────────────────────────

export const getPublicPages = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cmsService.getPublicPages();
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const getPageBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cmsService.getPageBySlug(req.params.slug, true);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const listPagesAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await cmsService.listPagesAdmin(req.query as any);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getPageByIdAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cmsService.getPageById(req.params.id);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const createPage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cmsService.createPage(req.body);
    sendSuccess(res, data, 'CMS Page created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updatePage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cmsService.updatePage(req.params.id, req.body);
    sendSuccess(res, data, 'CMS Page updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deletePage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await cmsService.deletePage(req.params.id);
    sendSuccess(res, null, 'CMS Page deleted successfully');
  } catch (error) {
    next(error);
  }
};

// ─── BLOG POSTS ───────────────────────────────────────────────────────────────

export const getPublicBlogPosts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await cmsService.getPublicBlogPosts(req.query as any);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getBlogPostBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cmsService.getBlogPostBySlug(req.params.slug, true);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const listBlogPostsAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await cmsService.listBlogPostsAdmin(req.query as any);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getBlogPostByIdAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cmsService.getBlogPostById(req.params.id);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const createBlogPost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorId = req.user?.id;
    const authorName = req.user ? `${req.user.email}` : undefined;
    const data = await cmsService.createBlogPost(req.body, authorId, authorName);
    sendSuccess(res, data, 'Blog post created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateBlogPost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cmsService.updateBlogPost(req.params.id, req.body);
    sendSuccess(res, data, 'Blog post updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteBlogPost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await cmsService.deleteBlogPost(req.params.id);
    sendSuccess(res, null, 'Blog post deleted successfully');
  } catch (error) {
    next(error);
  }
};

// ─── FAQS & FAQ CATEGORIES ────────────────────────────────────────────────────

export const getPublicFaqs = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cmsService.getPublicFaqsGrouped();
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const listFaqCategories = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cmsService.listFaqCategories();
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const createFaqCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cmsService.createFaqCategory(req.body);
    sendSuccess(res, data, 'FAQ category created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateFaqCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cmsService.updateFaqCategory(req.params.id, req.body);
    sendSuccess(res, data, 'FAQ category updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteFaqCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await cmsService.deleteFaqCategory(req.params.id);
    sendSuccess(res, null, 'FAQ category deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const listFaqsAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await cmsService.listFaqsAdmin(req.query as any);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const createFaq = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cmsService.createFaq(req.body);
    sendSuccess(res, data, 'FAQ created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateFaq = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cmsService.updateFaq(req.params.id, req.body);
    sendSuccess(res, data, 'FAQ updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteFaq = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await cmsService.deleteFaq(req.params.id);
    sendSuccess(res, null, 'FAQ deleted successfully');
  } catch (error) {
    next(error);
  }
};
