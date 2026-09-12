import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require('pdfmake');
import type { TDocumentDefinitions, Content, TableCell, Alignment } from 'pdfmake/interfaces';
import { PACIFIC_RESTROOM_LOGO_DATA_URL } from '../../assets/logo.base64';
import { numberToWordsIndianRupees } from '../invoices/services/gst.service';

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
  console.warn('[Employee Payslip PDF Service] Font initialization warning:', e?.message || e);
}

// ─── Design Palette ───────────────────────────────────────────────────────────
const NAVY = '#0f172a';
const NAVY_DARK = '#0b1e38';
const AMBER = '#d97706';
const EMERALD = '#047857';
const RED = '#dc2626';
const GRAY = '#475569';
const DARK_GRAY = '#1e293b';
const LIGHT_BG = '#f8fafc';
const BORDER_COLOR = '#cbd5e1';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatINR(value: number | string | null | undefined): string {
  const n = Number(value || 0);
  return `\u20B9${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    'July', 'August', 'September', 'October', 'November', 'December'
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
    fontSize: options.fontSize || 8.5,
    colSpan: options.colSpan,
    margin: options.margin || [4, 4, 4, 4],
  } as TableCell;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface EmployeePayslipPdfData {
  payrollRun: {
    id: string;
    month: number;
    year: number;
    monthlyCtc: number | string;
    totalCalendarDays: number;
    sundaysCount: number;
    approvedSundays: number;
    payableDays: number | string;
    perDayRate: number | string;
    presentDays: number | string;
    clDays: number | string;
    elDays: number | string;
    halfDays: number | string;
    unpaidDays: number | string;
    paidDays: number | string;
    overtimeHours: number | string;
    overtimeRate: number | string;
    overtimePay: number | string;
    grossSalary: number | string;
    advanceDeduction: number | string;
    otherDeductions: number | string;
    deductionSummary?: any;
    netSalary: number | string;
    status: string;
    paidAt?: Date | string | null;
    paymentMode?: string | null;
    paymentReference?: string | null;
    paymentNotes?: string | null;
    createdAt: Date | string;
  };
  employee: {
    employeeId: string;
    name: string;
    email: string;
    phone: string;
    designation: string;
    department: string;
    joiningDate: Date | string;
    governmentIdType: string;
    governmentIdNumber: string;
    bankAccountNumber: string;
    bankIfsc: string;
    bankName: string;
    bankAccountHolder: string;
    clBalance?: number | string;
    elBalance?: number | string;
  };
}

// ─── Generate PDF ─────────────────────────────────────────────────────────────
export async function generateEmployeePayslipPdf(data: EmployeePayslipPdfData): Promise<Buffer> {
  const { payrollRun, employee } = data;
  const payPeriod = `${getMonthName(payrollRun.month)} ${payrollRun.year}`;
  const netSalaryNum = Math.max(0, Math.round(Number(payrollRun.netSalary)));
  const netInWords = numberToWordsIndianRupees(netSalaryNum);

  // Parse any detailed deductions
  const advanceDeduction = Number(payrollRun.advanceDeduction || 0);
  const otherDeductions = Number(payrollRun.otherDeductions || 0);
  const unpaidDays = Number(payrollRun.unpaidDays || 0);
  const perDayRate = Number(payrollRun.perDayRate || 0);
  const unpaidDaysDeduction = unpaidDays * perDayRate;
  const totalDeductions = advanceDeduction + otherDeductions + unpaidDaysDeduction;

  const docDefinition: any = {
    pageSize: 'A4',
    pageMargins: [32, 28, 32, 32],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 8.5,
      color: DARK_GRAY,
      lineHeight: 1.25,
    },
    content: [
      // Header Banner
      {
        table: {
          widths: ['22%', '53%', '25%'],
          body: [
            [
              PACIFIC_RESTROOM_LOGO_DATA_URL
                ? {
                    image: PACIFIC_RESTROOM_LOGO_DATA_URL,
                    width: 80,
                    alignment: 'left',
                    margin: [0, 2, 0, 2],
                  }
                : { text: 'PRC', bold: true, fontSize: 20, color: NAVY },
              {
                stack: [
                  { text: 'PACIFIC PRODUCTS & SOLUTIONS', bold: true, fontSize: 13, color: NAVY },
                  {
                    text: 'Corporate Compensation & Payroll Division | Enterprise Hardware Suite',
                    fontSize: 7.5,
                    color: GRAY,
                    margin: [0, 2, 0, 0],
                  },
                  {
                    text: 'Contact: payroll@pacifichardware.com | Web: www.pacifichardware.com',
                    fontSize: 7.5,
                    color: GRAY,
                  },
                ],
                alignment: 'left',
              },
              {
                stack: [
                  {
                    table: {
                      widths: ['*'],
                      body: [
                        [
                          {
                            text: 'SALARY PAYSLIP',
                            bold: true,
                            fontSize: 9.5,
                            alignment: 'center',
                            fillColor: NAVY,
                            color: '#ffffff',
                            margin: [0, 4, 0, 4],
                          },
                        ],
                        [
                          {
                            text: payPeriod.toUpperCase(),
                            bold: true,
                            fontSize: 8.5,
                            alignment: 'center',
                            fillColor: LIGHT_BG,
                            color: AMBER,
                            margin: [0, 3, 0, 3],
                          },
                        ],
                      ],
                    },
                    layout: {
                      hLineWidth: () => 1,
                      vLineWidth: () => 1,
                      hLineColor: () => NAVY,
                      vLineColor: () => NAVY,
                    },
                  },
                ],
                alignment: 'right',
              },
            ],
          ],
        },
        layout: 'noBorders',
      },

      { canvas: [{ type: 'line', x1: 0, y1: 10, x2: 531, y2: 10, lineWidth: 1.5, lineColor: NAVY }] },

      // Section 1: Employee & Bank Information
      {
        margin: [0, 14, 0, 10],
        table: {
          widths: ['50%', '50%'],
          body: [
            [
              {
                fillColor: LIGHT_BG,
                margin: [6, 6, 6, 6],
                stack: [
                  { text: 'EMPLOYEE IDENTIFICATION', bold: true, fontSize: 8, color: NAVY, margin: [0, 0, 0, 5] },
                  {
                    columns: [
                      { width: '42%', text: 'Employee ID:', bold: true, color: GRAY, fontSize: 8 },
                      { width: '58%', text: employee.employeeId, bold: true, color: NAVY, fontSize: 8 },
                    ],
                    margin: [0, 1.5, 0, 1.5],
                  },
                  {
                    columns: [
                      { width: '42%', text: 'Full Name:', bold: true, color: GRAY, fontSize: 8 },
                      { width: '58%', text: employee.name, bold: true, fontSize: 8 },
                    ],
                    margin: [0, 1.5, 0, 1.5],
                  },
                  {
                    columns: [
                      { width: '42%', text: 'Designation:', bold: true, color: GRAY, fontSize: 8 },
                      { width: '58%', text: employee.designation, fontSize: 8 },
                    ],
                    margin: [0, 1.5, 0, 1.5],
                  },
                  {
                    columns: [
                      { width: '42%', text: 'Department:', bold: true, color: GRAY, fontSize: 8 },
                      { width: '58%', text: employee.department, fontSize: 8 },
                    ],
                    margin: [0, 1.5, 0, 1.5],
                  },
                  {
                    columns: [
                      { width: '42%', text: 'Date of Joining:', bold: true, color: GRAY, fontSize: 8 },
                      { width: '58%', text: formatDate(employee.joiningDate), fontSize: 8 },
                    ],
                    margin: [0, 1.5, 0, 1.5],
                  },
                  {
                    columns: [
                      { width: '42%', text: `${employee.governmentIdType}:`, bold: true, color: GRAY, fontSize: 8 },
                      { width: '58%', text: employee.governmentIdNumber, fontSize: 8 },
                    ],
                    margin: [0, 1.5, 0, 1.5],
                  },
                ],
              },
              {
                fillColor: LIGHT_BG,
                margin: [6, 6, 6, 6],
                stack: [
                  { text: 'BANK DISBURSEMENT CREDENTIALS', bold: true, fontSize: 8, color: NAVY, margin: [0, 0, 0, 5] },
                  {
                    columns: [
                      { width: '42%', text: 'Account Holder:', bold: true, color: GRAY, fontSize: 8 },
                      { width: '58%', text: employee.bankAccountHolder, fontSize: 8 },
                    ],
                    margin: [0, 1.5, 0, 1.5],
                  },
                  {
                    columns: [
                      { width: '42%', text: 'Bank Name:', bold: true, color: GRAY, fontSize: 8 },
                      { width: '58%', text: employee.bankName, fontSize: 8 },
                    ],
                    margin: [0, 1.5, 0, 1.5],
                  },
                  {
                    columns: [
                      { width: '42%', text: 'Account Number:', bold: true, color: GRAY, fontSize: 8 },
                      { width: '58%', text: employee.bankAccountNumber, bold: true, fontSize: 8 },
                    ],
                    margin: [0, 1.5, 0, 1.5],
                  },
                  {
                    columns: [
                      { width: '42%', text: 'IFSC Code:', bold: true, color: GRAY, fontSize: 8 },
                      { width: '58%', text: employee.bankIfsc, fontSize: 8 },
                    ],
                    margin: [0, 1.5, 0, 1.5],
                  },
                  {
                    columns: [
                      { width: '42%', text: 'Payment Status:', bold: true, color: GRAY, fontSize: 8 },
                      {
                        width: '58%',
                        text: payrollRun.status,
                        bold: true,
                        fontSize: 8,
                        color: payrollRun.status === 'PAID' ? EMERALD : AMBER,
                      },
                    ],
                    margin: [0, 1.5, 0, 1.5],
                  },
                  ...(payrollRun.paidAt
                    ? [
                        {
                          columns: [
                            { width: '42%', text: 'Disbursed On:', bold: true, color: GRAY, fontSize: 8 },
                            { width: '58%', text: formatDate(payrollRun.paidAt), fontSize: 8 },
                          ],
                          margin: [0, 1.5, 0, 1.5],
                        },
                      ]
                    : []),
                ],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => BORDER_COLOR,
          vLineColor: () => BORDER_COLOR,
        },
      },

      // Section 2: Attendance & Leave Overview
      {
        margin: [0, 4, 0, 10],
        table: {
          widths: ['16.6%', '16.6%', '16.6%', '16.6%', '16.6%', '17%'],
          body: [
            [
              makeCell('CALENDAR DAYS', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 7.5 }),
              makeCell('PAYABLE DAYS', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 7.5 }),
              makeCell('PRESENT DAYS', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 7.5 }),
              makeCell('PAID LEAVES (CL/EL)', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 7.5 }),
              makeCell('UNPAID DAYS', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 7.5 }),
              makeCell('TOTAL PAID DAYS', { bold: true, align: 'center', fillColor: NAVY, color: '#ffffff', fontSize: 7.5 }),
            ],
            [
              makeCell(`${payrollRun.totalCalendarDays ?? (payrollRun as any).daysInMonth ?? 30}`, { align: 'center', bold: true, fontSize: 9 }),
              makeCell(`${payrollRun.payableDays}`, { align: 'center', bold: true, fontSize: 9 }),
              makeCell(`${payrollRun.presentDays}`, { align: 'center', bold: true, fontSize: 9 }),
              makeCell(`${Number(payrollRun.clDays || 0) + Number(payrollRun.elDays || 0)}`, { align: 'center', bold: true, fontSize: 9 }),
              makeCell(`${payrollRun.unpaidDays}`, { align: 'center', bold: true, fontSize: 9, color: Number(payrollRun.unpaidDays) > 0 ? RED : DARK_GRAY }),
              makeCell(`${payrollRun.paidDays}`, { align: 'center', bold: true, fontSize: 9, color: EMERALD }),
            ],
          ],
        },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => BORDER_COLOR,
          vLineColor: () => BORDER_COLOR,
        },
      },

      // Section 3: Itemized Earnings & Deductions Breakdown
      {
        margin: [0, 4, 0, 10],
        table: {
          widths: ['35%', '15%', '35%', '15%'],
          body: [
            [
              makeCell('EARNINGS DESCRIPTION', { bold: true, fillColor: NAVY, color: '#ffffff', fontSize: 8 }),
              makeCell('AMOUNT (\u20B9)', { bold: true, align: 'right', fillColor: NAVY, color: '#ffffff', fontSize: 8 }),
              makeCell('DEDUCTIONS DESCRIPTION', { bold: true, fillColor: NAVY, color: '#ffffff', fontSize: 8 }),
              makeCell('AMOUNT (\u20B9)', { bold: true, align: 'right', fillColor: NAVY, color: '#ffffff', fontSize: 8 }),
            ],
            [
              makeCell(`Monthly Basic CTC (${payPeriod})`, { fontSize: 8 }),
              makeCell(formatINR(payrollRun.monthlyCtc), { align: 'right', fontSize: 8 }),
              makeCell('Absence / Unpaid Leave Deduction', { fontSize: 8 }),
              makeCell(formatINR(unpaidDaysDeduction), { align: 'right', fontSize: 8, color: unpaidDaysDeduction > 0 ? RED : DARK_GRAY }),
            ],
            [
              makeCell(`Earned CTC (${payrollRun.paidDays} Paid Days @ ${formatINR(payrollRun.perDayRate)}/day)`, { fontSize: 8 }),
              makeCell(formatINR(Number(payrollRun.perDayRate) * Number(payrollRun.paidDays)), { align: 'right', fontSize: 8 }),
              makeCell('Salary Advance Recovered', { fontSize: 8 }),
              makeCell(formatINR(advanceDeduction), { align: 'right', fontSize: 8, color: advanceDeduction > 0 ? RED : DARK_GRAY }),
            ],
            [
              makeCell(`Overtime Pay (${payrollRun.overtimeHours} hrs @ ${formatINR(payrollRun.overtimeRate)}/hr)`, { fontSize: 8 }),
              makeCell(formatINR(payrollRun.overtimePay), { align: 'right', fontSize: 8, color: Number(payrollRun.overtimePay) > 0 ? EMERALD : DARK_GRAY }),
              makeCell('Other Penalties & Statutory Deductions', { fontSize: 8 }),
              makeCell(formatINR(otherDeductions), { align: 'right', fontSize: 8, color: otherDeductions > 0 ? RED : DARK_GRAY }),
            ],
            [
              makeCell('TOTAL GROSS EARNINGS', { bold: true, fillColor: LIGHT_BG, fontSize: 8.5, color: NAVY }),
              makeCell(formatINR(payrollRun.grossSalary), { bold: true, align: 'right', fillColor: LIGHT_BG, fontSize: 8.5, color: NAVY }),
              makeCell('TOTAL DEDUCTIONS', { bold: true, fillColor: LIGHT_BG, fontSize: 8.5, color: RED }),
              makeCell(formatINR(totalDeductions), { bold: true, align: 'right', fillColor: LIGHT_BG, fontSize: 8.5, color: RED }),
            ],
          ],
        },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => BORDER_COLOR,
          vLineColor: () => BORDER_COLOR,
        },
      },

      // Section 4: Net Salary Callout Box
      {
        margin: [0, 8, 0, 14],
        table: {
          widths: ['100%'],
          body: [
            [
              {
                fillColor: '#f1f5f9',
                margin: [10, 8, 10, 8],
                stack: [
                  {
                    columns: [
                      {
                        width: '60%',
                        stack: [
                          { text: 'NET SALARY PAYABLE', bold: true, fontSize: 9.5, color: NAVY },
                          { text: `Amount in words: ${netInWords}`, italics: true, fontSize: 8, color: GRAY, margin: [0, 3, 0, 0] },
                        ],
                      },
                      {
                        width: '40%',
                        alignment: 'right',
                        text: formatINR(payrollRun.netSalary),
                        bold: true,
                        fontSize: 15,
                        color: NAVY_DARK,
                      },
                    ],
                  },
                ],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 1.5,
          vLineWidth: () => 1.5,
          hLineColor: () => NAVY,
          vLineColor: () => NAVY,
        },
      },

      // Leave Balance Summary if available
      ...(employee.clBalance !== undefined || employee.elBalance !== undefined
        ? [
            {
              margin: [0, 0, 0, 12],
              columns: [
                {
                  width: '50%',
                  text: `Casual Leave (CL) Balance: ${Number(employee.clBalance || 0).toFixed(2)} days`,
                  fontSize: 7.5,
                  color: GRAY,
                },
                {
                  width: '50%',
                  alignment: 'right' as Alignment,
                  text: `Earned Leave (EL) Balance: ${Number(employee.elBalance || 0).toFixed(2)} days`,
                  fontSize: 7.5,
                  color: GRAY,
                },
              ],
            },
          ]
        : []),

      // Signatory Section
      {
        margin: [0, 16, 0, 0],
        columns: [
          {
            width: '60%',
            stack: [
              { text: 'Notes & Policy Declarations:', bold: true, fontSize: 7.5, color: GRAY },
              {
                text: '1. This document is a computer-generated salary advice and does not require a physical signature.',
                fontSize: 7,
                color: GRAY,
                margin: [0, 1, 0, 0],
              },
              {
                text: '2. All advances and deductions reflected above have been approved per corporate HR policy.',
                fontSize: 7,
                color: GRAY,
              },
              {
                text: '3. For payroll queries, discrepancy reports, or TDS inquiries, contact accounts@pacifichardware.com within 5 working days.',
                fontSize: 7,
                color: GRAY,
              },
            ],
          },
          {
            width: '40%',
            alignment: 'right',
            stack: [
              { text: 'For PACIFIC PRODUCTS & SOLUTIONS', bold: true, fontSize: 8, color: NAVY },
              { text: '[Authorized Signatory / Payroll Dept]', fontSize: 7.5, color: GRAY, margin: [0, 26, 0, 0] },
              { text: `Generated: ${formatDate(new Date())}`, fontSize: 7, color: GRAY },
            ],
          },
        ],
      },
    ],
  };

  const doc = pdfmake.createPdf(docDefinition);
  return await doc.getBuffer();
}
