/**
 * proforma-invoice-pdf.service.ts
 *
 * Production-grade Proforma Invoice PDF Generator for Pacific Products & Solutions.
 * Matches exact ReportLab A4 layout, colors (#20242A, #70757A, #F5F6F7), column widths,
 * QR verification, buyer/project split, product table, bank details, and totals.
 */

import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require('pdfmake');
import type { TDocumentDefinitions, Content, StyleDictionary, TableCell, Alignment } from 'pdfmake/interfaces';
import { PRC_LOGO_DATA_URL } from '../../assets/logo.base64';

// ── Configure Roboto Fonts from pdfmake package ──────────────────────────────
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
  console.warn('[PI PDF Service] Font initialization warning:', e?.message || e);
}

// ── Exact Design Tokens from Reference Specification ─────────────────────────
const DARK = '#20242A';
const LINE = '#70757A';
const LIGHT = '#F5F6F7';
const MUTED = '#4B5563';

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatINR(value: number | null | undefined): string {
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
    italics?: boolean;
  } = {}
): TableCell {
  return {
    text,
    bold: options.bold ?? false,
    alignment: options.align || 'left',
    color: options.color || DARK,
    fillColor: options.fillColor,
    fontSize: options.fontSize || 8.5,
    colSpan: options.colSpan,
    margin: options.margin || [4, 4, 4, 4],
    italics: options.italics,
  } as TableCell;
}

export interface ProformaPdfData {
  id: string;
  piNumber: string;
  financialYear: string;
  sequenceNo?: number;
  status: string;
  facility?: {
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    gstin?: string;
    email?: string;
    phone?: string;
    bankDetails?: Record<string, any>;
  };
  quoteNumber?: string | null;
  poNumber?: string | null;
  customerPoNumber?: string | null;
  orderId?: string | null;
  customerName: string;
  companyName?: string | null;
  customerEmail: string;
  customerPhone?: string | null;
  gstin?: string | null;
  pan?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
  placeOfSupply?: string | null;
  subtotal: number | any;
  taxableAmount: number | any;
  cgst: number | any;
  sgst: number | any;
  igst: number | any;
  cess?: number | any;
  discount?: number | any;
  shippingCost?: number | any;
  roundOff?: number | any;
  grandTotal: number | any;
  advancePercentage: number | any;
  advanceAmount: number | any;
  balanceDue: number | any;
  paymentTerms?: string | null;
  deliveryTimeline?: string | null;
  validUntil?: Date | string | null;
  verificationToken: string;
  verificationId: string;
  documentHash: string;
  digitalSignature?: string | null;
  signedBy?: string | null;
  signedAt?: Date | string | null;
  qrCodeDataUrl?: string | null;
  notes?: string | null;
  termsAndConditions?: string | null;
  bankDetails?: Record<string, any> | null;
  createdAt: Date | string;
  items?: Array<{
    id?: string;
    sku: string;
    productName: string;
    description?: string | null;
    hsnCode?: string | null;
    unit?: string | null;
    quantity: number | any;
    unitRate: number | any;
    discountPercent?: number | any;
    taxableAmount?: number | any;
    cgstRate?: number | any;
    cgstAmount?: number | any;
    sgstRate?: number | any;
    sgstAmount?: number | any;
    igstRate?: number | any;
    igstAmount?: number | any;
    lineTotal: number | any;
  }>;
}

/**
 * Main Proforma Invoice PDF Generator
 * Dynamically converts Admin UI & Database Proforma Invoice records into
 * the exact reference design.
 */
