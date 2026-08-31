/**
 * proforma-invoice-pdf.service.ts
 *
 * Minimal, production-oriented Commercial Proforma Invoice generator.
 * Design principles:
 * - White background throughout
 * - No decorative colour blocks
 * - Clean typography and thin rules
 * - Company logo + legal/company details in header
 * - Issue date on the left metadata area
 * - QR section and PI number at top right
 * - Financial/commercial summary without coloured backgrounds
 * - Dedicated final page for commercial terms
 */

import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require('pdfmake');
import type { TDocumentDefinitions, Content, StyleDictionary, TableCell } from 'pdfmake/interfaces';
import { PRC_LOGO_DATA_URL } from '../../assets/logo.base64';

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

// -----------------------------------------------------------------------------
// CORPORATE MINIMAL PALETTE
// -----------------------------------------------------------------------------
const INK = '#111827';
const MUTED = '#6B7280';
const RULE = '#D1D5DB';
const RULE_LIGHT = '#E5E7EB';
const WHITE = '#FFFFFF';

function formatINR(value: number | null | undefined): string {
  const n = Number(value || 0);
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function cell(
  text: string,
  options: {
    bold?: boolean;
    align?: 'left' | 'center' | 'right';
    color?: string;
    fontSize?: number;
    colSpan?: number;
    margin?: [number, number, number, number];
  } = {},
): TableCell {
  return {
    text,
    bold: options.bold ?? false,
    alignment: options.align || 'left',
    color: options.color || INK,
    fontSize: options.fontSize || 8,
    colSpan: options.colSpan,
    margin: options.margin || [5, 4, 5, 4],
  } as TableCell;
}

const lineLayout = {
  hLineColor: () => RULE,
  vLineColor: () => RULE,
  hLineWidth: () => 0.45,
  vLineWidth: () => 0.45,
};

const noFillTableLayout = {
  hLineColor: () => RULE_LIGHT,
  vLineColor: () => RULE_LIGHT,
  hLineWidth: () => 0.4,
  vLineWidth: () => 0.4,
};

export interface ProformaPdfData {
  id: string;
  piNumber: string;
  financialYear: string;
  sequenceNo?: number;
  status: string;
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

export async function generateProformaPdf(pi: ProformaPdfData): Promise<Buffer> {
  const items = pi.items || [];
  const advancePct = Number(pi.advancePercentage || 50);
  const isInterstate = Number(pi.igst || 0) > 0;
  const customerName = pi.customerName || pi.companyName || 'Customer';

  const bank = pi.bankDetails || {
    bankName: '',
    accountName: '',
    accountNumber: '',
    ifsc: '',
    branch: '',
    upiId: '',
  };

  // ---------------------------------------------------------------------------
  // LINE ITEMS
  // ---------------------------------------------------------------------------
  const itemRows: TableCell[][] = [
    [
      cell('S. NO.', { bold: true, align: 'center', fontSize: 7.5 }),
      cell('DESCRIPTION', { bold: true, fontSize: 7.5 }),
      cell('HSN/SAC', { bold: true, align: 'center', fontSize: 7.5 }),
      cell('UNIT', { bold: true, align: 'center', fontSize: 7.5 }),
      cell('QTY', { bold: true, align: 'center', fontSize: 7.5 }),
      cell('RATE', { bold: true, align: 'right', fontSize: 7.5 }),
      cell(isInterstate ? 'IGST' : 'GST', { bold: true, align: 'right', fontSize: 7.5 }),
      cell('AMOUNT', { bold: true, align: 'right', fontSize: 7.5 }),
    ],
  ];

  if (!items.length) {
    itemRows.push([
      {
        text: 'No line items listed',
        colSpan: 8,
        alignment: 'center',
        color: MUTED,
        italics: true,
        margin: [5, 10, 5, 10],
      } as TableCell,
      ...Array(7).fill({ text: '' } as TableCell),
    ]);
  } else {
    items.forEach((item, index) => {
      const taxAmount = isInterstate
        ? Number(item.igstAmount || 0)
        : Number(item.cgstAmount || 0) + Number(item.sgstAmount || 0);

      itemRows.push([
        cell(String(index + 1), { align: 'center' }),
        {
          stack: [
            {
              text: String(item.productName || 'PRODUCT').toUpperCase(),
              bold: true,
              fontSize: 8,
              color: INK,
            },
            ...(item.description || item.sku
              ? [{
                  text: [
                    item.sku ? `SKU: ${item.sku}` : '',
                    item.description || '',
                  ].filter(Boolean).join('  •  '),
                  fontSize: 7,
                  color: MUTED,
                  margin: [0, 2, 0, 0] as [number, number, number, number],
                }]
              : []),
          ],
          margin: [5, 4, 5, 4],
        },
        cell(item.hsnCode || '—', { align: 'center' }),
        cell(item.unit || 'PCS', { align: 'center' }),
        cell(String(Number(item.quantity || 0)), { align: 'center' }),
        cell(formatINR(Number(item.unitRate || 0)), { align: 'right' }),
        cell(formatINR(taxAmount), { align: 'right' }),
        cell(formatINR(Number(item.lineTotal || 0)), { align: 'right', bold: true }),
      ]);
    });
  }

  const companyDetails: Content = {
    stack: [
      {
        image: PRC_LOGO_DATA_URL,
        width: 62,
        height: 62,
        margin: [0, 0, 0, 7],
      },
      { text: 'PACIFIC PRODUCTS AND SOLUTIONS', fontSize: 13, bold: true, color: INK },
      {
        text: 'H-5, JR Complex, Melaram Farm Gate No. 4, Sewa Dham Road, Mandoli, Delhi – 110093, India',
        fontSize: 7.3,
        color: MUTED,
        margin: [0, 3, 0, 1],
      },
      { text: 'GSTIN: 07CIJPS1392A2Z9', fontSize: 7.3, color: MUTED },
      { text: 'Email: info@pacificproduct.in', fontSize: 7.3, color: MUTED, margin: [0, 1, 0, 0] },
    ],
  };

  const qrAndPi: Content = {
    width: 160,
    stack: [
      {
        text: 'QR VERIFICATION',
        fontSize: 7,
        bold: true,
        color: MUTED,
        alignment: 'right',
        margin: [0, 0, 0, 4],
      },
      pi.qrCodeDataUrl
        ? {
            image: pi.qrCodeDataUrl,
            width: 58,
            height: 58,
            alignment: 'right',
          }
        : {
            text: 'QR unavailable',
            fontSize: 7,
            color: MUTED,
            alignment: 'right',
            margin: [0, 15, 0, 15],
          },
      {
        canvas: [{
          type: 'line',
          x1: 65,
          y1: 0,
          x2: 160,
          y2: 0,
          lineWidth: 0.5,
          lineColor: RULE,
        }],
        margin: [0, 5, 0, 5],
      },
      { text: 'PROFORMA INVOICE NO.', fontSize: 7, bold: true, color: MUTED, alignment: 'right' },
      {
        text: pi.piNumber,
        fontSize: 10,
        bold: true,
        color: INK,
        alignment: 'right',
        margin: [0, 2, 0, 0],
      },
    ],
  };

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [38, 34, 38, 42],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 8,
      color: INK,
    },

    footer: (currentPage: number, pageCount: number): Content => ({
      columns: [
        {
          width: '*',
          text: 'Pacific Products and Solutions',
          fontSize: 6.8,
          color: MUTED,
        },
        {
          width: 'auto',
          text: `Page ${currentPage} of ${pageCount}`,
          fontSize: 6.8,
          color: MUTED,
          alignment: 'right',
        },
      ],
      margin: [38, 8, 38, 0],
    }),

    content: [
      // -----------------------------------------------------------------------
      // PAGE 1 — PROFORMA INVOICE
      // -----------------------------------------------------------------------
      {
        columns: [
          { width: '*', ...companyDetails } as any,
          qrAndPi,
        ],
        margin: [0, 0, 0, 13],
      },

      {
        canvas: [{
          type: 'line',
          x1: 0,
          y1: 0,
          x2: 519,
          y2: 0,
          lineWidth: 0.8,
          lineColor: INK,
        }],
        margin: [0, 0, 0, 10],
      },

      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'PROFORMA INVOICE', fontSize: 17, bold: true, color: INK },
              {
                text: 'Commercial supply document',
                fontSize: 7.5,
                color: MUTED,
                margin: [0, 2, 0, 0],
              },
            ],
          },
          {
            width: 145,
            table: {
              widths: [62, '*'],
              body: [
                [cell('ISSUE DATE', { bold: true, fontSize: 7 }), cell(formatDate(pi.createdAt), { bold: true, align: 'right', fontSize: 8 })],
                [cell('FINANCIAL YEAR', { bold: true, fontSize: 7 }), cell(pi.financialYear || '—', { bold: true, align: 'right', fontSize: 8 })],
              ],
            },
            layout: 'noBorders',
          },
        ],
        margin: [0, 0, 0, 13],
      },

      {
        columns: [
          {
            width: '49%',
            stack: [
              { text: 'BILL TO', style: 'sectionLabel' },
              {
                stack: [
                  { text: customerName, fontSize: 9.5, bold: true },
                  ...(pi.companyName && pi.companyName !== customerName
                    ? [{ text: pi.companyName, fontSize: 8, color: MUTED, margin: [0, 2, 0, 0] as [number, number, number, number] }]
                    : []),
                  ...(pi.gstin ? [{ text: `GSTIN: ${pi.gstin}`, fontSize: 7.5, color: MUTED, margin: [0, 2, 0, 0] as [number, number, number, number] }] : []),
                  ...(pi.customerEmail ? [{ text: pi.customerEmail, fontSize: 7.5, color: MUTED, margin: [0, 2, 0, 0] as [number, number, number, number] }] : []),
                  ...(pi.customerPhone ? [{ text: pi.customerPhone, fontSize: 7.5, color: MUTED, margin: [0, 2, 0, 0] as [number, number, number, number] }] : []),
                  ...(pi.billingAddress ? [{ text: pi.billingAddress, fontSize: 7.5, color: MUTED, margin: [0, 4, 0, 0] as [number, number, number, number] }] : []),
                ],
                margin: [0, 5, 0, 0],
              },
            ],
          },
          { width: '2%', text: '' },
          {
            width: '49%',
            stack: [
              { text: 'REFERENCE DETAILS', style: 'sectionLabel' },
              {
                table: {
                  widths: [92, '*'],
                  body: [
                    [cell('Quotation', { color: MUTED, fontSize: 7.5 }), cell(pi.quoteNumber || '—', { bold: true, fontSize: 7.5 })],
                    [cell('Customer PO', { color: MUTED, fontSize: 7.5 }), cell(pi.customerPoNumber || pi.poNumber || '—', { bold: true, fontSize: 7.5 })],
                    [cell('Order Reference', { color: MUTED, fontSize: 7.5 }), cell(pi.orderId || '—', { bold: true, fontSize: 7.5 })],
                    [cell('Delivery', { color: MUTED, fontSize: 7.5 }), cell(pi.shippingAddress || 'As agreed', { fontSize: 7.5 })],
                  ],
                },
                layout: 'noBorders',
                margin: [0, 5, 0, 0],
              },
            ],
          },
        ],
        margin: [0, 0, 0, 15],
      },

      { text: 'ITEM DETAILS', style: 'sectionLabel', margin: [0, 0, 0, 5] },
      {
        table: {
          headerRows: 1,
          widths: [28, '*', 44, 32, 28, 58, 55, 65],
          body: itemRows,
        },
        layout: {
          hLineWidth: (i: number, node: any) => i === 0 || i === 1 || i === node.table.body.length ? 0.7 : 0.35,
          vLineWidth: () => 0.35,
          hLineColor: (i: number) => i === 0 || i === 1 ? INK : RULE_LIGHT,
          vLineColor: () => RULE_LIGHT,
        },
        margin: [0, 0, 0, 14],
      },

      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'BANK ACCOUNT DETAILS FOR RTGS / NEFT / IMPS', style: 'sectionLabel', margin: [0, 0, 0, 5] },
              {
                table: {
                  widths: [72, 7, '*'],
                  body: [
                    [cell('Bank Name', { color: MUTED, fontSize: 7.2 }), cell(':', { color: MUTED, fontSize: 7.2 }), cell(bank.bankName || '—', { bold: true, fontSize: 7.2 })],
                    [cell('Account Name', { color: MUTED, fontSize: 7.2 }), cell(':', { color: MUTED, fontSize: 7.2 }), cell(bank.accountName || '—', { bold: true, fontSize: 7.2 })],
                    [cell('Account No.', { color: MUTED, fontSize: 7.2 }), cell(':', { color: MUTED, fontSize: 7.2 }), cell(bank.accountNumber || '—', { bold: true, fontSize: 7.2 })],
                    [cell('IFSC Code', { color: MUTED, fontSize: 7.2 }), cell(':', { color: MUTED, fontSize: 7.2 }), cell(bank.ifsc || '—', { bold: true, fontSize: 7.2 })],
                    ...(bank.upiId ? [[cell('UPI / VPA', { color: MUTED, fontSize: 7.2 }), cell(':', { color: MUTED, fontSize: 7.2 }), cell(bank.upiId, { fontSize: 7.2 })]] : []),
                  ],
                },
                layout: 'noBorders',
              },
            ],
          },
          { width: 16, text: '' },
          {
            width: 235,
            stack: [
              { text: 'AMOUNT SUMMARY', style: 'sectionLabel', alignment: 'right', margin: [0, 0, 0, 5] },
              {
                table: {
                  widths: ['*', 95],
                  body: [
                    [cell('Taxable Value', { fontSize: 8 }), cell(formatINR(pi.taxableAmount || pi.subtotal), { align: 'right', fontSize: 8 })],
                    ...(Number(pi.discount || 0) > 0
                      ? [[cell('Discount', { fontSize: 8 }), cell(`- ${formatINR(pi.discount)}`, { align: 'right', fontSize: 8 })]]
                      : []),
                    ...(isInterstate
                      ? [[cell('IGST', { fontSize: 8 }), cell(formatINR(pi.igst), { align: 'right', fontSize: 8 })]]
                      : [
                          [cell('CGST', { fontSize: 8 }), cell(formatINR(pi.cgst), { align: 'right', fontSize: 8 })],
                          [cell('SGST', { fontSize: 8 }), cell(formatINR(pi.sgst), { align: 'right', fontSize: 8 })],
                        ]),
                    ...(Number(pi.shippingCost || 0) > 0
                      ? [[cell('Freight / Logistics', { fontSize: 8 }), cell(formatINR(pi.shippingCost), { align: 'right', fontSize: 8 })]]
                      : []),
                    ...(Number(pi.roundOff || 0) !== 0
                      ? [[cell('Round Off', { fontSize: 8 }), cell(formatINR(pi.roundOff), { align: 'right', fontSize: 8 })]]
                      : []),
                    [cell('TOTAL AMOUNT', { bold: true, fontSize: 9, margin: [5, 7, 5, 7] }), cell(formatINR(pi.grandTotal), { bold: true, align: 'right', fontSize: 9, margin: [5, 7, 5, 7] })],
                    [cell(`ADVANCE PAYABLE (${advancePct}%)`, { bold: true, fontSize: 8 }), cell(formatINR(pi.advanceAmount), { bold: true, align: 'right', fontSize: 8 })],
                    [cell(`BALANCE ON DISPATCH (${100 - advancePct}%)`, { fontSize: 8 }), cell(formatINR(pi.balanceDue), { align: 'right', fontSize: 8 })],
                  ],
                },
                layout: {
                  hLineColor: (i: number) => i === 5 ? INK : RULE_LIGHT,
                  vLineColor: () => RULE_LIGHT,
                  hLineWidth: (i: number) => i === 5 ? 0.7 : 0.35,
                  vLineWidth: () => 0.35,
                },
              },
            ],
          },
        ],
        margin: [0, 0, 0, 20],
      },

      {
        columns: [
          {
            width: '*',
            stack: [
              {
                text: pi.notes || 'This is a system-generated commercial document.',
                fontSize: 7,
                color: MUTED,
              },
            ],
          },
          {
            width: 140,
            stack: [
              { text: 'For Pacific Products and Solutions', fontSize: 8, bold: true, alignment: 'right' },
              { text: 'Authorised Signatory', fontSize: 7, color: MUTED, alignment: 'right', margin: [0, 22, 0, 0] },
            ],
          },
        ],
      },

      // -----------------------------------------------------------------------
      // PAGE 2 — COMMERCIAL TERMS ONLY
      // -----------------------------------------------------------------------
      {
        pageBreak: 'before',
        text: 'COMMERCIAL TERMS',
        style: 'termsTitle',
        margin: [0, 0, 0, 10],
      },
      {
        canvas: [{
          type: 'line',
          x1: 0,
          y1: 0,
          x2: 519,
          y2: 0,
          lineWidth: 0.8,
          lineColor: INK,
        }],
        margin: [0, 0, 0, 20],
      },
      {
        ol: [
          'This Proforma Invoice is valid for 30 calendar days.',
          'Production lead time starts upon receipt of advance deposit.',
          'All disputes subject to Delhi jurisdiction only.',
        ],
        fontSize: 10,
        color: INK,
        lineHeight: 1.7,
      },
      {
        canvas: [{
          type: 'line',
          x1: 0,
          y1: 0,
          x2: 519,
          y2: 0,
          lineWidth: 0.45,
          lineColor: RULE,
        }],
        margin: [0, 28, 0, 10],
      },
      {
        text: `PI Number: ${pi.piNumber}`,
        fontSize: 8,
        color: MUTED,
      },
      {
        text: `Issued on: ${formatDate(pi.createdAt)}`,
        fontSize: 8,
        color: MUTED,
        margin: [0, 3, 0, 0],
      },
    ],

    styles: {
      sectionLabel: {
        fontSize: 7.5,
        bold: true,
        color: MUTED,
        characterSpacing: 0.5,
      },
      termsTitle: {
        fontSize: 18,
        bold: true,
        color: INK,
        characterSpacing: 0.4,
      },
    } as StyleDictionary,
  };

  const doc = pdfmake.createPdf(docDefinition);
  return await doc.getBuffer();
}
