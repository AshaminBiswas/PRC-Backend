import { Router } from 'express';
import * as controller from './users.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { adminLimiter } from '../../middleware/rateLimit.middleware';
import {
  ListUsersQuerySchema,
  CreateUserSchema,
  UpdateUserSchema,
  UpdateProfileSchema,
  UpdateAvatarSchema,
  UpdateUserRolesSchema,
  ActivityQuerySchema,
  UuidParamSchema,
} from './users.schema';

const router = Router();

// All user routes require authentication
router.use(authenticate);
router.use(adminLimiter);

// ─── Own profile routes (must come before /:id to avoid conflicts) ────────────
router.get('/activity', validate(ActivityQuerySchema, 'query'), controller.getUserActivity);
router.get('/orders', controller.getUserOrders);
router.get('/quotes', controller.getUserQuotes);
router.get('/reviews', controller.getUserReviews);
router.patch('/profile', validate(UpdateProfileSchema), controller.updateProfile);
router.patch('/avatar', validate(UpdateAvatarSchema), controller.updateAvatar);

// ─── Admin user management routes ─────────────────────────────────────────────
router.get('/', authorize('users.read'), validate(ListUsersQuerySchema, 'query'), controller.listUsers);
router.post('/', authorize('users.create'), validate(CreateUserSchema), controller.createUser);
router.get('/:id', authorize('users.read'), validate(UuidParamSchema, 'params'), controller.getUserById);
router.patch('/:id', authorize('users.update'), validate(UuidParamSchema, 'params'), validate(UpdateUserSchema), controller.updateUser);
router.delete('/:id', authorize('users.delete'), validate(UuidParamSchema, 'params'), controller.deleteUser);
router.get('/:id/roles', authorize('users.read'), validate(UuidParamSchema, 'params'), controller.getUserRoles);
router.patch('/:id/roles', authorize('users.update'), validate(UuidParamSchema, 'params'), validate(UpdateUserRolesSchema), controller.updateUserRoles);

export default router;
