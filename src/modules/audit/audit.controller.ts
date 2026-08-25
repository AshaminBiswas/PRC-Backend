import { Request, Response, NextFunction } from 'express';
import * as auditService from './audit.service';
import { sendSuccess, sendPaginated } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';

export const listLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await auditService.listAuditLogs(req.query as any);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getAdmin360 = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUser = req.user;
    const roleSlug = currentUser?.roleSlug || (typeof (currentUser as any)?.role === 'object' ? (currentUser as any)?.role?.slug : (currentUser as any)?.role) || '';
    const rolesList = currentUser?.roles || [];
    
    const isSuperAdmin =
      String(roleSlug).toLowerCase().includes('super') ||
      rolesList.some((r) => String(r).toLowerCase().includes('super'));

    // Strict Security Gate: Only Super Administrators can view detailed Admin Activity Dossiers
    if (!isSuperAdmin) {
      throw new AppError(
        'FORBIDDEN',
        'Access Denied: Only Super Administrators can inspect staff and executive activity dossiers.',
        403
      );
    }

    const data = await auditService.getAdmin360(req.params.id);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};
