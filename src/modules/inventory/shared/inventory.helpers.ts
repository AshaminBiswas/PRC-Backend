import bwipjs from 'bwip-js';
import QRCode from 'qrcode';
import ExcelJS from 'exceljs';
import { Response } from 'express';

// ─── Number Generators ────────────────────────────────────────────────────────

export const generateDocNumber = (prefix: string): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${timestamp}-${random}`;
};

// ─── Barcode & QR Code Generators ──────────────────────────────────────────────

export const generateBarcodeBuffer = async (text: string): Promise<Buffer> => {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text,
    scale: 3,
    height: 10,
    includetext: true,
    textxalign: 'center',
  });
};

export const generateQRCodeDataUrl = async (text: string): Promise<string> => {
  return QRCode.toDataURL(text, { width: 300, margin: 2 });
};

export const generateQRCodeBuffer = async (text: string): Promise<Buffer> => {
  return QRCode.toBuffer(text, { width: 300, margin: 2 });
};

// ─── Export Helpers (CSV & Excel) ─────────────────────────────────────────────

export const sendCsvResponse = (res: Response, filename: string, headers: string[], data: Record<string, any>[]) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);

  let csvContent = headers.join(',') + '\n';
  for (const row of data) {
    const values = headers.map((header) => {
      const val = row[header] ?? '';
      const stringVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
      return `"${stringVal.replace(/"/g, '""')}"`;
    });
    csvContent += values.join(',') + '\n';
  }

  res.send(csvContent);
};

export const sendExcelResponse = async (
  res: Response,
  filename: string,
  sheetName: string,
  columns: { header: string; key: string; width?: number }[],
  data: Record<string, any>[]
) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  worksheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width || 20,
  }));

  worksheet.addRows(data);

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);

  await workbook.xlsx.write(res);
  res.end();
};
