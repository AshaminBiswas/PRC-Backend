import ExcelJS from 'exceljs';
import { Response } from 'express';

// ─── Theme Colors ────────────────────────────────────────────────────────────
const NAVY_HEADER = 'FF0F172A';
const NAVY_DARK = 'FF1E293B';
const AMBER_ACCENT = 'FFD97706';
const EMERALD_SUCCESS = 'FF047857';
const RED_ALERT = 'FFDC2626';
const SLATE_MUTED = 'FF64748B';
const ROW_ALT = 'FFF8FAFC';
const BORDER_LIGHT = 'FFE2E8F0';

export const RUPEE_FORMAT = '[$₹-en-IN]#,##0.00;([$₹-en-IN]#,##0.00);"-"';

/** Convert integer paise to rupees */
export const paiseToRupees = (paise: number = 0): number => {
  return Number((paise / 100).toFixed(2));
};

/** Apply uniform styling to header row */
function styleHeaderRow(row: ExcelJS.Row, bgArgb: string = NAVY_HEADER) {
  row.height = 28;
  row.eachCell({ includeEmpty: false }, (cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: bgArgb },
    };
    cell.font = {
      bold: true,
      color: { argb: 'FFFFFFFF' },
      size: 10,
      name: 'Segoe UI',
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FFCBD5E1' } },
    };
  });
}

/** Apply alternating striping to table rows */
function styleDataRow(row: ExcelJS.Row, isEven: boolean) {
  row.height = 22;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { size: 9.5, name: 'Segoe UI' };
    cell.border = {
      top: { style: 'thin', color: { argb: BORDER_LIGHT } },
      bottom: { style: 'thin', color: { argb: BORDER_LIGHT } },
      left: { style: 'thin', color: { argb: BORDER_LIGHT } },
      right: { style: 'thin', color: { argb: BORDER_LIGHT } },
    };
    if (isEven) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: ROW_ALT },
      };
    }
  });
}

/** Apply subtotal / summary row styling */
function styleSummaryRow(row: ExcelJS.Row, bgArgb: string = 'FFF1F5F9') {
  row.height = 24;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: bgArgb },
    };
    cell.font = {
      bold: true,
      size: 10,
      name: 'Segoe UI',
      color: { argb: 'FF0F172A' },
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'double', color: { argb: 'FF475569' } },
    };
  });
}

/** Helper to format standard Raw / Itemized Vouchers worksheet with all required columns and autoFilter */
export function addRawVouchersWorksheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  entries: any[],
  defaultBranchName: string = 'All Branches'
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(sheetName, {
    views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }],
  });

  ws.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Voucher No', key: 'entryNumber', width: 20 },
    { header: 'Branch', key: 'branch', width: 22 },
    { header: 'Who Paid (Name)', key: 'paidBy', width: 22 },
    { header: 'Category', key: 'category', width: 22 },
    { header: 'Sub-Category', key: 'subCategory', width: 18 },
    { header: 'Amount (₹)', key: 'amount', width: 18 },
    { header: 'Payment Mode', key: 'paymentMode', width: 16 },
    { header: 'Description / Note', key: 'description', width: 36 },
    { header: 'Paid To (Vendor / Person)', key: 'paidTo', width: 26 },
    { header: 'Receipt Slip', key: 'receiptSlip', width: 22 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Approved By', key: 'approvedBy', width: 20 },
  ];

  styleHeaderRow(ws.getRow(1), NAVY_HEADER);

  entries.forEach((e, idx) => {
    const dStr = e.date instanceof Date
      ? e.date.toISOString().split('T')[0]
      : e.date
      ? String(e.date).split('T')[0]
      : '-';

    const branchName = e.branch?.name || defaultBranchName;
    const payerName = e.paidBy
      ? e.paidBy
      : e.addedBy
      ? `${e.addedBy.firstName || ''} ${e.addedBy.lastName || ''}`.trim() || e.addedBy.email
      : e.employee?.name || '-';

    const approverName = e.approvedBy
      ? `${e.approvedBy.firstName || ''} ${e.approvedBy.lastName || ''}`.trim() || e.approvedBy.email
      : '-';

    const row = ws.addRow([
      dStr,
      e.entryNumber,
      branchName,
      payerName,
      e.category?.name || 'Uncategorized',
      e.subCategory || '-',
      paiseToRupees(e.amount),
      e.paymentMode,
      e.description,
      e.paidTo,
      e.receiptAttachment ? { text: 'View Slip / Receipt', hyperlink: e.receiptAttachment } : 'No Slip',
      e.status,
      approverName,
    ]);

    styleDataRow(row, idx % 2 === 1);

    // Number formatting (Amount is column 7)
    row.getCell(7).numFmt = RUPEE_FORMAT;
    row.getCell(7).alignment = { horizontal: 'right' };

    // Alignments
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(8).alignment = { horizontal: 'center' };
    row.getCell(12).alignment = { horizontal: 'center' };

    // Receipt Slip Hyperlink Styling (Column 11)
    const receiptCell = row.getCell(11);
    if (e.receiptAttachment) {
      receiptCell.font = { color: { argb: 'FF2563EB' }, underline: true, size: 9.5, name: 'Segoe UI' };
      receiptCell.alignment = { horizontal: 'center' };
    } else {
      receiptCell.font = { color: { argb: 'FF94A3B8' }, italic: true, size: 9.5, name: 'Segoe UI' };
      receiptCell.alignment = { horizontal: 'center' };
    }
  });

  // Summary Row if entries exist
  if (entries.length > 0) {
    const totalRow = ws.addRow([
      'TOTAL',
      '',
      '',
      '',
      '',
      '',
      { formula: `SUM(G2:G${entries.length + 1})` },
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
    styleSummaryRow(totalRow);
    totalRow.getCell(7).numFmt = RUPEE_FORMAT;
    totalRow.getCell(7).alignment = { horizontal: 'right' };
  }

  // Enable AutoFilter on header row
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(entries.length + 1, 1), column: ws.columns.length },
  };

  return ws;
}

