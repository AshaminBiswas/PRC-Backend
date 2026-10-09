import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require('pdfmake');
import type { TDocumentDefinitions, TableCell, Alignment } from 'pdfmake/interfaces';
import { PACIFIC_RESTROOM_LOGO_DATA_URL } from '../../assets/logo.base64';

// ─── Font Configuration ───────────────────────────────────────────────────────
try {
  const pdfmakeDir = path.dirname(require.resolve('pdfmake/package.json'));
  pdfmake.addFonts({
    Roboto: {
      normal: path.join(pdfmakeDir, 'fonts/Roboto/Roboto-Regular.ttf'),
      bold: path.join(pdfmakeDir, 'fonts/Roboto/Roboto-Medium.ttf'),
      italics: path.join(pdfmakeDir, 'fonts/Roboto/Roboto-Italic.ttf'),
      bolditalics: path.join(pdfmakeDir, 'fonts/Roboto/Roboto-MediumItalic.ttf'),
    },
  });
} catch (e: any) {
  console.warn('[Attendance Report PDF Service] Font initialization warning:', e?.message || e);
}

// ─── Design Palette ───────────────────────────────────────────────────────────
const NAVY = '#0f172a';
const NAVY_DARK = '#0b1e38';
const EMERALD = '#047857';
const RED = '#dc2626';
const BLUE = '#2563eb';
const INDIGO = '#4f46e5';
const AMBER = '#d97706';
const GRAY = '#64748b';
const DARK_GRAY = '#1e293b';
const LIGHT_BG = '#f8fafc';
const BORDER_COLOR = '#cbd5e1';

// ─── Data Types ───────────────────────────────────────────────────────────────
export interface DailyAttendanceStatus {
  day: number;
  code: string; // 'P', 'DD', 'HD', 'H', 'CL', 'EL', 'A', 'WO', 'SW', '-'
  isSunday: boolean;
  isSundayOverride?: boolean;
  overtimeHours?: number;
}

export interface MonthlyAttendanceReportEmployeeItem {
  employeeId: string;
  name: string;
  department: string;
  designation: string;
  monthlyCtc: number;
  perDayRate?: number;
  dailyAttendance: DailyAttendanceStatus[];
  presentDays: number;
  doubleDutyDays: number;
  halfDays: number;
  holidayDays: number;
  paidLeaveDays: number; // CL + EL
  unpaidDays: number; // UL + LEAVE
  approvedSundays: number;
  paidDays: number;
  overtimeHours: number;
  overtimePay: number;
  advanceAmount: number;
  deductionAmount: number;
  grossSalary: number;
  netSalary: number;
}

