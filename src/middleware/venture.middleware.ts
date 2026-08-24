import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { sendError } from '../utils/response';

declare global {
  namespace Express {
    interface Request {
      ventureId?: string;
    }
  }
}

export const requireVenture = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, { code: 'UNAUTHORIZED', message: 'Authentication required' }, 401);
      return;
    }

    const roleSlug = (req.user.roleSlug || '').toLowerCase();
    const roles = (req.user.roles || []).map((r) => r.toLowerCase());

    const isAdmin =
      ['super-admin', 'super_admin', 'superadmin', 'admin', 'manager'].includes(roleSlug) ||
      roles.some((r) => ['super-admin', 'super_admin', 'superadmin', 'admin', 'manager'].includes(r));

    // Venture ID can come from header x-venture-id, query ?ventureId, or body
    let ventureId =
      (req.headers['x-venture-id'] as string) ||
      (req.query.ventureId as string) ||
      req.body?.ventureId;

    // If no ventureId provided, find default venture for user
    if (!ventureId) {
      const defaultVentureUser = await prisma.ventureUser.findFirst({
        where: { userId: req.user.id, isDefault: true },
        select: { ventureId: true },
      });

      if (defaultVentureUser) {
        ventureId = defaultVentureUser.ventureId;
      } else {
        const firstVentureUser = await prisma.ventureUser.findFirst({
          where: { userId: req.user.id },
          select: { ventureId: true },
        });

        if (firstVentureUser) {
          ventureId = firstVentureUser.ventureId;
        }
      }
    }

    // Fallback: If still no ventureId, auto-resolve to primary system venture
    if (!ventureId) {
      const primaryVenture = await prisma.venture.findFirst({
        where: { deletedAt: null },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      if (primaryVenture) {
        ventureId = primaryVenture.id;
      }
    }

    // For non-admin users with an explicitly specified non-default venture, check membership
    if (!isAdmin && ventureId) {
      const membership = await prisma.ventureUser.findUnique({
        where: { ventureId_userId: { ventureId, userId: req.user.id } },
      });

      const userHasAnyVenture = await prisma.ventureUser.findFirst({
        where: { userId: req.user.id },
      });

      if (userHasAnyVenture && !membership) {
        sendError(res, { code: 'FORBIDDEN', message: 'Access denied to specified venture' }, 403);
        return;
      }
    }

    req.ventureId = ventureId;
    next();
  } catch (error) {
    sendError(res, { code: 'INTERNAL_ERROR', message: 'Failed to resolve venture context' }, 500);
  }
};