/** Helper to format standard Cash Float Top-Ups worksheet with all required columns, clickable links, and autoFilter */
export function addFloatTopUpsWorksheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  topUps: any[],
  defaultBranchName: string = 'All Branches'
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(sheetName, {
    views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }],
  });

  ws.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Record ID', key: 'id', width: 18 },
    { header: 'Branch', key: 'branch', width: 22 },
    { header: 'Amount (₹)', key: 'amount', width: 18 },
    { header: 'Source of Cash Float', key: 'source', width: 28 },
    { header: 'Reference / Cheque No', key: 'referenceNo', width: 24 },
    { header: 'Notes / Purpose', key: 'notes', width: 34 },
    { header: 'Payment Receipt Slip', key: 'receiptAttachment', width: 24 },
    { header: 'Added By', key: 'addedBy', width: 22 },
  ];

  styleHeaderRow(ws.getRow(1), NAVY_HEADER);

  topUps.forEach((t, idx) => {
    const dStr = t.date instanceof Date
      ? t.date.toISOString().split('T')[0]
      : t.date
      ? String(t.date).split('T')[0]
      : '-';

    const branchName = t.branch?.name || defaultBranchName;
    const addedByName = t.addedBy
      ? `${t.addedBy.firstName || ''} ${t.addedBy.lastName || ''}`.trim() || t.addedBy.email
      : '-';

    const row = ws.addRow([
      dStr,
      `FLT-${t.id ? t.id.slice(0, 8).toUpperCase() : String(idx + 1).padStart(4, '0')}`,
      branchName,
      paiseToRupees(t.amount),
      t.source,
      t.referenceNo || '-',
      t.notes || '-',
      t.receiptAttachment ? { text: 'View Receipt Slip', hyperlink: t.receiptAttachment } : 'No Slip',
      addedByName,
    ]);

    styleDataRow(row, idx % 2 === 1);
    row.getCell(4).numFmt = RUPEE_FORMAT;
    row.getCell(4).alignment = { horizontal: 'right' };

    // Format clickable receipt link
    if (t.receiptAttachment) {
      row.getCell(8).font = {
        name: 'Segoe UI',
        size: 9.5,
        color: { argb: 'FF2563EB' },
        underline: true,
      };
    }
  });

  // Total row
  if (topUps.length > 0) {
    const totalRow = ws.addRow([
      'TOTAL FLOAT TOP-UPS',
      '',
      '',
      { formula: `SUM(D2:D${topUps.length + 1})` },
      '',
      '',
      '',
      '',
      '',
    ]);
    styleSummaryRow(totalRow);
    totalRow.getCell(4).numFmt = RUPEE_FORMAT;
    totalRow.getCell(4).alignment = { horizontal: 'right' };
  }

  // Enable AutoFilter on header row
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(topUps.length + 1, 1), column: ws.columns.length },
  };

  return ws;
}