export async function generateProformaPdf(pi: ProformaPdfData): Promise<Buffer> {
  const items = pi.items || [];
  const isSigned = Boolean(pi.digitalSignature && pi.signedBy);
  const isInterstate = Number(pi.igst || 0) > 0;
  const customerName = pi.customerName || pi.companyName || 'Valued Commercial Client';
  const advancePct = Number(pi.advancePercentage || 50);

  // Facility & Company Branding
  const companyName = pi.facility?.name || 'Pacific Products and Solutions';
  const companyGstin = pi.facility?.gstin || '07AADFP3948F1Z1';
  const companyEmail = pi.facility?.email || 'billing@pacifichardware.com';
  const companyPhone = pi.facility?.phone || '+91 98185 92113';

  // Bank Remittance Details
  const bank = pi.bankDetails || pi.facility?.bankDetails || {
    bankName: 'HDFC Bank Ltd.',
    accountName: 'Pacific Products and Solutions',
    accountNumber: '50200012345678',
    ifsc: 'HDFC0001234',
    branch: 'Mandoli, Delhi',
    upiId: 'pacificproducts@hdfcbank',
  };

  // ── Line Items Table Body ───────────────────────────────────────────────────
  const tableRows: TableCell[][] = [
    [
      makeCell('#', { bold: true, align: 'center', fontSize: 7.4, fillColor: LIGHT, color: DARK }),
      makeCell('DESCRIPTION / PRODUCT SPECIFICATION', { bold: true, fontSize: 7.4, fillColor: LIGHT, color: DARK }),
      makeCell('HSN / SAC', { bold: true, align: 'center', fontSize: 7.4, fillColor: LIGHT, color: DARK }),
      makeCell('UNIT', { bold: true, align: 'center', fontSize: 7.4, fillColor: LIGHT, color: DARK }),
      makeCell('QTY', { bold: true, align: 'center', fontSize: 7.4, fillColor: LIGHT, color: DARK }),
      makeCell('RATE (\u20B9)', { bold: true, align: 'center', fontSize: 7.4, fillColor: LIGHT, color: DARK }),
      makeCell(isInterstate ? 'IGST (\u20B9)' : 'GST (\u20B9)', { bold: true, align: 'center', fontSize: 7.4, fillColor: LIGHT, color: DARK }),
      makeCell('TOTAL (\u20B9)', { bold: true, align: 'center', fontSize: 7.4, fillColor: LIGHT, color: DARK }),
    ],
  ];

  if (items.length === 0) {
    tableRows.push([
      {
        text: 'No line items listed in proforma invoice',
        colSpan: 8,
        alignment: 'center' as Alignment,
        color: MUTED,
        italics: true,
        margin: [4, 12, 4, 12] as [number, number, number, number],
      } as TableCell,
      ...Array(7).fill({ text: '' } as TableCell),
    ]);
  } else {
    items.forEach((item, idx) => {
      const taxAmt = isInterstate
        ? Number(item.igstAmount || 0)
        : Number(item.cgstAmount || 0) + Number(item.sgstAmount || 0);

      tableRows.push([
        makeCell(String(idx + 1), { align: 'center', fontSize: 8.5, color: DARK }),
        {
          stack: [
            { text: String(item.productName || 'HARDWARE FITTING').toUpperCase(), bold: true, fontSize: 8.5, color: DARK },
            { text: `SKU: ${item.sku || 'N/A'}${item.description ? `  |  ${item.description}` : ''}`, fontSize: 7.2, color: MUTED, margin: [0, 1.5, 0, 0] as [number, number, number, number] },
          ],
          margin: [4, 4, 4, 4] as [number, number, number, number],
        } as TableCell,
        makeCell(item.hsnCode || '83024110', { align: 'center', fontSize: 8.5, color: DARK }),
        makeCell(item.unit || 'PCS', { align: 'center', fontSize: 8.5, color: DARK }),
        makeCell(String(Number(item.quantity || 1)), { align: 'center', fontSize: 8.5, color: DARK }),
        makeCell(Number(item.unitRate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), { align: 'right', fontSize: 8.5, color: DARK }),
        makeCell(taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), { align: 'right', fontSize: 8.5, color: DARK }),
        makeCell(Number(item.lineTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), { align: 'right', fontSize: 8.5, color: DARK }),
      ]);
    });
  }

  // ── Document Definition ────────────────────────────────────────────────────
  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [28, 26, 28, 28],
    defaultStyle: { font: 'Roboto', fontSize: 8.5, color: DARK },

    // ── Fixed Footer across all pages ──────────────────────────────────────────
    footer: (currentPage: number, pageCount: number): Content => ({
      stack: [
        {
          canvas: [
            {
              type: 'line',
              x1: 28,
              y1: 0,
              x2: 567,
              y2: 0,
              lineWidth: 0.9,
              lineColor: LINE,
            },
          ],
          margin: [0, 0, 0, 6] as [number, number, number, number],
        },
        {
          columns: [
            {
              width: '*',
              text: `Ref: PI #${pi.piNumber}    |    Computer Generated`,
              fontSize: 7.5,
              color: DARK,
              alignment: 'center' as Alignment,
            },
            {
              width: 50,
              text: `${currentPage} / ${pageCount}`,
              fontSize: 8,
              color: DARK,
              alignment: 'right' as Alignment,
            },
          ],
          margin: [28, 0, 28, 0] as [number, number, number, number],
        },
      ],
    }),

    content: [
      // ═════════════════════════════════════════════════════════════════════════
      // ─── PAGE 1: COMMERCIAL PROFORMA INVOICE ─────────────────────────────────
      // ═════════════════════════════════════════════════════════════════════════

      // ── 1. Header: Logo Box + Company Details Left | QR Code & PI No Right
      {
        columns: [
          // Left: Bordered Logo Box & Company Details
          {
            width: '*',
            columns: [
              // Bordered Square Logo Box
              {
                width: 54,
                table: {
                  widths: [44],
                  body: [
                    [
                      {
                        image: PRC_LOGO_DATA_URL,
                        width: 40,
                        height: 40,
                        alignment: 'center' as Alignment,
                        margin: [2, 2, 2, 2] as [number, number, number, number],
                      },
                    ],
                  ],
                },
                layout: {
                  hLineColor: () => LINE,
                  vLineColor: () => LINE,
                  hLineWidth: () => 0.8,
                  vLineWidth: () => 0.8,
                },
                margin: [0, 0, 10, 0] as [number, number, number, number],
              },
              // Company Name and Legal Contact Info
              {
                width: '*',
                stack: [
                  { text: companyName, fontSize: 13, bold: true, color: DARK, margin: [0, 0, 0, 2] as [number, number, number, number] },
                  { text: 'H -3, J.R. Complex Gate No 4, Mela Ram Farm,', fontSize: 8.5, color: DARK },
                  { text: 'Mandoli, Delhi 110093, India', fontSize: 8.5, color: DARK, margin: [0, 0, 0, 2] as [number, number, number, number] },
                  { text: `GSTIN: ${companyGstin}`, fontSize: 8.5, color: DARK, margin: [0, 0, 0, 2] as [number, number, number, number] },
                  { text: `Email: ${companyEmail}`, fontSize: 8.5, color: DARK, margin: [0, 0, 0, 2] as [number, number, number, number] },
                  { text: `Phone: ${companyPhone}  |  Website: www.pacifichardware.com`, fontSize: 8.5, color: DARK },
                ],
              },
            ],
          },
          // Right: QR Code Box + QR VERIFICATION + PI No.
          {
            width: 170,
            stack: [
              pi.qrCodeDataUrl
                ? {
                    stack: [
                      {
                        table: {
                          widths: [56],
                          body: [
                            [
                              {
                                image: pi.qrCodeDataUrl,
                                width: 52,
                                height: 52,
                                alignment: 'center' as Alignment,
                                margin: [2, 2, 2, 2] as [number, number, number, number],
                              },
                            ],
                          ],
                        },
                        layout: {
                          hLineColor: () => LINE,
                          vLineColor: () => LINE,
                          hLineWidth: () => 0.8,
                          vLineWidth: () => 0.8,
                        },
                        alignment: 'right' as Alignment,
                        margin: [0, 0, 0, 2] as [number, number, number, number],
                      },
                      { text: 'QR VERIFICATION', fontSize: 7.5, bold: true, color: DARK, alignment: 'right' as Alignment, margin: [0, 0, 6, 6] as [number, number, number, number] },
                    ],
                  }
                : {
                    text: 'QR Verification Record',
                    fontSize: 7.5,
                    color: MUTED,
                    alignment: 'right' as Alignment,
                    margin: [0, 10, 0, 10] as [number, number, number, number],
                  },
              {
                text: [
                  { text: 'PI No.: ', bold: true, fontSize: 10.5, color: DARK },
                  { text: pi.piNumber, bold: true, fontSize: 10.5, color: DARK },
                ],
                alignment: 'right' as Alignment,
                margin: [0, 2, 0, 0] as [number, number, number, number],
              },
            ],
          },
        ],
        margin: [0, 0, 0, 8] as [number, number, number, number],
      },

      // ── 2. Horizontal Divider 1 (1.2pt Line) ─────────────────────────────────
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 539, y2: 0, lineWidth: 1.2, lineColor: LINE }],
        margin: [0, 0, 0, 9] as [number, number, number, number],
      },

      // ── 3. Title & Date Strip ────────────────────────────────────────────────
      {
        columns: [
          // Left: PROFORMA INVOICE (19pt Bold)
          {
            text: 'PROFORMA INVOICE',
            fontSize: 19,
            bold: true,
            color: DARK,
            width: '*',
            margin: [2, 0, 0, 0] as [number, number, number, number],
          },
          // Right: Issue Date & Financial Year
          {
            width: 175,
            table: {
              widths: [80, 8, '*'],
              body: [
                [
                  makeCell('Issue Date', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                  makeCell(':', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                  makeCell(formatDate(pi.createdAt), { fontSize: 9.5, color: DARK, align: 'right', margin: [0, 1, 0, 1] }),
                ],
                [
                  makeCell('Financial Year', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                  makeCell(':', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                  makeCell(pi.financialYear || '2026-2027', { fontSize: 9.5, color: DARK, align: 'right', margin: [0, 1, 0, 1] }),
                ],
              ],
            },
            layout: 'noBorders',
          },
        ],
        margin: [0, 0, 0, 8] as [number, number, number, number],
      },

      // ── 4. Horizontal Divider 2 (0.9pt Line) ──────────────────────────────────
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 539, y2: 0, lineWidth: 0.9, lineColor: LINE }],
        margin: [0, 0, 0, 9] as [number, number, number, number],
      },

      // ── 5. Two-Column Party Details with Center Vertical Split ────────────────
      {
        columns: [
          // Left Column: BILL TO (BUYER)
          {
            width: '48%',
            stack: [
              { text: 'BILL TO (BUYER)', fontSize: 8.5, bold: true, color: DARK, margin: [0, 0, 0, 4] as [number, number, number, number] },
              { text: customerName, fontSize: 10, bold: true, color: DARK, margin: [0, 0, 0, 2] as [number, number, number, number] },
              ...(pi.companyName && pi.companyName !== customerName
                ? [{ text: pi.companyName, fontSize: 8.5, color: DARK, margin: [0, 0, 0, 2] as [number, number, number, number] }]
                : []),
              ...(pi.gstin
                ? [{ text: `GSTIN: ${pi.gstin}`, fontSize: 8.5, color: DARK, margin: [0, 0, 0, 2] as [number, number, number, number] }]
                : []),
              {
                text: [
                  { text: pi.customerEmail || '' },
                  ...(pi.customerPhone ? [{ text: `  |  Ph: ${pi.customerPhone}` }] : []),
                ],
                fontSize: 8.5,
                color: DARK,
                margin: [0, 0, 0, 4] as [number, number, number, number],
              },
              { text: 'Billing Address:', fontSize: 8.5, bold: true, color: DARK, margin: [0, 2, 0, 1] as [number, number, number, number] },
              {
                text: pi.billingAddress || 'As per client profile records',
                fontSize: 8.5,
                color: DARK,
                lineHeight: 1.3,
              },
            ],
          },
          // Center Vertical Divider Line (0.7pt)
          {
            width: '4%',
            canvas: [
              {
                type: 'line',
                x1: 10,
                y1: 0,
                x2: 10,
                y2: 105,
                lineWidth: 0.7,
                lineColor: LINE,
              },
            ],
          },
          // Right Column: ORDER & PROJECT DETAILS
          {
            width: '48%',
            stack: [
              { text: 'ORDER & PROJECT DETAILS', fontSize: 8.5, bold: true, color: DARK, margin: [0, 0, 0, 4] as [number, number, number, number] },
              {
                table: {
                  widths: [82, 8, '*'],
                  body: [
                    [
                      makeCell('Order Type', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                      makeCell(':', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                      makeCell(pi.quoteNumber ? `Linked Quote #${pi.quoteNumber}` : (pi.customerPoNumber ? `Client PO #${pi.customerPoNumber}` : 'Commercial Supply Order'), { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                    ],
                    [
                      makeCell('FY', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                      makeCell(':', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                      makeCell(pi.financialYear || '2026-2027', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                    ],
                    [
                      makeCell('PI Number', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                      makeCell(':', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                      makeCell(pi.piNumber, { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                    ],
                    [
                      makeCell('Payment Terms', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                      makeCell(':', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                      makeCell(pi.paymentTerms || `${advancePct}% Advance, Balance at Dispatch`, { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                    ],
                    [
                      makeCell('Delivery Address', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                      makeCell(':', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                      makeCell(pi.shippingAddress || pi.billingAddress || 'To be confirmed prior to dispatch', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                    ],
                  ],
                },
                layout: 'noBorders',
              },
            ],
          },
        ],
        margin: [0, 0, 0, 10] as [number, number, number, number],
      },

      // ── 6. Line Items Table (Box with #70757A borders & #F5F6F7 header) ──────
      {
        table: {
          headerRows: 1,
          widths: [24, '*', 55, 36, 32, 58, 52, 60],
          body: tableRows,
        },
        layout: {
          hLineWidth: () => 0.8,
          vLineWidth: () => 0.8,
          hLineColor: () => LINE,
          vLineColor: () => LINE,
          paddingLeft: () => 5,
          paddingRight: () => 5,
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
        margin: [0, 0, 0, 12] as [number, number, number, number],
      },

      // ── 7. Lower Split Section: Bank Account Details Left | Summary Right ────
      {
        columns: [
          // Left Column: Bank Account Details
          {
            width: '52%',
            stack: [
              { text: 'BANK ACCOUNT DETAILS FOR RTGS / NEFT / IMPS', fontSize: 8.5, bold: true, color: DARK, margin: [0, 0, 0, 6] as [number, number, number, number] },
              {
                table: {
                  widths: [80, 8, '*'],
                  body: [
                    [
                      makeCell('Bank Name', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                      makeCell(':', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                      makeCell(bank.bankName || 'HDFC Bank Ltd.', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                    ],
                    [
                      makeCell('Account Name', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                      makeCell(':', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                      makeCell(bank.accountName || 'Pacific Products and Solutions', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                    ],
                    [
                      makeCell('Account No.', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                      makeCell(':', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                      makeCell(bank.accountNumber || '50200012345678', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                    ],
                    [
                      makeCell('IFSC Code', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                      makeCell(':', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                      makeCell(bank.ifsc || 'HDFC0001234', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                    ],
                    [
                      makeCell('Branch', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                      makeCell(':', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                      makeCell(bank.branch || 'Mandoli, Delhi', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                    ],
                    [
                      makeCell('UPI / VPA', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                      makeCell(':', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                      makeCell(bank.upiId || 'pacificproducts@hdfcbank', { fontSize: 8.5, color: DARK, margin: [0, 1, 0, 1] }),
                    ],
                  ],
                },
                layout: 'noBorders',
              },
            ],
          },
          // Right Column: Summary Breakdown
          {
            width: '48%',
            stack: [
              {
                table: {
                  widths: ['*', 90],
                  body: [
                    [
                      makeCell('Taxable Value (Basic)', { fontSize: 8.5, color: DARK, margin: [0, 1.5, 0, 1.5] }),
                      makeCell(formatINR(pi.taxableAmount || pi.subtotal), { fontSize: 8.5, align: 'right', color: DARK, margin: [0, 1.5, 0, 1.5] }),
                    ],
                    ...(Number(pi.discount || 0) > 0
                      ? [
                          [
                            makeCell('Trade Discount', { fontSize: 8.5, color: DARK, margin: [0, 1.5, 0, 1.5] }),
                            makeCell(`- ${formatINR(pi.discount)}`, { fontSize: 8.5, align: 'right', color: DARK, margin: [0, 1.5, 0, 1.5] }),
                          ],
                        ]
                      : []),
                    ...(isInterstate
                      ? [
                          [
                            makeCell('IGST (18%)', { fontSize: 8.5, color: DARK, margin: [0, 1.5, 0, 1.5] }),
                            makeCell(formatINR(pi.igst), { fontSize: 8.5, align: 'right', color: DARK, margin: [0, 1.5, 0, 1.5] }),
                          ],
                        ]
                      : [
                          [
                            makeCell('CGST (9%)', { fontSize: 8.5, color: DARK, margin: [0, 1.5, 0, 1.5] }),
                            makeCell(formatINR(pi.cgst), { fontSize: 8.5, align: 'right', color: DARK, margin: [0, 1.5, 0, 1.5] }),
                          ],
                          [
                            makeCell('SGST (9%)', { fontSize: 8.5, color: DARK, margin: [0, 1.5, 0, 1.5] }),
                            makeCell(formatINR(pi.sgst), { fontSize: 8.5, align: 'right', color: DARK, margin: [0, 1.5, 0, 1.5] }),
                          ],
                        ]),
                    ...(Number(pi.shippingCost || 0) > 0
                      ? [
                          [
                            makeCell('Logistics & Freight', { fontSize: 8.5, color: DARK, margin: [0, 1.5, 0, 1.5] }),
                            makeCell(formatINR(pi.shippingCost), { fontSize: 8.5, align: 'right', color: DARK, margin: [0, 1.5, 0, 1.5] }),
                          ],
                        ]
                      : []),
                    ...(Number(pi.roundOff || 0) !== 0
                      ? [
                          [
                            makeCell('Round Off Adjustment', { fontSize: 8.5, color: DARK, margin: [0, 1.5, 0, 1.5] }),
                            makeCell(formatINR(pi.roundOff), { fontSize: 8.5, align: 'right', color: DARK, margin: [0, 1.5, 0, 1.5] }),
                          ],
                        ]
                      : []),
                  ],
                },
                layout: 'noBorders',
              },
              // Line above Grand Total (0.8pt)
              {
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 245, y2: 0, lineWidth: 0.8, lineColor: LINE }],
                margin: [0, 4, 0, 4] as [number, number, number, number],
              },
              {
                table: {
                  widths: ['*', 90],
                  body: [
                    [
                      makeCell('GRAND TOTAL', { fontSize: 10, bold: true, color: DARK, margin: [0, 2, 0, 2] }),
                      makeCell(formatINR(pi.grandTotal), { fontSize: 10, bold: true, align: 'right', color: DARK, margin: [0, 2, 0, 2] }),
                    ],
                  ],
                },
                layout: 'noBorders',
              },
              // Line below Grand Total (0.8pt)
              {
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 245, y2: 0, lineWidth: 0.8, lineColor: LINE }],
                margin: [0, 4, 0, 4] as [number, number, number, number],
              },
              {
                table: {
                  widths: ['*', 90],
                  body: [
                    [
                      makeCell(`Advance Payable (${advancePct}%)`, { fontSize: 8.5, color: DARK, margin: [0, 1.5, 0, 1.5] }),
                      makeCell(formatINR(pi.advanceAmount), { fontSize: 8.5, align: 'right', color: DARK, margin: [0, 1.5, 0, 1.5] }),
                    ],
                    [
                      makeCell(`Balance on Dispatch (${100 - advancePct}%)`, { fontSize: 8.5, color: DARK, margin: [0, 1.5, 0, 1.5] }),
                      makeCell(formatINR(pi.balanceDue), { fontSize: 8.5, align: 'right', color: DARK, margin: [0, 1.5, 0, 1.5] }),
                    ],
                  ],
                },
                layout: 'noBorders',
              },
            ],
          },
        ],
        margin: [0, 8, 0, 16] as [number, number, number, number],
      },

      // ── 8. Authorised Signatory Block (Bottom Left) ──────────────────────────
      {
        columns: [
          {
            width: 220,
            stack: [
              { text: 'Authorised Signatory', fontSize: 8.5, bold: true, color: DARK, margin: [0, 0, 0, 2] as [number, number, number, number] },
              { text: `For ${companyName}`, fontSize: 8.5, color: DARK, margin: [0, 0, 0, 24] as [number, number, number, number] },
              {
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 135, y2: 0, lineWidth: 0.8, lineColor: LINE }],
                margin: [0, 0, 0, 3] as [number, number, number, number],
              },
              { text: `(${pi.signedBy || 'Executive Desk'})`, fontSize: 8.5, color: DARK },
            ],
          },
        ],
        margin: [0, 0, 0, 8] as [number, number, number, number],
      },

      // ═════════════════════════════════════════════════════════════════════════
      // ─── PAGE 2: GENERAL TERMS & CONDITIONS (OFFICIAL DOCUMENT TERMS) ────────
      // ═════════════════════════════════════════════════════════════════════════
      {
        text: companyName,
        fontSize: 10,
        bold: true,
        color: DARK,
        pageBreak: 'before',
        margin: [0, 0, 0, 2] as [number, number, number, number],
      },
      {
        text: 'GENERAL TERMS & CONDITIONS',
        fontSize: 14,
        bold: true,
        color: DARK,
        characterSpacing: 0.4,
        margin: [0, 0, 0, 4] as [number, number, number, number],
      },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 539, y2: 0, lineWidth: 1, lineColor: LINE }],
        margin: [0, 0, 0, 10] as [number, number, number, number],
      },

      // ── 1. Specifications Required for Production ──
      { text: '1. SPECIFICATIONS REQUIRED FOR PRODUCTION', style: 'termsSectionHeader' },
      {
        text: 'The following technical parameters and approvals are strictly required prior to commencing manufacturing:',
        style: 'termsText',
        margin: [0, 0, 0, 3] as [number, number, number, number],
      },
      {
        ol: [
          'Actual site measurements verified and certified by the client / project architect.',
          'Formal shop drawing approval signed off by the client or authorized project consultant.',
          'Written approval and selection of colors for compact laminate boards and hardware finishes.',
        ],
        style: 'termsList',
        margin: [0, 0, 0, 8] as [number, number, number, number],
      },

      // ── 2. Commercial & Operational Terms ──
      { text: '2. OTHER TERMS & CONDITIONS', style: 'termsSectionHeader' },
      {
        ol: [
          'Price quoted is based on the bill of quantities (BOQ) given by you and is subject to revision if final site requirement differs.',
          'The client will provide a safety place for storage of material at site with lock and key facilities.',
          'The client will provide electric power facility at free of cost up to the work place.',
          'Required purchase order only for supply because assembly is free of cost due to product nature.',
          'This proforma invoice is valid for 30 days only from the date of issuance.',
          'All materials should be installed / erected within 30 days from the date of delivery.',
          'All invoices will be made on number of cubicle basis.',
          'Unloading and shifting of material at site is in the scope of client only.',
          'PO and remittances should be raised in the name of Pacific Products and Solutions, Delhi.',
          'Freight charge will be extra as actual.',
        ],
        style: 'termsList',
        margin: [0, 0, 0, 8] as [number, number, number, number],
      },

      // ── 3. Payment Terms for Supply ──
      { text: '3. PAYMENT TERMS FOR SUPPLY', style: 'termsSectionHeader' },
      {
        ol: [
          `${advancePct}% advance along with confirmed Proforma Invoice (and balance ${100 - advancePct}% prior to dispatch / on delivery).`,
          'Payments are to be made by the client based on the agreed terms and conditions with us, failing to do the same Pacific Products & Solutions reserves the right to cancel the order.',
        ],
        style: 'termsList',
        margin: [0, 0, 0, 8] as [number, number, number, number],
      },

      // ── 4. Special Note: Site Delay & Payment Liability ──
      { text: '4. SPECIAL NOTE (SITE DELAY & PAYMENT LIABILITY)', style: 'termsSectionHeader' },
      {
        text: 'If your site gets prolonged or is put on hold for whatever reason for more than 30 days from the date of delivery of material at your site, then we will be liable for 100% payment against material. You cannot delay our payment on account of unfinished project. However we will extend all help in installation etc. when you are ready for the same & we will provide you back up for the quality assurance therefore please do not hold back our payment for any reason in the interest of speedy supply to you.',
        style: 'termsText',
        margin: [0, 0, 0, 8] as [number, number, number, number],
      },

      // ── 5. Delivery & 6. Statutory Compliance ──
      {
        columns: [
          // Delivery
          {
            width: '49%',
            stack: [
              { text: '5. DELIVERY TIMELINE', style: 'termsSectionHeader' },
              {
                text: pi.deliveryTimeline || '12 - 15 working days from the date of your clear Advance Payment, purchase order, approval of shop drawing, and colour approval for compact board & hardware.',
                style: 'termsText',
              },
            ],
            margin: [0, 0, 6, 0] as [number, number, number, number],
          },
          { width: '2%', text: '' },
          // Statutory Compliance
          {
            width: '49%',
            stack: [
              { text: '6. STATUTORY COMPLIANCE', style: 'termsSectionHeader' },
              {
                text: 'a) For SEZ sale: GST, Service Tax is exempted against the submission of the following certificates:',
                style: 'termsText',
                margin: [0, 0, 0, 3] as [number, number, number, number],
              },
              {
                ol: [
                  'SEZ approval certificate',
                  'FORM - I confirmation from the client',
                ],
                style: 'termsList',
              },
            ],
            margin: [6, 0, 0, 0] as [number, number, number, number],
          },
        ],
        margin: [0, 0, 0, 12] as [number, number, number, number],
      },

      // ── Dual Signatures on Page 2 ──
      {
        columns: [
          // Client Acceptance
          {
            width: '48%',
            stack: [
              {
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.8, lineColor: LINE }],
                margin: [0, 16, 0, 4] as [number, number, number, number],
              },
              {
                text: isSigned
                  ? `\u2714 Digitally Accepted by: ${customerName}`
                  : 'Client Acceptance & Confirmed Signature',
                fontSize: 8.5,
                bold: true,
                color: DARK,
              },
              {
                text: isSigned
                  ? `Date: ${formatDate(pi.signedAt || pi.createdAt)} \u2022 Company Seal`
                  : 'Name, Designation & Company Official Stamp',
                fontSize: 7.5,
                color: MUTED,
              },
            ],
          },
          { width: '4%', text: '' },
          // Pacific Products and Solutions Signatory
          {
            width: '48%',
            stack: [
              {
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.8, lineColor: LINE }],
                margin: [0, 16, 0, 4] as [number, number, number, number],
              },
              {
                text: `For ${companyName}, Delhi`,
                fontSize: 8.5,
                bold: true,
                color: DARK,
              },
              {
                text: `Authorised Signatory (${pi.signedBy || 'Executive Desk'})`,
                fontSize: 7.5,
                color: MUTED,
              },
            ],
          },
        ],
        margin: [0, 4, 0, 0] as [number, number, number, number],
      },
    ],

    styles: {
      termsSectionHeader: {
        fontSize: 8.8,
        bold: true,
        color: DARK,
        margin: [0, 3, 0, 2] as [number, number, number, number],
      },
      termsList: {
        fontSize: 7.8,
        color: DARK,
        lineHeight: 1.3,
      },
      termsText: {
        fontSize: 7.8,
        color: DARK,
        lineHeight: 1.3,
      },
    } as StyleDictionary,
  };

  const doc = pdfmake.createPdf(docDefinition);
  const buffer = await doc.getBuffer();
  return buffer;
}
