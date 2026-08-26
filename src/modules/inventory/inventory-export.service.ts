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

import { getStockStatus } from './inventory.service';

// ─── Excel Reports Generator ──────────────────────────────────────────────────

export const generateStockExcel = async (data: any[], branchName: string = 'All Branches'): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PRC Hardware Inventory System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Current Stock Matrix', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }],
  });

  // Title Header
  worksheet.mergeCells('A1:K1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `PACIFIC HARDWARE — MULTI-BRANCH STOCK REPORT (${branchName.toUpperCase()})`;
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 32;

  // Metadata Sub-row
  worksheet.mergeCells('A2:K2');
  const metaCell = worksheet.getCell('A2');
  metaCell.value = `Generated On: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} | Total Listed SKUs: ${data.length}`;
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
    'Category',
    'Facility / Branch',
    'On-Hand Stock',
    'Available Qty',
    'Reserved Qty',
    'Reorder Level',
    'Unit Price (₹)',
    'Stock Value (₹)',
    'Stock Status',
  ];
  headerRow.height = 25;
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
    const onHand = Number(row.quantity ?? row.stock ?? 0);
    const reserved = Number(row.reservedQuantity ?? 0);
    const availableQty = Math.max(0, onHand - reserved);
    const reorder = Number(row.reorderLevel ?? row.product?.reorderLevel ?? 10);
    const stockInfo = getStockStatus(availableQty, reorder);
    const unitPrice = Number(row.product?.price ?? row.price ?? 0);
    const stockValue = onHand * unitPrice;

    const r = worksheet.addRow([
      row.product?.sku || row.sku || 'N/A',
      row.product?.name || row.productName || row.name || 'N/A',
      row.product?.category?.name || (typeof row.category === 'string' ? row.category : row.category?.name) || 'General',
      row.branch?.name || row.branchName || 'Central Depot',
      onHand,
      availableQty,
      reserved,
      reorder,
      unitPrice,
      stockValue,
      stockInfo.label.toUpperCase(),
    ]);

    r.height = 21;
    r.font = { name: 'Arial', size: 9.5 };

    const bgColor = index % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';
    r.eachCell((cell, colNumber) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      if (colNumber === 1 || colNumber === 3 || colNumber === 4) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colNumber === 2) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else if (colNumber >= 5 && colNumber <= 8) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0';
      } else if (colNumber === 9 || colNumber === 10) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '₹#,##0.00';
      } else if (colNumber === 11) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (stockInfo.isOutOfStock) {
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFDC2626' } };
        } else if (stockInfo.isLowStock) {
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFD97706' } };
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
    { width: 22 }, // Category
    { width: 22 }, // Branch
    { width: 14 }, // On-Hand Stock
    { width: 14 }, // Available Qty
    { width: 14 }, // Reserved Qty
    { width: 14 }, // Reorder Level
    { width: 16 }, // Unit Price (₹)
    { width: 18 }, // Stock Value (₹)
    { width: 18 }, // Stock Status
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
      const availableQty = Math.max(0, (row.quantity || 0) - (row.reservedQuantity || 0));
      const stockInfo = getStockStatus(availableQty, row.reorderLevel || row.product?.reorderLevel || 10);
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
          text: stockInfo.label.toUpperCase(),
          fontSize: 8,
          bold: true,
          alignment: 'center',
          color: stockInfo.isOutOfStock ? '#dc2626' : stockInfo.isLowStock ? '#d97706' : '#16a34a',
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

// ─── Product Traceability Dossier Exports (6-Sheet Excel & PDF) ───────────────

export const generateProductDossierExcel = async (dossier: any): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PRC Hardware Inventory Intelligence';
  workbook.created = new Date();

  const prod = dossier.product || {};
  const metrics = dossier.summaryMetrics || {};

  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 1: PRODUCT PROFILE
  // ══════════════════════════════════════════════════════════════════════════
  const s1 = workbook.addWorksheet('Product Profile');
  s1.columns = [{ width: 24 }, { width: 38 }, { width: 24 }, { width: 38 }];

  s1.mergeCells('A1:D1');
  const t1 = s1.getCell('A1');
  t1.value = `PRC HARDWARE — PRODUCT INVENTORY & AUDIT DOSSIER`;
  t1.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  t1.alignment = { horizontal: 'center', vertical: 'middle' };
  s1.getRow(1).height = 32;

  s1.mergeCells('A2:D2');
  const sub1 = s1.getCell('A2');
  sub1.value = `Product Name: ${prod.name || 'N/A'} | SKU: ${prod.sku || 'N/A'} | Generated On: ${new Date().toLocaleString('en-IN')}`;
  sub1.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF64748B' } };
  sub1.alignment = { horizontal: 'center', vertical: 'middle' };
  s1.getRow(2).height = 20;

  // Master Specs Table
  const pRows = [
    ['Product Name', prod.name || 'N/A', 'SKU Code', prod.sku || 'N/A'],
    ['Category', prod.categoryName || 'General', 'Brand / Manufacturer', prod.brand || 'PRC Architectural'],
    ['Current Stock Total', `${prod.stock || 0} Units`, 'Reorder Threshold', `${prod.reorderLevel || 10} Units`],
    ['Standard Retail Price', `₹${Number(prod.price || 0).toLocaleString('en-IN')}`, 'Sale / Contractor Price', prod.salePrice ? `₹${Number(prod.salePrice).toLocaleString('en-IN')}` : 'N/A'],
    ['Listing Status', String(prod.status || 'ACTIVE').toUpperCase(), 'Warranty', prod.warranty || '2 Years Commercial'],
    ['Dimensions', prod.dimensions ? JSON.stringify(prod.dimensions) : 'Standard', 'Weight', prod.weight ? `${prod.weight} kg` : 'N/A'],
    ['Created / Listed At', prod.createdAt ? new Date(prod.createdAt).toLocaleString('en-IN') : 'N/A', 'Last Catalog Update', prod.updatedAt ? new Date(prod.updatedAt).toLocaleString('en-IN') : 'N/A'],
    ['Lifetime Purchases Value', `₹${Number(metrics.totalPurchaseExpenditure || 0).toLocaleString('en-IN')}`, 'Lifetime Sales Revenue', `₹${Number(metrics.totalSalesRevenue || 0).toLocaleString('en-IN')}`],
    ['Total Units Purchased', `${metrics.totalPurchasedQty || 0} Units`, 'Total Units Sold', `${metrics.totalSoldQty || 0} Units`],
    ['Inventory Asset Value (Cost)', `₹${Number(metrics.inventoryValueAtCost || 0).toLocaleString('en-IN')}`, 'Inventory Asset Value (Retail)', `₹${Number(metrics.inventoryValueAtRetail || 0).toLocaleString('en-IN')}`],
  ];

  s1.addRow([]);
  const specHeader = s1.addRow(['ATTRIBUTE', 'SPECIFICATION', 'FINANCIAL METRIC', 'VALUE']);
  specHeader.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  specHeader.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  pRows.forEach((r, idx) => {
    const row = s1.addRow(r);
    row.font = { name: 'Arial', size: 9.5 };
    const bg = idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';
    row.eachCell((c, col) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      c.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      if (col === 1 || col === 3) c.font = { bold: true, color: { argb: 'FF475569' } };
    });
  });

  // Branch Allocation Table
  s1.addRow([]);
  const bTitle = s1.addRow(['WAREHOUSE BRANCH ALLOCATION MATRIX', '', '', '']);
  s1.mergeCells(`A${bTitle.number}:D${bTitle.number}`);
  bTitle.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  bTitle.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };

  const bHeader = s1.addRow(['Branch Code', 'Branch Facility Name', 'Available Quantity', 'Reorder Level']);
  bHeader.font = { name: 'Arial', size: 9.5, bold: true };
  (dossier.branchInventories || []).forEach((b: any) => {
    s1.addRow([b.branchCode, b.branchName, b.availableQuantity, b.reorderLevel]);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 2: VENDOR & PURCHASES
  // ══════════════════════════════════════════════════════════════════════════
  const s2 = workbook.addWorksheet('Vendor & Purchases', { views: [{ state: 'frozen', xSplit: 0, ySplit: 3 }] });
  s2.mergeCells('A1:H1');
  const t2 = s2.getCell('A1');
  t2.value = `PURCHASE & VENDOR PROCUREMENT AUDIT — ${prod.name || ''} (${prod.sku || ''})`;
  t2.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  t2.alignment = { horizontal: 'center', vertical: 'middle' };
  s2.getRow(1).height = 28;

  s2.getRow(3).values = ['Purchase Date', 'Invoice / PO #', 'Supplier / Vendor', 'Vendor Contact', 'Destination Branch', 'Qty Received', 'Unit Cost (₹)', 'Total Value (₹)'];
  s2.getRow(3).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  s2.getRow(3).eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  (dossier.purchases || []).forEach((p: any, idx: number) => {
    const r = s2.addRow([
      new Date(p.purchaseDate).toLocaleDateString('en-IN'),
      p.invoiceNumber,
      p.vendorName,
      p.vendorPhone || p.vendorEmail || 'N/A',
      `[${p.branchCode}] ${p.branchName}`,
      p.quantity,
      p.unitPurchasePrice,
      p.totalPurchaseValue,
    ]);
    r.font = { name: 'Arial', size: 9.5 };
    const bg = idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';
    r.eachCell((c, col) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      c.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      if (col === 6) c.numFmt = '#,##0';
      if (col === 7 || col === 8) c.numFmt = '₹#,##0.00';
    });
  });
  s2.columns = [{ width: 14 }, { width: 18 }, { width: 28 }, { width: 22 }, { width: 24 }, { width: 14 }, { width: 16 }, { width: 18 }];

  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 3: STOCK MOVEMENT LEDGER
  // ══════════════════════════════════════════════════════════════════════════
  const s3 = workbook.addWorksheet('Stock Ledger', { views: [{ state: 'frozen', xSplit: 0, ySplit: 3 }] });
  s3.mergeCells('A1:G1');
  const t3 = s3.getCell('A1');
  t3.value = `CHRONOLOGICAL STOCK LEDGER — ${prod.name || ''} (${prod.sku || ''})`;
  t3.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  t3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  t3.alignment = { horizontal: 'center', vertical: 'middle' };
  s3.getRow(1).height = 28;

  s3.getRow(3).values = ['Timestamp', 'Branch', 'Movement Type', 'Qty Delta', 'Stock Progression', 'User / Actor', 'Reason / Reference'];
  s3.getRow(3).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  s3.getRow(3).eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  (dossier.stockMovements || []).forEach((m: any, idx: number) => {
    const isPos = ['PURCHASE_IN', 'TRANSFER_IN', 'ADJUSTMENT_IN', 'RETURN_IN'].includes(m.type);
    const r = s3.addRow([
      new Date(m.createdAt).toLocaleString('en-IN'),
      m.branchName,
      m.type,
      `${isPos ? '+' : '-'}${m.quantity}`,
      `${m.previousQty} → ${m.newQty}`,
      m.performedByName,
      m.notes,
    ]);
    r.font = { name: 'Arial', size: 9.5 };
    const bg = idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';
    r.eachCell((c, col) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      c.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      if (col === 4) {
        c.font = { bold: true, color: { argb: isPos ? 'FF16A34A' : 'FFDC2626' } };
        c.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    });
  });
  s3.columns = [{ width: 20 }, { width: 22 }, { width: 18 }, { width: 14 }, { width: 18 }, { width: 20 }, { width: 32 }];

  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 4: SALES & CUSTOMER ORDERS
  // ══════════════════════════════════════════════════════════════════════════
  const s4 = workbook.addWorksheet('Sales & Orders', { views: [{ state: 'frozen', xSplit: 0, ySplit: 3 }] });
  s4.mergeCells('A1:I1');
  const t4 = s4.getCell('A1');
  t4.value = `CUSTOMER SALES & FULFILLMENT HISTORY — ${prod.name || ''} (${prod.sku || ''})`;
  t4.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  t4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  t4.alignment = { horizontal: 'center', vertical: 'middle' };
  s4.getRow(1).height = 28;

  s4.getRow(3).values = ['Order Date', 'Order #', 'Customer Name', 'City / State', 'Qty Sold', 'Unit Price (₹)', 'Line Total (₹)', 'Order Status', 'Delivery Date'];
  s4.getRow(3).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  s4.getRow(3).eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  (dossier.sales || []).forEach((s: any, idx: number) => {
    const r = s4.addRow([
      new Date(s.orderDate).toLocaleDateString('en-IN'),
      s.orderNumber,
      s.customerName,
      `${s.city}, ${s.state}`,
      s.quantity,
      s.salePricePerUnit,
      s.totalSaleValue,
      s.orderStatus,
      s.deliveredAt ? new Date(s.deliveredAt).toLocaleDateString('en-IN') : 'N/A',
    ]);
    r.font = { name: 'Arial', size: 9.5 };
    const bg = idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';
    r.eachCell((c, col) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      c.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      if (col === 5) c.numFmt = '#,##0';
      if (col === 6 || col === 7) c.numFmt = '₹#,##0.00';
    });
  });
  s4.columns = [{ width: 14 }, { width: 16 }, { width: 26 }, { width: 20 }, { width: 12 }, { width: 16 }, { width: 18 }, { width: 16 }, { width: 16 }];

  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 5: CUSTOMER DIRECTORY
  // ══════════════════════════════════════════════════════════════════════════
  const s5 = workbook.addWorksheet('Customer Directory', { views: [{ state: 'frozen', xSplit: 0, ySplit: 3 }] });
  s5.mergeCells('A1:G1');
  const t5 = s5.getCell('A1');
  t5.value = `BUYER DIRECTORY & SKU LIFETIME VALUE — ${prod.name || ''} (${prod.sku || ''})`;
  t5.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  t5.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  t5.alignment = { horizontal: 'center', vertical: 'middle' };
  s5.getRow(1).height = 28;

  s5.getRow(3).values = ['Customer / Company Name', 'Email', 'Phone', 'City / Location', 'Total Units Bought', 'Total Spend on SKU (₹)', 'Last Order Date'];
  s5.getRow(3).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  s5.getRow(3).eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  (dossier.customerDirectory || []).forEach((c: any, idx: number) => {
    const r = s5.addRow([
      c.companyName ? `${c.customerName} (${c.companyName})` : c.customerName,
      c.email || 'N/A',
      c.phone || 'N/A',
      `${c.city || ''}, ${c.state || ''}`.trim().replace(/^,/, ''),
      c.totalUnitsPurchased,
      c.totalSpendOnSku,
      new Date(c.lastOrderDate).toLocaleDateString('en-IN'),
    ]);
    r.font = { name: 'Arial', size: 9.5 };
    const bg = idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';
    r.eachCell((cell, col) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      if (col === 5) cell.numFmt = '#,##0';
      if (col === 6) cell.numFmt = '₹#,##0.00';
    });
  });
  s5.columns = [{ width: 28 }, { width: 26 }, { width: 18 }, { width: 20 }, { width: 18 }, { width: 22 }, { width: 16 }];

  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 6: COMPLETE AUDIT TIMELINE
  // ══════════════════════════════════════════════════════════════════════════
  const s6 = workbook.addWorksheet('Audit Timeline', { views: [{ state: 'frozen', xSplit: 0, ySplit: 3 }] });
  s6.mergeCells('A1:F1');
  const t6 = s6.getCell('A1');
  t6.value = `COMPLETE CHRONOLOGICAL AUDIT TIMELINE — ${prod.name || ''} (${prod.sku || ''})`;
  t6.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  t6.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  t6.alignment = { horizontal: 'center', vertical: 'middle' };
  s6.getRow(1).height = 28;

  s6.getRow(3).values = ['Timestamp', 'Lifecycle Stage', 'Event Title', 'Actor / User', 'Reference #', 'Detailed Event Log'];
  s6.getRow(3).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  s6.getRow(3).eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  (dossier.timeline || []).forEach((t: any, idx: number) => {
    const r = s6.addRow([
      new Date(t.timestamp).toLocaleString('en-IN'),
      t.stage,
      t.title,
      t.actor,
      t.reference,
      t.description,
    ]);
    r.font = { name: 'Arial', size: 9.5 };
    const bg = idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';
    r.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
    });
  });
  s6.columns = [{ width: 20 }, { width: 20 }, { width: 30 }, { width: 22 }, { width: 18 }, { width: 55 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

export const generateProductDossierPdf = async (dossier: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const prod = dossier.product || {};
    const metrics = dossier.summaryMetrics || {};

    const purchasesRows: any[] = [
      [
        { text: 'Date', style: 'tableHeader' },
        { text: 'Invoice #', style: 'tableHeader' },
        { text: 'Supplier', style: 'tableHeader' },
        { text: 'Qty', style: 'tableHeader', alignment: 'right' },
        { text: 'Rate (₹)', style: 'tableHeader', alignment: 'right' },
        { text: 'Total (₹)', style: 'tableHeader', alignment: 'right' },
      ],
    ];

    (dossier.purchases || []).slice(0, 15).forEach((p: any, i: number) => {
      const fill = i % 2 === 0 ? '#f8fafc' : '#ffffff';
      purchasesRows.push([
        { text: new Date(p.purchaseDate).toLocaleDateString('en-IN'), fontSize: 8, fillColor: fill },
        { text: p.invoiceNumber || 'N/A', fontSize: 8, fillColor: fill },
        { text: p.vendorName || 'Supplier', fontSize: 8, fillColor: fill },
        { text: String(p.quantity), fontSize: 8, alignment: 'right', fillColor: fill },
        { text: `₹${Number(p.unitPurchasePrice).toLocaleString('en-IN')}`, fontSize: 8, alignment: 'right', fillColor: fill },
        { text: `₹${Number(p.totalPurchaseValue).toLocaleString('en-IN')}`, fontSize: 8, alignment: 'right', fillColor: fill, bold: true },
      ]);
    });

    const movementsRows: any[] = [
      [
        { text: 'Timestamp', style: 'tableHeader' },
        { text: 'Type', style: 'tableHeader' },
        { text: 'Branch', style: 'tableHeader' },
        { text: 'Qty', style: 'tableHeader', alignment: 'right' },
        { text: 'Progression', style: 'tableHeader', alignment: 'center' },
        { text: 'Reason / Note', style: 'tableHeader' },
      ],
    ];

    (dossier.stockMovements || []).slice(0, 20).forEach((m: any, i: number) => {
      const fill = i % 2 === 0 ? '#f8fafc' : '#ffffff';
      const isPos = ['PURCHASE_IN', 'TRANSFER_IN', 'ADJUSTMENT_IN', 'RETURN_IN'].includes(m.type);
      movementsRows.push([
        { text: new Date(m.createdAt).toLocaleDateString('en-IN'), fontSize: 8, fillColor: fill },
        { text: m.type, fontSize: 8, fillColor: fill },
        { text: m.branchName, fontSize: 8, fillColor: fill },
        { text: `${isPos ? '+' : '-'}${m.quantity}`, fontSize: 8, alignment: 'right', bold: true, color: isPos ? '#16a34a' : '#dc2626', fillColor: fill },
        { text: `${m.previousQty} → ${m.newQty}`, fontSize: 8, alignment: 'center', fillColor: fill },
        { text: m.notes || 'Routine update', fontSize: 8, fillColor: fill },
      ]);
    });

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [28, 28, 28, 28],
      content: [
        {
          columns: [
            { text: 'PRC HARDWARE', fontSize: 16, bold: true, color: '#0f172a' },
            { text: 'PRODUCT INVENTORY & AUDIT DOSSIER', fontSize: 11, bold: true, color: '#d97706', alignment: 'right' },
          ],
        },
        {
          text: `Generated on ${new Date().toLocaleString('en-IN')} | Master SKU Audit`,
          fontSize: 8,
          color: '#64748b',
          margin: [0, 2, 0, 10],
        },
        {
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 539, y2: 0, lineWidth: 1.5, lineColor: '#d97706' }],
          margin: [0, 0, 0, 10],
        },
        {
          style: 'card',
          table: {
            widths: ['25%', '25%', '25%', '25%'],
            body: [
              [
                { text: 'PRODUCT NAME', bold: true, fontSize: 8, color: '#64748b' },
                { text: prod.name || 'N/A', bold: true, fontSize: 9, color: '#0f172a' },
                { text: 'SKU CODE', bold: true, fontSize: 8, color: '#64748b' },
                { text: prod.sku || 'N/A', bold: true, fontSize: 9, color: '#0f172a' },
              ],
              [
                { text: 'CATEGORY', bold: true, fontSize: 8, color: '#64748b' },
                { text: prod.categoryName || 'Hardware', fontSize: 8.5 },
                { text: 'CURRENT STOCK', bold: true, fontSize: 8, color: '#64748b' },
                { text: `${prod.stock || 0} Units (${prod.status || 'ACTIVE'})`, bold: true, fontSize: 9, color: '#16a34a' },
              ],
              [
                { text: 'RETAIL PRICE', bold: true, fontSize: 8, color: '#64748b' },
                { text: `₹${Number(prod.price || 0).toLocaleString('en-IN')}`, bold: true, fontSize: 8.5 },
                { text: 'AVG PURCHASE COST', bold: true, fontSize: 8, color: '#64748b' },
                { text: `₹${Number(metrics.avgPurchaseCost || 0).toLocaleString('en-IN')}`, bold: true, fontSize: 8.5 },
              ],
              [
                { text: 'LIFETIME PURCHASES', bold: true, fontSize: 8, color: '#64748b' },
                { text: `${metrics.totalPurchasedQty || 0} Units (₹${Number(metrics.totalPurchaseExpenditure || 0).toLocaleString('en-IN')})`, fontSize: 8 },
                { text: 'LIFETIME SALES', bold: true, fontSize: 8, color: '#64748b' },
                { text: `${metrics.totalSoldQty || 0} Units (₹${Number(metrics.totalSalesRevenue || 0).toLocaleString('en-IN')})`, fontSize: 8 },
              ],
            ],
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 12],
        },
        { text: 'PROCUREMENT & VENDOR PURCHASES', fontSize: 10, bold: true, color: '#0f172a', margin: [0, 6, 0, 4] },
        {
          table: {
            headerRows: 1,
            widths: ['16%', '18%', '28%', '10%', '14%', '14%'],
            body: purchasesRows,
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#cbd5e1',
            vLineColor: () => '#cbd5e1',
          },
          margin: [0, 0, 0, 12],
        },
        { text: 'CHRONOLOGICAL STOCK LEDGER MOVEMENTS', fontSize: 10, bold: true, color: '#0f172a', margin: [0, 6, 0, 4] },
        {
          table: {
            headerRows: 1,
            widths: ['18%', '20%', '18%', '10%', '14%', '20%'],
            body: movementsRows,
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
          fontSize: 8,
          color: '#ffffff',
          fillColor: '#0f172a',
          margin: [0, 3, 0, 3],
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
