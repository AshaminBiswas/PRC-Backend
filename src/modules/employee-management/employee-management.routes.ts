import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { sendError } from '../../utils/response';
import {
  createEmployeeHandler,
  updateEmployeeHandler,
  getEmployeeHandler,
  listEmployeesHandler,
  deactivateEmployeeHandler,
  recordAttendanceHandler,
  batchRecordAttendanceHandler,
  listAttendanceHandler,
  accrueMonthlyLeaveHandler,
  adjustLeaveHandler,
  getLeaveLedgerHandler,
  createAdvanceHandler,
  updateAdvanceHandler,
  deleteAdvanceHandler,
  listAdvancesHandler,
  createDeductionHandler,
  updateDeductionHandler,
  deleteDeductionHandler,
  listDeductionsHandler,
  calculatePayrollHandler,
  listPayrollRunsHandler,
  finalizePayrollHandler,
  revertPayrollToDraftHandler,
  markPayrollPaidHandler,
  downloadPayslipPdfHandler,
  resendPayslipEmailHandler,
} from './employee-management.controller';

const router = Router();

// ─── Role Check Middlewares ──────────────────────────────────────────────────
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
        message: 'Super Admin privileges required to perform this action.',
      },
      403
    );
    return;
  }
  next();
};

export const requireAdminOrSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    sendError(res, { code: 'UNAUTHORIZED', message: 'Authentication required' }, 401);
    return;
  }
  const roleSlug = (req.user.roleSlug || '').toLowerCase();
  const rolesList = (req.user.roles || []).map((r) => r.toLowerCase());
  const allowed =
    ['super-admin', 'super_admin', 'superadmin', 'admin', 'manager'].includes(roleSlug) ||
    rolesList.some((r) => ['super-admin', 'super_admin', 'superadmin', 'admin', 'manager'].includes(r));

  if (!allowed) {
    sendError(
      res,
      {
        code: 'FORBIDDEN',
        message: 'Admin privileges required to access Employee Management features.',
      },
      403
    );
    return;
  }
  next();
};

// All routes require authenticated user session
router.use(authenticate);
router.use(requireAdminOrSuperAdmin);

// ─── Employee Master Data ─────────────────────────────────────────────────────
router.get('/', listEmployeesHandler);
router.post('/', createEmployeeHandler);
router.get('/detail/:id', getEmployeeHandler);
router.put('/detail/:id', updateEmployeeHandler);
router.delete('/detail/:id', requireSuperAdmin, deactivateEmployeeHandler);

// ─── Attendance Management ────────────────────────────────────────────────────
router.get('/attendance', listAttendanceHandler);
router.post('/attendance', recordAttendanceHandler);
router.post('/attendance/batch', batchRecordAttendanceHandler);

// ─── Leave Ledger ─────────────────────────────────────────────────────────────
router.post('/leave/accrue-monthly', accrueMonthlyLeaveHandler);
router.get('/:id/leave-ledger', getLeaveLedgerHandler);
router.post('/:id/leave-ledger', adjustLeaveHandler);

// ─── Advances ─────────────────────────────────────────────────────────────────
router.get('/advances', listAdvancesHandler);
router.post('/advances', createAdvanceHandler);
router.put('/advances/:id', updateAdvanceHandler);
router.delete('/advances/:id', deleteAdvanceHandler);

// ─── Deductions ───────────────────────────────────────────────────────────────
router.get('/deductions', listDeductionsHandler);
router.post('/deductions', createDeductionHandler);
router.put('/deductions/:id', updateDeductionHandler);
router.delete('/deductions/:id', deleteDeductionHandler);

// ─── Monthly Payroll Engine ───────────────────────────────────────────────────
router.get('/payroll', listPayrollRunsHandler);
router.post('/payroll/calculate', calculatePayrollHandler);
router.post('/payroll/:id/finalize', finalizePayrollHandler);
router.post('/payroll/:id/revert-draft', requireSuperAdmin, revertPayrollToDraftHandler);
router.post('/payroll/:id/mark-paid', requireSuperAdmin, markPayrollPaidHandler);
router.get('/payroll/:id/pdf', downloadPayslipPdfHandler);
router.post('/payroll/:id/resend-email', resendPayslipEmailHandler);

export default router;
