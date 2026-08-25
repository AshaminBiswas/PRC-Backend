import { Request, Response, NextFunction } from 'express';
import * as rolesService from './roles.service';
import { sendSuccess, sendMessage } from '../../utils/response';

export const listRoles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await rolesService.listRoles();
    sendSuccess(res, data);
  } catch (error) { next(error); }
};

export const getRoleById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await rolesService.getRoleById(req.params.id);
    sendSuccess(res, data);
  } catch (error) { next(error); }
};

import { logAdminAction } from '../../utils/auditLogger';

export const createRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await rolesService.createRole(req.body);
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'ROLE_CREATED',
      entity: 'ROLE',
      entityId: data.id,
      entityName: data.name,
      details: `Created new security role '${data.name}' (${data.slug}).`,
      severity: 'CRITICAL',
      metadata: { roleId: data.id, name: data.name, slug: data.slug },
      req,
    });
    sendSuccess(res, data, 'Role created successfully', 201);
  } catch (error) { next(error); }
};

export const updateRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await rolesService.updateRole(req.params.id, req.body);
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'ROLE_UPDATED',
      entity: 'ROLE',
      entityId: req.params.id,
      details: `Updated role #${req.params.id} name / description.`,
      severity: 'WARNING',
      metadata: req.body,
      req,
    });
    sendMessage(res, 'Role updated successfully');
  } catch (error) { next(error); }
};

export const deleteRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await rolesService.deleteRole(req.params.id);
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'ROLE_DELETED',
      entity: 'ROLE',
      entityId: req.params.id,
      details: `Deleted security role #${req.params.id}.`,
      severity: 'CRITICAL',
      metadata: { roleId: req.params.id },
      req,
    });
    sendMessage(res, 'Role deleted successfully');
  } catch (error) { next(error); }
};

export const updateRolePermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await rolesService.updateRolePermissions(req.params.id, req.body.permissions);
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'PERMISSIONS_UPDATED',
      entity: 'PERMISSION',
      entityId: req.params.id,
      details: `Updated permission set for role #${req.params.id}. Assigned ${req.body.permissions?.length || 0} permissions.`,
      severity: 'CRITICAL',
      metadata: { roleId: req.params.id, permissions: req.body.permissions },
      req,
    });
    sendMessage(res, 'Permissions updated successfully');
  } catch (error) { next(error); }
};

export const listPermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await rolesService.listPermissions();
    sendSuccess(res, data);
  } catch (error) { next(error); }
};

export const createPermission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await rolesService.createPermission(req.body);
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'PERMISSION_CREATED',
      entity: 'PERMISSION',
      entityId: data.id,
      entityName: data.name,
      details: `Created new system permission '${data.name}' (${data.slug}) under module '${data.module}'.`,
      severity: 'CRITICAL',
      metadata: data,
      req,
    });
    sendSuccess(res, data, 'Permission created successfully', 201);
  } catch (error) { next(error); }
};

export const updatePermission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await rolesService.updatePermission(req.params.id, req.body);
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'PERMISSION_UPDATED',
      entity: 'PERMISSION',
      entityId: req.params.id,
      entityName: data.name,
      details: `Updated permission #${req.params.id} '${data.name}' (${data.slug}).`,
      severity: 'WARNING',
      metadata: req.body,
      req,
    });
    sendSuccess(res, data, 'Permission updated successfully');
  } catch (error) { next(error); }
};

export const deletePermission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await rolesService.deletePermission(req.params.id);
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'PERMISSION_DELETED',
      entity: 'PERMISSION',
      entityId: req.params.id,
      details: `Permanently deleted permission #${req.params.id}.`,
      severity: 'CRITICAL',
      metadata: { permissionId: req.params.id },
      req,
    });
    sendMessage(res, result.message || 'Permission deleted successfully');
  } catch (error) { next(error); }
};

