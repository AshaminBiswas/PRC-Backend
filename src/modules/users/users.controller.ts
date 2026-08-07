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

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await usersService.createUser(req.body);
    sendSuccess(res, data, 'User created successfully', 201);
  } catch (error) { next(error); }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await usersService.updateUser(req.params.id, req.body);
    sendSuccess(res, data, 'User updated successfully');
  } catch (error) { next(error); }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await usersService.deleteUser(req.params.id);
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
    sendMessage(res, 'User roles updated successfully');
  } catch (error) { next(error); }
};