// ─── 1. Day-Wise Multi-Sheet Workbook ────────────────────────────────────────
export async function buildDayWiseWorkbook(data: {
  date: string;
  branchName: string;
  ledger: any;
  topUps: any[];
  entries: any[];
  categoryTotals: { categoryName: string; amount: number; count: number }[];
}): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PRC Hardware Daily Cash Expense Tracker';
  wb.created = new Date();

  // ── Sheet 1: Day Summary & Balance ─────────────────────────────────────────
  const s1 = wb.addWorksheet('Day Summary & Balance', {
    views: [{ showGridLines: true }],
  });

  s1.columns = [
    { header: 'Metric / Component', key: 'metric', width: 32 },
    { header: 'Amount (₹)', key: 'amount', width: 22 },
    { header: 'Status / Notes', key: 'notes', width: 40 },
  ];
  styleHeaderRow(s1.getRow(1), NAVY_HEADER);

  const opening = paiseToRupees(data.ledger?.openingBalance ?? 0);
  const received = paiseToRupees(data.ledger?.cashReceived ?? 0);
  const expenses = paiseToRupees(data.ledger?.totalExpenses ?? 0);
  const closing = paiseToRupees(data.ledger?.closingBalance ?? (opening + received - expenses));
  const physical = data.ledger?.physicalCashCounted != null ? paiseToRupees(data.ledger.physicalCashCounted) : null;
  const variance = physical != null ? Number((closing - physical).toFixed(2)) : null;

  const rows = [
    ['Branch Location', data.branchName, 'Facility identifier'],
    ['Reconciliation Date', data.date, 'Calendar date'],
    ['1. Opening Cash Float', opening, 'Cash-in-hand carried forward'],
    ['2. Mid-Day Float / Top-ups', received, `${data.topUps.length} cash top-ups logged`],
    ['3. Total Cash Expenses (Approved)', expenses, `${data.entries.filter((e) => e.status === 'APPROVED').length} approved vouchers`],
    ['4. Calculated Closing Balance', closing, 'Formula: Opening + Top-ups - Expenses'],
    ['5. Physical Cash Counted', physical ?? 'Not Counted', data.ledger?.isReconciled ? 'Verified at closing' : 'Pending admin count'],
    ['6. Reconciliation Variance', variance != null ? variance : '-', variance === 0 ? 'BALANCED' : variance != null ? 'MISMATCH FLAGGED' : 'Pending'],
    ['Reconciliation Status', data.ledger?.isReconciled ? 'RECONCILED & LOCKED' : 'OPEN / UNRECONCILED', data.ledger?.reconciledBy?.firstName ? `By ${data.ledger.reconciledBy.firstName}` : ''],
  ];

  rows.forEach((r, idx) => {
    const row = s1.addRow(r);
    styleDataRow(row, idx % 2 === 1);
    if (typeof r[1] === 'number') {
      row.getCell(2).numFmt = RUPEE_FORMAT;
      row.getCell(2).alignment = { horizontal: 'right' };
    }
  });

  // Add Category Summary table on Sheet 1 below
  s1.addRow([]);
  const catHeaderRow = s1.addRow(['Category Breakdown', 'Total Spent (₹)', 'Entries Count']);
  styleHeaderRow(catHeaderRow, NAVY_DARK);

  data.categoryTotals.forEach((c, idx) => {
    const r = s1.addRow([c.categoryName, paiseToRupees(c.amount), c.count]);
    styleDataRow(r, idx % 2 === 1);
    r.getCell(2).numFmt = RUPEE_FORMAT;
    r.getCell(2).alignment = { horizontal: 'right' };
    r.getCell(3).alignment = { horizontal: 'center' };
  });

  // ── Sheet 2: Itemized Transactions ────────────────────────────────────────
  addRawVouchersWorksheet(wb, 'Itemized Expenses', data.entries, data.branchName);

  // ── Sheet 3: Cash Float Top-Ups ───────────────────────────────────────────
  if (data.topUps && data.topUps.length > 0) {
    addFloatTopUpsWorksheet(wb, 'Cash Float Top-Ups', data.topUps, data.branchName);
  }

  return wb;
}

