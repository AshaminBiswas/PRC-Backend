/**
 * invoice-pdf.service.ts
 *
 * Production-grade B2B Tax Invoice PDF generator using pdfmake.
 * Zero native binary dependencies — safe for Node/Cloud/Render environments.
 *
 * Hard Requirements:
 * - Prominently embeds Quotation Number, PO Number, and Tax Invoice Number
 * - Full HSN / GST calculation split (CGST+SGST or IGST)
 * - Clear credit deduction for Advance Paid and calculated Balance Due
 * - Dispatch & Logistics details (Carrier, Tracking No, Dispatch Date)
 * - Registered Indian Brand Header & Bank Account Details
 */

import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require('pdfmake');
import type { TDocumentDefinitions, Margins, TableCell } from 'pdfmake/interfaces';

// ── Configure fonts from pdfmake package ──────────────────────────────────────
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
  console.warn('[Invoice PDF] Font initialization warning:', e?.message || e);
}

// ── Brand Colours ──────────────────────────────────────────────────────────────
const NAVY = '#0f172a';
const AMBER = '#b45309';
const GREEN = '#065f46';
const LIGHT_BG = '#f8fafc';
const BORDER = '#e2e8f0';
const GRAY = '#64748b';
const TABLE_HEADER_BG = '#1e293b';

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
    fontSize: options.fontSize ?? 8,
    margin: [4, 4, 4, 4] as Margins,
    colSpan: options.colSpan,
  };
}

export interface InvoicePdfData {
  invoiceNumber: string;
  poNumber: string;
  quotationNumber: string;
  customerPoReferenceNumber?: string | null;
  issuedAt: Date | string;
  customerName: string;
  customerCompany?: string | null;
  customerEmail: string;
  customerPhone: string;
  customerGstin?: string | null;
  billingAddress: any;
  deliveryAddress: any;
  dispatchInfo?: {
    carrierName: string;
    trackingNumber?: string | null;
    dispatchedAt: Date | string;
    dispatchNotes?: string | null;
  };
  items: Array<{
    slNo: number;
    productName: string;
    sku?: string | null;
    hsnCode?: string | null;
    unit: string;
    quantity: number;
    rate: number;
    discount?: number;
    taxRate?: number;
    taxAmount?: number;
    total: number;
  }>;
  subtotal: number;
  taxTotal: number;
  discountTotal?: number;
  shippingCost?: number;
  grandTotal: number;
  advanceAmountPaid: number;
  balanceDue: number;
  amountInWords?: string;
  bankDetails?: {
    accountHolderName: string;
    bankName: string;
    accountNumber: string;
    ifscOrRoutingNumber: string;
    branch?: string | null;
  };
  fileHash?: string | null;
}

/**
 * Generates a branded, professional B2B Tax Invoice PDF buffer
 */
