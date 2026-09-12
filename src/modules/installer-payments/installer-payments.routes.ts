import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
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
 * Enforce Super Admin or relevant elevated privileges.
 */
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    sendError(res, { code: 'UNAUTHORIZED', message: 'Authentication required' }, 401);
    return;
  }
  const roleSlug = (req.user.roleSlug || '').toLowerCase();
  const rolesList = (req.user.roles || []).map((r) => r.toLowerCase());
  const userPerms = req.user.permissions || [];
  const isSuper =
    ['super-admin', 'super_admin', 'superadmin'].includes(roleSlug) ||
    rolesList.some((r) => ['super-admin', 'super_admin', 'superadmin'].includes(r));

  if (
    isSuper ||
    userPerms.some((p) =>
      p.startsWith('installer_payments.') ||
      p.startsWith('cubicle_installers.') ||
      p.startsWith('cubicle_models.')
    )
  ) {
    next();
    return;
  }

  sendError(
    res,
    {
      code: 'FORBIDDEN',
      message: 'Super Admin or relevant Installer Management privileges required to perform this action.',
    },
    403
  );
};

/**
 * Enforce Admin, Super Admin, or custom role with installer permissions.
 */
export const requireAdminOrSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    sendError(res, { code: 'UNAUTHORIZED', message: 'Authentication required' }, 401);
    return;
  }
  const roleSlug = (req.user.roleSlug || '').toLowerCase();
  const rolesList = (req.user.roles || []).map((r) => r.toLowerCase());
  const userPerms = req.user.permissions || [];
  const isAuthorized =
    ['super-admin', 'super_admin', 'superadmin', 'admin', 'manager'].includes(roleSlug) ||
    rolesList.some((r) => ['super-admin', 'super_admin', 'superadmin', 'admin', 'manager'].includes(r));

  const hasPerm = userPerms.some((p) =>
    p.startsWith('installer_payments.') ||
    p.startsWith('cubicle_installers.') ||
    p.startsWith('cubicle_models.')
  );

  if (!isAuthorized && !hasPerm) {
    sendError(res, { code: 'FORBIDDEN', message: 'Admin access privileges or installer permissions required' }, 403);
    return;
  }
  next();
};

// ─── Cubicle Model Master Routes ─────────────────────────────────────────────
router.get('/models', authenticate, authorize('cubicle_models.read', 'installer_payments.read', 'installer_payments.create'), listCubicleModelsHandler);
router.post('/models', authenticate, authorize('cubicle_models.create'), createCubicleModelHandler);
router.patch('/models/:id', authenticate, authorize('cubicle_models.update'), updateCubicleModelHandler);
router.delete('/models/:id', authenticate, authorize('cubicle_models.delete'), deactivateCubicleModelHandler);

// ─── Cubicle Installer Master Routes (Directory) ─────────────────────────────
router.get('/installers', authenticate, authorize('cubicle_installers.read', 'installer_payments.read', 'installer_payments.create'), listCubicleInstallersHandler);
router.post('/installers', authenticate, authorize('cubicle_installers.create'), createCubicleInstallerHandler);
router.patch('/installers/:id', authenticate, authorize('cubicle_installers.update'), updateCubicleInstallerHandler);
router.delete('/installers/:id', authenticate, authorize('cubicle_installers.delete'), deactivateCubicleInstallerHandler);
router.get('/installers/:id/ledger', authenticate, authorize('cubicle_installers.ledger', 'cubicle_installers.read', 'installer_payments.read'), getInstallerLedgerHandler);

// ─── Full Payment History Export ─────────────────────────────────────────────
router.get('/export/excel', authenticate, authorize('installer_payments.export', 'installer_payments.read'), exportInstallerBillsExcelHandler);

// ─── Installer Payment Bills Routes ──────────────────────────────────────────
router.get('/', authenticate, authorize('installer_payments.read'), listInstallerBillsHandler);
router.get('/:id', authenticate, authorize('installer_payments.read'), getInstallerBillHandler);
router.post('/', authenticate, authorize('installer_payments.create'), createInstallerBillHandler);
router.patch('/:id', authenticate, authorize('installer_payments.update'), updateInstallerBillHandler);
router.post('/:id/payments', authenticate, authorize('installer_payments.record_payment', 'installer_payments.update'), recordBillPaymentHandler);
router.get('/:id/pdf', authenticate, authorize('installer_payments.download_bill', 'installer_payments.read'), downloadBillPdfHandler);
router.post('/:id/resend-email', authenticate, authorize('installer_payments.send_email'), resendBillEmailHandler);
router.delete('/:id', authenticate, authorize('installer_payments.delete'), deleteInstallerBillHandler);
router.get('/:id/audit-logs', authenticate, authorize('installer_payments.read'), getBillAuditLogsHandler);

export default router;

