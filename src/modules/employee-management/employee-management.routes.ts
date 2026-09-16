import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
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
  deleteAttendanceHandler,
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
  const userPerms = req.user.permissions || [];
  const isSuper =
    ['super-admin', 'super_admin', 'superadmin'].includes(roleSlug) ||
    rolesList.some((r) => ['super-admin', 'super_admin', 'superadmin'].includes(r));

  // Allow Super Admin or customized roles possessing elevated management/revert/disburse capabilities
  if (
    isSuper ||
    userPerms.includes('employees.delete') ||
    userPerms.includes('payroll.revert_draft') ||
    userPerms.includes('payroll.disburse')
  ) {
    next();
    return;
  }

  sendError(
    res,
    {
      code: 'FORBIDDEN',
      message: 'Super Admin or elevated HR management privileges required to perform this action.',
    },
    403
  );
};

export const requireAdminOrSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    sendError(res, { code: 'UNAUTHORIZED', message: 'Authentication required' }, 401);
    return;
  }
  const roleSlug = (req.user.roleSlug || '').toLowerCase();
  const rolesList = (req.user.roles || []).map((r) => r.toLowerCase());
  const userPerms = req.user.permissions || [];
  const allowed =
    ['super-admin', 'super_admin', 'superadmin', 'admin', 'manager'].includes(roleSlug) ||
    rolesList.some((r) => ['super-admin', 'super_admin', 'superadmin', 'admin', 'manager'].includes(r));

  const hasAnyEmployeePerm = userPerms.some((p) =>
    p.startsWith('employees.') ||
    p.startsWith('attendance.') ||
    p.startsWith('leaves.') ||
    p.startsWith('advances.') ||
    p.startsWith('deductions.') ||
    p.startsWith('payroll.')
  );

  if (!allowed && !hasAnyEmployeePerm) {
    sendError(
      res,
      {
        code: 'FORBIDDEN',
        message: 'Admin privileges or relevant Employee Management permissions required.',
      },
      403
    );
    return;
  }
  next();
};

// All routes require authenticated user session and base employee-management capability
router.use(authenticate);
router.use(requireAdminOrSuperAdmin);

// ─── Employee Master Data ─────────────────────────────────────────────────────
router.get('/', authorize('employees.read'), listEmployeesHandler);
router.post('/', authorize('employees.create'), createEmployeeHandler);
router.get('/detail/:id', authorize('employees.read'), getEmployeeHandler);
router.put('/detail/:id', authorize('employees.update'), updateEmployeeHandler);
router.delete('/detail/:id', authorize('employees.delete'), deactivateEmployeeHandler);

// ─── Attendance Management ────────────────────────────────────────────────────
router.get('/attendance', authorize('attendance.read'), listAttendanceHandler);
router.post('/attendance', authorize('attendance.mark', 'attendance.update'), recordAttendanceHandler);
router.post('/attendance/batch', authorize('attendance.batch', 'attendance.mark'), batchRecordAttendanceHandler);
router.delete('/attendance', authorize('attendance.mark', 'attendance.update'), deleteAttendanceHandler);

// ─── Leave Ledger ─────────────────────────────────────────────────────────────
router.post('/leave/accrue-monthly', authorize('leaves.accrue'), accrueMonthlyLeaveHandler);
router.get('/:id/leave-ledger', authorize('leaves.read'), getLeaveLedgerHandler);
router.post('/:id/leave-ledger', authorize('leaves.adjust'), adjustLeaveHandler);

// ─── Advances ─────────────────────────────────────────────────────────────────
router.get('/advances', authorize('advances.read'), listAdvancesHandler);
router.post('/advances', authorize('advances.create'), createAdvanceHandler);
router.put('/advances/:id', authorize('advances.update'), updateAdvanceHandler);
router.delete('/advances/:id', authorize('advances.delete'), deleteAdvanceHandler);

// ─── Deductions ───────────────────────────────────────────────────────────────
router.get('/deductions', authorize('deductions.read'), listDeductionsHandler);
router.post('/deductions', authorize('deductions.create'), createDeductionHandler);
router.put('/deductions/:id', authorize('deductions.update'), updateDeductionHandler);
router.delete('/deductions/:id', authorize('deductions.delete'), deleteDeductionHandler);

// ─── Monthly Payroll Engine ───────────────────────────────────────────────────
router.get('/payroll', authorize('payroll.read'), listPayrollRunsHandler);
router.post('/payroll/calculate', authorize('payroll.calculate'), calculatePayrollHandler);
router.post('/payroll/:id/finalize', authorize('payroll.finalize'), finalizePayrollHandler);
router.post('/payroll/:id/revert-draft', authorize('payroll.revert_draft'), revertPayrollToDraftHandler);
router.post('/payroll/:id/mark-paid', authorize('payroll.disburse'), markPayrollPaidHandler);
router.get('/payroll/:id/pdf', authorize('payroll.download_payslip', 'payroll.read'), downloadPayslipPdfHandler);
router.post('/payroll/:id/resend-email', authorize('payroll.email_payslip'), resendPayslipEmailHandler);

export default router;
