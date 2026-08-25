import { Router } from 'express';
import * as controller from './roles.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { adminLimiter } from '../../middleware/rateLimit.middleware';
import {
  CreateRoleSchema,
  UpdateRoleSchema,
  UpdateRolePermissionsSchema,
  CreatePermissionSchema,
  UpdatePermissionSchema,
  UuidParamSchema,
} from './roles.schema';

const router = Router();

router.use(authenticate);
router.use(adminLimiter);

// ─── Permissions Endpoints ──────────────────────────────────────────────────
router.get('/permissions', authorize('roles.read'), controller.listPermissions);
router.post('/permissions', authorize('roles.create'), validate(CreatePermissionSchema), controller.createPermission);
router.patch('/permissions/:id', authorize('roles.update'), validate(UuidParamSchema, 'params'), validate(UpdatePermissionSchema), controller.updatePermission);
router.delete('/permissions/:id', authorize('roles.delete'), validate(UuidParamSchema, 'params'), controller.deletePermission);

// ─── Role CRUD ──────────────────────────────────────────────────────────────
router.get('/', authorize('roles.read'), controller.listRoles);
router.post('/', authorize('roles.create'), validate(CreateRoleSchema), controller.createRole);
router.get('/:id', authorize('roles.read'), validate(UuidParamSchema, 'params'), controller.getRoleById);
router.patch('/:id', authorize('roles.update'), validate(UuidParamSchema, 'params'), validate(UpdateRoleSchema), controller.updateRole);
router.delete('/:id', authorize('roles.delete'), validate(UuidParamSchema, 'params'), controller.deleteRole);
router.patch('/:id/permissions', authorize('roles.update'), validate(UuidParamSchema, 'params'), validate(UpdateRolePermissionsSchema), controller.updateRolePermissions);

export default router;

