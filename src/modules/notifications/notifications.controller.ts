import { Request, Response, NextFunction } from 'express';
import * as notificationsService from './notifications.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';

export const getUserNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const result = await notificationsService.getUserNotifications(req.user.id, req.query as any);
    res.status(200).json({
      success: true,
      data: result.data,
      unreadCount: result.unreadCount,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const data = await notificationsService.markAsRead(req.user.id, req.params.id);
    sendSuccess(res, data, 'Notification marked as read');
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const result = await notificationsService.markAllAsRead(req.user.id);
    sendSuccess(res, result, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
};

export const sendNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await notificationsService.sendNotification(req.body);
    sendSuccess(res, data, 'Notification sent successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const isAdmin = ['super_admin', 'admin', 'manager'].includes((req.user as any).role);
    const data = await notificationsService.deleteNotification(req.user.id, req.params.id, isAdmin);
    sendSuccess(res, data, 'Notification deleted successfully');
  } catch (error) {
    next(error);
  }
};
