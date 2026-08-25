import { Request, Response, NextFunction } from 'express';
import * as usersService from './users.service';
import { sendSuccess, sendPaginated, sendMessage } from '../../utils/response';

export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await usersService.listUsers(req.query as any);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) { next(error); }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await usersService.getUserById(req.params.id);
    sendSuccess(res, data);
  } catch (error) { next(error); }
};

export const getCustomer360 = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await usersService.getCustomer360(req.params.id);
    sendSuccess(res, data);
  } catch (error) { next(error); }
};

import { logAdminAction } from '../../utils/auditLogger';

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await usersService.createUser(req.body);
    const isStaff = Boolean(req.body.roleId);
    logAdminAction({
      userId: req.user?.id || 'system',
      action: isStaff ? 'ADMIN_CREATED' : 'CUSTOMER_CREATED',
      entity: isStaff ? 'ADMIN' : 'CUSTOMER',
      entityId: data.id,
      entityName: `${data.firstName} ${data.lastName} (${data.email})`,
      details: `Created new ${isStaff ? 'administrator/staff' : 'customer'} account '${data.firstName} ${data.lastName}' (${data.email}).`,
      severity: isStaff ? 'CRITICAL' : 'SUCCESS',
      metadata: { email: data.email, companyName: data.companyName, roleId: req.body.roleId },
      req,
    });
    sendSuccess(res, data, 'User created successfully', 201);
  } catch (error) { next(error); }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await usersService.updateUser(req.params.id, req.body);
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'USER_UPDATED',
      entity: 'CUSTOMER',
      entityId: data.id,
      entityName: `${data.firstName} ${data.lastName} (${data.email})`,
      details: `Updated user account details for '${data.firstName} ${data.lastName}' (${data.email}). Status: ${data.status}.`,
      severity: 'INFO',
      metadata: req.body,
      req,
    });
    sendSuccess(res, data, 'User updated successfully');
  } catch (error) { next(error); }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetUser = await usersService.getUserById(req.params.id).catch(() => null);
    await usersService.deleteUser(req.params.id);
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'USER_DELETED',
      entity: 'CUSTOMER',
      entityId: req.params.id,
      entityName: targetUser ? `${targetUser.firstName} ${targetUser.lastName} (${targetUser.email})` : req.params.id,
      details: `Permanently deleted user account ${targetUser ? `'${targetUser.firstName} ${targetUser.lastName}' (${targetUser.email})` : req.params.id}.`,
      severity: 'CRITICAL',
      metadata: { deletedUserId: req.params.id, email: targetUser?.email },
      req,
    });
    sendMessage(res, 'User deleted successfully');
  } catch (error) { next(error); }
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await usersService.updateProfile(req.user!.id, req.body);
    sendSuccess(res, data, 'Profile updated successfully');
  } catch (error) { next(error); }
};

export const updateAvatar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await usersService.updateAvatar(req.user!.id, req.body.avatar);
    sendSuccess(res, data, 'Avatar updated successfully');
  } catch (error) { next(error); }
};

export const getUserActivity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await usersService.getUserActivity(req.user!.id, req.query as any);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) { next(error); }
};

export const getUserOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await usersService.getUserOrders(req.user!.id, req.query as any);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) { next(error); }
};

export const getUserQuotes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await usersService.getUserQuotes(req.user!.id, req.query as any);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) { next(error); }
};

export const getUserReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await usersService.getUserReviews(req.user!.id, req.query as any);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) { next(error); }
};

export const getUserRoles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await usersService.getUserRoles(req.params.id);
    sendSuccess(res, data);
  } catch (error) { next(error); }
};

export const updateUserRoles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await usersService.updateUserRoles(req.params.id, req.body.roleIds);
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'USER_ROLES_REASSIGNED',
      entity: 'ROLE',
      entityId: req.params.id,
      details: `Reassigned roles/permissions for user #${req.params.id}.`,
      severity: 'CRITICAL',
      metadata: { targetUserId: req.params.id, roleIds: req.body.roleIds },
      req,
    });
    sendMessage(res, 'User roles updated successfully');
  } catch (error) { next(error); }
};

// ─── User Addresses ───────────────────────────────────────────────────────────

export const getUserAddresses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await usersService.getUserAddresses(req.user!.id);
    sendSuccess(res, data);
  } catch (error) { next(error); }
};

export const createAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await usersService.createAddress(req.user!.id, req.body);
    sendSuccess(res, data, 'Address created successfully', 201);
  } catch (error) { next(error); }
};

export const updateAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await usersService.updateAddress(req.user!.id, req.params.addressId, req.body);
    sendSuccess(res, data, 'Address updated successfully');
  } catch (error) { next(error); }
};

export const deleteAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await usersService.deleteAddress(req.user!.id, req.params.addressId);
    sendMessage(res, 'Address deleted successfully');
  } catch (error) { next(error); }
};