// ─── 2. Week-Wise Multi-Sheet Workbook ───────────────────────────────────────
export async function buildWeekWiseWorkbook(data: {
  weekLabel: string;
  branchName: string;
  days: {
    date: string;
    dayName: string;
    opening: number;
    received: number;
    expenses: number;
    closing: number;
    variance: number | null;
    count: number;
  }[];
  categoryBreakdown: {
    categoryName: string;
    dayAmounts: number[];
    total: number;
  }[];
  entries: any[];
  topUps?: any[];
}): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PRC Hardware Daily Cash Expense Tracker';
  wb.created = new Date();

  // ── Sheet 1: Weekly Rollup ─────────────────────────────────────────────────
  const s1 = wb.addWorksheet('Weekly Rollup', {
    views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }],
  });

  s1.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Day', key: 'day', width: 14 },
    { header: 'Opening Float (₹)', key: 'opening', width: 18 },
    { header: 'Top-Ups Received (₹)', key: 'received', width: 20 },
    { header: 'Cash Spent (₹)', key: 'expenses', width: 18 },
    { header: 'Closing Balance (₹)', key: 'closing', width: 20 },
    { header: 'Variance (₹)', key: 'variance', width: 16 },
    { header: 'Entries', key: 'count', width: 12 },
  ];
  styleHeaderRow(s1.getRow(1), NAVY_HEADER);

  data.days.forEach((d, idx) => {
    const row = s1.addRow([
      d.date,
      d.dayName,
      paiseToRupees(d.opening),
      paiseToRupees(d.received),
      paiseToRupees(d.expenses),
      paiseToRupees(d.closing),
      d.variance != null ? paiseToRupees(d.variance) : '-',
      d.count,
    ]);
    styleDataRow(row, idx % 2 === 1);
    [3, 4, 5, 6, 7].forEach((colIdx) => {
      row.getCell(colIdx).numFmt = RUPEE_FORMAT;
      row.getCell(colIdx).alignment = { horizontal: 'right' };
    });
    row.getCell(8).alignment = { horizontal: 'center' };
  });

  const sumRow = s1.addRow([
    'WEEK TOTAL',
    '',
    '-',
    { formula: `SUM(D2:D${data.days.length + 1})` },
    { formula: `SUM(E2:E${data.days.length + 1})` },
    '-',
    '-',
    { formula: `SUM(H2:H${data.days.length + 1})` },
  ]);
  styleSummaryRow(sumRow);
  sumRow.getCell(4).numFmt = RUPEE_FORMAT;
  sumRow.getCell(5).numFmt = RUPEE_FORMAT;
  sumRow.getCell(4).alignment = { horizontal: 'right' };
  sumRow.getCell(5).alignment = { horizontal: 'right' };
  sumRow.getCell(8).alignment = { horizontal: 'center' };

  s1.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: data.days.length + 1, column: s1.columns.length },
  };

  // ── Sheet 2: Category Breakdown Pivot ─────────────────────────────────────
  const s2 = wb.addWorksheet('Category Breakdown', {
    views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }],
  });

  const catCols: Partial<ExcelJS.Column>[] = [
    { header: 'Category Name', key: 'category', width: 26 },
    { header: 'Mon (₹)', key: 'mon', width: 16 },
    { header: 'Tue (₹)', key: 'tue', width: 16 },
    { header: 'Wed (₹)', key: 'wed', width: 16 },
    { header: 'Thu (₹)', key: 'thu', width: 16 },
    { header: 'Fri (₹)', key: 'fri', width: 16 },
    { header: 'Sat (₹)', key: 'sat', width: 16 },
    { header: 'Sun (₹)', key: 'sun', width: 16 },
    { header: 'Total (₹)', key: 'total', width: 20 },
  ];
  s2.columns = catCols;
  styleHeaderRow(s2.getRow(1), NAVY_DARK);

  data.categoryBreakdown.forEach((c, idx) => {
    const row = s2.addRow([
      c.categoryName,
      paiseToRupees(c.dayAmounts[0] ?? 0),
      paiseToRupees(c.dayAmounts[1] ?? 0),
      paiseToRupees(c.dayAmounts[2] ?? 0),
      paiseToRupees(c.dayAmounts[3] ?? 0),
      paiseToRupees(c.dayAmounts[4] ?? 0),
      paiseToRupees(c.dayAmounts[5] ?? 0),
      paiseToRupees(c.dayAmounts[6] ?? 0),
      paiseToRupees(c.total),
    ]);
    styleDataRow(row, idx % 2 === 1);
    for (let i = 2; i <= 9; i++) {
      row.getCell(i).numFmt = RUPEE_FORMAT;
      row.getCell(i).alignment = { horizontal: 'right' };
    }
  });

  s2.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: data.categoryBreakdown.length + 1, column: s2.columns.length },
  };

  // ── Sheet 3: Raw Itemized Vouchers ─────────────────────────────────────────
  addRawVouchersWorksheet(wb, 'Raw Vouchers', data.entries, data.branchName);

  // ── Sheet 4: Cash Float Top-Ups ───────────────────────────────────────────
  if (data.topUps && data.topUps.length > 0) {
    addFloatTopUpsWorksheet(wb, 'Cash Float Top-Ups', data.topUps, data.branchName);
  }

  return wb;
}

