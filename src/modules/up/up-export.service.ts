import ExcelJS from 'exceljs';
import { Response } from 'express';
import { listExpenses } from './up.service';
import type { ListUpExpensesQuery } from './up.schema';

export const exportExpensesToExcel = async (query: ListUpExpensesQuery, res: Response) => {
  // Fetch up to 10,000 records for the export matching active filters
  const result = await listExpenses({ ...query, page: 1, limit: 10000 });
  const items = result.items;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Pacific Products & Solutions';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('UP Daily Expenses', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });

  // Header Title Row
  worksheet.mergeCells('A1:J1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'PACIFIC PRODUCTS & SOLUTIONS — UP DAILY EXPENSE LEDGER';
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E1B4B' }, // Dark Indigo
  };
  worksheet.getRow(1).height = 30;

  // Subtitle / Date Filter Info
  worksheet.mergeCells('A2:J2');
  const subCell = worksheet.getCell('A2');
  const dateInfo = query.startDate && query.endDate
    ? `Period: ${query.startDate} to ${query.endDate}`
    : `Exported on: ${new Date().toLocaleDateString('en-IN')}`;
  subCell.value = `${dateInfo} | Total Records: ${items.length} | Total Amount: ₹${result.pagination.totalAmount.toLocaleString('en-IN')}`;
  subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(2).height = 20;

  // Table Column Headers
  const headerRow = worksheet.addRow([
    'Expense Date',
    'Expense ID',
    'Category',
    'Amount (₹)',
    'Payment Mode',
    'Paid To / Vendor',
    'Short Note',
    'Verification Status',
    'Created By',
    'Created At',
  ]);
  headerRow.height = 24;

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4338CA' }, // Indigo 700
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF1E1B4B' } },
    };
  });

  // Data Rows
  items.forEach((item, idx) => {
    const row = worksheet.addRow([
      item.expenseDate instanceof Date ? item.expenseDate.toISOString().split('T')[0] : String(item.expenseDate).split('T')[0],
      item.id,
      item.categoryName,
      Number(item.amount),
      (item.paymentMode || 'cash').toUpperCase(),
      item.paidTo,
      item.note || '—',
      item.verified ? 'VERIFIED' : 'UNVERIFIED',
      item.createdByName || 'Admin',
      item.createdAt instanceof Date ? item.createdAt.toLocaleString('en-IN') : String(item.createdAt),
    ]);

    row.height = 20;
    const isEven = idx % 2 === 0;

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 4 ? 'right' : colNumber === 1 || colNumber === 8 ? 'center' : 'left',
      };
      if (colNumber === 4) {
        cell.numFmt = '#,##0.00';
      }
      if (isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  // Summary Row
  const summaryRow = worksheet.addRow([
    'TOTAL',
    '',
    '',
    result.pagination.totalAmount,
    '',
    '',
    '',
    '',
    '',
    '',
  ]);
  summaryRow.height = 24;
  summaryRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Arial', size: 10, bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };
    if (colNumber === 4) {
      cell.numFmt = '₹#,##0.00';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    }
  });

  // Auto-fit Column Widths
  worksheet.columns = [
    { width: 14 }, // Date
    { width: 36 }, // ID
    { width: 24 }, // Category
    { width: 16 }, // Amount
    { width: 15 }, // Payment Mode
    { width: 26 }, // Paid To
    { width: 32 }, // Note
    { width: 16 }, // Verification
    { width: 22 }, // Created By
    { width: 22 }, // Created At
  ];

  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const filename = `UP_Expense_Report_${yearMonth}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  await workbook.xlsx.write(res);
  res.end();
};
