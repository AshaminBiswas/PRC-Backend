import prisma from '../config/database';
import { eventBus } from '../events/eventBus';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';

export type AuditSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL' | 'SECURITY';

export type AuditEntity =
  | 'QUOTATION'
  | 'PURCHASE_ORDER'
  | 'INVOICE'
  | 'PROFORMA_INVOICE'
  | 'CUSTOMER'
  | 'ADMIN'
  | 'PRODUCT'
  | 'VARIANT'
  | 'ROLE'
  | 'PERMISSION'
  | 'AUTH'
  | 'SETTINGS'
  | 'SHIPPING'
  | 'COUPON'
  | 'SYSTEM';

export interface LogAdminActionParams {
  userId: string;
  adminEmail?: string;
  adminName?: string;
  adminRole?: string;
  action: string;
  entity: AuditEntity;
  entityId?: string;
  entityName?: string;
  details: string;
  severity?: AuditSeverity;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  req?: Request;
}

/**
 * Asynchronously and safely records an admin activity log in PostgreSQL `admin_audit_logs`.
 * Non-blocking: Errors are caught and logged without disrupting the main transaction.
 */
export async function logAdminAction(params: LogAdminActionParams): Promise<void> {
  // Run asynchronously without blocking parent caller
  setImmediate(async () => {
    try {
      const id = uuidv4();
      let email = params.adminEmail;
      let name = params.adminName;
      let role = params.adminRole;
      let ip = params.ipAddress;
      let ua = params.userAgent;

      if (params.req) {
        ip = ip || (params.req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || params.req.socket.remoteAddress || '127.0.0.1';
        ua = ua || params.req.headers['user-agent'] || 'Unknown Agent';
        if (!email && (params.req as any).user) {
          const reqUser = (params.req as any).user;
          email = reqUser.email;
          name = `${reqUser.firstName || ''} ${reqUser.lastName || ''}`.trim() || undefined;
          role = typeof reqUser.role === 'object' ? reqUser.role?.name || reqUser.role?.slug : reqUser.role;
        }
      }

      // If still missing admin details, lookup user record
      if ((!email || !name || !role) && params.userId) {
        try {
          const userRec = await prisma.user.findUnique({
            where: { id: params.userId },
            include: { userRoles: { include: { role: true } } },
          });
          if (userRec) {
            email = email || userRec.email;
            name = name || `${userRec.firstName || ''} ${userRec.lastName || ''}`.trim();
            role = role || userRec.userRoles[0]?.role?.name || userRec.userRoles[0]?.role?.slug || 'Administrator';
          }
        } catch {
          // Ignore lookup failure
        }
      }

      const logId = id;
      const userId = params.userId || 'system';
      const adminEmail = email || 'system@prchardware.com';
      const adminName = name || 'System Administrator';
      const adminRole = role || 'super_admin';
      const action = params.action.toUpperCase();
      const entity = params.entity.toUpperCase();
      const entityId = params.entityId || null;
      const entityName = params.entityName || null;
      const details = params.details;
      const severity = params.severity || 'INFO';
      const metadataStr = params.metadata ? JSON.stringify(params.metadata) : null;
      const ipAddress = ip || '127.0.0.1';
      const userAgent = ua || 'PRC Admin Portal';

      // Insert into admin_audit_logs table
      await prisma.$executeRawUnsafe(
        `INSERT INTO "admin_audit_logs" (
          "id", "user_id", "admin_email", "admin_name", "admin_role",
          "action", "entity", "entity_id", "entity_name", "details",
          "severity", "metadata", "ip_address", "user_agent", "created_at"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, NOW())`,
        logId,
        userId,
        adminEmail,
        adminName,
        adminRole,
        action,
        entity,
        entityId,
        entityName,
        details,
        severity,
        metadataStr,
        ipAddress,
        userAgent
      );

      // Emit to eventBus for real-time SSE broadcasts
      eventBus.emit('admin_audit_log', {
        id: logId,
        userId,
        adminEmail,
        adminName,
        adminRole,
        action,
        entity,
        entityId,
        entityName,
        details,
        severity,
        metadata: params.metadata || null,
        ipAddress,
        userAgent,
        createdAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.warn('[AuditLogger] Failed to write admin audit log:', err?.message || err);
    }
  });
}
