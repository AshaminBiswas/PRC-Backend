import { Router } from 'express';
import * as controller from './projects.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { cacheResponse } from '../../middleware/cache.middleware';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  ListProjectsQuerySchema,
  ProjectIdParamSchema,
} from './projects.schema';

const router = Router();

// ─── Public Routes ─────────────────────────────────────────────────────────────

// GET /api/v1/projects (with query filtering)
router.get('/', cacheResponse(60), validate(ListProjectsQuerySchema, 'query'), controller.getPublicProjects);

// GET /api/v1/projects/map/locations (Aggregated city & pin locations for India map)
router.get('/map/locations', cacheResponse(120), controller.getMapLocations);

// GET /api/v1/projects/categories (Distinct categories and counts)
router.get('/categories', cacheResponse(120), controller.getCategories);

// ─── Admin Routes ──────────────────────────────────────────────────────────────

// GET /api/v1/projects/admin/all
router.get(
  '/admin/all',
  authenticate,
  authorize('cms.read', 'cms.manage', 'projects.manage'),
  validate(ListProjectsQuerySchema, 'query'),
  controller.listAdminProjects
);

// POST /api/v1/projects/seed (Initial seed trigger)
router.post(
  '/seed',
  authenticate,
  authorize('cms.manage', 'projects.manage'),
  controller.seedProjects
);

// GET /api/v1/projects/:id
router.get('/:id', validate(ProjectIdParamSchema, 'params'), controller.getProjectById);

// POST /api/v1/projects
router.post(
  '/',
  authenticate,
  authorize('cms.create', 'cms.manage', 'projects.manage'),
  validate(CreateProjectSchema),
  controller.createProject
);

// PUT /api/v1/projects/:id
router.put(
  '/:id',
  authenticate,
  authorize('cms.update', 'cms.manage', 'projects.manage'),
  validate(ProjectIdParamSchema, 'params'),
  validate(UpdateProjectSchema),
  controller.updateProject
);

// PATCH /api/v1/projects/:id/featured
router.patch(
  '/:id/featured',
  authenticate,
  authorize('cms.update', 'cms.manage', 'projects.manage'),
  validate(ProjectIdParamSchema, 'params'),
  controller.toggleFeatured
);

// PATCH /api/v1/projects/:id/status
router.patch(
  '/:id/status',
  authenticate,
  authorize('cms.update', 'cms.manage', 'projects.manage'),
  validate(ProjectIdParamSchema, 'params'),
  controller.toggleStatus
);

// DELETE /api/v1/projects/:id
router.delete(
  '/:id',
  authenticate,
  authorize('cms.delete', 'cms.manage', 'projects.manage'),
  validate(ProjectIdParamSchema, 'params'),
  controller.deleteProject
);

export default router;
