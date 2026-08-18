import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/token.utils';
import prisma from '../config/database';
import { sendError } from '../utils/response';

// ─── Extend Request ───────────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        roleSlug: string;
        roles?: string[];
        permissions: string[];
      };
    }
  }
}

// ─── Authenticate ─────────────────────────────────────────────────────────────

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Access token is required' },
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    // Load user + roles + permissions from DB
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        status: true,
        userRoles: {
          select: {
            role: {
              select: {
                slug: true,
                rolePermissions: {
                  select: { permission: { select: { slug: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      sendError(res, { code: 'UNAUTHORIZED', message: 'User not found' }, 401);
      return;
    }

    if (user.status !== 'ACTIVE') {
      sendError(res, { code: 'ACCOUNT_SUSPENDED', message: 'Account is suspended or inactive' }, 403);
      return;
    }

    // Flatten permissions and detect roles
    const permissions: string[] = [];
    const roleSlugs = user.userRoles.map((ur) => (ur.role.slug || '').toLowerCase());
    const hasSuperAdmin = roleSlugs.some((s) => ['super-admin', 'super_admin', 'superadmin'].includes(s));
    const hasAdmin = roleSlugs.some((s) => ['admin'].includes(s));

    let primaryRoleSlug = hasSuperAdmin
      ? 'super_admin'
      : hasAdmin
      ? 'admin'
      : (user.userRoles[0]?.role?.slug ?? 'customer');

    for (const ur of user.userRoles) {
      for (const rp of ur.role.rolePermissions) {
        if (!permissions.includes(rp.permission.slug)) {
          permissions.push(rp.permission.slug);
        }
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      roleSlug: primaryRoleSlug,
      roles: roleSlugs.length > 0 ? roleSlugs : [primaryRoleSlug],
      permissions,
    };

    next();
  } catch (error) {
    sendError(res, { code: 'INVALID_TOKEN', message: 'Invalid or expired access token' }, 401);
  }
};

// ─── Authorize ────────────────────────────────────────────────────────────────

export const authorize = (...requiredPermissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, { code: 'UNAUTHORIZED', message: 'Authentication required' }, 401);
      return;
    }

    // Super Admin and Admin bypass all permission checks
    const roleSlug = (req.user.roleSlug || '').toLowerCase();
    if (['super-admin', 'super_admin', 'superadmin', 'admin'].includes(roleSlug)) {
      next();
      return;
    }

    // Allow request if user has ANY of the required permissions for the endpoint
    const hasPermission = requiredPermissions.some((perm) =>
      req.user!.permissions.includes(perm)
    );

    if (!hasPermission) {
      sendError(
        res,
        {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action',
          details: [{ required: requiredPermissions }],
        },
        403
      );
      return;
    }

    next();
  };
};

// ─── Optional Auth ────────────────────────────────────────────────────────────

export const optionalAuthenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyAccessToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId, deletedAt: null },
        select: {
          id: true,
          email: true,
          status: true,
          userRoles: {
            select: {
              role: {
                select: {
                  slug: true,
                  rolePermissions: { select: { permission: { select: { slug: true } } } },
                },
              },
            },
          },
        },
      });
      if (user && user.status === 'ACTIVE') {
        const permissions: string[] = [];
        const roleSlugs = user.userRoles.map((ur) => (ur.role.slug || '').toLowerCase());
        const hasSuperAdmin = roleSlugs.some((s) => ['super-admin', 'super_admin', 'superadmin'].includes(s));
        const hasAdmin = roleSlugs.some((s) => ['admin'].includes(s));

        let primaryRoleSlug = hasSuperAdmin
          ? 'super_admin'
          : hasAdmin
          ? 'admin'
          : (user.userRoles[0]?.role?.slug ?? 'customer');

        for (const ur of user.userRoles) {
          for (const rp of ur.role.rolePermissions) {
            if (!permissions.includes(rp.permission.slug)) permissions.push(rp.permission.slug);
          }
        }
        req.user = { id: user.id, email: user.email, roleSlug: primaryRoleSlug, permissions };
      }
    }
  } catch {
    // Ignore errors for optional auth
  }
  next();
};
