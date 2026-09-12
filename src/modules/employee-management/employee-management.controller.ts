import { Request, Response, NextFunction } from 'express';
import * as employeeService from './employee-management.service';
import {
  CreateEmployeeSchema,
  UpdateEmployeeSchema,
  ListEmployeesQuerySchema,
  RecordAttendanceItemSchema,
  BatchAttendanceSchema,
  ListAttendanceQuerySchema,
  AccrueMonthlyLeaveSchema,
  AdjustLeaveSchema,
  CreateAdvanceSchema,
  UpdateAdvanceSchema,
  ListAdvancesQuerySchema,
  CreateDeductionSchema,
  UpdateDeductionSchema,
  ListDeductionsQuerySchema,
  CalculatePayrollSchema,
  MarkPayrollPaidSchema,
  ListPayrollQuerySchema,
  ResendPayslipEmailSchema,
} from './employee-management.schema';
import { sendSuccess, sendError } from '../../utils/response';

// ─── Master Data Handlers ─────────────────────────────────────────────────────
export const createEmployeeHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CreateEmployeeSchema.parse(req.body);
    const createdById = req.user?.id;
    const employee = await employeeService.createEmployee(input, createdById);
    sendSuccess(res, employee, 'Employee created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateEmployeeHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const input = UpdateEmployeeSchema.parse(req.body);
    const updated = await employeeService.updateEmployee(id, input);
    sendSuccess(res, updated, 'Employee updated successfully');
  } catch (error) {
    next(error);
  }
};

export const getEmployeeHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const employee = await employeeService.getEmployee(id);
    if (!employee) {
      sendError(res, { code: 'NOT_FOUND', message: 'Employee not found' }, 404);
      return;
    }
    sendSuccess(res, employee);
  } catch (error) {
    next(error);
  }
};

export const listEmployeesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = ListEmployeesQuerySchema.parse(req.query);
    const result = await employeeService.listEmployees(query);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const deactivateEmployeeHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const updated = await employeeService.deactivateEmployee(id);
    sendSuccess(res, updated, 'Employee deactivated successfully');
  } catch (error) {
    next(error);
  }
};

// ─── Attendance Handlers ──────────────────────────────────────────────────────
export const recordAttendanceHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = RecordAttendanceItemSchema.parse(req.body);
    const markedById = req.user?.id;
    const result = await employeeService.recordAttendance(input, markedById);
    sendSuccess(res, result, 'Attendance recorded successfully');
  } catch (error) {
    next(error);
  }
};

export const batchRecordAttendanceHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = BatchAttendanceSchema.parse(req.body);
    const markedById = req.user?.id;
    const result = await employeeService.batchRecordAttendance(input, markedById);
    sendSuccess(res, result, `Recorded attendance for ${result.updatedCount} employees`);
  } catch (error) {
    next(error);
  }
};

export const listAttendanceHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = ListAttendanceQuerySchema.parse(req.query);
    const result = await employeeService.listAttendance(query);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

// ─── Leave Handlers ───────────────────────────────────────────────────────────
export const accrueMonthlyLeaveHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = AccrueMonthlyLeaveSchema.parse(req.body);
    const recordedById = req.user?.id;
    const result = await employeeService.accrueMonthlyLeave(input, recordedById);
    sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
};

export const adjustLeaveHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.params.id as string;
    const input = AdjustLeaveSchema.parse(req.body);
    const recordedById = req.user?.id;
    const result = await employeeService.adjustLeave(employeeId, input, recordedById);
    sendSuccess(res, result, 'Leave adjusted successfully');
  } catch (error) {
    next(error);
  }
};

export const getLeaveLedgerHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.params.id as string;
    const result = await employeeService.getLeaveLedger(employeeId);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

// ─── Advance Handlers ─────────────────────────────────────────────────────────
export const createAdvanceHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CreateAdvanceSchema.parse(req.body);
    const createdById = req.user?.id;
    const result = await employeeService.createAdvance(input, createdById);
    sendSuccess(res, result, 'Advance created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateAdvanceHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const input = UpdateAdvanceSchema.parse(req.body);
    const result = await employeeService.updateAdvance(id, input);
    sendSuccess(res, result, 'Advance updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteAdvanceHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    await employeeService.deleteAdvance(id);
    sendSuccess(res, { success: true }, 'Advance deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const listAdvancesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = ListAdvancesQuerySchema.parse(req.query);
    const result = await employeeService.listAdvances(query);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

// ─── Deduction Handlers ───────────────────────────────────────────────────────
export const createDeductionHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CreateDeductionSchema.parse(req.body);
    const createdById = req.user?.id;
    const result = await employeeService.createDeduction(input, createdById);
    sendSuccess(res, result, 'Deduction created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateDeductionHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const input = UpdateDeductionSchema.parse(req.body);
    const result = await employeeService.updateDeduction(id, input);
    sendSuccess(res, result, 'Deduction updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteDeductionHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    await employeeService.deleteDeduction(id);
    sendSuccess(res, { success: true }, 'Deduction deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const listDeductionsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = ListDeductionsQuerySchema.parse(req.query);
    const result = await employeeService.listDeductions(query);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

// ─── Payroll Handlers ─────────────────────────────────────────────────────────
export const calculatePayrollHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CalculatePayrollSchema.parse(req.body);
    const calculatedById = req.user?.id;
    const result = await employeeService.calculatePayroll(input, calculatedById);
    sendSuccess(res, result, `Payroll calculation completed for ${result.length} employee(s)`);
  } catch (error) {
    next(error);
  }
};

export const listPayrollRunsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = ListPayrollQuerySchema.parse(req.query);
    const result = await employeeService.listPayrollRuns(query);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const finalizePayrollHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const finalizedById = req.user?.id;
    const result = await employeeService.finalizePayroll(id, finalizedById);
    sendSuccess(res, result, 'Payroll finalized and deductions locked successfully');
  } catch (error) {
    next(error);
  }
};

export const markPayrollPaidHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const input = MarkPayrollPaidSchema.parse(req.body);
    const superAdminId = req.user?.id;
    const result = await employeeService.markPayrollPaid(id, input, superAdminId);
    sendSuccess(res, result, 'Payroll marked as PAID and payslip advice dispatched via email');
  } catch (error) {
    next(error);
  }
};

export const downloadPayslipPdfHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { buffer, filename } = await employeeService.getPayslipPdfBuffer(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

export const resendPayslipEmailHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const body = ResendPayslipEmailSchema.safeParse(req.body);
    const recipientEmail = body.success ? body.data.recipientEmail : undefined;
    const success = await employeeService.dispatchPayslipEmail(id, recipientEmail);
    if (success) {
      sendSuccess(res, { success: true }, 'Payslip email dispatched successfully to employee');
    } else {
      sendError(
        res,
        {
          code: 'EMAIL_DISPATCH_FAILED',
          message: 'Failed to dispatch payslip email. Please check recipient email or mail credentials.',
        },
        500
      );
    }
  } catch (error) {
    next(error);
  }
};
