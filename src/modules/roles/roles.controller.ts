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

export const createRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await rolesService.createRole(req.body);
    sendSuccess(res, data, 'Role created successfully', 201);
  } catch (error) { next(error); }
};

export const updateRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await rolesService.updateRole(req.params.id, req.body);
    sendMessage(res, 'Role updated successfully');
  } catch (error) { next(error); }
};

export const deleteRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await rolesService.deleteRole(req.params.id);
    sendMessage(res, 'Role deleted successfully');
  } catch (error) { next(error); }
};

export const updateRolePermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await rolesService.updateRolePermissions(req.params.id, req.body.permissions);
    sendMessage(res, 'Permissions updated successfully');
  } catch (error) { next(error); }
};

export const listPermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await rolesService.listPermissions();
    sendSuccess(res, data);
  } catch (error) { next(error); }
};
