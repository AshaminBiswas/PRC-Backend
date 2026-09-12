import ExcelJS from 'exceljs';

/** One line-item inside a bill (mirrors BillItem prisma model) */
export interface ExportBillItemLine {
  category: string; // e.g. 'CUBICLE', 'UMP', 'LOCKER'
  modelName: string;
  quantity: number;
  lineTotal: number;
}

export interface ExportBillItem {
  billNo: string;
  installerName: string;
  installerEmail: string;
  installDate: Date | string;
  isNcr: boolean;
  travelExpenses: number;
  siteAddress: string;
  sitePin: string;
  /** Per-model line items used to build dynamic pivot columns */
  items: ExportBillItemLine[];
  // Deductions & Penalties
  deductionAmount: number;
  deductionReason?: string | null;
  // Overall Totals
  totalQuantity: number;
  subtotal: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: string;
  paymentDate?: Date | string | null;
  emailStatus?: string | null;
  emailSentAt?: Date | string | null;
  createdAt: Date | string;
}

export interface ExportFilterSummary {
  installerId?: string;
  installerName?: string;
  month?: number;
  year?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
}

// ── Palette ─────────────────────────────────────────────────────────────────
const NAVY_ARGB = 'FF0F172A';
const NAVY_DARK_ARGB = 'FF1E293B';
const AMBER_ARGB = 'FFD97706';
const RED_ARGB = 'FFDC2626';
const EMERALD_ARGB = 'FF047857';
const SLATE_ARGB = 'FF64748B';
const BORDER_LIGHT = 'FFE2E8F0';
const BORDER_DARK = 'FF334155';

/** Return the category-specific header fill ARGB for dynamic pivot columns */
function categoryHeaderArgb(category: string): string {
  switch (category.toUpperCase()) {
    case 'UMP':    return 'FF5B4A00'; // Dark amber
    case 'LOCKER': return 'FF2D4739'; // Dark green
    default:       return 'FF1E3A5F'; // Deep blue for CUBICLE
  }
}

/** Convert 1-based column index to Excel letter(s) e.g. 27 → "AA" */
function colLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Generate an Excel workbook with:
 * - 7 fixed prefix columns (Bill No … Site PIN)
 * - N dynamic columns — one per distinct [CATEGORY] Model, showing installation quantity
 * - 11 fixed suffix columns (Total Units, Subtotal, Travel, Deductions, Reason, Net, Paid, Balance, Status, Date, Email)
 *
 * Model columns are sorted CUBICLE → UMP → LOCKER, then alphabetically.
 * Zero-quantity cells are shown as "—" in light grey.
 */
