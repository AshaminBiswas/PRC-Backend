import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';

export interface ListAuditLogsQuery {
  page?: number;
  limit?: number;
  search?: string;
  entity?: string;
  action?: string;
  severity?: string;
  adminUserId?: string;
  startDate?: string;
  endDate?: string;
}

export const listAuditLogs = async (query: ListAuditLogsQuery) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (query.search && query.search.trim()) {
    conditions.push(`(
      "admin_email" ILIKE $${paramIdx} OR
      "admin_name" ILIKE $${paramIdx} OR
      "action" ILIKE $${paramIdx} OR
      "details" ILIKE $${paramIdx} OR
      "entity_name" ILIKE $${paramIdx} OR
      "ip_address" ILIKE $${paramIdx}
    )`);
    params.push(`%${query.search.trim()}%`);
    paramIdx++;
  }

  if (query.entity && query.entity !== 'ALL') {
    conditions.push(`"entity" = $${paramIdx}`);
    params.push(query.entity.toUpperCase());
    paramIdx++;
  }

  if (query.action && query.action !== 'ALL') {
    conditions.push(`"action" = $${paramIdx}`);
    params.push(query.action.toUpperCase());
    paramIdx++;
  }

  if (query.severity && query.severity !== 'ALL') {
    conditions.push(`"severity" = $${paramIdx}`);
    params.push(query.severity.toUpperCase());
    paramIdx++;
  }

  if (query.adminUserId) {
    conditions.push(`"user_id" = $${paramIdx}`);
    params.push(query.adminUserId);
    paramIdx++;
  }

  if (query.startDate) {
    conditions.push(`"created_at" >= $${paramIdx}::timestamptz`);
    params.push(query.startDate);
    paramIdx++;
  }

  if (query.endDate) {
    conditions.push(`"created_at" <= $${paramIdx}::timestamptz`);
    params.push(query.endDate);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    // Count total matching
    const countResult = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int as total FROM "admin_audit_logs" ${whereClause}`,
      ...params
    );
    const total = Number(countResult[0]?.total || 0);

    // Fetch paginated logs
    const logs = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "admin_audit_logs" ${whereClause} ORDER BY "created_at" DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      ...params,
      limit,
      offset
    );

    return {
      data: logs.map((l) => ({
        id: l.id,
        userId: l.user_id,
        adminEmail: l.admin_email,
        adminName: l.admin_name,
        adminRole: l.admin_role,
        action: l.action,
        entity: l.entity,
        entityId: l.entity_id,
        entityName: l.entity_name,
        details: l.details,
        severity: l.severity,
        metadata: l.metadata,
        ipAddress: l.ip_address,
        userAgent: l.user_agent,
        createdAt: l.created_at,
      })),
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNextPage: page < (Math.ceil(total / limit) || 1),
        hasPrevPage: page > 1,
      },
    };
  } catch (err: any) {
    // Graceful fallback if table is initializing
    return {
      data: [],
      pagination: { page: 1, limit, totalItems: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false },
    };
  }
};

/**
 * Super-Admin exclusive 360° Profile & Action Dossier for any administrator.
 */
export const getAdmin360 = async (adminUserId: string) => {
  const admin = await prisma.user.findUnique({
    where: { id: adminUserId, deletedAt: null },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
      activityLogs: {
        orderBy: { createdAt: 'desc' },
        take: 30,
      },
    },
  });

  if (!admin) {
    throw new AppError('NOT_FOUND', 'Administrator account not found', 404);
  }

  // Fetch all audit logs created by this admin
  let logs: any[] = [];
  try {
    logs = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "admin_audit_logs" WHERE "user_id" = $1 ORDER BY "created_at" DESC LIMIT 500`,
      admin.id
    );
  } catch {
    logs = [];
  }

  const mappedLogs = logs.map((l) => ({
    id: l.id,
    userId: l.user_id,
    adminEmail: l.admin_email,
    adminName: l.admin_name,
    adminRole: l.admin_role,
    action: l.action,
    entity: l.entity,
    entityId: l.entity_id,
    entityName: l.entity_name,
    details: l.details,
    severity: l.severity,
    metadata: l.metadata,
    ipAddress: l.ip_address,
    userAgent: l.user_agent,
    createdAt: l.created_at,
  }));

  // Group actions by category
  const quoteActions = mappedLogs.filter(
    (l) => l.entity === 'QUOTATION' || l.entity === 'PURCHASE_ORDER' || l.action.includes('QUOTE') || l.action.includes('PO')
  );
  const invoiceActions = mappedLogs.filter(
    (l) => l.entity === 'INVOICE' || l.entity === 'PROFORMA_INVOICE' || l.action.includes('INVOICE') || l.action.includes('PI_')
  );
  const catalogActions = mappedLogs.filter(
    (l) => l.entity === 'PRODUCT' || l.entity === 'VARIANT' || l.entity === 'CATEGORY' || l.action.includes('PRODUCT') || l.action.includes('STOCK')
  );
  const customerActions = mappedLogs.filter(
    (l) => l.entity === 'CUSTOMER' || l.action.includes('CUSTOMER') || l.action.includes('B2B_RATE')
  );
  const securityActions = mappedLogs.filter(
    (l) => l.entity === 'ROLE' || l.entity === 'PERMISSION' || l.entity === 'AUTH' || l.action.includes('ROLE') || l.action.includes('2FA') || l.action.includes('LOGIN')
  );

  // Compute seniority
  const now = new Date();
  const created = new Date(admin.createdAt);
  const diffMs = Math.max(0, now.getTime() - created.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const years = Math.floor(diffDays / 365);
  const remainingDays = diffDays % 365;
  const months = Math.floor(remainingDays / 30);
  const days = remainingDays % 30;

  let longevityLabel = '';
  if (years > 0) {
    longevityLabel = `${years} Year${years > 1 ? 's' : ''}${months > 0 ? `, ${months} Month${months > 1 ? 's' : ''}` : ''}`;
  } else if (months > 0) {
    longevityLabel = `${months} Month${months > 1 ? 's' : ''}${days > 0 ? `, ${days} Day${days > 1 ? 's' : ''}` : ''}`;
  } else if (diffDays > 0) {
    longevityLabel = `${diffDays} Day${diffDays > 1 ? 's' : ''}`;
  } else {
    longevityLabel = 'Joined Today';
  }

  // Extract all permissions
  const permissionsMap = new Map<string, any>();
  admin.userRoles.forEach((ur) => {
    ur.role.rolePermissions.forEach((rp) => {
      if (rp.permission) {
        permissionsMap.set(rp.permission.slug, rp.permission);
      }
    });
  });
  const assignedPermissions = Array.from(permissionsMap.values());

  const primaryRole = admin.userRoles[0]?.role || null;
  const isSuperAdmin = primaryRole?.slug === 'super_admin' || primaryRole?.name?.toLowerCase().includes('super');

  return {
    admin: {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      phone: admin.phone,
      avatar: admin.avatar,
      status: admin.status,
      isVerified: admin.isVerified,
      twoFactorEnabled: admin.twoFactorEnabled,
      mustChangePassword: admin.mustChangePassword,
      lastLoginAt: admin.lastLoginAt,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
      isSuperAdmin,
      role: primaryRole,
      roles: admin.userRoles.map((ur) => ur.role),
      permissions: assignedPermissions,
      seniority: {
        totalDays: diffDays,
        years,
        months,
        days,
        label: longevityLabel,
      },
    },
    summary: {
      totalOperations: mappedLogs.length,
      quotesApproved: quoteActions.filter((l) => l.action.includes('APPROV')).length,
      invoicesGenerated: invoiceActions.filter((l) => l.action.includes('GENERATE') || l.action.includes('CREATE')).length,
      productsManaged: catalogActions.length,
      customersManaged: customerActions.length,
      securityActionsCount: securityActions.length,
    },
    sections: {
      quoteActions: quoteActions.slice(0, 100),
      invoiceActions: invoiceActions.slice(0, 100),
      catalogActions: catalogActions.slice(0, 100),
      customerActions: customerActions.slice(0, 100),
      securityActions: securityActions.slice(0, 100),
      allLogs: mappedLogs.slice(0, 150),
    },
  };
};
