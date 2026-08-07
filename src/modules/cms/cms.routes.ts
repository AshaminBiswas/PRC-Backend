import { Router } from 'express';
import * as controller from './cms.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { cacheResponse } from '../../middleware/cache.middleware';
import {
  CreateCmsPageSchema,
  UpdateCmsPageSchema,
  ListCmsPagesQuerySchema,
  CreateBlogPostSchema,
  UpdateBlogPostSchema,
  ListBlogPostsQuerySchema,
  CreateFaqCategorySchema,
  UpdateFaqCategorySchema,
  CreateFaqSchema,
  UpdateFaqSchema,
  ListFaqsQuerySchema,
  UuidParamSchema,
  SlugParamSchema,
} from './cms.schema';

const router = Router();

// ─── PAGES ────────────────────────────────────────────────────────────────────
// Public Pages routes
router.get('/pages', cacheResponse(300), controller.getPublicPages);
router.get('/pages/slug/:slug', cacheResponse(300), validate(SlugParamSchema, 'params'), controller.getPageBySlug);

// Admin Pages routes
router.get('/pages/admin', authenticate, authorize('cms.read', 'cms.manage'), validate(ListCmsPagesQuerySchema, 'query'), controller.listPagesAdmin);
router.get('/pages/admin/:id', authenticate, authorize('cms.read', 'cms.manage'), validate(UuidParamSchema, 'params'), controller.getPageByIdAdmin);
router.post('/pages', authenticate, authorize('cms.create', 'cms.manage'), validate(CreateCmsPageSchema), controller.createPage);
router.patch('/pages/:id', authenticate, authorize('cms.update', 'cms.manage'), validate(UuidParamSchema, 'params'), validate(UpdateCmsPageSchema), controller.updatePage);
router.delete('/pages/:id', authenticate, authorize('cms.delete', 'cms.manage'), validate(UuidParamSchema, 'params'), controller.deletePage);

// ─── BLOG POSTS ───────────────────────────────────────────────────────────────
// Public Blog routes
router.get('/blog', cacheResponse(120), validate(ListBlogPostsQuerySchema, 'query'), controller.getPublicBlogPosts);
router.get('/blog/slug/:slug', cacheResponse(300), validate(SlugParamSchema, 'params'), controller.getBlogPostBySlug);

// Admin Blog routes
router.get('/blog/admin', authenticate, authorize('cms.read', 'cms.manage'), validate(ListBlogPostsQuerySchema, 'query'), controller.listBlogPostsAdmin);
router.get('/blog/admin/:id', authenticate, authorize('cms.read', 'cms.manage'), validate(UuidParamSchema, 'params'), controller.getBlogPostByIdAdmin);
router.post('/blog', authenticate, authorize('cms.create', 'cms.manage'), validate(CreateBlogPostSchema), controller.createBlogPost);
router.patch('/blog/:id', authenticate, authorize('cms.update', 'cms.manage'), validate(UuidParamSchema, 'params'), validate(UpdateBlogPostSchema), controller.updateBlogPost);
router.delete('/blog/:id', authenticate, authorize('cms.delete', 'cms.manage'), validate(UuidParamSchema, 'params'), controller.deleteBlogPost);

// ─── FAQ CATEGORIES ────────────────────────────────────────────────────────────
// Admin FAQ Categories routes
router.get('/faq-categories', authenticate, authorize('cms.read', 'cms.manage'), controller.listFaqCategories);
router.post('/faq-categories', authenticate, authorize('cms.create', 'cms.manage'), validate(CreateFaqCategorySchema), controller.createFaqCategory);
router.patch('/faq-categories/:id', authenticate, authorize('cms.update', 'cms.manage'), validate(UuidParamSchema, 'params'), validate(UpdateFaqCategorySchema), controller.updateFaqCategory);
router.delete('/faq-categories/:id', authenticate, authorize('cms.delete', 'cms.manage'), validate(UuidParamSchema, 'params'), controller.deleteFaqCategory);

// ─── FAQS ──────────────────────────────────────────────────────────────────────
// Public FAQs route (grouped by category)
router.get('/faqs', cacheResponse(300), controller.getPublicFaqs);

// Admin FAQs routes
router.get('/faqs/admin', authenticate, authorize('cms.read', 'cms.manage'), validate(ListFaqsQuerySchema, 'query'), controller.listFaqsAdmin);
router.post('/faqs', authenticate, authorize('cms.create', 'cms.manage'), validate(CreateFaqSchema), controller.createFaq);
router.patch('/faqs/:id', authenticate, authorize('cms.update', 'cms.manage'), validate(UuidParamSchema, 'params'), validate(UpdateFaqSchema), controller.updateFaq);
router.delete('/faqs/:id', authenticate, authorize('cms.delete', 'cms.manage'), validate(UuidParamSchema, 'params'), controller.deleteFaq);

export default router;
