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

    // Venture ID can come from header x-venture-id, query ?ventureId, or body
    let ventureId =
      (req.headers['x-venture-id'] as string) ||
      (req.query.ventureId as string) ||
      req.body?.ventureId;

    // Super-admin can explicitly supply ventureId or query across all
    if (req.user.roleSlug === 'super-admin' && ventureId) {
      req.ventureId = ventureId;
      next();
      return;
    }

    // If no ventureId provided, find default venture for user
    if (!ventureId) {
      const defaultVentureUser = await prisma.ventureUser.findFirst({
        where: { userId: req.user.id, isDefault: true },
        select: { ventureId: true },
      });

      if (defaultVentureUser) {
        ventureId = defaultVentureUser.ventureId;
      } else {
        // Fall back to first venture user belongs to
        const firstVentureUser = await prisma.ventureUser.findFirst({
          where: { userId: req.user.id },
          select: { ventureId: true },
        });

        if (firstVentureUser) {
          ventureId = firstVentureUser.ventureId;
        }
      }
    }

    // Super-admin can proceed even if no specific venture is bound, but for regular users check membership
    if (req.user.roleSlug !== 'super-admin') {
      if (!ventureId) {
        sendError(res, { code: 'BAD_REQUEST', message: 'Venture context required for this user' }, 400);
        return;
      }

      const membership = await prisma.ventureUser.findUnique({
        where: { ventureId_userId: { ventureId, userId: req.user.id } },
      });

      if (!membership) {
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
