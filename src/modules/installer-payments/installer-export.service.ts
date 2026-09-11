import ExcelJS from 'exceljs';

export interface ExportBillItem {
  billNo: string;
  installerName: string;
  installerEmail: string;
  installDate: Date | string;
  isNcr: boolean;
  travelExpenses: number;
  siteAddress: string;
  sitePin: string;
  modelsSummary: string;
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
  month?: number;
  year?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export async function generateInstallerBillsExcel(
  records: ExportBillItem[],
  filters: ExportFilterSummary = {}
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Pacific Products & Solutions Admin';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Installer Payments History', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }],
  });

  // Title Banner
  worksheet.mergeCells('A1:Q1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'PACIFIC PRODUCTS & SOLUTIONS — CUBICLE INSTALLER PAYMENT HISTORY REPORT';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 30;

  // Filter & Generation Metadata Subtitle
  let filterText = 'All Dates';
  if (filters.month && filters.year) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    filterText = `${monthNames[filters.month - 1]} ${filters.year}`;
  } else if (filters.year) {
    filterText = `Year ${filters.year}`;
  } else if (filters.startDate || filters.endDate) {
    filterText = `${filters.startDate || 'Beginning'} to ${filters.endDate || 'Present'}`;
  }

  worksheet.mergeCells('A2:Q2');
  const metaCell = worksheet.getCell('A2');
  metaCell.value = `Filter Scope: ${filterText} | Status Filter: ${filters.status || 'ALL'} | Total Records: ${records.length} | Export Timestamp: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
  metaCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };
  metaCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(2).height = 18;

  // Blank spacer row
  worksheet.getRow(3).height = 8;

  // Header Row
  const headerRow = worksheet.getRow(4);
  headerRow.values = [
    'Bill No',
    'Install Date',
    'Installer Name',
    'Installer Email',
    'NCR Region',
    'Site Address',
    'Site PIN',
    'Cubicle Models & Qty',
    'Total Units',
    'Subtotal (₹)',
    'Travel Expenses (₹)',
    'Total Due (₹)',
    'Amount Paid (₹)',
    'Balance Due (₹)',
    'Payment Status',
    'Payment Date',
    'Clearance Email Status',
  ];

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF334155' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      bottom: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } },
    };
  });
  headerRow.height = 24;

  // Column Widths
  worksheet.columns = [
    { key: 'billNo', width: 14 },
    { key: 'installDate', width: 13 },
    { key: 'installerName', width: 20 },
    { key: 'installerEmail', width: 26 },
    { key: 'isNcr', width: 12 },
    { key: 'siteAddress', width: 34 },
    { key: 'sitePin', width: 12 },
    { key: 'modelsSummary', width: 28 },
    { key: 'totalQuantity', width: 12 },
    { key: 'subtotal', width: 15 },
    { key: 'travelExpenses', width: 18 },
    { key: 'total', width: 16 },
    { key: 'amountPaid', width: 16 },
    { key: 'balanceDue', width: 16 },
    { key: 'paymentStatus', width: 15 },
    { key: 'paymentDate', width: 14 },
    { key: 'emailStatus', width: 22 },
  ];

  // Data Rows
  let totalSubtotal = 0;
  let totalTravel = 0;
  let totalGrand = 0;
  let totalPaid = 0;
  let totalDue = 0;

  records.forEach((rec, idx) => {
    const rowIndex = idx + 5;
    const isEven = idx % 2 === 0;
    const rowBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    const installDateStr = rec.installDate
      ? new Date(rec.installDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'N/A';
    const paymentDateStr = rec.paymentDate
      ? new Date(rec.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : '-';

    totalSubtotal += Number(rec.subtotal || 0);
    totalTravel += Number(rec.travelExpenses || 0);
    totalGrand += Number(rec.total || 0);
    totalPaid += Number(rec.amountPaid || 0);
    totalDue += Number(rec.balanceDue || 0);

    const emailStatusText = rec.emailStatus
      ? `${rec.emailStatus}${rec.emailSentAt ? ` (${new Date(rec.emailSentAt).toLocaleDateString('en-IN')})` : ''}`
      : 'PENDING';

    const row = worksheet.addRow({
      billNo: rec.billNo,
      installDate: installDateStr,
      installerName: rec.installerName,
      installerEmail: rec.installerEmail,
      isNcr: rec.isNcr ? 'YES (NCR)' : 'NO (Outstation)',
      siteAddress: rec.siteAddress,
      sitePin: rec.sitePin,
      modelsSummary: rec.modelsSummary || 'N/A',
      totalQuantity: rec.totalQuantity,
      subtotal: Number(rec.subtotal || 0),
      travelExpenses: Number(rec.travelExpenses || 0),
      total: Number(rec.total || 0),
      amountPaid: Number(rec.amountPaid || 0),
      balanceDue: Number(rec.balanceDue || 0),
      paymentStatus: rec.paymentStatus === 'CLEARED' ? 'Full / Cleared' : 'Partial',
      paymentDate: paymentDateStr,
      emailStatus: emailStatusText,
    });

    row.height = 20;

    row.eachCell((cell, colNum) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      cell.font = { name: 'Calibri', size: 9 };

      // Formatting
      if ([1, 2, 5, 7, 9, 15, 16, 17].includes(colNum)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if ([10, 11, 12, 13, 14].includes(colNum)) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '₹#,##0.00';
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }

      // Status color highlighting
      if (colNum === 15) {
        if (rec.paymentStatus === 'CLEARED') {
          cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF047857' } };
        } else {
          cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFD97706' } };
        }
      }
    });
  });

  // Summary Row at the bottom
  const summaryRowIndex = records.length + 5;
  const summaryRow = worksheet.getRow(summaryRowIndex);
  summaryRow.getCell(1).value = 'TOTALS';
  summaryRow.getCell(10).value = totalSubtotal;
  summaryRow.getCell(11).value = totalTravel;
  summaryRow.getCell(12).value = totalGrand;
  summaryRow.getCell(13).value = totalPaid;
  summaryRow.getCell(14).value = totalDue;

  summaryRow.height = 22;
  summaryRow.eachCell((cell, colNum) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF334155' } },
      bottom: { style: 'double', color: { argb: 'FF334155' } },
    };
    if ([10, 11, 12, 13, 14].includes(colNum)) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.numFmt = '₹#,##0.00';
    } else {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
