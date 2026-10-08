import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require('pdfmake');
import type { TDocumentDefinitions, Content, TableCell, Alignment } from 'pdfmake/interfaces';
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
export interface MonthlyAttendanceReportEmployeeItem {
  employeeId: string;
  name: string;
  department: string;
  designation: string;
  monthlyCtc: number;
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
  text: string,
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
    fontSize: options.fontSize || 7.5,
    margin: options.margin || [2, 3, 2, 3],
    colSpan: options.colSpan,
  };
}

/**
 * Generates an executive A4 Landscape Monthly Attendance & Payroll Master Register PDF.
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
    totAdvances += Number(item.advanceAmount || 0);
    totDeductions += Number(item.deductionAmount || 0);
    totGross += Number(item.grossSalary || 0);
    totNet += Number(item.netSalary || 0);
  }

  // Build Master Table rows
  const tableBody: TableCell[][] = [];

  // 1. Table Header
  tableBody.push([
    makeCell('#', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 7 }),
    makeCell('EMP ID', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 7 }),
    makeCell('EMPLOYEE NAME', { bold: true, align: 'left', fillColor: NAVY, color: '#ffffff', fontSize: 7 }),
    makeCell('DEPARTMENT / ROLE', { bold: true, align: 'left', fillColor: NAVY, color: '#ffffff', fontSize: 7 }),
    makeCell('PRESENT\n(P)', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 6.5 }),
    makeCell('DOUBLE\nDUTY (DD)', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 6.5 }),
    makeCell('HALF\nDAY (HD)', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 6.5 }),
    makeCell('HOLIDAY\n(HOL)', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 6.5 }),
    makeCell('LEAVES\n(CL+EL)', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 6.5 }),
    makeCell('ABSENT\n(UL/L)', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 6.5 }),
    makeCell('SUNDAY\n(WORK)', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 6.5 }),
    makeCell('TOTAL\nPAID DAYS', { bold: true, align: 'center', fillColor: NAVY_DARK, color: '#38bdf8', fontSize: 7 }),
    makeCell('OT\nHRS', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 7 }),
    makeCell('ADVANCE\n(\u20B9)', { bold: true, align: 'right', fillColor: NAVY, color: '#ffffff', fontSize: 7 }),
    makeCell('DEDUCT\n(\u20B9)', { bold: true, align: 'right', fillColor: NAVY, color: '#ffffff', fontSize: 7 }),
    makeCell('GROSS\n(\u20B9)', { bold: true, align: 'right', fillColor: NAVY, color: '#ffffff', fontSize: 7 }),
    makeCell('NET PAY\n(\u20B9)', { bold: true, align: 'right', fillColor: NAVY_DARK, color: '#4ade80', fontSize: 7 }),
  ]);

  // 2. Data Rows
  data.items.forEach((emp, idx) => {
    const isEven = idx % 2 === 0;
    const rowBg = isEven ? '#ffffff' : LIGHT_BG;

    tableBody.push([
      makeCell(`${idx + 1}`, { align: 'center', fillColor: rowBg, fontSize: 7 }),
      makeCell(emp.employeeId, { bold: true, align: 'center', color: NAVY, fillColor: rowBg, fontSize: 7 }),
      makeCell(emp.name, { bold: true, fillColor: rowBg, fontSize: 7.5 }),
      makeCell(`${emp.designation || '-'}\n(${emp.department || '-'})`, { color: GRAY, fillColor: rowBg, fontSize: 6.5 }),
      makeCell(`${emp.presentDays}`, { align: 'center', bold: true, color: EMERALD, fillColor: rowBg, fontSize: 7.5 }),
      makeCell(`${emp.doubleDutyDays > 0 ? emp.doubleDutyDays : '-'}`, {
        align: 'center',
        bold: emp.doubleDutyDays > 0,
        color: emp.doubleDutyDays > 0 ? BLUE : GRAY,
        fillColor: rowBg,
        fontSize: 7.5,
      }),
      makeCell(`${emp.halfDays > 0 ? emp.halfDays : '-'}`, {
        align: 'center',
        color: emp.halfDays > 0 ? AMBER : GRAY,
        fillColor: rowBg,
        fontSize: 7.5,
      }),
      makeCell(`${emp.holidayDays > 0 ? emp.holidayDays : '-'}`, {
        align: 'center',
        bold: emp.holidayDays > 0,
        color: emp.holidayDays > 0 ? INDIGO : GRAY,
        fillColor: rowBg,
        fontSize: 7.5,
      }),
      makeCell(`${emp.paidLeaveDays > 0 ? emp.paidLeaveDays : '-'}`, {
        align: 'center',
        color: emp.paidLeaveDays > 0 ? BLUE : GRAY,
        fillColor: rowBg,
        fontSize: 7.5,
      }),
      makeCell(`${emp.unpaidDays > 0 ? emp.unpaidDays : '-'}`, {
        align: 'center',
        bold: emp.unpaidDays > 0,
        color: emp.unpaidDays > 0 ? RED : GRAY,
        fillColor: rowBg,
        fontSize: 7.5,
      }),
      makeCell(`${emp.approvedSundays > 0 ? emp.approvedSundays : '-'}`, {
        align: 'center',
        color: emp.approvedSundays > 0 ? AMBER : GRAY,
        fillColor: rowBg,
        fontSize: 7.5,
      }),
      makeCell(`${emp.paidDays}`, { align: 'center', bold: true, color: NAVY, fillColor: rowBg, fontSize: 8 }),
      makeCell(`${emp.overtimeHours > 0 ? `${emp.overtimeHours}h` : '-'}`, {
        align: 'center',
        color: emp.overtimeHours > 0 ? EMERALD : GRAY,
        fillColor: rowBg,
        fontSize: 7.5,
      }),
      makeCell(emp.advanceAmount > 0 ? formatINR(emp.advanceAmount) : '-', {
        align: 'right',
        color: emp.advanceAmount > 0 ? RED : GRAY,
        fillColor: rowBg,
        fontSize: 7,
      }),
      makeCell(emp.deductionAmount > 0 ? formatINR(emp.deductionAmount) : '-', {
        align: 'right',
        color: emp.deductionAmount > 0 ? RED : GRAY,
        fillColor: rowBg,
        fontSize: 7,
      }),
      makeCell(emp.grossSalary > 0 ? formatINR(emp.grossSalary) : '-', { align: 'right', fillColor: rowBg, fontSize: 7 }),
      makeCell(emp.netSalary > 0 ? formatINR(emp.netSalary) : '-', {
        align: 'right',
        bold: true,
        color: EMERALD,
        fillColor: rowBg,
        fontSize: 7.5,
      }),
    ]);
  });

  // 3. Totals Summary Row
  tableBody.push([
    makeCell('TOTALS', { colSpan: 4, bold: true, align: 'center', fillColor: '#f1f5f9', color: NAVY, fontSize: 7.5 }),
    makeCell('', {}),
    makeCell('', {}),
    makeCell('', {}),
    makeCell(`${totPresent}`, { bold: true, align: 'center', fillColor: '#f1f5f9', color: EMERALD, fontSize: 7.5 }),
    makeCell(`${totDoubleDuty}`, { bold: true, align: 'center', fillColor: '#f1f5f9', color: BLUE, fontSize: 7.5 }),
    makeCell(`${totHalf}`, { bold: true, align: 'center', fillColor: '#f1f5f9', color: AMBER, fontSize: 7.5 }),
    makeCell(`${totHoliday}`, { bold: true, align: 'center', fillColor: '#f1f5f9', color: INDIGO, fontSize: 7.5 }),
    makeCell(`${totPaidLeaves}`, { bold: true, align: 'center', fillColor: '#f1f5f9', color: BLUE, fontSize: 7.5 }),
    makeCell(`${totUnpaid}`, { bold: true, align: 'center', fillColor: '#f1f5f9', color: RED, fontSize: 7.5 }),
    makeCell(`${totSundays}`, { bold: true, align: 'center', fillColor: '#f1f5f9', color: AMBER, fontSize: 7.5 }),
    makeCell(`${Number(totPaidDays.toFixed(1))}`, { bold: true, align: 'center', fillColor: '#f1f5f9', color: NAVY, fontSize: 8 }),
    makeCell(`${Number(totOtHours.toFixed(1))}h`, { bold: true, align: 'center', fillColor: '#f1f5f9', color: EMERALD, fontSize: 7.5 }),
    makeCell(formatINR(totAdvances), { bold: true, align: 'right', fillColor: '#f1f5f9', color: RED, fontSize: 7.5 }),
    makeCell(formatINR(totDeductions), { bold: true, align: 'right', fillColor: '#f1f5f9', color: RED, fontSize: 7.5 }),
    makeCell(formatINR(totGross), { bold: true, align: 'right', fillColor: '#f1f5f9', color: NAVY, fontSize: 7.5 }),
    makeCell(formatINR(totNet), { bold: true, align: 'right', fillColor: '#f1f5f9', color: EMERALD, fontSize: 8 }),
  ]);

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [20, 18, 20, 22],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 7.5,
      color: DARK_GRAY,
    },
    footer: (currentPage: number, pageCount: number) => ({
      margin: [20, 0, 20, 0],
      columns: [
        {
          text: 'PRC Hardware Enterprise ERP - Confidential Monthly Register',
          fontSize: 6.5,
          color: GRAY,
        },
        {
          text: `Generated: ${formatDate(data.generatedAt)} | Page ${currentPage} of ${pageCount}`,
          alignment: 'right',
          fontSize: 6.5,
          color: GRAY,
        },
      ],
    }),
    content: [
      // ─── Header: Logo, Title & Metadata ─────────────────────────────────────
      {
        columns: [
          {
            width: 140,
            image: PACIFIC_RESTROOM_LOGO_DATA_URL,
            fit: [130, 36],
          },
          {
            width: '*',
            alignment: 'center',
            stack: [
              { text: 'PACIFIC PRODUCTS & SOLUTIONS', bold: true, fontSize: 13, color: NAVY },
              {
                text: 'MONTHLY EMPLOYEE ATTENDANCE & PAYROLL REGISTER',
                bold: true,
                fontSize: 10,
                color: AMBER,
                margin: [0, 1, 0, 0],
              },
              {
                text: `PERIOD: ${payPeriod.toUpperCase()}  |  SCOPE: ${data.filterLabel || 'ALL ACTIVE EMPLOYEES'}`,
                fontSize: 7.5,
                color: GRAY,
                margin: [0, 1, 0, 0],
              },
            ],
          },
          {
            width: 150,
            alignment: 'right',
            stack: [
              { text: `Calendar Days: ${data.totalCalendarDays}`, fontSize: 7, color: DARK_GRAY },
              { text: `Working Days: ${data.workingDays} | Sundays: ${data.sundaysCount}`, fontSize: 7, color: DARK_GRAY },
              { text: `Total Employees: ${data.items.length}`, fontSize: 7.5, bold: true, color: NAVY },
              { text: `Generated: ${formatDate(data.generatedAt)}`, fontSize: 6.5, color: GRAY },
            ],
          },
        ],
      },
      {
        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 5,
            x2: 801,
            y2: 5,
            lineWidth: 1.2,
            lineColor: NAVY,
          },
        ],
        margin: [0, 0, 0, 6],
      },

      // ─── Executive KPI Overview Deck ─────────────────────────────────────────
      {
        margin: [0, 0, 0, 6],
        table: {
          widths: ['12.5%', '12.5%', '12.5%', '12.5%', '12.5%', '12.5%', '12.5%', '12.5%'],
          body: [
            [
              makeCell('TOTAL STAFF', { bold: true, align: 'center', fillColor: LIGHT_BG, color: GRAY, fontSize: 6.5 }),
              makeCell('FULL DAYS (P)', { bold: true, align: 'center', fillColor: LIGHT_BG, color: GRAY, fontSize: 6.5 }),
              makeCell('DOUBLE SHIFTS', { bold: true, align: 'center', fillColor: LIGHT_BG, color: GRAY, fontSize: 6.5 }),
              makeCell('HOLIDAYS', { bold: true, align: 'center', fillColor: LIGHT_BG, color: GRAY, fontSize: 6.5 }),
              makeCell('ABSENT / UNPAID', { bold: true, align: 'center', fillColor: LIGHT_BG, color: GRAY, fontSize: 6.5 }),
              makeCell('OVERTIME HRS', { bold: true, align: 'center', fillColor: LIGHT_BG, color: GRAY, fontSize: 6.5 }),
              makeCell('TOTAL ADVANCES', { bold: true, align: 'center', fillColor: LIGHT_BG, color: GRAY, fontSize: 6.5 }),
              makeCell('TOTAL NET PAY', { bold: true, align: 'center', fillColor: LIGHT_BG, color: GRAY, fontSize: 6.5 }),
            ],
            [
              makeCell(`${data.items.length}`, { bold: true, align: 'center', fontSize: 9, color: NAVY }),
              makeCell(`${totPresent}`, { bold: true, align: 'center', fontSize: 9, color: EMERALD }),
              makeCell(`${totDoubleDuty}`, { bold: true, align: 'center', fontSize: 9, color: BLUE }),
              makeCell(`${totHoliday}`, { bold: true, align: 'center', fontSize: 9, color: INDIGO }),
              makeCell(`${totUnpaid}`, { bold: true, align: 'center', fontSize: 9, color: RED }),
              makeCell(`${Number(totOtHours.toFixed(1))} hrs`, { bold: true, align: 'center', fontSize: 9, color: AMBER }),
              makeCell(formatINR(totAdvances), { bold: true, align: 'center', fontSize: 9, color: RED }),
              makeCell(formatINR(totNet), { bold: true, align: 'center', fontSize: 9.5, color: EMERALD }),
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

      // ─── Master Itemized Attendance & Payroll Table ──────────────────────────
      {
        table: {
          headerRows: 1,
          widths: [
            18,  // #
            42,  // EMP ID
            100, // NAME
            85,  // DEPT / ROLE
            32,  // PRESENT
            35,  // DOUBLE DUTY
            30,  // HALF DAY
            32,  // HOLIDAY
            32,  // LEAVES
            32,  // ABSENT
            32,  // SUN
            40,  // PAID DAYS
            32,  // OT HRS
            45,  // ADVANCE
            45,  // DEDUCT
            55,  // GROSS
            60,  // NET PAY
          ],
          body: tableBody,
        },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length - 1 || i === node.table.body.length ? 1 : 0.5),
          vLineWidth: () => 0.5,
          hLineColor: (i, node) => (i === 0 || i === 1 || i === node.table.body.length - 1 ? NAVY : BORDER_COLOR),
          vLineColor: () => BORDER_COLOR,
        },
      },

      // ─── Signatory & Verification Block ─────────────────────────────────────
      {
        margin: [0, 10, 0, 0],
        columns: [
          {
            width: '33%',
            stack: [
              { text: 'Prepared By:', bold: true, fontSize: 7.5, color: NAVY },
              { text: 'HR & Attendance Officer', fontSize: 7, color: GRAY, margin: [0, 18, 0, 0] },
              { text: 'Signature & Date', fontSize: 6.5, color: GRAY },
            ],
          },
          {
            width: '34%',
            alignment: 'center',
            stack: [
              { text: 'Verified By:', bold: true, fontSize: 7.5, color: NAVY },
              { text: 'Plant / Operations Manager', fontSize: 7, color: GRAY, margin: [0, 18, 0, 0] },
              { text: 'Signature & Date', fontSize: 6.5, color: GRAY },
            ],
          },
          {
            width: '33%',
            alignment: 'right',
            stack: [
              { text: 'Authorized Signatory:', bold: true, fontSize: 7.5, color: NAVY },
              { text: 'Director / Super Admin', fontSize: 7, color: GRAY, margin: [0, 18, 0, 0] },
              { text: 'PACIFIC PRODUCTS & SOLUTIONS', fontSize: 6.5, color: GRAY },
            ],
          },
        ],
      },
    ],
  };

  const doc = pdfmake.createPdf(docDefinition);
  return await doc.getBuffer();
}