export async function generateInstallerBillsExcel(
  records: ExportBillItem[],
  filters: ExportFilterSummary = {}
): Promise<Buffer> {
  // ── 1. Discover all distinct models ──────────────────────────────────────
  const modelKeySet = new Map<string, { category: string; modelName: string }>();
  for (const rec of records) {
    for (const item of rec.items) {
      const key = `[${item.category}] ${item.modelName}`;
      if (!modelKeySet.has(key)) {
        modelKeySet.set(key, { category: item.category, modelName: item.modelName });
      }
    }
  }

  const catOrder: Record<string, number> = { CUBICLE: 0, UMP: 1, LOCKER: 2 };
  const modelColumns = [...modelKeySet.entries()].sort(([aKey, aVal], [bKey, bVal]) => {
    const aOrd = catOrder[aVal.category.toUpperCase()] ?? 99;
    const bOrd = catOrder[bVal.category.toUpperCase()] ?? 99;
    return aOrd !== bOrd ? aOrd - bOrd : aKey.localeCompare(bKey);
  });

  // ── 2. Column layout counts ───────────────────────────────────────────────
  const PREFIX_COLS  = 7;
  const SUFFIX_COLS  = 11;
  const modelColCount = modelColumns.length;
  const totalCols     = PREFIX_COLS + modelColCount + SUFFIX_COLS;
  const lastCol       = colLetter(totalCols);

  // ── 3. Workbook ───────────────────────────────────────────────────────────
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Pacific Products & Solutions Admin';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Installer Payments History', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }],
  });

  // ── 4. Title banner (row 1) ───────────────────────────────────────────────
  worksheet.mergeCells(`A1:${lastCol}1`);
  const titleCell = worksheet.getCell('A1');
  titleCell.value =
    'PACIFIC PRODUCTS & SOLUTIONS — INSTALLER PAYMENT HISTORY REPORT (PER-MODEL BREAKDOWN)';
  titleCell.font  = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_ARGB } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 30;

  // ── 5. Filter metadata (row 2) ────────────────────────────────────────────
  let filterText = 'All Dates';
  if (filters.month && filters.year) {
    const mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    filterText = `${mn[filters.month - 1]} ${filters.year}`;
  } else if (filters.year) {
    filterText = `Year ${filters.year}`;
  } else if (filters.startDate || filters.endDate) {
    filterText = `${filters.startDate || 'Beginning'} to ${filters.endDate || 'Present'}`;
  }
  const installerInfo = filters.installerName ? ` | Technician: ${filters.installerName}` : '';

  worksheet.mergeCells(`A2:${lastCol}2`);
  const metaCell = worksheet.getCell('A2');
  metaCell.value =
    `Filter: ${filterText}${installerInfo} | Status: ${filters.status || 'ALL'} | ` +
    `Records: ${records.length} | Models: ${modelColCount} | ` +
    `Exported: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
  metaCell.font      = { name: 'Calibri', size: 9, italic: true, color: { argb: SLATE_ARGB } };
  metaCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(2).height = 18;

  // Spacer row 3
  worksheet.getRow(3).height = 8;

  // ── 6. Header row (row 4) ─────────────────────────────────────────────────
  const headerValues: string[] = [
    'Bill No', 'Install Date', 'Installer Name', 'Installer Email',
    'NCR Region', 'Site Address', 'Site PIN',
    ...modelColumns.map(([key]) => key),
    'Total Units', 'Subtotal (₹)', 'Travel Expenses (₹)',
    'Deductions (₹)', 'Deduction Reason',
    'Net Total Due (₹)', 'Amount Paid (₹)', 'Balance Due (₹)',
    'Payment Status', 'Payment Date', 'Email Status',
  ];

  const headerRow = worksheet.getRow(4);
  headerRow.values = headerValues;
  headerRow.height = 34;

  headerRow.eachCell((cell, colNum) => {
    let fillArgb = NAVY_DARK_ARGB;
    if (colNum > PREFIX_COLS && colNum <= PREFIX_COLS + modelColCount) {
      const [, meta] = modelColumns[colNum - PREFIX_COLS - 1];
      fillArgb = categoryHeaderArgb(meta.category);
    } else {
      const sIdx = colNum - PREFIX_COLS - modelColCount;
      if (sIdx === 4 || sIdx === 5) fillArgb = 'FF7F1D1D'; // dark red for deduction cols
    }
    cell.font      = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillArgb } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border    = {
      top: { style: 'thin', color: { argb: BORDER_DARK } }, left: { style: 'thin', color: { argb: BORDER_DARK } },
      bottom: { style: 'thin', color: { argb: BORDER_DARK } }, right: { style: 'thin', color: { argb: BORDER_DARK } },
    };
  });

  // ── 7. Column widths ──────────────────────────────────────────────────────
  worksheet.columns = [
    { key: 'billNo',          width: 14 },
    { key: 'installDate',     width: 13 },
    { key: 'installerName',   width: 20 },
    { key: 'installerEmail',  width: 28 },
    { key: 'isNcr',           width: 13 },
    { key: 'siteAddress',     width: 34 },
    { key: 'sitePin',         width: 11 },
    ...modelColumns.map(([key]) => ({ key: `model_${key}`, width: 14 })),
    { key: 'totalQuantity',   width: 13 },
    { key: 'subtotal',        width: 16 },
    { key: 'travelExpenses',  width: 19 },
    { key: 'deductionAmount', width: 16 },
    { key: 'deductionReason', width: 26 },
    { key: 'total',           width: 16 },
    { key: 'amountPaid',      width: 16 },
    { key: 'balanceDue',      width: 16 },
    { key: 'paymentStatus',   width: 15 },
    { key: 'paymentDate',     width: 14 },
    { key: 'emailStatus',     width: 24 },
  ];

  // ── 8. Totals accumulators ────────────────────────────────────────────────
  const modelTotals = new Map<string, number>();
  modelColumns.forEach(([key]) => modelTotals.set(key, 0));
  let totalAllUnits = 0, totalSubtotal = 0, totalTravel = 0;
  let totalDeductions = 0, totalGrand = 0, totalPaid = 0, totalDue = 0;

  // ── 9. Data rows ──────────────────────────────────────────────────────────
  records.forEach((rec, idx) => {
    const rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

    const installDateStr = rec.installDate
      ? new Date(rec.installDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'N/A';
    const paymentDateStr = rec.paymentDate
      ? new Date(rec.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—';
    const emailStatusText = rec.emailStatus
      ? `${rec.emailStatus}${rec.emailSentAt ? ` (${new Date(rec.emailSentAt).toLocaleDateString('en-IN')})` : ''}`
      : 'PENDING';

    // Build quantity lookup for this bill
    const itemQtyMap = new Map<string, number>();
    for (const item of rec.items) {
      const key = `[${item.category}] ${item.modelName}`;
      itemQtyMap.set(key, (itemQtyMap.get(key) || 0) + item.quantity);
    }

    // Accumulate totals
    for (const [key] of modelColumns) {
      modelTotals.set(key, (modelTotals.get(key) || 0) + (itemQtyMap.get(key) || 0));
    }
    totalAllUnits   += Number(rec.totalQuantity   || 0);
    totalSubtotal   += Number(rec.subtotal         || 0);
    totalTravel     += Number(rec.travelExpenses   || 0);
    totalDeductions += Number(rec.deductionAmount  || 0);
    totalGrand      += Number(rec.total            || 0);
    totalPaid       += Number(rec.amountPaid       || 0);
    totalDue        += Number(rec.balanceDue       || 0);

    const rowValues: (string | number)[] = [
      rec.billNo, installDateStr, rec.installerName, rec.installerEmail,
      rec.isNcr ? 'YES (NCR)' : 'NO (Outstation)',
      rec.siteAddress, rec.sitePin,
      ...modelColumns.map(([key]) => itemQtyMap.get(key) || 0),
      Number(rec.totalQuantity  || 0),
      Number(rec.subtotal        || 0),
      Number(rec.travelExpenses  || 0),
      Number(rec.deductionAmount || 0),
      rec.deductionReason || '—',
      Number(rec.total       || 0),
      Number(rec.amountPaid  || 0),
      Number(rec.balanceDue  || 0),
      rec.paymentStatus === 'CLEARED' ? 'Full / Cleared' : 'Partial',
      paymentDateStr,
      emailStatusText,
    ];

    const row = worksheet.addRow(rowValues);
    row.height = 20;

    const suffixStart = PREFIX_COLS + modelColCount + 1; // 1-based col where suffix begins

    row.eachCell((cell, colNum) => {
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.border = {
        top: { style: 'thin', color: { argb: BORDER_LIGHT } }, left: { style: 'thin', color: { argb: BORDER_LIGHT } },
        bottom: { style: 'thin', color: { argb: BORDER_LIGHT } }, right: { style: 'thin', color: { argb: BORDER_LIGHT } },
      };
      cell.font = { name: 'Calibri', size: 9 };

      const isDynamic = colNum > PREFIX_COLS && colNum <= PREFIX_COLS + modelColCount;
      const sIdx      = colNum - suffixStart + 1; // 1-based within suffix (≤0 if not in suffix)

      if ([1, 2, 5, 7].includes(colNum)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };

      } else if (isDynamic) {
        const qty = (cell.value as number) || 0;
        if (qty === 0) {
          cell.value     = '—';
          cell.font      = { name: 'Calibri', size: 9, color: { argb: 'FFCBD5E1' } };
        } else {
          cell.font      = { name: 'Calibri', size: 9, bold: true };
        }
        cell.alignment = { horizontal: 'center', vertical: 'middle' };

      } else if (sIdx === 1) {
        // Total Units
        cell.alignment = { horizontal: 'center', vertical: 'middle' };

      } else if (sIdx === 2 || sIdx === 3) {
        // Subtotal | Travel Expenses
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt    = '₹#,##0.00';

      } else if (sIdx === 4) {
        // Deductions — red
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt    = '₹#,##0.00';
        if (Number(cell.value) > 0) {
          cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: RED_ARGB } };
        }

      } else if (sIdx === 5) {
        // Deduction Reason
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        if (cell.value && String(cell.value) !== '—') {
          cell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: RED_ARGB } };
        }

      } else if (sIdx === 6 || sIdx === 7 || sIdx === 8) {
        // Net Total Due | Amount Paid | Balance Due
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt    = '₹#,##0.00';
        if (sIdx === 7) {
          cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: EMERALD_ARGB } };
        }

      } else if (sIdx === 9) {
        // Payment Status
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = {
          name: 'Calibri', size: 9, bold: true,
          color: { argb: rec.paymentStatus === 'CLEARED' ? EMERALD_ARGB : AMBER_ARGB },
        };

      } else {
        // Payment Date | Email Status
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
  });

  // ── 10. Summary / Totals row ──────────────────────────────────────────────
  const summaryValues: (string | number)[] = [
    'TOTALS', '', '', '', '', '', '',
    ...modelColumns.map(([key]) => modelTotals.get(key) || 0),
    totalAllUnits, totalSubtotal, totalTravel,
    totalDeductions, '',
    totalGrand, totalPaid, totalDue,
    '', '', '',
  ];

  const summaryRow = worksheet.getRow(records.length + 5);
  summaryRow.values = summaryValues;
  summaryRow.height = 24;

  const suffixStart = PREFIX_COLS + modelColCount + 1;

  summaryRow.eachCell((cell, colNum) => {
    cell.font  = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_ARGB } };
    cell.border = {
      top:    { style: 'medium', color: { argb: BORDER_DARK } },
      bottom: { style: 'double', color: { argb: BORDER_DARK } },
    };

    const isDynamic  = colNum > PREFIX_COLS && colNum <= PREFIX_COLS + modelColCount;
    const sIdx       = colNum - suffixStart + 1;
    const currencyS  = new Set([2, 3, 4, 6, 7, 8]);

    if (isDynamic || sIdx === 1) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else if (currencyS.has(sIdx)) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.numFmt    = '₹#,##0.00';
    } else {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}