// ─── 3. Month-Wise Multi-Sheet Workbook ──────────────────────────────────────
export async function buildMonthWiseWorkbook(data: {
  monthName: string;
  year: number;
  branchName: string;
  categoryNames: string[];
  days: {
    date: string;
    dayNum: number;
    categoryAmounts: Record<string, number>;
    dayTotal: number;
    topUps: number;
    closing: number;
    physical: number | null;
    variance: number | null;
  }[];
  reconciliations: any[];
  categoryTotals: Record<string, number>;
  entries?: any[];
  topUps?: any[];
}): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PRC Hardware Daily Cash Expense Tracker';
  wb.created = new Date();

  // ── Sheet 1: Monthly Pivot Summary ────────────────────────────────────────
  const s1 = wb.addWorksheet('Monthly Pivot Summary', {
    views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }],
  });

  const cols: Partial<ExcelJS.Column>[] = [
    { header: 'Date', key: 'date', width: 14 },
    ...data.categoryNames.map((c) => ({ header: `${c} (₹)`, key: c, width: 16 })),
    { header: 'Day Total (₹)', key: 'dayTotal', width: 18 },
    { header: 'Float Added (₹)', key: 'topUps', width: 18 },
    { header: 'Closing Balance (₹)', key: 'closing', width: 20 },
    { header: 'Physical Count (₹)', key: 'physical', width: 18 },
    { header: 'Variance (₹)', key: 'variance', width: 16 },
  ];
  s1.columns = cols;
  styleHeaderRow(s1.getRow(1), NAVY_HEADER);

  data.days.forEach((d, idx) => {
    const rowValues: any[] = [d.date];
    data.categoryNames.forEach((c) => {
      rowValues.push(paiseToRupees(d.categoryAmounts[c] ?? 0));
    });
    rowValues.push(paiseToRupees(d.dayTotal));
    rowValues.push(paiseToRupees(d.topUps));
    rowValues.push(paiseToRupees(d.closing));
    rowValues.push(d.physical != null ? paiseToRupees(d.physical) : '-');
    rowValues.push(d.variance != null ? paiseToRupees(d.variance) : '-');

    const row = s1.addRow(rowValues);
    styleDataRow(row, idx % 2 === 1);
    for (let i = 2; i <= rowValues.length; i++) {
      if (typeof rowValues[i - 1] === 'number') {
        row.getCell(i).numFmt = RUPEE_FORMAT;
        row.getCell(i).alignment = { horizontal: 'right' };
      } else {
        row.getCell(i).alignment = { horizontal: 'center' };
      }
    }
  });

  // Grand total row
  const totalValues: any[] = ['MONTH TOTAL'];
  data.categoryNames.forEach((c) => {
    totalValues.push(paiseToRupees(data.categoryTotals[c] ?? 0));
  });
  const grandTotalExpenses = Object.values(data.categoryTotals).reduce((a, b) => a + b, 0);
  totalValues.push(paiseToRupees(grandTotalExpenses));
  totalValues.push('-');
  totalValues.push('-');
  totalValues.push('-');
  totalValues.push('-');

  const grandRow = s1.addRow(totalValues);
  styleSummaryRow(grandRow);
  for (let i = 2; i <= totalValues.length; i++) {
    if (typeof totalValues[i - 1] === 'number') {
      grandRow.getCell(i).numFmt = RUPEE_FORMAT;
      grandRow.getCell(i).alignment = { horizontal: 'right' };
    }
  }

  s1.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: data.days.length + 1, column: s1.columns.length },
  };

  // ── Sheet 2: Daily Closing & Reconciliation Log ───────────────────────────
  const s2 = wb.addWorksheet('Reconciliation Log', {
    views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }],
  });
  s2.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Opening Balance (₹)', key: 'opening', width: 18 },
    { header: 'Float Added (₹)', key: 'received', width: 18 },
    { header: 'Approved Expenses (₹)', key: 'expenses', width: 22 },
    { header: 'Calculated Closing (₹)', key: 'closing', width: 22 },
    { header: 'Physical Count (₹)', key: 'physical', width: 18 },
    { header: 'Variance (₹)', key: 'variance', width: 16 },
    { header: 'Status', key: 'status', width: 18 },
    { header: 'Reconciled By', key: 'user', width: 20 },
    { header: 'Notes', key: 'notes', width: 34 },
  ];
  styleHeaderRow(s2.getRow(1), NAVY_DARK);

  data.reconciliations.forEach((r, idx) => {
    const opening = paiseToRupees(r.openingBalance);
    const received = paiseToRupees(r.cashReceived);
    const exp = paiseToRupees(r.totalExpenses);
    const closing = paiseToRupees(r.closingBalance);
    const physical = r.physicalCashCounted != null ? paiseToRupees(r.physicalCashCounted) : null;
    const variance = physical != null ? Number((closing - physical).toFixed(2)) : null;

    const row = s2.addRow([
      r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0],
      opening,
      received,
      exp,
      closing,
      physical ?? '-',
      variance ?? '-',
      r.isReconciled ? 'RECONCILED' : 'PENDING',
      r.reconciledBy?.firstName ? `${r.reconciledBy.firstName} ${r.reconciledBy.lastName || ''}`.trim() : '-',
      r.reconciliationNotes || '-',
    ]);
    styleDataRow(row, idx % 2 === 1);
    [2, 3, 4, 5].forEach((col) => {
      row.getCell(col).numFmt = RUPEE_FORMAT;
      row.getCell(col).alignment = { horizontal: 'right' };
    });
    if (physical != null) {
      row.getCell(6).numFmt = RUPEE_FORMAT;
      row.getCell(6).alignment = { horizontal: 'right' };
    }
    if (variance != null) {
      row.getCell(7).numFmt = RUPEE_FORMAT;
      row.getCell(7).alignment = { horizontal: 'right' };
      if (variance !== 0) {
        row.getCell(7).font = { color: { argb: RED_ALERT }, bold: true };
      }
    }
    row.getCell(8).alignment = { horizontal: 'center' };
  });

  s2.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: data.reconciliations.length + 1, column: s2.columns.length },
  };

  // ── Sheet 3: Raw Itemized Vouchers ─────────────────────────────────────────
  if (data.entries && data.entries.length > 0) {
    addRawVouchersWorksheet(wb, 'Raw Vouchers', data.entries, data.branchName);
  }

  // ── Sheet 4: Cash Float Top-Ups ───────────────────────────────────────────
  if (data.topUps && data.topUps.length > 0) {
    addFloatTopUpsWorksheet(wb, 'Cash Float Top-Ups', data.topUps, data.branchName);
  }

  return wb;
}

