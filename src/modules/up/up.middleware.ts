import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';

/**
 * Checks whether a given authenticated user has access to the private UP module.
 * Super Admin automatically has access.
 * Other administrators require an active (non-revoked) record in up_expense_access.
 * Zero access is inferred from general roles, finance roles, or manager roles.
 */
export const checkUserUPAccess = async (
  userId: string,
  roleSlug?: string,
  roles?: string[]
): Promise<boolean> => {
  if (!userId) return false;

  // 1. Super Admin check
  const allRoles = [roleSlug || '', ...(roles || [])].map((r) =>
    r.toLowerCase().replace(/[-_]/g, '')
  );
  const isSuper = allRoles.some((r) =>
    ['superadmin', 'super-admin', 'super_admin'].includes(r)
  );
  if (isSuper) return true;

  // 2. Query up_expense_access for an active record
  try {
    const accessRecords = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM "up_expense_access" WHERE "admin_id"::text = $1 AND "revoked_at" IS NULL LIMIT 1;`,
      userId
    );
    return accessRecords.length > 0;
  } catch (err) {
    console.warn('[UP Authorization] Error checking UP allow-list:', err);
    return false;
  }
};

/**
 * Middleware that strictly protects all UP routes.
 * Returns 403 Forbidden without any financial details if unauthorized.
 */
export const requireUPAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
    return;
  }

  const hasAccess = await checkUserUPAccess(
    req.user.id,
    req.user.roleSlug,
    req.user.roles
  );

  if (!hasAccess) {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied: You do not have permission to access UP',
      },
    });
    return;
  }

  next();
};

/**
 * Middleware restricting sensitive operations (Access allow-list, verification, category editing)
 * strictly to Super Administrators.
 */
export const requireUPSuperAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
    return;
  }

  const allRoles = [req.user.roleSlug || '', ...(req.user.roles || [])].map((r) =>
    r.toLowerCase().replace(/[-_]/g, '')
  );
  const isSuper = allRoles.some((r) =>
    ['superadmin', 'super-admin', 'super_admin'].includes(r)
  );

  if (!isSuper) {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Only Super Administrators can perform this action in UP',
      },
    });
    return;
  }

  next();
};
