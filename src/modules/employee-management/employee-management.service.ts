import prisma from '../../config/database';
import { logger } from '../../config/logger';
import { sendMail } from '../../utils/email.utils';
import { generateEmployeePayslipPdf } from './employee-payslip-pdf.service';
import {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  ListEmployeesQuery,
  RecordAttendanceItemInput,
  BatchAttendanceInput,
  ListAttendanceQuery,
  AdjustLeaveInput,
  AccrueMonthlyLeaveInput,
  CreateAdvanceInput,
  UpdateAdvanceInput,
  ListAdvancesQuery,
  CreateDeductionInput,
  UpdateDeductionInput,
  ListDeductionsQuery,
  CalculatePayrollInput,
  MarkPayrollPaidInput,
  ListPayrollQuery,
} from './employee-management.schema';
import { Prisma } from '@prisma/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getYearMonthString(year: number, month: number): string {
  return `${year}${String(month).padStart(2, '0')}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function countSundaysInMonth(year: number, month: number): number {
  const totalDays = getDaysInMonth(year, month);
  let sundays = 0;
  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(year, month - 1, day);
    if (d.getDay() === 0) sundays++;
  }
  return sundays;
}

// ─── Sequence Generator ───────────────────────────────────────────────────────
/**
 * Auto-generates atomic sequential Employee ID:
 * Format: PPSE + YYYYMM + 001 (e.g. PPSE202609001)
 * Defaults to monthly reset (configurable).
 */
export async function generateEmployeeId(date = new Date()): Promise<string> {
  const ym = getYearMonthString(date.getFullYear(), date.getMonth() + 1);
  const seq = await prisma.employeeIdSequence.upsert({
    where: { yearMonth: ym },
    create: { yearMonth: ym, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return `PPSE${ym}${String(seq.lastNumber).padStart(3, '0')}`;
}

// ─── Master Data Services ─────────────────────────────────────────────────────
export async function createEmployee(data: CreateEmployeeInput, _createdById?: string) {
  const employeeId = await generateEmployeeId(new Date(data.joiningDate));

  const employee = await prisma.employee.create({
    data: {
      employeeId,
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone.trim(),
      address: data.address.trim(),
      governmentIdType: data.governmentIdType,
      governmentIdNumber: data.governmentIdNumber.trim().toUpperCase(),
      bankAccountNumber: data.bankAccountNumber.trim(),
      bankIfsc: data.bankIfsc.trim().toUpperCase(),
      bankName: data.bankName.trim(),
      bankAccountHolder: data.bankAccountHolder.trim(),
      designation: data.designation.trim(),
      department: data.department.trim(),
      responsibilities: data.responsibilities?.trim() || null,
      monthlyCtc: new Prisma.Decimal(data.monthlyCtc),
      joiningDate: new Date(data.joiningDate),
      status: data.status,
      clBalance: new Prisma.Decimal(0),
      elBalance: new Prisma.Decimal(0),
    },
  });

  logger.info(`[Employee] Registered new employee ${employee.name} (${employee.employeeId})`);
  return employee;
}

export async function updateEmployee(id: string, data: UpdateEmployeeInput) {
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.email !== undefined) updateData.email = data.email.trim().toLowerCase();
  if (data.phone !== undefined) updateData.phone = data.phone.trim();
  if (data.address !== undefined) updateData.address = data.address.trim();
  if (data.governmentIdType !== undefined) updateData.governmentIdType = data.governmentIdType;
  if (data.governmentIdNumber !== undefined) updateData.governmentIdNumber = data.governmentIdNumber.trim().toUpperCase();
  if (data.bankAccountNumber !== undefined) updateData.bankAccountNumber = data.bankAccountNumber.trim();
  if (data.bankIfsc !== undefined) updateData.bankIfsc = data.bankIfsc.trim().toUpperCase();
  if (data.bankName !== undefined) updateData.bankName = data.bankName.trim();
  if (data.bankAccountHolder !== undefined) updateData.bankAccountHolder = data.bankAccountHolder.trim();
  if (data.designation !== undefined) updateData.designation = data.designation.trim();
  if (data.department !== undefined) updateData.department = data.department.trim();
  if (data.responsibilities !== undefined) updateData.responsibilities = data.responsibilities?.trim() || null;
  if (data.monthlyCtc !== undefined) updateData.monthlyCtc = new Prisma.Decimal(data.monthlyCtc);
  if (data.joiningDate !== undefined) updateData.joiningDate = new Date(data.joiningDate);
  if (data.status !== undefined) updateData.status = data.status;

  return await prisma.employee.update({
    where: { id },
    data: updateData,
  });
}

export async function getEmployee(id: string) {
  return await prisma.employee.findUnique({
    where: { id },
    include: {
      advances: { orderBy: { createdAt: 'desc' }, take: 5 },
      deductions: { orderBy: { createdAt: 'desc' }, take: 5 },
      leaveLedgers: { orderBy: { createdAt: 'desc' }, take: 10 },
      payrollRuns: { orderBy: { createdAt: 'desc' }, take: 6 },
    },
  });
}

export async function listEmployees(query: ListEmployeesQuery) {
  const { search, department, status, page, limit } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.EmployeeWhereInput = {};
  if (status) where.status = status;
  if (department) where.department = { equals: department, mode: 'insensitive' };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { employeeId: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { designation: { contains: search, mode: 'insensitive' } },
      { department: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    items,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function deactivateEmployee(id: string) {
  return await prisma.employee.update({
    where: { id },
    data: { status: 'INACTIVE' },
  });
}

// ─── Attendance Services ──────────────────────────────────────────────────────
export async function recordAttendance(data: RecordAttendanceItemInput, markedById?: string) {
  const dateObj = new Date(data.date);
  const isSunday = dateObj.getDay() === 0;

  // Fast path: If neither the current attendance nor the new status involves CL/EL,
  // execute direct upsert in a single roundtrip without extra employee queries.
  const involvesLeave = data.status === 'CL' || data.status === 'EL';

  if (!involvesLeave) {
    const existing = await prisma.employeeAttendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: data.employeeId,
          date: dateObj,
        },
      },
      select: { status: true },
    });

    if (existing && (existing.status === 'CL' || existing.status === 'EL')) {
      // Must refund previous leave
      const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
      if (employee) {
        if (existing.status === 'CL') {
          const newCl = Number(employee.clBalance) + 1;
          await prisma.employee.update({ where: { id: data.employeeId }, data: { clBalance: newCl } });
          await prisma.employeeLeaveLedger.create({
            data: {
              employeeId: data.employeeId,
              leaveType: 'CL',
              transactionType: 'ADJUSTMENT',
              amount: new Prisma.Decimal(1),
              balanceAfter: new Prisma.Decimal(newCl),
              month: dateObj.getMonth() + 1,
              year: dateObj.getFullYear(),
              reason: `Refund 1 CL due to attendance status change from CL to ${data.status} on ${data.date}`,
              recordedById: markedById,
            },
          });
        } else if (existing.status === 'EL') {
          const newEl = Number(employee.elBalance) + 1;
          await prisma.employee.update({ where: { id: data.employeeId }, data: { elBalance: newEl } });
          await prisma.employeeLeaveLedger.create({
            data: {
              employeeId: data.employeeId,
              leaveType: 'EL',
              transactionType: 'ADJUSTMENT',
              amount: new Prisma.Decimal(1),
              balanceAfter: new Prisma.Decimal(newEl),
              month: dateObj.getMonth() + 1,
              year: dateObj.getFullYear(),
              reason: `Refund 1 EL due to attendance status change from EL to ${data.status} on ${data.date}`,
              recordedById: markedById,
            },
          });
        }
      }
    }

    return await prisma.employeeAttendance.upsert({
      where: {
        employeeId_date: {
          employeeId: data.employeeId,
          date: dateObj,
        },
      },
      create: {
        employeeId: data.employeeId,
        date: dateObj,
        status: data.status,
        isSunday,
        isSundayOverride: data.isSundayOverride || false,
        overtimeHours: new Prisma.Decimal(data.overtimeHours || 0),
        notes: data.notes || null,
        markedById,
      },
      update: {
        status: data.status,
        isSunday,
        isSundayOverride: data.isSundayOverride || false,
        overtimeHours: new Prisma.Decimal(data.overtimeHours || 0),
        notes: data.notes || null,
        markedById,
      },
    });
  }

  // Slow path: only runs when new status is CL or EL
  const existing = await prisma.employeeAttendance.findUnique({
    where: {
      employeeId_date: {
        employeeId: data.employeeId,
        date: dateObj,
      },
    },
  });

  const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
  if (!employee) throw new Error('Employee not found');

  if (existing?.status !== data.status) {
    if (existing?.status === 'CL') {
      const newCl = Number(employee.clBalance) + 1;
      await prisma.employee.update({
        where: { id: data.employeeId },
        data: { clBalance: newCl },
      });
      await prisma.employeeLeaveLedger.create({
        data: {
          employeeId: data.employeeId,
          leaveType: 'CL',
          transactionType: 'ADJUSTMENT',
          amount: new Prisma.Decimal(1),
          balanceAfter: new Prisma.Decimal(newCl),
          month: dateObj.getMonth() + 1,
          year: dateObj.getFullYear(),
          reason: `Refund 1 CL due to attendance status change from CL to ${data.status} on ${data.date}`,
          recordedById: markedById,
        },
      });
    }
    if (existing?.status === 'EL') {
      const newEl = Number(employee.elBalance) + 1;
      await prisma.employee.update({
        where: { id: data.employeeId },
        data: { elBalance: newEl },
      });
      await prisma.employeeLeaveLedger.create({
        data: {
          employeeId: data.employeeId,
          leaveType: 'EL',
          transactionType: 'ADJUSTMENT',
          amount: new Prisma.Decimal(1),
          balanceAfter: new Prisma.Decimal(newEl),
          month: dateObj.getMonth() + 1,
          year: dateObj.getFullYear(),
          reason: `Refund 1 EL due to attendance status change from EL to ${data.status} on ${data.date}`,
          recordedById: markedById,
        },
      });
    }

    if (data.status === 'CL') {
      const newCl = Math.max(0, Number(employee.clBalance) - 1);
      await prisma.employee.update({
        where: { id: data.employeeId },
        data: { clBalance: newCl },
      });
      await prisma.employeeLeaveLedger.create({
        data: {
          employeeId: data.employeeId,
          leaveType: 'CL',
          transactionType: 'USAGE',
          amount: new Prisma.Decimal(-1),
          balanceAfter: new Prisma.Decimal(newCl),
          month: dateObj.getMonth() + 1,
          year: dateObj.getFullYear(),
          reason: `Casual Leave consumed for attendance on ${data.date}`,
          recordedById: markedById,
        },
      });
    }
    if (data.status === 'EL') {
      const newEl = Math.max(0, Number(employee.elBalance) - 1);
      await prisma.employee.update({
        where: { id: data.employeeId },
        data: { elBalance: newEl },
      });
      await prisma.employeeLeaveLedger.create({
        data: {
          employeeId: data.employeeId,
          leaveType: 'EL',
          transactionType: 'USAGE',
          amount: new Prisma.Decimal(-1),
          balanceAfter: new Prisma.Decimal(newEl),
          month: dateObj.getMonth() + 1,
          year: dateObj.getFullYear(),
          reason: `Earned Leave consumed for attendance on ${data.date}`,
          recordedById: markedById,
        },
      });
    }
  }

  return await prisma.employeeAttendance.upsert({
    where: {
      employeeId_date: {
        employeeId: data.employeeId,
        date: dateObj,
      },
    },
    create: {
      employeeId: data.employeeId,
      date: dateObj,
      status: data.status,
      isSunday,
      isSundayOverride: data.isSundayOverride || false,
      overtimeHours: new Prisma.Decimal(data.overtimeHours || 0),
      notes: data.notes || null,
      markedById,
    },
    update: {
      status: data.status,
      isSunday,
      isSundayOverride: data.isSundayOverride || false,
      overtimeHours: new Prisma.Decimal(data.overtimeHours || 0),
      notes: data.notes || null,
      markedById,
    },
  });
}

export async function batchRecordAttendance(data: BatchAttendanceInput, markedById?: string) {
  // Execute all operations concurrently via Promise.all for high performance
  const promises = data.records.map((item) =>
    recordAttendance(
      {
        employeeId: item.employeeId,
        date: data.date,
        status: item.status,
        isSundayOverride: item.isSundayOverride,
        overtimeHours: item.overtimeHours,
        notes: item.notes,
      },
      markedById
    )
  );
  const records = await Promise.all(promises);
  return { updatedCount: records.length, records };
}

export async function listAttendance(query: ListAttendanceQuery) {
  const { month, year, employeeId } = query;
  const startDate = new Date(year, month - 1, 1);
  const totalDays = getDaysInMonth(year, month);
  const endDate = new Date(year, month - 1, totalDays);

  const where: Prisma.EmployeeAttendanceWhereInput = {
    date: {
      gte: startDate,
      lte: endDate,
    },
  };
  if (employeeId) where.employeeId = employeeId;

  const records = await prisma.employeeAttendance.findMany({
    where,
    orderBy: { date: 'asc' },
    include: {
      employee: {
        select: {
          id: true,
          employeeId: true,
          name: true,
          department: true,
          designation: true,
        },
      },
    },
  });

  return {
    month,
    year,
    totalDays,
    records,
  };
}

// ─── Leave Ledger Services ────────────────────────────────────────────────────
export async function accrueMonthlyLeave(input: AccrueMonthlyLeaveInput, recordedById?: string) {
  const { month, year } = input;
  const activeEmployees = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
  });

  let clAccruedCount = 0;
  let elAccruedCount = 0;

  for (const emp of activeEmployees) {
    // Check if CL already accrued for this month & year
    const existingCl = await prisma.employeeLeaveLedger.findFirst({
      where: {
        employeeId: emp.id,
        leaveType: 'CL',
        transactionType: 'ACCRUAL',
        month,
        year,
      },
    });

    if (!existingCl) {
      const updatedCl = Number(emp.clBalance) + 1.0;
      await prisma.employee.update({
        where: { id: emp.id },
        data: { clBalance: updatedCl },
      });
      await prisma.employeeLeaveLedger.create({
        data: {
          employeeId: emp.id,
          leaveType: 'CL',
          transactionType: 'ACCRUAL',
          amount: new Prisma.Decimal(1.0),
          balanceAfter: new Prisma.Decimal(updatedCl),
          month,
          year,
          reason: `Automatic monthly Casual Leave accrual (+1.00) for ${month}/${year}`,
          recordedById,
        },
      });
      clAccruedCount++;
    }

    // Check if EL already accrued for this month & year (+0.25/month = 1 day every 4 months)
    const existingEl = await prisma.employeeLeaveLedger.findFirst({
      where: {
        employeeId: emp.id,
        leaveType: 'EL',
        transactionType: 'ACCRUAL',
        month,
        year,
      },
    });

    if (!existingEl) {
      const updatedEl = Number(emp.elBalance) + 0.25;
      await prisma.employee.update({
        where: { id: emp.id },
        data: { elBalance: updatedEl },
      });
      await prisma.employeeLeaveLedger.create({
        data: {
          employeeId: emp.id,
          leaveType: 'EL',
          transactionType: 'ACCRUAL',
          amount: new Prisma.Decimal(0.25),
          balanceAfter: new Prisma.Decimal(updatedEl),
          month,
          year,
          reason: `Automatic monthly Earned Leave accrual (+0.25) for ${month}/${year}`,
          recordedById,
        },
      });
      elAccruedCount++;
    }
  }

  return {
    month,
    year,
    totalEmployees: activeEmployees.length,
    clAccruedCount,
    elAccruedCount,
    message: `Leave accrual complete for ${month}/${year}. Added 1 CL to ${clAccruedCount} employees, 0.25 EL to ${elAccruedCount} employees.`,
  };
}

export async function adjustLeave(employeeId: string, input: AdjustLeaveInput, recordedById?: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error('Employee not found');

  const currentBal = input.leaveType === 'CL' ? Number(employee.clBalance) : Number(employee.elBalance);

  // Compute signed delta based on transactionType:
  // USAGE (Debit): Must ALWAYS deduct from balance -> negative delta
  // ACCRUAL (Credit): Must ALWAYS add to balance -> positive delta
  // ADJUSTMENT: Use signed amount as provided
  let delta = input.amount;
  if (input.transactionType === 'USAGE') {
    delta = -Math.abs(input.amount);
  } else if (input.transactionType === 'ACCRUAL') {
    delta = Math.abs(input.amount);
  }

  const newBal = Math.max(0, currentBal + delta);

  const updatedEmployee = await prisma.employee.update({
    where: { id: employeeId },
    data: input.leaveType === 'CL' ? { clBalance: newBal } : { elBalance: newBal },
    select: { id: true, employeeId: true, name: true, clBalance: true, elBalance: true },
  });

  const entry = await prisma.employeeLeaveLedger.create({
    data: {
      employeeId,
      leaveType: input.leaveType,
      transactionType: input.transactionType,
      amount: new Prisma.Decimal(delta),
      balanceAfter: new Prisma.Decimal(newBal),
      month: input.month,
      year: input.year,
      reason: input.reason.trim(),
      recordedById,
    },
  });

  return {
    entry,
    currentBalance: newBal,
    previousBalance: currentBal,
    delta,
    employee: updatedEmployee,
  };
}

export async function getLeaveLedger(employeeId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, employeeId: true, name: true, clBalance: true, elBalance: true },
  });
  if (!employee) throw new Error('Employee not found');

  const history = await prisma.employeeLeaveLedger.findMany({
    where: { employeeId },
    orderBy: { createdAt: 'desc' },
  });

  return {
    employee,
    history,
  };
}

// ─── Advances & Deductions Services ──────────────────────────────────────────
export async function createAdvance(data: CreateAdvanceInput, createdById?: string) {
  return await prisma.employeeAdvance.create({
    data: {
      employeeId: data.employeeId,
      amount: new Prisma.Decimal(data.amount),
      reason: data.reason.trim(),
      advanceDate: data.advanceDate ? new Date(data.advanceDate) : new Date(),
      recoveryMonth: data.recoveryMonth,
      recoveryYear: data.recoveryYear,
      createdById,
    },
    include: {
      employee: {
        select: { id: true, employeeId: true, name: true, department: true },
      },
    },
  });
}

export async function updateAdvance(id: string, data: UpdateAdvanceInput) {
  const updateData: any = {};
  if (data.amount !== undefined) updateData.amount = new Prisma.Decimal(data.amount);
  if (data.reason !== undefined) updateData.reason = data.reason.trim();
  if (data.advanceDate !== undefined) updateData.advanceDate = new Date(data.advanceDate);
  if (data.recoveryMonth !== undefined) updateData.recoveryMonth = data.recoveryMonth;
  if (data.recoveryYear !== undefined) updateData.recoveryYear = data.recoveryYear;
  if (data.isRecovered !== undefined) {
    updateData.isRecovered = data.isRecovered;
    updateData.recoveredAt = data.isRecovered ? new Date() : null;
  }

  return await prisma.employeeAdvance.update({
    where: { id },
    data: updateData,
    include: {
      employee: { select: { id: true, employeeId: true, name: true } },
    },
  });
}

export async function deleteAdvance(id: string) {
  return await prisma.employeeAdvance.delete({ where: { id } });
}

export async function listAdvances(query: ListAdvancesQuery) {
  const where: Prisma.EmployeeAdvanceWhereInput = {};
  if (query.employeeId) where.employeeId = query.employeeId;
  if (query.recoveryMonth) where.recoveryMonth = query.recoveryMonth;
  if (query.recoveryYear) where.recoveryYear = query.recoveryYear;
  if (query.isRecovered !== undefined) where.isRecovered = query.isRecovered;

  return await prisma.employeeAdvance.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      employee: { select: { id: true, employeeId: true, name: true, department: true } },
    },
  });
}

export async function createDeduction(data: CreateDeductionInput, createdById?: string) {
  return await prisma.employeeDeduction.create({
    data: {
      employeeId: data.employeeId,
      amount: new Prisma.Decimal(data.amount),
      reason: data.reason.trim(),
      applyMonth: data.applyMonth,
      applyYear: data.applyYear,
      createdById,
    },
    include: {
      employee: {
        select: { id: true, employeeId: true, name: true, department: true },
      },
    },
  });
}

export async function updateDeduction(id: string, data: UpdateDeductionInput) {
  const updateData: any = {};
  if (data.amount !== undefined) updateData.amount = new Prisma.Decimal(data.amount);
  if (data.reason !== undefined) updateData.reason = data.reason.trim();
  if (data.applyMonth !== undefined) updateData.applyMonth = data.applyMonth;
  if (data.applyYear !== undefined) updateData.applyYear = data.applyYear;
  if (data.isApplied !== undefined) {
    updateData.isApplied = data.isApplied;
    updateData.appliedAt = data.isApplied ? new Date() : null;
  }

  return await prisma.employeeDeduction.update({
    where: { id },
    data: updateData,
    include: {
      employee: { select: { id: true, employeeId: true, name: true } },
    },
  });
}

export async function deleteDeduction(id: string) {
  return await prisma.employeeDeduction.delete({ where: { id } });
}

export async function listDeductions(query: ListDeductionsQuery) {
  const where: Prisma.EmployeeDeductionWhereInput = {};
  if (query.employeeId) where.employeeId = query.employeeId;
  if (query.applyMonth) where.applyMonth = query.applyMonth;
  if (query.applyYear) where.applyYear = query.applyYear;
  if (query.isApplied !== undefined) where.isApplied = query.isApplied;

  return await prisma.employeeDeduction.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      employee: { select: { id: true, employeeId: true, name: true, department: true } },
    },
  });
}

// ─── Payroll Calculation Engine ───────────────────────────────────────────────
/**
 * Calculates payroll according to PRC Hardware HR specifications:
 *
 * Total Calendar Days: Days in the target month (e.g. 30 in September)
 * Default Sundays: Number of Sundays in target month (e.g. 4)
 * Admin-Approved Sundays: Sundays where isSundayOverride = true
 * Payable Days = Total Calendar Days - Default Sundays + Admin-Approved Sundays
 * Per-Day Rate = Monthly CTC / Payable Days
 *
 * Paid Days = Present Days + CL Days + EL Days + (0.5 * Half Days) + Admin-Approved Sundays
 * OT Rate = Per-Day Rate / Standard Hours (8)
 * OT Pay = Total Overtime Hours * OT Rate
 * Gross Salary = (Per-Day Rate * Paid Days) + OT Pay
 * Net Salary = Gross Salary - Pending Deductions - Pending Advances
 */
export async function calculateEmployeeMonthlyPayroll(
  employee: any,
  month: number,
  year: number,
  calculatedById?: string,
  previewOnly = false
) {
  const totalCalendarDays = getDaysInMonth(year, month);
  const sundaysCount = countSundaysInMonth(year, month);

  // Fetch attendance records for this month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month - 1, totalCalendarDays);

  const attendances = await prisma.employeeAttendance.findMany({
    where: {
      employeeId: employee.id,
      date: { gte: startDate, lte: endDate },
    },
  });

  let presentDays = 0;
  let clDays = 0;
  let elDays = 0;
  let halfDays = 0;
  let unpaidDays = 0;
  let approvedSundays = 0;
  let overtimeHours = 0;

  for (const att of attendances) {
    overtimeHours += Number(att.overtimeHours || 0);

    if (att.isSunday) {
      if (att.isSundayOverride) {
        approvedSundays++;
      }
      // Sunday is excluded from normal weekday status counts
      continue;
    }

    switch (att.status) {
      case 'PRESENT':
        presentDays += 1;
        break;
      case 'CL':
        clDays += 1;
        break;
      case 'EL':
        elDays += 1;
        break;
      case 'HALF_DAY':
        halfDays += 1;
        break;
      case 'UL':
      case 'LEAVE':
        unpaidDays += 1;
        break;
    }
  }

  // Formula Calculations
  const payableDays = Math.max(1, totalCalendarDays - sundaysCount + approvedSundays);
  const monthlyCtc = Number(employee.monthlyCtc || 0);
  const perDayRate = monthlyCtc / payableDays;

  // Paid Days = Present + CL + EL + 0.5 * HalfDay + ApprovedSundays
  const paidDays = presentDays + clDays + elDays + 0.5 * halfDays + approvedSundays;

  const standardHours = 8;
  const overtimeRate = perDayRate / standardHours;
  const overtimePay = overtimeHours * overtimeRate;

  const grossSalary = perDayRate * paidDays + overtimePay;

  // Fetch pending advances scheduled for recovery in this month
  const pendingAdvances = await prisma.employeeAdvance.findMany({
    where: {
      employeeId: employee.id,
      recoveryMonth: month,
      recoveryYear: year,
      isRecovered: false,
    },
  });
  const advanceDeduction = pendingAdvances.reduce((sum, adv) => sum + Number(adv.amount), 0);

  // Fetch pending deductions scheduled for this month
  const pendingDeductions = await prisma.employeeDeduction.findMany({
    where: {
      employeeId: employee.id,
      applyMonth: month,
      applyYear: year,
      isApplied: false,
    },
  });
  const otherDeductions = pendingDeductions.reduce((sum, ded) => sum + Number(ded.amount), 0);

  const netSalary = Math.max(0, grossSalary - advanceDeduction - otherDeductions);

  const breakdown = {
    employeeId: employee.id,
    month,
    year,
    monthlyCtc,
    totalCalendarDays,
    sundaysCount,
    approvedSundays,
    payableDays: Number(payableDays.toFixed(2)),
    perDayRate: Number(perDayRate.toFixed(2)),
    presentDays,
    clDays,
    elDays,
    halfDays,
    unpaidDays,
    paidDays: Number(paidDays.toFixed(2)),
    overtimeHours: Number(overtimeHours.toFixed(2)),
    overtimeRate: Number(overtimeRate.toFixed(2)),
    overtimePay: Number(overtimePay.toFixed(2)),
    grossSalary: Number(grossSalary.toFixed(2)),
    advanceDeduction: Number(advanceDeduction.toFixed(2)),
    otherDeductions: Number(otherDeductions.toFixed(2)),
    deductionSummary: {
      advances: pendingAdvances.map((a) => ({ id: a.id, amount: Number(a.amount), reason: a.reason })),
      deductions: pendingDeductions.map((d) => ({ id: d.id, amount: Number(d.amount), reason: d.reason })),
    },
    netSalary: Number(netSalary.toFixed(2)),
  };

  if (previewOnly) {
    return {
      ...breakdown,
      status: 'DRAFT',
      employee: {
        id: employee.id,
        employeeId: employee.employeeId,
        name: employee.name,
        department: employee.department,
        designation: employee.designation,
        email: employee.email,
        phone: employee.phone,
      },
    };
  }

  // Upsert payroll run in database
  const run = await prisma.employeePayrollRun.upsert({
    where: {
      employeeId_year_month: {
        employeeId: employee.id,
        year,
        month,
      },
    },
    create: {
      employeeId: employee.id,
      month,
      year,
      monthlyCtc: new Prisma.Decimal(breakdown.monthlyCtc),
      totalCalendarDays: breakdown.totalCalendarDays,
      sundaysCount: breakdown.sundaysCount,
      approvedSundays: breakdown.approvedSundays,
      payableDays: new Prisma.Decimal(breakdown.payableDays),
      perDayRate: new Prisma.Decimal(breakdown.perDayRate),
      presentDays: new Prisma.Decimal(breakdown.presentDays),
      clDays: new Prisma.Decimal(breakdown.clDays),
      elDays: new Prisma.Decimal(breakdown.elDays),
      halfDays: new Prisma.Decimal(breakdown.halfDays),
      unpaidDays: new Prisma.Decimal(breakdown.unpaidDays),
      paidDays: new Prisma.Decimal(breakdown.paidDays),
      overtimeHours: new Prisma.Decimal(breakdown.overtimeHours),
      overtimeRate: new Prisma.Decimal(breakdown.overtimeRate),
      overtimePay: new Prisma.Decimal(breakdown.overtimePay),
      grossSalary: new Prisma.Decimal(breakdown.grossSalary),
      advanceDeduction: new Prisma.Decimal(breakdown.advanceDeduction),
      otherDeductions: new Prisma.Decimal(breakdown.otherDeductions),
      deductionSummary: breakdown.deductionSummary,
      netSalary: new Prisma.Decimal(breakdown.netSalary),
      status: 'DRAFT',
      createdById: calculatedById,
    },
    update: {
      monthlyCtc: new Prisma.Decimal(breakdown.monthlyCtc),
      totalCalendarDays: breakdown.totalCalendarDays,
      sundaysCount: breakdown.sundaysCount,
      approvedSundays: breakdown.approvedSundays,
      payableDays: new Prisma.Decimal(breakdown.payableDays),
      perDayRate: new Prisma.Decimal(breakdown.perDayRate),
      presentDays: new Prisma.Decimal(breakdown.presentDays),
      clDays: new Prisma.Decimal(breakdown.clDays),
      elDays: new Prisma.Decimal(breakdown.elDays),
      halfDays: new Prisma.Decimal(breakdown.halfDays),
      unpaidDays: new Prisma.Decimal(breakdown.unpaidDays),
      paidDays: new Prisma.Decimal(breakdown.paidDays),
      overtimeHours: new Prisma.Decimal(breakdown.overtimeHours),
      overtimeRate: new Prisma.Decimal(breakdown.overtimeRate),
      overtimePay: new Prisma.Decimal(breakdown.overtimePay),
      grossSalary: new Prisma.Decimal(breakdown.grossSalary),
      advanceDeduction: new Prisma.Decimal(breakdown.advanceDeduction),
      otherDeductions: new Prisma.Decimal(breakdown.otherDeductions),
      deductionSummary: breakdown.deductionSummary,
      netSalary: new Prisma.Decimal(breakdown.netSalary),
    },
    include: {
      employee: true,
    },
  });

  return run;
}

export async function calculatePayroll(input: CalculatePayrollInput, calculatedById?: string) {
  const { month, year, employeeId, previewOnly } = input;

  if (employeeId) {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new Error('Employee not found');
    const result = await calculateEmployeeMonthlyPayroll(employee, month, year, calculatedById, previewOnly);
    return [result];
  }

  const activeEmployees = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
  });

  const results = [];
  for (const emp of activeEmployees) {
    const res = await calculateEmployeeMonthlyPayroll(emp, month, year, calculatedById, previewOnly);
    results.push(res);
  }

  return results;
}

export async function listPayrollRuns(query: ListPayrollQuery) {
  const where: Prisma.EmployeePayrollRunWhereInput = {
    month: query.month,
    year: query.year,
  };
  if (query.employeeId) where.employeeId = query.employeeId;
  if (query.status) where.status = query.status;

  return await prisma.employeePayrollRun.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      employee: true,
    },
  });
}

export async function finalizePayroll(payrollRunId: string, finalizedById?: string) {
  const run = await prisma.employeePayrollRun.findUnique({
    where: { id: payrollRunId },
    include: { employee: true },
  });
  if (!run) throw new Error('Payroll run not found');

  // Mark advances as recovered
  await prisma.employeeAdvance.updateMany({
    where: {
      employeeId: run.employeeId,
      recoveryMonth: run.month,
      recoveryYear: run.year,
      isRecovered: false,
    },
    data: {
      isRecovered: true,
      recoveredAt: new Date(),
      payrollRunId: run.id,
    },
  });

  // Mark deductions as applied
  await prisma.employeeDeduction.updateMany({
    where: {
      employeeId: run.employeeId,
      applyMonth: run.month,
      applyYear: run.year,
      isApplied: false,
    },
    data: {
      isApplied: true,
      appliedAt: new Date(),
      payrollRunId: run.id,
    },
  });

  return await prisma.employeePayrollRun.update({
    where: { id: payrollRunId },
    data: {
      status: 'FINALIZED',
      finalizedById,
    },
    include: { employee: true },
  });
}

export async function markPayrollPaid(payrollRunId: string, input: MarkPayrollPaidInput, superAdminId?: string) {
  const run = await prisma.employeePayrollRun.findUnique({
    where: { id: payrollRunId },
    include: { employee: true },
  });
  if (!run) throw new Error('Payroll run not found');

  const updated = await prisma.employeePayrollRun.update({
    where: { id: payrollRunId },
    data: {
      status: 'PAID',
      paidAt: input.paidAt || new Date(),
      paymentMode: input.paymentMode,
      paymentReference: input.paymentReference || null,
      paymentNotes: input.paymentNotes || null,
      finalizedById: superAdminId,
    },
    include: { employee: true },
  });

  logger.info(`[Payroll] Marked run ${run.id} as PAID for ${run.employee.name} by superadmin ${superAdminId}`);

  // Automatically attempt payslip email dispatch
  try {
    await dispatchPayslipEmail(payrollRunId);
  } catch (emailErr: any) {
    logger.warn(`[Payroll] Automated payslip email dispatch failed: ${emailErr?.message || emailErr}`);
  }

  return updated;
}

// ─── PDF & Email Services ─────────────────────────────────────────────────────
export async function getPayslipPdfBuffer(payrollRunId: string): Promise<{ buffer: Buffer; filename: string }> {
  const run = await prisma.employeePayrollRun.findUnique({
    where: { id: payrollRunId },
    include: { employee: true },
  });
  if (!run) throw new Error('Payroll run record not found');

  const buffer = await generateEmployeePayslipPdf({
    payrollRun: {
      ...run,
      monthlyCtc: run.monthlyCtc.toString(),
      payableDays: run.payableDays.toString(),
      perDayRate: run.perDayRate.toString(),
      presentDays: run.presentDays.toString(),
      clDays: run.clDays.toString(),
      elDays: run.elDays.toString(),
      halfDays: run.halfDays.toString(),
      unpaidDays: run.unpaidDays.toString(),
      paidDays: run.paidDays.toString(),
      overtimeHours: run.overtimeHours.toString(),
      overtimeRate: run.overtimeRate.toString(),
      overtimePay: run.overtimePay.toString(),
      grossSalary: run.grossSalary.toString(),
      advanceDeduction: run.advanceDeduction.toString(),
      otherDeductions: run.otherDeductions.toString(),
      netSalary: run.netSalary.toString(),
    },
    employee: {
      employeeId: run.employee.employeeId,
      name: run.employee.name,
      email: run.employee.email,
      phone: run.employee.phone,
      designation: run.employee.designation,
      department: run.employee.department,
      joiningDate: run.employee.joiningDate,
      governmentIdType: run.employee.governmentIdType,
      governmentIdNumber: run.employee.governmentIdNumber,
      bankAccountNumber: run.employee.bankAccountNumber,
      bankIfsc: run.employee.bankIfsc,
      bankName: run.employee.bankName,
      bankAccountHolder: run.employee.bankAccountHolder,
      clBalance: run.employee.clBalance.toString(),
      elBalance: run.employee.elBalance.toString(),
    },
  });

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const filename = `Payslip-${run.employee.employeeId}-${monthNames[run.month - 1]}-${run.year}.pdf`;

  return { buffer, filename };
}

export async function dispatchPayslipEmail(payrollRunId: string, recipientEmail?: string): Promise<boolean> {
  const run = await prisma.employeePayrollRun.findUnique({
    where: { id: payrollRunId },
    include: { employee: true },
  });
  if (!run) throw new Error('Payroll run not found');

  const toEmail = recipientEmail || run.employee.email;
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const period = `${monthNames[run.month - 1]} ${run.year}`;

  try {
    const { buffer, filename } = await getPayslipPdfBuffer(payrollRunId);

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background: #0f172a; padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">PACIFIC PRODUCTS & SOLUTIONS</h1>
          <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 12px;">Corporate Compensation & Payroll Division</p>
        </div>
        
        <div style="padding: 24px;">
          <p style="font-size: 15px; color: #1e293b; margin-top: 0;">Dear <strong>${run.employee.name}</strong>,</p>
          <p style="font-size: 14px; color: #475569; line-height: 1.5;">
            Your salary payslip for <strong>${period}</strong> has been generated. Please find your official disbursement advice attached as a PDF document.
          </p>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>Employee ID:</strong></td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 600; text-align: right;">${run.employee.employeeId}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>Department:</strong></td>
                <td style="padding: 6px 0; color: #0f172a; text-align: right;">${run.employee.department}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>Pay Period:</strong></td>
                <td style="padding: 6px 0; color: #0f172a; text-align: right;">${period}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>Paid Days:</strong></td>
                <td style="padding: 6px 0; color: #0f172a; text-align: right;">${run.paidDays} / ${run.payableDays} Days</td>
              </tr>
              <tr style="border-top: 1px solid #e2e8f0;">
                <td style="padding: 8px 0; color: #0f172a; font-weight: 700; font-size: 14px;">Net Disbursed Salary:</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 700; font-size: 16px; text-align: right;">₹${Number(run.netSalary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
            The net amount is disbursed to your registered bank account (<strong>${run.employee.bankName} - ${run.employee.bankAccountNumber}</strong>).
          </p>
          <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">
            If you have any questions or notice any discrepancy regarding your attendance or calculations, please contact HR/Accounts at payroll@pacifichardware.com.
          </p>
        </div>

        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8;">
          This is an automated compensation advice from Pacific Products & Solutions. Please do not reply directly to this email.
        </div>
      </div>
    `;

    await sendMail({
      to: toEmail,
      subject: `Salary Payslip - ${period} - ${run.employee.name} (${run.employee.employeeId})`,
      html: emailHtml,
      attachments: [
        {
          filename,
          content: buffer,
          contentType: 'application/pdf',
        },
      ],
    });

    await prisma.employeePayrollRun.update({
      where: { id: payrollRunId },
      data: {
        emailSent: true,
        emailSentAt: new Date(),
        emailStatus: 'SENT',
        emailError: null,
      },
    });

    logger.info(`[Payroll Email] Successfully emailed payslip ${filename} to ${toEmail}`);
    return true;
  } catch (err: any) {
    logger.error(`[Payroll Email] Failed to email payslip to ${toEmail}: ${err?.message || err}`);
    await prisma.employeePayrollRun.update({
      where: { id: payrollRunId },
      data: {
        emailSent: false,
        emailStatus: 'FAILED',
        emailError: err?.message || String(err),
      },
    });
    return false;
  }
}