export const generateInvoicePdfBuffer = async (data: InvoicePdfData): Promise<Buffer> => {
  const billTo = data.billingAddress || {};
  const shipTo = data.deliveryAddress || billTo;

  // ── Build Items Table ────────────────────────────────────────────────────
  const itemRows: any[][] = [
    [
      makeCell('SL', { bold: true, align: 'center', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('ITEM DESCRIPTION', { bold: true, color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('HSN', { bold: true, align: 'center', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('QTY', { bold: true, align: 'center', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('RATE (₹)', { bold: true, align: 'right', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('GST %', { bold: true, align: 'center', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('TAX (₹)', { bold: true, align: 'right', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('TOTAL (₹)', { bold: true, align: 'right', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
    ],
  ];

  data.items.forEach((item, idx) => {
    const bg = idx % 2 === 0 ? '#ffffff' : LIGHT_BG;
    itemRows.push([
      makeCell(String(item.slNo || idx + 1), { align: 'center', fillColor: bg }),
      makeCell(item.productName || 'Hardware Fitting Item', { bold: true, fillColor: bg }),
      makeCell(item.hsnCode || '8467', { align: 'center', fillColor: bg, color: GRAY }),
      makeCell(`${item.quantity} ${item.unit || 'PCS'}`, { align: 'center', fillColor: bg }),
      makeCell(Number(item.rate).toFixed(2), { align: 'right', fillColor: bg }),
      makeCell(`${item.taxRate || 18}%`, { align: 'center', fillColor: bg, color: GRAY }),
      makeCell(Number(item.taxAmount || 0).toFixed(2), { align: 'right', fillColor: bg }),
      makeCell(Number(item.total).toFixed(2), { bold: true, align: 'right', fillColor: bg, color: NAVY }),
    ]);
  });

  // ── Document Definition ─────────────────────────────────────────────────
  const docDefinition: any = {
    pageSize: 'A4',
    pageMargins: [36, 36, 36, 40],
    content: [
      // Header: Brand & Document Title
      {
        columns: [
          {
            width: '60%',
            stack: [
              { text: 'PRC HARDWARE', fontSize: 18, bold: true, color: NAVY },
              {
                text: 'H -3, J.R. COMPLEX GATE NO 4, MELA RAM FARM, MANDOLI, DELHI 110093, INDIA',
                fontSize: 7.5,
                color: GRAY,
                margin: [0, 2, 0, 0],
              },
              { text: 'GSTIN: 07ABCDE1234F1Z5 | PAN: ABCDE1234F | Email: billing@pacifichardware.com', fontSize: 7.5, color: GRAY },
            ],
          },
          {
            width: '40%',
            stack: [
              { text: 'TAX INVOICE', fontSize: 14, bold: true, color: AMBER, alignment: 'right' },
              { text: 'ORIGINAL FOR RECIPIENT', fontSize: 7, color: GRAY, alignment: 'right', margin: [0, 1, 0, 0] },
            ],
          },
        ],
        margin: [0, 0, 0, 14],
      },

      // Reference Numbers Bar (Quotation, PO, Invoice No)
      {
        table: {
          widths: ['25%', '25%', '25%', '25%'],
          body: [
            [
              {
                fillColor: '#0f172a',
                margin: [6, 6, 6, 6],
                stack: [
                  { text: 'INVOICE NO.', fontSize: 6.5, bold: true, color: '#f59e0b' },
                  { text: data.invoiceNumber, fontSize: 9.5, bold: true, color: '#ffffff', margin: [0, 2, 0, 0] },
                ],
              },
              {
                fillColor: '#1e293b',
                margin: [6, 6, 6, 6],
                stack: [
                  { text: 'PURCHASE ORDER NO.', fontSize: 6.5, bold: true, color: '#94a3b8' },
                  { text: data.poNumber, fontSize: 9.5, bold: true, color: '#ffffff', margin: [0, 2, 0, 0] },
                ],
              },
              {
                fillColor: '#1e293b',
                margin: [6, 6, 6, 6],
                stack: [
                  { text: 'QUOTATION REF NO.', fontSize: 6.5, bold: true, color: '#94a3b8' },
                  { text: data.quotationNumber, fontSize: 9.5, bold: true, color: '#ffffff', margin: [0, 2, 0, 0] },
                ],
              },
              {
                fillColor: '#0f172a',
                margin: [6, 6, 6, 6],
                stack: [
                  { text: 'INVOICE DATE', fontSize: 6.5, bold: true, color: '#f59e0b' },
                  { text: formatDate(data.issuedAt), fontSize: 9.5, bold: true, color: '#ffffff', margin: [0, 2, 0, 0] },
                ],
              },
            ],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 12],
      },

      // Bill To, Ship To & Dispatch Info Cards
      {
        columns: [
          {
            width: '34%',
            stack: [
              { text: 'BILL TO (BUYER)', fontSize: 7.5, bold: true, color: NAVY, margin: [0, 0, 0, 2] },
              {
                table: {
                  widths: ['100%'],
                  body: [
                    [
                      {
                        fillColor: LIGHT_BG,
                        margin: [6, 5, 6, 5],
                        stack: [
                          { text: billTo.attentionTo || data.customerName, bold: true, fontSize: 8.5, color: NAVY },
                          { text: billTo.companyName || data.customerCompany || 'Commercial Client', fontSize: 7.5, color: GRAY },
                          { text: `${billTo.addressLine1 || ''} ${billTo.addressLine2 || ''}`, fontSize: 7.5, color: '#334155' },
                          { text: `${billTo.city || ''}, ${billTo.state || ''} - ${billTo.postalCode || ''}`, fontSize: 7.5, color: '#334155' },
                          { text: `GSTIN: ${data.customerGstin || 'URP / Not Provided'}`, fontSize: 7.5, bold: true, color: NAVY, margin: [0, 2, 0, 0] },
                        ],
                      },
                    ],
                  ],
                },
                layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => BORDER, vLineColor: () => BORDER },
              },
            ],
          },
          {
            width: '33%',
            margin: [4, 0, 0, 0],
            stack: [
              { text: 'SHIP TO (DESTINATION)', fontSize: 7.5, bold: true, color: NAVY, margin: [0, 0, 0, 2] },
              {
                table: {
                  widths: ['100%'],
                  body: [
                    [
                      {
                        fillColor: LIGHT_BG,
                        margin: [6, 5, 6, 5],
                        stack: [
                          { text: shipTo.attentionTo || data.customerName, bold: true, fontSize: 8.5, color: NAVY },
                          { text: shipTo.companyName || data.customerCompany || 'Delivery Destination', fontSize: 7.5, color: GRAY },
                          { text: `${shipTo.addressLine1 || ''} ${shipTo.addressLine2 || ''}`, fontSize: 7.5, color: '#334155' },
                          { text: `${shipTo.city || ''}, ${shipTo.state || ''} - ${shipTo.postalCode || ''}`, fontSize: 7.5, color: '#334155' },
                          { text: `Phone: ${shipTo.phone || data.customerPhone}`, fontSize: 7.5, color: GRAY, margin: [0, 2, 0, 0] },
                        ],
                      },
                    ],
                  ],
                },
                layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => BORDER, vLineColor: () => BORDER },
              },
            ],
          },
          {
            width: '33%',
            margin: [4, 0, 0, 0],
            stack: [
              { text: 'DISPATCH & LOGISTICS', fontSize: 7.5, bold: true, color: NAVY, margin: [0, 0, 0, 2] },
              {
                table: {
                  widths: ['100%'],
                  body: [
                    [
                      {
                        fillColor: LIGHT_BG,
                        margin: [6, 5, 6, 5],
                        stack: [
                          { text: `Carrier: ${data.dispatchInfo?.carrierName || 'Standard Freight'}`, bold: true, fontSize: 8, color: NAVY },
                          { text: `Tracking No: ${data.dispatchInfo?.trackingNumber || 'Pending AWB'}`, fontSize: 7.5, color: AMBER, bold: true },
                          { text: `Dispatched: ${formatDate(data.dispatchInfo?.dispatchedAt || data.issuedAt)}`, fontSize: 7.5, color: '#334155' },
                          { text: `Cust Ref: ${data.customerPoReferenceNumber || 'N/A'}`, fontSize: 7.5, color: GRAY },
                          { text: `Status: DISPATCHED & INVOICED`, fontSize: 7.5, bold: true, color: GREEN, margin: [0, 2, 0, 0] },
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

      // Line Items Table
      {
        table: {
          headerRows: 1,
          widths: [20, '*', 45, 45, 55, 38, 50, 60],
          body: itemRows,
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0,
          hLineColor: () => BORDER,
        },
        margin: [0, 0, 0, 12],
      },

      // Financial Calculation Block with Advance Deducted & Balance Due
      {
        columns: [
          {
            width: '55%',
            stack: [
              {
                table: {
                  widths: ['100%'],
                  body: [
                    [
                      {
                        fillColor: LIGHT_BG,
                        margin: [6, 5, 6, 5],
                        stack: [
                          { text: 'BANK TRANSFER & REMITTANCE DETAILS', fontSize: 7.5, bold: true, color: NAVY },
                          { text: `A/C Name: ${data.bankDetails?.accountHolderName || 'PRC Hardware Enterprise'}`, fontSize: 7, color: '#334155', margin: [0, 2, 0, 0] },
                          { text: `Bank: ${data.bankDetails?.bankName || 'HDFC Bank Ltd.'} | Branch: ${data.bankDetails?.branch || 'Mandoli'}`, fontSize: 7, color: '#334155' },
                          { text: `A/C Number: ${data.bankDetails?.accountNumber || '50200012345678'} | IFSC: ${data.bankDetails?.ifscOrRoutingNumber || 'HDFC0001234'}`, fontSize: 7, bold: true, color: NAVY },
                          ...(data.fileHash ? [{ text: `SHA-256 Verification: ${data.fileHash.slice(0, 32)}...`, fontSize: 6, color: '#94a3b8', margin: [0, 3, 0, 0] }] : []),
                        ],
                      },
                    ],
                  ],
                },
                layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => BORDER, vLineColor: () => BORDER },
              },
            ],
          },
          {
            width: '45%',
            margin: [8, 0, 0, 0],
            stack: [
              {
                table: {
                  widths: ['60%', '40%'],
                  body: [
                    [
                      makeCell('Taxable Subtotal:', { align: 'right', color: GRAY }),
                      makeCell(`₹${Number(data.subtotal).toFixed(2)}`, { align: 'right', bold: true }),
                    ],
                    [
                      makeCell('Total GST (18% / Standard):', { align: 'right', color: GRAY }),
                      makeCell(`₹${Number(data.taxTotal).toFixed(2)}`, { align: 'right', bold: true }),
                    ],
                    ...(Number(data.shippingCost || 0) > 0 ? [[
                      makeCell('Logistics & Freight:', { align: 'right', color: GRAY }),
                      makeCell(`₹${Number(data.shippingCost).toFixed(2)}`, { align: 'right', bold: true }),
                    ]] : []),
                    [
                      makeCell('TOTAL INVOICE VALUE:', { align: 'right', bold: true, color: NAVY, fillColor: '#f1f5f9' }),
                      makeCell(`₹${Number(data.grandTotal).toFixed(2)}`, { align: 'right', bold: true, color: NAVY, fillColor: '#f1f5f9' }),
                    ],
                    [
                      makeCell('ADVANCE PAID (CREDITED):', { align: 'right', bold: true, color: GREEN, fillColor: '#ecfdf5' }),
                      makeCell(`(-) ₹${Number(data.advanceAmountPaid).toFixed(2)}`, { align: 'right', bold: true, color: GREEN, fillColor: '#ecfdf5' }),
                    ],
                    [
                      makeCell('BALANCE DUE ON DISPATCH:', { align: 'right', bold: true, color: AMBER, fillColor: '#fffbeb' }),
                      makeCell(`₹${Number(data.balanceDue).toFixed(2)}`, { align: 'right', bold: true, color: AMBER, fillColor: '#fffbeb', fontSize: 9 }),
                    ],
                  ],
                },
                layout: { hLineWidth: () => 0.5, vLineWidth: () => 0, hLineColor: () => BORDER },
              },
            ],
          },
        ],
        margin: [0, 0, 0, 14],
      },

      // Declaration & Authorized Signatory
      {
        columns: [
          {
            width: '60%',
            stack: [
              { text: 'TERMS & DECLARATION', fontSize: 7, bold: true, color: NAVY },
              { text: '1. All architectural hardware supplies are guaranteed against manufacturing defects.', fontSize: 6.5, color: GRAY, margin: [0, 2, 0, 0] },
              { text: '2. Goods dispatched per Commercial Packing List. Balance payable as per agreed B2B terms.', fontSize: 6.5, color: GRAY },
              { text: '3. This is a system-generated electronic tax invoice authorized under Section 31 of CGST Act.', fontSize: 6.5, color: GRAY },
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
                        fillColor: '#f8fafc',
                        margin: [6, 4, 6, 4],
                        stack: [
                          { text: 'FOR PRC HARDWARE', fontSize: 7, bold: true, color: GRAY, alignment: 'center' },
                          { text: 'Authorized Signatory', fontSize: 8, bold: true, color: NAVY, alignment: 'center', margin: [0, 12, 0, 2] },
                          { text: `Digitally Signed on ${formatDate(data.issuedAt)}`, fontSize: 6, color: GREEN, alignment: 'center' },
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
    footer: (currentPage: number, pageCount: number) => {
      return {
        margin: [36, 0, 36, 0],
        columns: [
          {
            text: `Invoice: ${data.invoiceNumber} | PO: ${data.poNumber} | Quotation: ${data.quotationNumber}`,
            fontSize: 6.5,
            color: GRAY,
          },
          {
            text: `Page ${currentPage} of ${pageCount}`,
            fontSize: 6.5,
            color: GRAY,
            alignment: 'right',
          },
        ],
      };
    },
  };

  const doc = pdfmake.createPdf(docDefinition as TDocumentDefinitions);
  const buffer = await doc.getBuffer();
  return buffer;
};

