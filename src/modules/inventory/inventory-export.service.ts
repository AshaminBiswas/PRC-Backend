import ExcelJS from 'exceljs';
import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require('pdfmake');
import type { TDocumentDefinitions } from 'pdfmake/interfaces';

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
  console.warn('[Inventory PDF] Font initialization warning:', e?.message || e);
}

// ─── Excel Reports Generator ──────────────────────────────────────────────────

export const generateStockExcel = async (data: any[], branchName: string = 'All Branches'): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PRC Hardware Inventory System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Current Stock', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }],
  });

  // Title Header
  worksheet.mergeCells('A1:G1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `PACIFIC HARDWARE — MULTI-BRANCH STOCK REPORT (${branchName.toUpperCase()})`;
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 32;

  // Metadata Sub-row
  worksheet.mergeCells('A2:G2');
  const metaCell = worksheet.getCell('A2');
  metaCell.value = `Generated On: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} | Total SKUs: ${data.length}`;
  metaCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
  metaCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(2).height = 18;

  // Blank row
  worksheet.getRow(3).height = 10;

  // Table Headers
  const headerRow = worksheet.getRow(4);
  headerRow.values = [
    'SKU',
    'Product Name',
    'Branch',
    'Available Qty',
    'Reserved Qty',
    'Reorder Level',
    'Stock Status',
  ];
  headerRow.height = 24;
  headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF334155' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      right: { style: 'thin', color: { argb: 'FF334155' } },
    };
  });

  // Table Rows
  data.forEach((row, index) => {
    const isLow = row.quantity <= (row.reorderLevel || 10);
    const r = worksheet.addRow([
      row.product?.sku || row.sku || 'N/A',
      row.product?.name || row.productName || 'N/A',
      row.branch?.name || row.branchName || 'N/A',
      row.quantity,
      row.reservedQuantity || 0,
      row.reorderLevel || 10,
      isLow ? 'LOW STOCK' : row.quantity === 0 ? 'OUT OF STOCK' : 'IN STOCK',
    ]);

    r.height = 20;
    r.font = { name: 'Arial', size: 9.5 };

    const bgColor = index % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';
    r.eachCell((cell, colNumber) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      if (colNumber === 1 || colNumber === 3) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colNumber === 2) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else if (colNumber >= 4 && colNumber <= 6) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0';
      } else if (colNumber === 7) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (isLow) {
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFDC2626' } };
        } else {
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF16A34A' } };
        }
      }
    });
  });

  // Set Column Widths
  worksheet.columns = [
    { width: 16 }, // SKU
    { width: 38 }, // Product Name
    { width: 20 }, // Branch
    { width: 15 }, // Available Qty
    { width: 15 }, // Reserved Qty
    { width: 15 }, // Reorder Level
    { width: 18 }, // Status
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

export const generatePurchasesExcel = async (purchases: any[]): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PRC Hardware Inventory System';
  const worksheet = workbook.addWorksheet('Purchase History', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }],
  });

  worksheet.mergeCells('A1:G1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'PACIFIC HARDWARE — PURCHASE & PROCUREMENT AUDIT LEDGER';
  titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 30;

  worksheet.mergeCells('A2:G2');
  const metaCell = worksheet.getCell('A2');
  metaCell.value = `Exported: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} | Total Purchases: ${purchases.length}`;
  metaCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
  metaCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(2).height = 18;

  const headerRow = worksheet.getRow(4);
  headerRow.values = [
    'Date',
    'Invoice #',
    'Supplier / Vendor',
    'Destination Branch',
    'Items Count',
    'Total Amount (₹)',
    'Notes / Reference',
  ];
  headerRow.height = 24;
  headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  purchases.forEach((p, index) => {
    const dateStr = new Date(p.purchaseDate || p.createdAt).toLocaleDateString('en-IN');
    const r = worksheet.addRow([
      dateStr,
      p.invoiceNumber || 'N/A',
      p.supplier?.name || 'N/A',
      p.branch?.name || 'N/A',
      p.items?.length || 0,
      Number(p.totalAmount || 0),
      p.notes || '',
    ]);

    r.height = 20;
    r.font = { name: 'Arial', size: 9.5 };
    const bgColor = index % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';
    r.eachCell((cell, col) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      if (col === 6) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '₹#,##0.00';
      } else if (col === 5) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  worksheet.columns = [
    { width: 14 },
    { width: 18 },
    { width: 28 },
    { width: 20 },
    { width: 14 },
    { width: 20 },
    { width: 30 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

export const generateMovementsExcel = async (movements: any[]): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PRC Hardware Inventory System';
  const worksheet = workbook.addWorksheet('Stock Ledger', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }],
  });

  worksheet.mergeCells('A1:H1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'PACIFIC HARDWARE — IMMUTABLE STOCK MOVEMENT LEDGER';
  titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 30;

  worksheet.mergeCells('A2:H2');
  const metaCell = worksheet.getCell('A2');
  metaCell.value = `Exported: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} | Total Transactions: ${movements.length}`;
  metaCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
  metaCell.alignment = { horizontal: 'center', vertical: 'middle' };

  const headerRow = worksheet.getRow(4);
  headerRow.values = [
    'Timestamp',
    'Product SKU',
    'Product Name',
    'Branch',
    'Movement Type',
    'Qty Changed',
    'Stock (Before → After)',
    'Reason / Notes',
  ];
  headerRow.height = 24;
  headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  movements.forEach((m, idx) => {
    const timeStr = new Date(m.createdAt).toLocaleString('en-IN');
    const isPositive = ['PURCHASE_IN', 'TRANSFER_IN', 'ADJUSTMENT_IN', 'RETURN_IN'].includes(m.type);
    const sign = isPositive ? `+${m.quantity}` : `-${m.quantity}`;

    const r = worksheet.addRow([
      timeStr,
      m.product?.sku || 'N/A',
      m.product?.name || 'N/A',
      m.branch?.name || 'N/A',
      m.type,
      sign,
      `${m.previousQty} → ${m.newQty}`,
      m.notes || m.referenceType || '',
    ]);

    r.height = 20;
    r.font = { name: 'Arial', size: 9.5 };
    const bgColor = idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';
    r.eachCell((cell, col) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      if (col === 6) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = {
          name: 'Arial',
          size: 9.5,
          bold: true,
          color: { argb: isPositive ? 'FF16A34A' : 'FFDC2626' },
        };
      } else if (col === 7) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
  });

  worksheet.columns = [
    { width: 20 },
    { width: 16 },
    { width: 34 },
    { width: 18 },
    { width: 18 },
    { width: 14 },
    { width: 22 },
    { width: 30 },
  ];

  const mBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(mBuffer);
};

// ─── PDF Reports Generator ────────────────────────────────────────────────────

export const generateStockPdf = async (data: any[], branchName: string = 'All Branches'): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const tableBody: any[] = [
      [
        { text: 'SKU', style: 'tableHeader' },
        { text: 'Product Name', style: 'tableHeader' },
        { text: 'Branch', style: 'tableHeader' },
        { text: 'Available', style: 'tableHeader', alignment: 'right' },
        { text: 'Reserved', style: 'tableHeader', alignment: 'right' },
        { text: 'Reorder', style: 'tableHeader', alignment: 'right' },
        { text: 'Status', style: 'tableHeader', alignment: 'center' },
      ],
    ];

    data.forEach((row, i) => {
      const isLow = row.quantity <= (row.reorderLevel || 10);
      const isEven = i % 2 === 0;
      const rowFill = isEven ? '#f8fafc' : '#ffffff';

      tableBody.push([
        { text: row.product?.sku || row.sku || 'N/A', fontSize: 8.5, fillColor: rowFill },
        { text: row.product?.name || row.productName || 'N/A', fontSize: 8.5, fillColor: rowFill },
        { text: row.branch?.name || row.branchName || 'N/A', fontSize: 8.5, fillColor: rowFill },
        { text: String(row.quantity), fontSize: 8.5, alignment: 'right', fillColor: rowFill, bold: true },
        { text: String(row.reservedQuantity || 0), fontSize: 8.5, alignment: 'right', fillColor: rowFill },
        { text: String(row.reorderLevel || 10), fontSize: 8.5, alignment: 'right', fillColor: rowFill },
        {
          text: isLow ? 'LOW STOCK' : row.quantity === 0 ? 'OUT OF STOCK' : 'IN STOCK',
          fontSize: 8,
          bold: true,
          alignment: 'center',
          color: isLow ? '#dc2626' : '#16a34a',
          fillColor: rowFill,
        },
      ]);
    });

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [30, 30, 30, 30],
      content: [
        {
          columns: [
            {
              text: 'PACIFIC HARDWARE',
              fontSize: 16,
              bold: true,
              color: '#0f172a',
            },
            {
              text: `MULTI-BRANCH STOCK REPORT\n${branchName.toUpperCase()}`,
              fontSize: 11,
              bold: true,
              color: '#d97706',
              alignment: 'right',
            },
          ],
        },
        {
          text: `Generated on ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} | Total SKUs: ${data.length}`,
          fontSize: 8,
          color: '#64748b',
          margin: [0, 4, 0, 12],
        },
        {
          table: {
            headerRows: 1,
            widths: ['18%', '34%', '16%', '10%', '8%', '7%', '17%'],
            body: tableBody,
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#cbd5e1',
            vLineColor: () => '#cbd5e1',
          },
        },
      ],
      styles: {
        tableHeader: {
          bold: true,
          fontSize: 8.5,
          color: '#ffffff',
          fillColor: '#0f172a',
          margin: [0, 4, 0, 4],
        },
      },
      defaultStyle: {
        font: 'Roboto',
      },
    };

    const doc = pdfmake.createPdf(docDefinition);
    doc.getBuffer((buffer: any) => {
      resolve(Buffer.from(buffer));
    });
  });
};