// ─── 4. Year-Wise Multi-Sheet Workbook ───────────────────────────────────────
export async function buildYearWiseWorkbook(data: {
  year: number;
  branchName: string;
  categoryNames: string[];
  months: {
    monthNum: number;
    monthName: string;
    categoryAmounts: Record<string, number>;
    monthTotal: number;
    floatAdded: number;
    endingBalance: number;
    netVariance: number;
    entryCount: number;
  }[];
  annualCategoryTotals: Record<string, number>;
  annualGrandTotal: number;
  entries?: any[];
  topUps?: any[];
}): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PRC Hardware Daily Cash Expense Tracker';
  wb.created = new Date();

  // ── Sheet 1: Category Trends & Annual Pivot ───────────────────────────────
  const s1 = wb.addWorksheet('Annual Category Trends', {
    views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }],
  });

  const cols: Partial<ExcelJS.Column>[] = [
    { header: 'Category Name', key: 'category', width: 28 },
    ...data.months.map((m) => ({ header: `${m.monthName} (₹)`, key: m.monthName, width: 16 })),
    { header: 'Year Total (₹)', key: 'yearTotal', width: 20 },
    { header: 'Monthly Avg (₹)', key: 'avg', width: 18 },
    { header: '% of Spend', key: 'share', width: 14 },
  ];
  s1.columns = cols;
  styleHeaderRow(s1.getRow(1), NAVY_HEADER);

  data.categoryNames.forEach((c, idx) => {
    const totalForCat = data.annualCategoryTotals[c] ?? 0;
    const monthlyAvg = totalForCat / 12;
    const share = data.annualGrandTotal > 0 ? (totalForCat / data.annualGrandTotal) * 100 : 0;

    const rowValues: any[] = [c];
    data.months.forEach((m) => {
      rowValues.push(paiseToRupees(m.categoryAmounts[c] ?? 0));
    });
    rowValues.push(paiseToRupees(totalForCat));
    rowValues.push(paiseToRupees(monthlyAvg));
    rowValues.push(`${share.toFixed(1)}%`);

    const row = s1.addRow(rowValues);
    styleDataRow(row, idx % 2 === 1);
    for (let i = 2; i <= rowValues.length - 1; i++) {
      row.getCell(i).numFmt = RUPEE_FORMAT;
      row.getCell(i).alignment = { horizontal: 'right' };
    }
    row.getCell(rowValues.length).alignment = { horizontal: 'center' };
  });

  // Annual Totals Row
  const totalRowValues: any[] = ['ANNUAL TOTAL'];
  data.months.forEach((m) => {
    totalRowValues.push(paiseToRupees(m.monthTotal));
  });
  totalRowValues.push(paiseToRupees(data.annualGrandTotal));
  totalRowValues.push(paiseToRupees(data.annualGrandTotal / 12));
  totalRowValues.push('100.0%');

  const grandRow = s1.addRow(totalRowValues);
  styleSummaryRow(grandRow);
  for (let i = 2; i <= totalRowValues.length - 1; i++) {
    grandRow.getCell(i).numFmt = RUPEE_FORMAT;
    grandRow.getCell(i).alignment = { horizontal: 'right' };
  }
  grandRow.getCell(totalRowValues.length).alignment = { horizontal: 'center' };

  s1.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: data.categoryNames.length + 1, column: s1.columns.length },
  };

  // ── Sheet 2: Month-by-Month Financials ────────────────────────────────────
  const s2 = wb.addWorksheet('Monthly Financial Rollup', {
    views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }],
  });
  s2.columns = [
    { header: 'Month', key: 'month', width: 16 },
    { header: 'Total Cash Spent (₹)', key: 'expenses', width: 22 },
    { header: 'Float Added (₹)', key: 'float', width: 20 },
    { header: 'Closing Balance (₹)', key: 'closing', width: 22 },
    { header: 'Net Variance (₹)', key: 'variance', width: 18 },
    { header: 'Vouchers Count', key: 'count', width: 16 },
  ];
  styleHeaderRow(s2.getRow(1), NAVY_DARK);

  data.months.forEach((m, idx) => {
    const row = s2.addRow([
      m.monthName,
      paiseToRupees(m.monthTotal),
      paiseToRupees(m.floatAdded),
      paiseToRupees(m.endingBalance),
      paiseToRupees(m.netVariance),
      m.entryCount,
    ]);
    styleDataRow(row, idx % 2 === 1);
    [2, 3, 4, 5].forEach((col) => {
      row.getCell(col).numFmt = RUPEE_FORMAT;
      row.getCell(col).alignment = { horizontal: 'right' };
    });
    row.getCell(6).alignment = { horizontal: 'center' };
  });

  s2.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: data.months.length + 1, column: s2.columns.length },
  };

  // ── Sheet 3: Raw Itemized Vouchers ─────────────────────────────────────────
  if (data.entries && data.entries.length > 0) {
    addRawVouchersWorksheet(wb, 'Raw Vouchers', data.entries, data.branchName);
  }

  // ── Sheet 4: Cash Float Top-Ups ───────────────────────────────────────────
  if (data.topUps && data.topUps.length > 0) {
    addFloatTopUpsWorksheet(wb, 'Cash Float Top-Ups', data.topUps, data.branchName);
  }

  return wb;
}

// ─── Stream Workbook helper ──────────────────────────────────────────────────
export async function streamWorkbookToResponse(wb: ExcelJS.Workbook, filename: string, res: Response) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  await wb.xlsx.write(res);
  res.end();
}
