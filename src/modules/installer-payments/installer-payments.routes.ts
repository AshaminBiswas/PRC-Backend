import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { sendError } from '../../utils/response';
import {
  listCubicleModelsHandler,
  createCubicleModelHandler,
  updateCubicleModelHandler,
  deactivateCubicleModelHandler,
  listCubicleInstallersHandler,
  createCubicleInstallerHandler,
  updateCubicleInstallerHandler,
  deactivateCubicleInstallerHandler,
  getInstallerLedgerHandler,
  listInstallerBillsHandler,
  getInstallerBillHandler,
  createInstallerBillHandler,
  updateInstallerBillHandler,
  getBillAuditLogsHandler,
  recordBillPaymentHandler,
  downloadBillPdfHandler,
  resendBillEmailHandler,
  deleteInstallerBillHandler,
  exportInstallerBillsExcelHandler,
} from './installer-payments.controller';

const router = Router();

// ─── Role Check Middlewares ──────────────────────────────────────────────────

/**
 * Enforce Super Admin role.
 * Rejects non-super-admins with HTTP 403 Forbidden.
 */
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    sendError(res, { code: 'UNAUTHORIZED', message: 'Authentication required' }, 401);
    return;
  }
  const roleSlug = (req.user.roleSlug || '').toLowerCase();
  const rolesList = (req.user.roles || []).map((r) => r.toLowerCase());
  const isSuper =
    ['super-admin', 'super_admin', 'superadmin'].includes(roleSlug) ||
    rolesList.some((r) => ['super-admin', 'super_admin', 'superadmin'].includes(r));

  if (!isSuper) {
    sendError(
      res,
      {
        code: 'FORBIDDEN',
        message: 'Super Admin privileges required to manage cubicle models or export full payment history.',
      },
      403
    );
    return;
  }
  next();
};

/**
 * Enforce Admin or Super Admin role.
 */
export const requireAdminOrSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    sendError(res, { code: 'UNAUTHORIZED', message: 'Authentication required' }, 401);
    return;
  }
  const roleSlug = (req.user.roleSlug || '').toLowerCase();
  const rolesList = (req.user.roles || []).map((r) => r.toLowerCase());
  const isAuthorized =
    ['super-admin', 'super_admin', 'superadmin', 'admin'].includes(roleSlug) ||
    rolesList.some((r) => ['super-admin', 'super_admin', 'superadmin', 'admin'].includes(r));

  if (!isAuthorized) {
    sendError(res, { code: 'FORBIDDEN', message: 'Admin access privileges required' }, 403);
    return;
  }
  next();
};

// ─── Cubicle Model Master Routes ─────────────────────────────────────────────
// Reading active models is open to Admins to feed the payment bill form dropdown;
// Creating, updating, and deactivating is strictly locked to Super Admin.
router.get('/models', authenticate, requireAdminOrSuperAdmin, listCubicleModelsHandler);
router.post('/models', authenticate, requireSuperAdmin, createCubicleModelHandler);
router.patch('/models/:id', authenticate, requireSuperAdmin, updateCubicleModelHandler);
router.delete('/models/:id', authenticate, requireSuperAdmin, deactivateCubicleModelHandler);

// ─── Cubicle Installer Master Routes (Directory) ─────────────────────────────
// Listing active installers is open to Admins for auto-fetching details in the bill creation form;
// Creating, updating, and deactivating is strictly locked to Super Admin.
router.get('/installers', authenticate, requireAdminOrSuperAdmin, listCubicleInstallersHandler);
router.post('/installers', authenticate, requireSuperAdmin, createCubicleInstallerHandler);
router.patch('/installers/:id', authenticate, requireSuperAdmin, updateCubicleInstallerHandler);
router.delete('/installers/:id', authenticate, requireSuperAdmin, deactivateCubicleInstallerHandler);
router.get('/installers/:id/ledger', authenticate, requireAdminOrSuperAdmin, getInstallerLedgerHandler);

// ─── Full Payment History Export (Super Admin Only) ──────────────────────────
router.get('/export/excel', authenticate, requireSuperAdmin, exportInstallerBillsExcelHandler);

// ─── Installer Payment Bills Routes (Admin & Super Admin) ────────────────────
router.get('/', authenticate, requireAdminOrSuperAdmin, listInstallerBillsHandler);
router.get('/:id', authenticate, requireAdminOrSuperAdmin, getInstallerBillHandler);
router.post('/', authenticate, requireAdminOrSuperAdmin, createInstallerBillHandler);
// Bill edit is Super Admin only — changes are audit-logged
router.patch('/:id', authenticate, requireSuperAdmin, updateInstallerBillHandler);
router.post('/:id/payments', authenticate, requireAdminOrSuperAdmin, recordBillPaymentHandler);
router.get('/:id/pdf', authenticate, requireAdminOrSuperAdmin, downloadBillPdfHandler);
router.post('/:id/resend-email', authenticate, requireAdminOrSuperAdmin, resendBillEmailHandler);
router.delete('/:id', authenticate, requireSuperAdmin, deleteInstallerBillHandler);
// Audit log — readable by all admins, written only on SuperAdmin edits
router.get('/:id/audit-logs', authenticate, requireAdminOrSuperAdmin, getBillAuditLogsHandler);

export default router;