export interface MonthlyAttendanceReportData {
  month: number;
  year: number;
  totalCalendarDays: number;
  sundaysCount: number;
  workingDays: number;
  filterLabel?: string;
  generatedAt: Date;
  generatedByName?: string;
  items: MonthlyAttendanceReportEmployeeItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatINR(value: number | string | null | undefined): string {
  const n = Number(value || 0);
  return `\u20B9${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return months[month - 1] || `Month ${month}`;
}

function makeCell(
  text: any,
  options: {
    bold?: boolean;
    align?: Alignment;
    color?: string;
    fillColor?: string;
    fontSize?: number;
    colSpan?: number;
    margin?: [number, number, number, number];
  } = {}
): TableCell {
  return {
    text,
    bold: options.bold ?? false,
    alignment: options.align || 'left',
    color: options.color || DARK_GRAY,
    fillColor: options.fillColor,
    fontSize: options.fontSize || 6.5,
    margin: options.margin || [1.5, 2, 1.5, 2],
    colSpan: options.colSpan,
  };
}

function getDailyStatusCodeInfo(code: string): {
  color: string;
  fillColor?: string;
  bold: boolean;
} {
  switch (code) {
    case 'P':
      return { color: '#047857', fillColor: '#ecfdf5', bold: true }; // Emerald
    case 'DD':
      return { color: '#0284c7', fillColor: '#e0f2fe', bold: true }; // Cyan/Blue
    case 'HD':
      return { color: '#b45309', fillColor: '#fffbeb', bold: true }; // Amber
    case 'H':
      return { color: '#4338ca', fillColor: '#e0e7ff', bold: true }; // Indigo
    case 'SW':
      return { color: '#92400e', fillColor: '#fef3c7', bold: true }; // Sunday Work Approved
    case 'CL':
    case 'EL':
      return { color: '#7e22ce', fillColor: '#f3e8ff', bold: true }; // Purple
    case 'WO':
      return { color: '#94a3b8', fillColor: '#f8fafc', bold: false }; // Slate
    case 'A':
      return { color: '#e11d48', fillColor: '#ffe4e6', bold: true }; // Rose
    default:
      return { color: '#cbd5e1', fillColor: undefined, bold: false }; // Hyphen
  }
}

/**
 * Generates an executive A4 Landscape Monthly Register PDF cleanly split across 2 dedicated parts:
 *   - PAGE 1: Part I — Daily Attendance Muster Roll (All calendar days 1 to 28/29/30/31 + Duty totals)
 *   - PAGE 2: Part II — Monthly Wages, Advances & Net Compensation Register (Employee identity repeated + Financial breakdown)
 */
export async function generateMonthlyAttendanceReportPdf(
  data: MonthlyAttendanceReportData
): Promise<Buffer> {
  const monthName = getMonthName(data.month);
  const payPeriod = `${monthName} ${data.year}`;

  // Accumulate totals across all employees
  let totPresent = 0;
  let totDoubleDuty = 0;
  let totHalf = 0;
  let totHoliday = 0;
  let totPaidLeaves = 0;
  let totUnpaid = 0;
  let totSundays = 0;
  let totPaidDays = 0;
  let totOtHours = 0;
  let totOtPay = 0;
  let totAdvances = 0;
  let totDeductions = 0;
  let totGross = 0;
  let totNet = 0;

  for (const item of data.items) {
    totPresent += Number(item.presentDays || 0);
    totDoubleDuty += Number(item.doubleDutyDays || 0);
    totHalf += Number(item.halfDays || 0);
    totHoliday += Number(item.holidayDays || 0);
    totPaidLeaves += Number(item.paidLeaveDays || 0);
    totUnpaid += Number(item.unpaidDays || 0);
    totSundays += Number(item.approvedSundays || 0);
    totPaidDays += Number(item.paidDays || 0);
    totOtHours += Number(item.overtimeHours || 0);
    totOtPay += Number(item.overtimePay || 0);
    totAdvances += Number(item.advanceAmount || 0);
    totDeductions += Number(item.deductionAmount || 0);
    totGross += Number(item.grossSalary || 0);
    totNet += Number(item.netSalary || 0);
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PART I: DAILY ATTENDANCE MUSTER ROLL TABLE (PAGES 1+)
  // ═════════════════════════════════════════════════════════════════════════════
  const musterTableBody: TableCell[][] = [];

  // Table 1 Header
  const dayOfWeekNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const musterHeaderRow: TableCell[] = [
    makeCell('#', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 6.5 }),
    makeCell('EMP ID', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 6.5 }),
    makeCell('EMPLOYEE NAME', { bold: true, align: 'left', fillColor: NAVY, color: '#ffffff', fontSize: 6.5 }),
    makeCell('DEPT / ROLE', { bold: true, align: 'left', fillColor: NAVY, color: '#ffffff', fontSize: 6.5 }),
  ];

  for (let d = 1; d <= data.totalCalendarDays; d++) {
    const dObj = new Date(data.year, data.month - 1, d);
    const isSun = dObj.getDay() === 0;
    const dayName = dayOfWeekNames[dObj.getDay()];
    musterHeaderRow.push(
      makeCell(`${d}\n${dayName}`, {
        bold: true,
        align: 'center',
        fillColor: isSun ? '#334155' : NAVY,
        color: isSun ? '#fca5a5' : '#ffffff',
        fontSize: 5,
        margin: [0.5, 2, 0.5, 2],
      })
    );
  }

  musterHeaderRow.push(
    makeCell('PRESENT\n(P)', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 6 }),
    makeCell('DOUBLE\nDUTY', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 6 }),
    makeCell('HALF\nDAY', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 6 }),
    makeCell('HOLIDAY\n(H)', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 6 }),
    makeCell('ABSENT\n(A)', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 6 }),
    makeCell('TOTAL PAID\nDAYS', { bold: true, align: 'center', fillColor: NAVY_DARK, color: '#38bdf8', fontSize: 6.5 })
  );
  musterTableBody.push(musterHeaderRow);

  // Table 1 Data Rows
  data.items.forEach((emp, idx) => {
    const isEven = idx % 2 === 0;
    const rowBg = isEven ? '#ffffff' : LIGHT_BG;

    const row: TableCell[] = [
      makeCell(`${idx + 1}`, { align: 'center', fillColor: rowBg, fontSize: 6.5 }),
      makeCell(emp.employeeId, { bold: true, align: 'center', color: NAVY, fillColor: rowBg, fontSize: 6.5 }),
      makeCell(emp.name, { bold: true, fillColor: rowBg, fontSize: 6.5, color: DARK_GRAY }),
      makeCell(`${emp.designation || '-'}\n(${emp.department || '-'})`, { color: GRAY, fillColor: rowBg, fontSize: 5.5 }),
    ];

    // Day-by-day attendance status cells
    for (let d = 1; d <= data.totalCalendarDays; d++) {
      const dayStatus = emp.dailyAttendance?.[d - 1];
      const code = dayStatus?.code || (dayStatus?.isSunday ? 'WO' : '-');
      const styling = getDailyStatusCodeInfo(code);

      row.push(
        makeCell(code, {
          align: 'center',
          bold: styling.bold,
          color: styling.color,
          fillColor: styling.fillColor || rowBg,
          fontSize: 6,
          margin: [0.5, 2, 0.5, 2],
        })
      );
    }

    // Attendance summary columns
    row.push(
      makeCell(`${emp.presentDays}`, { align: 'center', bold: true, color: EMERALD, fillColor: rowBg, fontSize: 7 }),
      makeCell(emp.doubleDutyDays > 0 ? `${emp.doubleDutyDays}` : '-', {
        align: 'center',
        bold: emp.doubleDutyDays > 0,
        color: emp.doubleDutyDays > 0 ? BLUE : GRAY,
        fillColor: rowBg,
        fontSize: 7,
      }),
      makeCell(emp.halfDays > 0 ? `${emp.halfDays}` : '-', {
        align: 'center',
        color: emp.halfDays > 0 ? AMBER : GRAY,
        fillColor: rowBg,
        fontSize: 7,
      }),
      makeCell(emp.holidayDays > 0 ? `${emp.holidayDays}` : '-', {
        align: 'center',
        bold: emp.holidayDays > 0,
        color: emp.holidayDays > 0 ? INDIGO : GRAY,
        fillColor: rowBg,
        fontSize: 7,
      }),
      makeCell(emp.unpaidDays > 0 ? `${emp.unpaidDays}` : '-', {
        align: 'center',
        bold: emp.unpaidDays > 0,
        color: emp.unpaidDays > 0 ? RED : GRAY,
        fillColor: rowBg,
        fontSize: 7,
      }),
      makeCell(`${emp.paidDays}`, { align: 'center', bold: true, color: NAVY, fillColor: rowBg, fontSize: 7.5 })
    );

    musterTableBody.push(row);
  });

  // Table 1 Totals Row
  const musterTotalsRow: TableCell[] = [
    makeCell('TOTALS', { colSpan: 4, bold: true, align: 'center', fillColor: '#f1f5f9', color: NAVY, fontSize: 6.5 }),
    makeCell('', {}),
    makeCell('', {}),
    makeCell('', {}),
  ];

  for (let d = 1; d <= data.totalCalendarDays; d++) {
    const dObj = new Date(data.year, data.month - 1, d);
    const isSun = dObj.getDay() === 0;
    const workingCount = data.items.filter((item) => {
      const code = item.dailyAttendance?.[d - 1]?.code;
      return code === 'P' || code === 'DD' || code === 'HD' || code === 'SW';
    }).length;

    if (isSun && workingCount === 0) {
      totalsCellForDay(musterTotalsRow, '-', GRAY);
    } else {
      totalsCellForDay(musterTotalsRow, `${workingCount}`, EMERALD);
    }
  }

  function totalsCellForDay(target: TableCell[], text: string, color: string) {
    target.push(
      makeCell(text, {
        bold: text !== '-',
        align: 'center',
        color,
        fillColor: '#f1f5f9',
        fontSize: 5.5,
        margin: [0.5, 2, 0.5, 2],
      })
    );
  }

  musterTotalsRow.push(
    makeCell(`${totPresent}`, { bold: true, align: 'center', fillColor: '#f1f5f9', color: EMERALD, fontSize: 7 }),
    makeCell(`${totDoubleDuty}`, { bold: true, align: 'center', fillColor: '#f1f5f9', color: BLUE, fontSize: 7 }),
    makeCell(`${totHalf}`, { bold: true, align: 'center', fillColor: '#f1f5f9', color: AMBER, fontSize: 7 }),
    makeCell(`${totHoliday}`, { bold: true, align: 'center', fillColor: '#f1f5f9', color: INDIGO, fontSize: 7 }),
    makeCell(`${totUnpaid}`, { bold: true, align: 'center', fillColor: '#f1f5f9', color: RED, fontSize: 7 }),
    makeCell(`${Number(totPaidDays.toFixed(1))}`, { bold: true, align: 'center', fillColor: '#f1f5f9', color: NAVY, fontSize: 7.5 })
  );
  musterTableBody.push(musterTotalsRow);

  // Compute Table 1 Column Widths
  const dayColWidth = data.totalCalendarDays <= 28 ? 14.5 : data.totalCalendarDays <= 30 ? 13.5 : 13.0;
  const dayWidths = Array(data.totalCalendarDays).fill(dayColWidth);
  const musterTableWidths = [
    16,  // #
    46,  // EMP ID
    88,  // EMPLOYEE NAME
    68,  // DEPT / ROLE
    ...dayWidths, // Daily attendance columns (1..totalCalendarDays)
    28,  // PRESENT (P)
    28,  // DOUBLE DUTY
    28,  // HALF DAY
    28,  // HOLIDAY (H)
    28,  // ABSENT (A)
    38,  // TOTAL PAID DAYS
  ];

  // ═════════════════════════════════════════════════════════════════════════════
  // PART II: MONTHLY WAGES & NET COMPENSATION REGISTER TABLE (PAGE 2)
  // ═════════════════════════════════════════════════════════════════════════════
  const wageTableBody: TableCell[][] = [];

  // Table 2 Header
  wageTableBody.push([
    makeCell('#', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 6.5 }),
    makeCell('EMP ID', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 6.5 }),
    makeCell('EMPLOYEE NAME', { bold: true, align: 'left', fillColor: NAVY, color: '#ffffff', fontSize: 6.5 }),
    makeCell('DEPARTMENT / DESIGNATION', { bold: true, align: 'left', fillColor: NAVY, color: '#ffffff', fontSize: 6.5 }),
    makeCell('MONTHLY CTC\n(\u20B9)', { bold: true, align: 'right', fillColor: NAVY, color: '#ffffff', fontSize: 6 }),
    makeCell('PER-DAY\nRATE (\u20B9)', { bold: true, align: 'right', fillColor: NAVY, color: '#ffffff', fontSize: 6 }),
    makeCell('PAID\nDAYS', { bold: true, align: 'center', fillColor: NAVY_DARK, color: '#38bdf8', fontSize: 6.5 }),
    makeCell('OT\nHRS', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 6 }),
    makeCell('OT PAY\n(\u20B9)', { bold: true, align: 'right', fillColor: NAVY, color: '#ffffff', fontSize: 6 }),
    makeCell('GROSS WAGE\n(\u20B9)', { bold: true, align: 'right', fillColor: NAVY, color: '#ffffff', fontSize: 6.5 }),
    makeCell('ADVANCES\n(\u20B9)', { bold: true, align: 'right', fillColor: NAVY, color: '#ffffff', fontSize: 6 }),
    makeCell('DEDUCT\n(\u20B9)', { bold: true, align: 'right', fillColor: NAVY, color: '#ffffff', fontSize: 6 }),
    makeCell('NET PAYABLE\n(\u20B9)', { bold: true, align: 'right', fillColor: NAVY_DARK, color: '#4ade80', fontSize: 7 }),
    makeCell('SIGNATURE / RECEIPT', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 6.5 }),
  ]);

  // Table 2 Data Rows
  data.items.forEach((emp, idx) => {
    const isEven = idx % 2 === 0;
    const rowBg = isEven ? '#ffffff' : LIGHT_BG;

    wageTableBody.push([
      makeCell(`${idx + 1}`, { align: 'center', fillColor: rowBg, fontSize: 6.5 }),
      makeCell(emp.employeeId, { bold: true, align: 'center', color: NAVY, fillColor: rowBg, fontSize: 6.5 }),
      makeCell(emp.name, { bold: true, fillColor: rowBg, fontSize: 7, color: DARK_GRAY }),
      makeCell(`${emp.designation || '-'}\n${emp.department || '-'}`, { color: GRAY, fillColor: rowBg, fontSize: 6 }),
      makeCell(formatINR(emp.monthlyCtc), { align: 'right', fillColor: rowBg, fontSize: 6.5 }),
      makeCell(emp.perDayRate ? formatINR(emp.perDayRate) : '-', { align: 'right', color: GRAY, fillColor: rowBg, fontSize: 6.5 }),
      makeCell(`${emp.paidDays}`, { align: 'center', bold: true, color: NAVY, fillColor: rowBg, fontSize: 7 }),
      makeCell(emp.overtimeHours > 0 ? `${emp.overtimeHours}h` : '-', {
        align: 'center',
        color: emp.overtimeHours > 0 ? EMERALD : GRAY,
        fillColor: rowBg,
        fontSize: 6.5,
      }),
      makeCell(emp.overtimePay > 0 ? formatINR(emp.overtimePay) : '-', {
        align: 'right',
        color: emp.overtimePay > 0 ? EMERALD : GRAY,
        fillColor: rowBg,
        fontSize: 6.5,
      }),
      makeCell(emp.grossSalary > 0 ? formatINR(emp.grossSalary) : '-', {
        align: 'right',
        bold: true,
        fillColor: rowBg,
        fontSize: 7,
      }),
      makeCell(emp.advanceAmount > 0 ? formatINR(emp.advanceAmount) : '-', {
        align: 'right',
        color: emp.advanceAmount > 0 ? RED : GRAY,
        fillColor: rowBg,
        fontSize: 6.5,
      }),
      makeCell(emp.deductionAmount > 0 ? formatINR(emp.deductionAmount) : '-', {
        align: 'right',
        color: emp.deductionAmount > 0 ? RED : GRAY,
        fillColor: rowBg,
        fontSize: 6.5,
      }),
      makeCell(emp.netSalary > 0 ? formatINR(emp.netSalary) : '-', {
        align: 'right',
        bold: true,
        color: EMERALD,
        fillColor: rowBg,
        fontSize: 7.5,
      }),
      makeCell('', { align: 'center', fillColor: rowBg }), // Space for signature / initials
    ]);
  });

  // Table 2 Totals Row
  wageTableBody.push([
    makeCell('TOTALS', { colSpan: 4, bold: true, align: 'center', fillColor: '#f1f5f9', color: NAVY, fontSize: 7 }),
    makeCell('', {}),
    makeCell('', {}),
    makeCell('', {}),
    makeCell('-', { align: 'right', color: GRAY, fillColor: '#f1f5f9', fontSize: 6.5 }),
    makeCell('-', { align: 'right', color: GRAY, fillColor: '#f1f5f9', fontSize: 6.5 }),
    makeCell(`${Number(totPaidDays.toFixed(1))}`, { bold: true, align: 'center', fillColor: '#f1f5f9', color: NAVY, fontSize: 7 }),
    makeCell(`${Number(totOtHours.toFixed(1))}h`, { bold: true, align: 'center', fillColor: '#f1f5f9', color: EMERALD, fontSize: 6.5 }),
    makeCell(formatINR(totOtPay), { bold: true, align: 'right', fillColor: '#f1f5f9', color: EMERALD, fontSize: 6.5 }),
    makeCell(formatINR(totGross), { bold: true, align: 'right', fillColor: '#f1f5f9', color: NAVY, fontSize: 7 }),
    makeCell(formatINR(totAdvances), { bold: true, align: 'right', fillColor: '#f1f5f9', color: RED, fontSize: 6.5 }),
    makeCell(formatINR(totDeductions), { bold: true, align: 'right', fillColor: '#f1f5f9', color: RED, fontSize: 6.5 }),
    makeCell(formatINR(totNet), { bold: true, align: 'right', fillColor: '#f1f5f9', color: EMERALD, fontSize: 8 }),
    makeCell('-', { align: 'center', color: GRAY, fillColor: '#f1f5f9', fontSize: 6.5 }),
  ]);

  const wageTableWidths = [
    18,  // #
    48,  // EMP ID
    105, // EMPLOYEE NAME
    95,  // DEPARTMENT / DESIGNATION
    52,  // MONTHLY CTC
    45,  // PER DAY RATE
    38,  // PAID DAYS
    30,  // OT HRS
    45,  // OT PAY
    62,  // GROSS WAGE
    55,  // ADVANCE
    48,  // DEDUCT
    68,  // NET PAYABLE
    90,  // SIGNATURE / RECEIPT
  ];

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [18, 14, 18, 16],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 6.5,
      color: DARK_GRAY,
    },
    footer: (currentPage: number, pageCount: number) => ({
      margin: [18, 0, 18, 0],
      columns: [
        {
          text: 'PRC Hardware Enterprise ERP — Confidential Monthly Attendance & Wage Register',
          fontSize: 6,
          color: GRAY,
        },
        {
          text: `Generated: ${formatDate(data.generatedAt)} | Page ${currentPage} of ${pageCount}`,
          alignment: 'right',
          fontSize: 6,
          color: GRAY,
        },
      ],
    }),
    content: [
      // ═════════════════════════════════════════════════════════════════════════
      // SECTION 1: ATTENDANCE MUSTER ROLL (PAGE 1)
      // ═════════════════════════════════════════════════════════════════════════
      {
        columns: [
          {
            width: 130,
            image: PACIFIC_RESTROOM_LOGO_DATA_URL,
            fit: [120, 32],
          },
          {
            width: '*',
            alignment: 'center',
            stack: [
              { text: 'PACIFIC PRODUCTS & SOLUTIONS', bold: true, fontSize: 12, color: NAVY },
              { text: 'PRC HARDWARE — MANUFACTURING & SITE EXECUTION DIVISION', fontSize: 7, color: GRAY, margin: [0, 1, 0, 1] },
              { text: `PART I: DAILY ATTENDANCE MUSTER ROLL — ${payPeriod.toUpperCase()}`, bold: true, fontSize: 8.5, color: NAVY },
              {
                text: `${data.filterLabel || 'ALL ACTIVE EMPLOYEES'} | Total Calendar Days: ${data.totalCalendarDays} | Statutory Sundays: ${data.sundaysCount} | Standard Working Days: ${data.workingDays}`,
                fontSize: 6.5,
                color: GRAY,
                margin: [0, 1, 0, 0],
              },
            ],
          },
          {
            width: 140,
            alignment: 'right',
            stack: [
              {
                table: {
                  widths: ['*'],
                  body: [
                    [
                      {
                        fillColor: NAVY_DARK,
                        alignment: 'center',
                        margin: [4, 2, 4, 2],
                        stack: [
                          { text: 'ATTENDANCE MUSTER', bold: true, color: '#ffffff', fontSize: 6.5 },
                          { text: payPeriod.toUpperCase(), bold: true, color: '#38bdf8', fontSize: 8 },
                        ],
                      },
                    ],
                  ],
                },
                layout: 'noBorders',
              },
            ],
          },
        ],
      },

      { text: '', margin: [0, 2, 0, 2] },

      // KPI Deck (Attendance Overview)
      {
        table: {
          widths: ['*', '*', '*', '*', '*', '*', '*', '*'],
          body: [
            [
              makeCell('TOTAL STAFF', { bold: true, align: 'center', fillColor: LIGHT_BG, color: GRAY, fontSize: 6 }),
              makeCell('FULL DAYS (P)', { bold: true, align: 'center', fillColor: LIGHT_BG, color: GRAY, fontSize: 6 }),
              makeCell('DOUBLE SHIFTS (DD)', { bold: true, align: 'center', fillColor: LIGHT_BG, color: GRAY, fontSize: 6 }),
              makeCell('HOLIDAYS (H)', { bold: true, align: 'center', fillColor: LIGHT_BG, color: GRAY, fontSize: 6 }),
              makeCell('ABSENT / UNPAID (A)', { bold: true, align: 'center', fillColor: LIGHT_BG, color: GRAY, fontSize: 6 }),
              makeCell('OVERTIME HRS', { bold: true, align: 'center', fillColor: LIGHT_BG, color: GRAY, fontSize: 6 }),
              makeCell('TOTAL ADVANCES', { bold: true, align: 'center', fillColor: LIGHT_BG, color: GRAY, fontSize: 6 }),
              makeCell('TOTAL NET PAY', { bold: true, align: 'center', fillColor: LIGHT_BG, color: GRAY, fontSize: 6 }),
            ],
            [
              makeCell(`${data.items.length}`, { bold: true, align: 'center', fontSize: 8.5, color: NAVY }),
              makeCell(`${totPresent}`, { bold: true, align: 'center', fontSize: 8.5, color: EMERALD }),
              makeCell(`${totDoubleDuty}`, { bold: true, align: 'center', fontSize: 8.5, color: BLUE }),
              makeCell(`${totHoliday}`, { bold: true, align: 'center', fontSize: 8.5, color: INDIGO }),
              makeCell(`${totUnpaid}`, { bold: true, align: 'center', fontSize: 8.5, color: RED }),
              makeCell(`${Number(totOtHours.toFixed(1))} hrs`, { bold: true, align: 'center', fontSize: 8.5, color: AMBER }),
              makeCell(formatINR(totAdvances), { bold: true, align: 'center', fontSize: 8.5, color: RED }),
              makeCell(formatINR(totNet), { bold: true, align: 'center', fontSize: 9, color: EMERALD }),
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => BORDER_COLOR,
          vLineColor: () => BORDER_COLOR,
        },
      },

      // Status Code Legend
      {
        margin: [0, 3, 0, 3],
        table: {
          widths: ['*'],
          body: [
            [
              {
                fillColor: '#f8fafc',
                borderColor: [BORDER_COLOR, BORDER_COLOR, BORDER_COLOR, BORDER_COLOR],
                margin: [6, 2, 6, 2],
                fontSize: 6,
                text: [
                  { text: 'STATUS CODES:  ', bold: true, color: NAVY },
                  { text: 'P ', bold: true, color: '#047857' },
                  { text: '= Present | ' },
                  { text: 'DD ', bold: true, color: '#0284c7' },
                  { text: '= Double Duty (2x) | ' },
                  { text: 'HD ', bold: true, color: '#d97706' },
                  { text: '= Half Day (0.5x) | ' },
                  { text: 'H ', bold: true, color: '#4338ca' },
                  { text: '= Paid Holiday | ' },
                  { text: 'SW ', bold: true, color: '#92400e' },
                  { text: '= Sunday Work Approved | ' },
                  { text: 'CL/EL ', bold: true, color: '#7e22ce' },
                  { text: '= Paid Leave | ' },
                  { text: 'WO ', color: '#64748b' },
                  { text: '= Weekly Off (Sunday) | ' },
                  { text: 'A ', bold: true, color: '#e11d48' },
                  { text: '= Absent (Unpaid) | ' },
                  { text: '- ', color: '#94a3b8' },
                  { text: '= Not Recorded' },
                ],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => BORDER_COLOR,
          vLineColor: () => BORDER_COLOR,
        },
      },

      // Table 1: Daily Attendance Muster Roll
      {
        table: {
          headerRows: 1,
          widths: musterTableWidths,
          body: musterTableBody,
        },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length - 1 || i === node.table.body.length ? 1 : 0.5),
          vLineWidth: () => 0.5,
          hLineColor: (i, node) => (i === 0 || i === 1 || i === node.table.body.length - 1 ? NAVY : BORDER_COLOR),
          vLineColor: () => BORDER_COLOR,
        },
      },

      // ═════════════════════════════════════════════════════════════════════════
      // SECTION 2: MONTHLY WAGES & NET COMPENSATION REGISTER (PAGE 2)
      // ═════════════════════════════════════════════════════════════════════════
      {
        pageBreak: 'before',
        columns: [
          {
            width: 130,
            image: PACIFIC_RESTROOM_LOGO_DATA_URL,
            fit: [120, 32],
          },
          {
            width: '*',
            alignment: 'center',
            stack: [
              { text: 'PACIFIC PRODUCTS & SOLUTIONS', bold: true, fontSize: 12, color: NAVY },
              { text: 'PRC HARDWARE — MANUFACTURING & SITE EXECUTION DIVISION', fontSize: 7, color: GRAY, margin: [0, 1, 0, 1] },
              { text: `PART II: WAGES, ADVANCES & NET COMPENSATION REGISTER — ${payPeriod.toUpperCase()}`, bold: true, fontSize: 8.5, color: NAVY },
              {
                text: `${data.filterLabel || 'ALL ACTIVE EMPLOYEES'} | Statutory Form / Wage Register under PRC Hardware ERP | Currency: INR (\u20B9)`,
                fontSize: 6.5,
                color: GRAY,
                margin: [0, 1, 0, 0],
              },
            ],
          },
          {
            width: 140,
            alignment: 'right',
            stack: [
              {
                table: {
                  widths: ['*'],
                  body: [
                    [
                      {
                        fillColor: NAVY_DARK,
                        alignment: 'center',
                        margin: [4, 2, 4, 2],
                        stack: [
                          { text: 'WAGE REGISTER', bold: true, color: '#ffffff', fontSize: 6.5 },
                          { text: payPeriod.toUpperCase(), bold: true, color: '#4ade80', fontSize: 8 },
                        ],
                      },
                    ],
                  ],
                },
                layout: 'noBorders',
              },
            ],
          },
        ],
      },

      { text: '', margin: [0, 3, 0, 3] },

      // Compensation Summary Deck
      {
        table: {
          widths: ['*', '*', '*', '*'],
          body: [
            [
              makeCell('TOTAL GROSS SALARY', { bold: true, align: 'center', fillColor: LIGHT_BG, color: GRAY, fontSize: 6.5 }),
              makeCell('TOTAL ADVANCES RECOVERED', { bold: true, align: 'center', fillColor: LIGHT_BG, color: GRAY, fontSize: 6.5 }),
              makeCell('TOTAL DEDUCTIONS / PENALTIES', { bold: true, align: 'center', fillColor: LIGHT_BG, color: GRAY, fontSize: 6.5 }),
              makeCell('TOTAL NET DISBURSEMENT', { bold: true, align: 'center', fillColor: LIGHT_BG, color: GRAY, fontSize: 6.5 }),
            ],
            [
              makeCell(formatINR(totGross), { bold: true, align: 'center', fontSize: 9.5, color: NAVY }),
              makeCell(formatINR(totAdvances), { bold: true, align: 'center', fontSize: 9.5, color: RED }),
              makeCell(formatINR(totDeductions), { bold: true, align: 'center', fontSize: 9.5, color: RED }),
              makeCell(formatINR(totNet), { bold: true, align: 'center', fontSize: 10, color: EMERALD }),
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => BORDER_COLOR,
          vLineColor: () => BORDER_COLOR,
        },
      },

      { text: '', margin: [0, 3, 0, 3] },

      // Table 2: Compensation Register Table
      {
        table: {
          headerRows: 1,
          widths: wageTableWidths,
          body: wageTableBody,
        },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length - 1 || i === node.table.body.length ? 1 : 0.5),
          vLineWidth: () => 0.5,
          hLineColor: (i, node) => (i === 0 || i === 1 || i === node.table.body.length - 1 ? NAVY : BORDER_COLOR),
          vLineColor: () => BORDER_COLOR,
        },
      },

      // Tripartite Signatory Block (under wage register)
      {
        margin: [0, 16, 0, 0],
        columns: [
          {
            width: '33%',
            stack: [
              { text: 'Prepared By:', bold: true, fontSize: 7, color: NAVY },
              { text: 'HR & Attendance Officer', fontSize: 6.5, color: GRAY, margin: [0, 20, 0, 0] },
              { text: 'Signature & Date', fontSize: 6, color: GRAY },
            ],
          },
          {
            width: '34%',
            alignment: 'center',
            stack: [
              { text: 'Verified By:', bold: true, fontSize: 7, color: NAVY },
              { text: 'Plant / Operations Manager', fontSize: 6.5, color: GRAY, margin: [0, 20, 0, 0] },
              { text: 'Signature & Date', fontSize: 6, color: GRAY },
            ],
          },
          {
            width: '33%',
            alignment: 'right',
            stack: [
              { text: 'Authorized Signatory:', bold: true, fontSize: 7, color: NAVY },
              { text: 'Director / Super Admin', fontSize: 6.5, color: GRAY, margin: [0, 20, 0, 0] },
              { text: 'PACIFIC PRODUCTS & SOLUTIONS', fontSize: 6, color: GRAY },
            ],
          },
        ],
      },
    ],
  };

  const doc = pdfmake.createPdf(docDefinition);
  return await doc.getBuffer();
}
