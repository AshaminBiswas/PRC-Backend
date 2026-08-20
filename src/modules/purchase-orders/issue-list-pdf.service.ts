/**
 * issue-list-pdf.service.ts
 *
 * Production-grade Product Issue List / Dispatch Issue Note / Delivery Challan PDF generator.
 * Details all items dispatched from the warehouse with itemized rates, quantities, HSN codes,
 * taxes, carrier details, and formal storekeeper / consignee sign-off sections.
 */

import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require('pdfmake');
import type { TDocumentDefinitions, Margins, TableCell } from 'pdfmake/interfaces';

// Brand Colours
const NAVY = '#0f172a';
const AMBER = '#b45309';
const BLUE = '#1d4ed8';
const GREEN = '#065f46';
const LIGHT_BG = '#f8fafc';
const BORDER = '#e2e8f0';
const GRAY = '#64748b';
const TABLE_HEADER_BG = '#1e293b';

function formatCurrency(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(Number(num))) return '₹0.00';
  return `₹${Number(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function makeCell(
  text: string,
  options: {
    bold?: boolean;
    align?: 'left' | 'center' | 'right';
    color?: string;
    fillColor?: string;
    fontSize?: number;
    colSpan?: number;
  } = {}
): TableCell {
  return {
    text,
    bold: options.bold ?? false,
    alignment: options.align ?? 'left',
    color: options.color ?? '#1e293b',
    fillColor: options.fillColor,
    fontSize: options.fontSize ?? 8.5,
    margin: [4, 4, 4, 4] as Margins,
    colSpan: options.colSpan,
  };
}

export interface IssueListPdfData {
  issueNumber: string;
  poNumber: string;
  quotationNumber?: string | null;
  invoiceNumber?: string | null;
  ewayBillRef?: string | null;
  issuedAt: Date | string;
  issuedByName?: string | null;
  receivedByName?: string | null;
  carrierName?: string | null;
  vehicleNumber?: string | null;
  customerName: string;
  customerCompany?: string | null;
  customerGstin?: string | null;
  billingAddress: any;
  deliveryAddress: any;
  items: Array<{
    slNo: number;
    productName: string;
    sku?: string | null;
    hsnCode?: string | null;
    unit: string;
    quantity: number;
    rate: number;
    amount: number;
    taxRate?: number;
    taxAmount?: number;
    total: number;
  }>;
  totalQuantity: number;
  totalValue: number;
  notes?: string | null;
}

export const generateIssueListPdfBuffer = async (
  data: IssueListPdfData
): Promise<Buffer> => {
  const itemRows: TableCell[][] = [
    [
      makeCell('#', { bold: true, align: 'center', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('Product Description & Specifications', { bold: true, color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('SKU / HSN', { bold: true, align: 'center', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('Issued Qty', { bold: true, align: 'center', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('Unit Rate', { bold: true, align: 'right', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('Taxable Amt', { bold: true, align: 'right', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('GST %', { bold: true, align: 'center', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('Total Value', { bold: true, align: 'right', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
    ],
  ];

  data.items.forEach((item, index) => {
    const isEven = index % 2 === 0;
    const rowBg = isEven ? '#ffffff' : LIGHT_BG;
    const hsnSku = [item.sku ? `SKU: ${item.sku}` : '', item.hsnCode ? `HSN: ${item.hsnCode}` : ''].filter(Boolean).join('\n') || '—';

    itemRows.push([
      makeCell(String(item.slNo || index + 1), { align: 'center', fillColor: rowBg }),
      makeCell(item.productName, { bold: true, fillColor: rowBg }),
      makeCell(hsnSku, { align: 'center', color: GRAY, fontSize: 7.5, fillColor: rowBg }),
      makeCell(`${item.quantity} ${item.unit || 'PCS'}`, { align: 'center', bold: true, color: BLUE, fillColor: rowBg }),
      makeCell(formatCurrency(item.rate), { align: 'right', fillColor: rowBg }),
      makeCell(formatCurrency(item.amount), { align: 'right', fillColor: rowBg }),
      makeCell(item.taxRate ? `${item.taxRate}%` : '18%', { align: 'center', color: GRAY, fillColor: rowBg }),
      makeCell(formatCurrency(item.total || item.amount), { align: 'right', bold: true, fillColor: rowBg }),
    ]);
  });

  const billTo = data.billingAddress || {};
  const shipTo = data.deliveryAddress || billTo;

  const docDefinition = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [36, 36, 36, 44] as Margins,
    defaultStyle: {
      font: 'Roboto',
      fontSize: 8.5,
      color: NAVY,
      lineHeight: 1.2,
    },
    content: [
      // Top Header
      {
        columns: [
          {
            width: '60%',
            stack: [
              { text: 'PRC HARDWARE CENTRAL LOGISTICS', fontSize: 15, bold: true, color: NAVY },
              { text: 'Store Issue Note & Delivery Challan (Outward Dispatch)', fontSize: 8, color: AMBER, bold: true, margin: [0, 2, 0, 4] },
              { text: 'Dispatch Warehouse: Central DC, Mandoli Industrial Area, Delhi - 110093', fontSize: 7.5, color: GRAY },
              { text: 'GSTIN: 07AAECP1234F1Z5 | Phone: +91 11 2233 4455', fontSize: 7.5, color: GRAY },
            ],
          },
          {
            width: '40%',
            stack: [
              {
                table: {
                  widths: ['100%'],
                  body: [
                    [
                      {
                        fillColor: '#f1f5f9',
                        margin: [8, 6, 8, 6],
                        stack: [
                          { text: 'PRODUCT ISSUE SLIP', fontSize: 11, bold: true, color: NAVY, alignment: 'right' },
                          { text: `Issue Ref: ${data.issueNumber}`, fontSize: 9.5, bold: true, color: BLUE, alignment: 'right', margin: [0, 2, 0, 1] },
                          { text: `Issue Date: ${formatDate(data.issuedAt)}`, fontSize: 8, color: GRAY, alignment: 'right' },
                        ],
                      },
                    ],
                  ],
                },
                layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => BORDER, vLineColor: () => BORDER },
              },
            ],
          },
        ],
        margin: [0, 0, 0, 12],
      },

      // Reference Grid
      {
        table: {
          widths: ['25%', '25%', '25%', '25%'],
          body: [
            [
              { text: 'Master PO #', fontSize: 7.5, bold: true, color: GRAY, fillColor: '#f1f5f9' },
              { text: 'Tax Invoice Ref', fontSize: 7.5, bold: true, color: GRAY, fillColor: '#f1f5f9' },
              { text: 'E-Way Bill No', fontSize: 7.5, bold: true, color: GRAY, fillColor: '#f1f5f9' },
              { text: 'Carrier / Transporter', fontSize: 7.5, bold: true, color: GRAY, fillColor: '#f1f5f9' },
            ],
            [
              { text: data.poNumber, fontSize: 8.5, bold: true, color: NAVY },
              { text: data.invoiceNumber || '—', fontSize: 8.5, color: NAVY },
              { text: data.ewayBillRef || '—', fontSize: 8.5, bold: true, color: GREEN },
              { text: `${data.carrierName || 'BlueDart Express'} (${data.vehicleNumber || 'DL01AB1234'})`, fontSize: 8, bold: true, color: BLUE },
            ],
          ],
        },
        layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => BORDER, vLineColor: () => BORDER },
        margin: [0, 0, 0, 12],
      },

      // Addresses
      {
        columns: [
          {
            width: '50%',
            stack: [
              { text: 'CONSIGNED CUSTOMER:', fontSize: 8, bold: true, color: GRAY },
              { text: data.customerCompany || data.customerName, fontSize: 9, bold: true, color: NAVY, margin: [0, 2, 0, 1] },
              { text: `${billTo.addressLine1 || '—'}, ${billTo.city || ''} - ${billTo.postalCode || ''}`, fontSize: 7.5, color: '#334155' },
              { text: `GSTIN: ${data.customerGstin || 'URP'}`, fontSize: 7.5, bold: true, color: GRAY },
            ],
          },
          {
            width: '50%',
            stack: [
              { text: 'DELIVERY DESTINATION:', fontSize: 8, bold: true, color: GRAY },
              { text: shipTo.companyName || shipTo.attentionTo || data.customerName, fontSize: 9, bold: true, color: NAVY, margin: [0, 2, 0, 1] },
              { text: `${shipTo.addressLine1 || '—'}, ${shipTo.city || ''} - ${shipTo.postalCode || ''}`, fontSize: 7.5, color: '#334155' },
              { text: `Attention: ${shipTo.attentionTo || data.customerName} (${shipTo.phone || '—'})`, fontSize: 7.5, color: GRAY },
            ],
          },
        ],
        margin: [0, 0, 0, 12],
      },

      // Line Items Table
      {
        table: {
          headerRows: 1,
          widths: [18, '*', 65, 45, 50, 55, 35, 60],
          body: itemRows,
        },
        layout: { hLineWidth: () => 0.5, vLineWidth: () => 0, hLineColor: () => BORDER },
        margin: [0, 0, 0, 12],
      },

      // Summary Total Row
      {
        table: {
          widths: ['70%', '15%', '15%'],
          body: [
            [
              { text: 'DISPATCH TOTAL SUMMARY', bold: true, color: NAVY, fillColor: '#f1f5f9' },
              { text: `Qty: ${data.totalQuantity} PCS`, bold: true, alignment: 'center', color: BLUE, fillColor: '#f1f5f9' },
              { text: formatCurrency(data.totalValue), bold: true, alignment: 'right', color: NAVY, fillColor: '#f1f5f9' },
            ],
          ],
        },
        layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => BORDER, vLineColor: () => BORDER },
        margin: [0, 0, 0, 16],
      },

      // Dual Signature Sign-off
      {
        columns: [
          {
            width: '48%',
            stack: [
              {
                table: {
                  widths: ['100%'],
                  body: [
                    [
                      {
                        fillColor: '#fafafa',
                        margin: [8, 8, 8, 8],
                        stack: [
                          { text: 'ISSUED BY (WAREHOUSE STOREKEEPER)', fontSize: 7.5, bold: true, color: GRAY },
                          { text: data.issuedByName || 'Central DC Store Manager', fontSize: 8.5, bold: true, color: NAVY, margin: [0, 16, 0, 2] },
                          { text: `Signature & Date: ${formatDate(data.issuedAt)}`, fontSize: 7, color: GREEN },
                          { text: 'Physical items verified & packed per standards', fontSize: 6.5, color: GRAY },
                        ],
                      },
                    ],
                  ],
                },
                layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => BORDER, vLineColor: () => BORDER },
              },
            ],
          },
          { width: '4%', text: '' },
          {
            width: '48%',
            stack: [
              {
                table: {
                  widths: ['100%'],
                  body: [
                    [
                      {
                        fillColor: '#fafafa',
                        margin: [8, 8, 8, 8],
                        stack: [
                          { text: 'RECEIVED BY (TRANSPORTER / CONSIGNEE)', fontSize: 7.5, bold: true, color: GRAY },
                          { text: data.receivedByName || 'Transporter Representative / Driver', fontSize: 8.5, bold: true, color: NAVY, margin: [0, 16, 0, 2] },
                          { text: 'Receiver Signature & Company Stamp', fontSize: 7, color: GRAY },
                          { text: 'Received all listed goods in intact, undamaged condition', fontSize: 6.5, color: GRAY },
                        ],
                      },
                    ],
                  ],
                },
                layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => BORDER, vLineColor: () => BORDER },
              },
            ],
          },
        ],
      },
    ],
    footer: (currentPage: number, pageCount: number) => ({
      margin: [36, 0, 36, 0] as Margins,
      columns: [
        { text: `Product Issue Slip: ${data.issueNumber} | Master PO: ${data.poNumber}`, fontSize: 7, color: GRAY },
        { text: `Page ${currentPage} of ${pageCount}`, fontSize: 7, color: GRAY, alignment: 'right' },
      ],
    }),
  };

  const doc = pdfmake.createPdf(docDefinition as unknown as TDocumentDefinitions);
  return await doc.getBuffer();
};
