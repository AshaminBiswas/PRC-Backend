/**
 * proforma-invoice-pdf.service.ts
 *
 * Production-grade PDF generator for Commercial Proforma Invoices (PI) using pdfmake.
 * Features:
 * - PRC Hardware brand palette: Obsidian Navy (#0f172a), Amber Gold (#d97706), Emerald (#047857).
 * - Vector SVG icons for crisp markers, contacts, and security seals.
 * - Comprehensive GST tax breakdown (Intrastate CGST+SGST vs Interstate IGST).
 * - Advance deposit summary with payment terms schedule.
 * - Bank RTGS/NEFT/UPI transfer instructions box.
 * - Cryptographic digital signature box with high-resolution QR verification code.
 */

import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require('pdfmake');
import type { TDocumentDefinitions, Content, StyleDictionary, TableCell } from 'pdfmake/interfaces';
import { PRC_LOGO_DATA_URL } from '../../assets/logo.base64';

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
  console.warn('[PI PDF Service] Font initialization warning:', e?.message || e);
}

// ── Palette Constants ────────────────────────────────────────────────────────
const NAVY = '#0f172a';
const NAVY_DARK = '#0b1e38';
const AMBER = '#f59e0b';
const AMBER_DARK = '#d97706';
const GREEN = '#047857';
const LIGHT_BG = '#f8fafc';
const BORDER_DARK = '#1e293b';
const BORDER_LIGHT = '#cbd5e1';
const BORDER_SUBTLE = '#e2e8f0';
const GRAY = '#475569';
const DARK_GRAY = '#1e293b';

// ── Crisp Vector SVG Icons ───────────────────────────────────────────────────
const ICONS = {
  mail: (color = AMBER_DARK) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
  phone: (color = AMBER_DARK) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  globe: (color = AMBER_DARK) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`,
  calendar: (color = GRAY) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`,
  clock: (color = GRAY) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  user: (color = AMBER_DARK) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>`,
  shield: (color = AMBER_DARK) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`,
  mapPin: (color = AMBER_DARK) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
  docRef: (color = GRAY) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  bank: (color = AMBER_DARK) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 10-5 10 5v2H2z"/><path d="M4 10v9"/><path d="M8 10v9"/><path d="M16 10v9"/><path d="M20 10v9"/><path d="M2 21h20"/></svg>`,
  signatureSvg: `
    <svg viewBox="0 0 110 32" fill="none" stroke="#0f172a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 24 C 14 6, 18 4, 26 21 C 30 28, 36 8, 44 16 C 52 24, 58 6, 68 20 C 76 12, 86 16, 98 22" />
      <line x1="2" y1="30" x2="108" y2="30" stroke="#94a3b8" stroke-width="0.75" />
    </svg>`,
};

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
    align?: 'left' | 'center' | 'right';
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
    color: options.color || NAVY,
    fillColor: options.fillColor,
    fontSize: options.fontSize || 8,
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
 */
export async function generateProformaPdf(pi: ProformaPdfData): Promise<Buffer> {
  const items = pi.items || [];
  const isSigned = Boolean(pi.digitalSignature && pi.signedBy);
  const isInterstate = Number(pi.igst || 0) > 0;

  // Default Bank Details
  const bank = pi.bankDetails || {
    bankName: 'HDFC Bank Ltd.',
    accountName: 'Pacific Products and Solutions',
    accountNumber: '50200012345678',
    ifsc: 'HDFC0001234',
    branch: 'Mandoli Industrial Area, Delhi',
    upiId: 'pacificproducts@hdfcbank',
  };

  // ── Line Items Table ───────────────────────────────────────────────────────
  const tableRows: TableCell[][] = [
    [
      makeCell('#', { bold: true, align: 'center', color: '#ffffff', fillColor: NAVY_DARK, fontSize: 7.5 }),
      makeCell('DESCRIPTION / PRODUCT SPECIFICATION', { bold: true, color: '#ffffff', fillColor: NAVY_DARK, fontSize: 7.5 }),
      makeCell('HSN', { bold: true, align: 'center', color: '#ffffff', fillColor: NAVY_DARK, fontSize: 7.5 }),
      makeCell('QTY', { bold: true, align: 'center', color: '#ffffff', fillColor: NAVY_DARK, fontSize: 7.5 }),
      makeCell('RATE (\u20B9)', { bold: true, align: 'right', color: '#ffffff', fillColor: NAVY_DARK, fontSize: 7.5 }),
      makeCell('TAXABLE (\u20B9)', { bold: true, align: 'right', color: '#ffffff', fillColor: NAVY_DARK, fontSize: 7.5 }),
      makeCell(isInterstate ? 'IGST (\u20B9)' : 'GST (\u20B9)', { bold: true, align: 'right', color: '#ffffff', fillColor: NAVY_DARK, fontSize: 7.5 }),
      makeCell('TOTAL (\u20B9)', { bold: true, align: 'right', color: '#ffffff', fillColor: NAVY_DARK, fontSize: 7.5 }),
    ],
  ];

  if (items.length === 0) {
    tableRows.push([
      {
        text: 'No line items listed in proforma invoice',
        colSpan: 8,
        alignment: 'center',
        color: GRAY,
        italics: true,
        margin: [4, 10, 4, 10],
      } as TableCell,
      ...Array(7).fill({ text: '' } as TableCell),
    ]);
  } else {
    items.forEach((item, idx) => {
      const rowBg = idx % 2 === 0 ? '#ffffff' : LIGHT_BG;
      const taxAmt = isInterstate
        ? Number(item.igstAmount || 0)
        : Number(item.cgstAmount || 0) + Number(item.sgstAmount || 0);

      tableRows.push([
        makeCell(String(idx + 1), { align: 'center', fillColor: rowBg, fontSize: 7.5 }),
        {
          stack: [
            { text: item.productName || 'Hardware Fitting', bold: true, fontSize: 8, color: NAVY },
            { text: `SKU: ${item.sku || 'N/A'}${item.description ? `  |  ${item.description}` : ''}`, fontSize: 6.8, color: GRAY },
          ],
          fillColor: rowBg,
          margin: [4, 3.5, 4, 3.5],
        },
        makeCell(item.hsnCode || '8302', { align: 'center', fillColor: rowBg, fontSize: 7.5 }),
        makeCell(`${Number(item.quantity)} ${item.unit || 'PCS'}`, { align: 'center', fillColor: rowBg, fontSize: 7.5, bold: true }),
        makeCell(Number(item.unitRate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), { align: 'right', fillColor: rowBg, fontSize: 7.5 }),
        makeCell(Number(item.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), { align: 'right', fillColor: rowBg, fontSize: 7.5 }),
        makeCell(taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), { align: 'right', fillColor: rowBg, fontSize: 7.5 }),
        makeCell(Number(item.lineTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), { align: 'right', bold: true, fillColor: rowBg, fontSize: 7.5, color: NAVY }),
      ]);
    });
  }

  // ── QR Code Section (for signature verification) ───────────────────────────
  const qrSection: Content = pi.qrCodeDataUrl
    ? {
        columns: [
          {
            image: pi.qrCodeDataUrl,
            width: 52,
            height: 52,
          },
          {
            width: '*',
            stack: [
              { text: isSigned ? 'Cryptographically Verified' : 'Official Verification Record', fontSize: 8, bold: true, color: isSigned ? GREEN : NAVY, margin: [6, 0, 0, 2] },
              { text: `Verification ID: ${pi.verificationId}`, fontSize: 7, color: DARK_GRAY, margin: [6, 0, 0, 1] },
              { text: `Signed By: ${pi.signedBy || 'PRC Commercial Desk'}`, fontSize: 7, color: DARK_GRAY, margin: [6, 0, 0, 1] },
              { text: `Date: ${formatDate(pi.signedAt || pi.createdAt)}`, fontSize: 7, color: DARK_GRAY, margin: [6, 0, 0, 1] },
              { text: `SHA256: ${(pi.documentHash || '').slice(0, 22)}...`, fontSize: 6.5, color: GRAY, margin: [6, 0, 0, 0] },
            ],
          },
        ],
        margin: [0, 2, 0, 0],
      }
    : {
        text: 'Awaiting digital signature & verification stamp',
        fontSize: 7.5,
        italics: true,
        color: GRAY,
        margin: [0, 6, 0, 6],
      };

  // ── Document Definition ────────────────────────────────────────────────────
  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [32, 28, 32, 36],
    defaultStyle: { font: 'Roboto', fontSize: 8, color: NAVY },

    // Fixed Footer Across Pages
    footer: (currentPage: number, pageCount: number): Content => ({
      stack: [
        {
          canvas: [
            {
              type: 'line',
              x1: 32,
              y1: 0,
              x2: 563,
              y2: 0,
              lineWidth: 0.5,
              lineColor: BORDER_LIGHT,
            },
          ],
          margin: [0, 0, 0, 4],
        },
        {
          columns: [
            {
              width: '42%',
              columns: [
                { svg: ICONS.mapPin(AMBER_DARK), width: 10, height: 10, margin: [0, 1, 0, 0] },
                {
                  text: 'H -3, J.R. COMPLEX GATE NO 4,\nMELA RAM FARM, MANDOLI, DELHI 110093',
                  fontSize: 6.5,
                  color: DARK_GRAY,
                  lineHeight: 1.2,
                  margin: [4, 0, 0, 0],
                },
              ],
            },
            {
              width: '28%',
              columns: [
                { svg: ICONS.mail(AMBER_DARK), width: 10, height: 10, margin: [0, 2, 0, 0] },
                {
                  text: 'billing@pacifichardware.com\n+91 98185 92113',
                  fontSize: 6.8,
                  color: DARK_GRAY,
                  margin: [4, 0, 0, 0],
                },
              ],
            },
            {
              width: '24%',
              columns: [
                { svg: ICONS.docRef(GRAY), width: 10, height: 10, margin: [0, 1, 0, 0] },
                {
                  stack: [
                    { text: `PI: ${pi.piNumber}`, fontSize: 6.8, bold: true, color: DARK_GRAY },
                    { text: 'Official Commercial Document', fontSize: 6, color: GRAY },
                  ],
                  margin: [4, 0, 0, 0],
                },
              ],
            },
            {
              width: '6%',
              table: {
                widths: ['*'],
                body: [
                  [
                    {
                      text: `${currentPage} / ${pageCount}`,
                      fontSize: 7,
                      bold: true,
                      color: NAVY,
                      alignment: 'center',
                      fillColor: '#ffffff',
                      margin: [1, 2, 1, 2],
                    },
                  ],
                ],
              },
              layout: {
                hLineColor: () => BORDER_LIGHT,
                vLineColor: () => BORDER_LIGHT,
                hLineWidth: () => 0.5,
                vLineWidth: () => 0.5,
              },
            },
          ],
          margin: [32, 0, 32, 0],
        },
      ],
    }),

    content: [
      // ── Top Header Brand ───────────────────────────────────────────────────
      {
        columns: [
          {
            width: '*',
            columns: [
              {
                image: PRC_LOGO_DATA_URL,
                width: 42,
                height: 42,
                margin: [0, 0, 8, 0],
              },
              {
                stack: [
                  { text: 'PRC Hardware', fontSize: 16, bold: true, color: NAVY, characterSpacing: 0.5 },
                  {
                    text: 'PACIFIC PRODUCTS AND SOLUTIONS',
                    fontSize: 7.5,
                    bold: true,
                    color: AMBER_DARK,
                    margin: [0, 1, 0, 1],
                  },
                  {
                    text: 'H-3, J.R. Complex, Gate No 4, Mela Ram Farm, Mandoli, Delhi - 110093',
                    fontSize: 6.8,
                    color: DARK_GRAY,
                  },
                  {
                    text: 'GSTIN: 07AABCP1234F1Z9  |  PAN: AABCP1234F',
                    fontSize: 6.8,
                    bold: true,
                    color: DARK_GRAY,
                  },
                ],
              },
            ],
          },
          {
            width: 175,
            stack: [
              {
                columns: [
                  { svg: ICONS.mail(AMBER_DARK), width: 10, height: 10, margin: [0, 1, 0, 0] },
                  { text: 'po@pacifichardware.com', fontSize: 7.2, color: NAVY, margin: [4, 0, 0, 0] },
                ],
                margin: [0, 0, 0, 2],
              },
              {
                columns: [
                  { svg: ICONS.phone(AMBER_DARK), width: 10, height: 10, margin: [0, 1, 0, 0] },
                  { text: '+91 98185 92113', fontSize: 7.2, color: NAVY, margin: [4, 0, 0, 0] },
                ],
                margin: [0, 0, 0, 2],
              },
              {
                columns: [
                  { svg: ICONS.globe(AMBER_DARK), width: 10, height: 10, margin: [0, 1, 0, 0] },
                  { text: 'www.pacifichardware.com', fontSize: 7.2, color: NAVY, margin: [4, 0, 0, 0] },
                ],
              },
            ],
          },
        ],
        margin: [0, 0, 0, 6],
      },

      // Accent Amber Bar
      {
        canvas: [{ type: 'rect', x: 0, y: 0, w: 531, h: 1.5, color: AMBER }],
        margin: [0, 0, 0, 8],
      },

      // ── Title & Reference Badge ────────────────────────────────────────────
      {
        columns: [
          {
            stack: [
              { text: 'PROFORMA INVOICE', fontSize: 16, bold: true, color: NAVY, characterSpacing: 0.5 },
              { text: 'Advance Commercial Demand & Specification Confirmation', fontSize: 7.2, color: GRAY, margin: [0, 1, 0, 0] },
            ],
            width: '*',
          },
          {
            width: 185,
            table: {
              widths: [55, '*'],
              body: [
                [
                  {
                    text: 'PI NO.',
                    fontSize: 7.5,
                    bold: true,
                    color: NAVY,
                    alignment: 'center',
                    fillColor: '#ffffff',
                    margin: [3, 4, 3, 4],
                  },
                  {
                    text: pi.piNumber,
                    fontSize: 8,
                    bold: true,
                    color: AMBER_DARK,
                    alignment: 'center',
                    fillColor: '#ffffff',
                    margin: [3, 4, 3, 4],
                  },
                ],
              ],
            },
            layout: {
              hLineColor: () => BORDER_DARK,
              vLineColor: () => BORDER_DARK,
              hLineWidth: () => 0.75,
              vLineWidth: () => 0.75,
            },
          },
        ],
        margin: [0, 0, 0, 8],
      },

      // ── 3-Column Metadata Strip ────────────────────────────────────────────
      {
        table: {
          widths: ['33.33%', '33.33%', '33.34%'],
          body: [
            [
              {
                columns: [
                  { svg: ICONS.calendar(AMBER_DARK), width: 12, height: 12, margin: [0, 2, 0, 0] },
                  {
                    stack: [
                      { text: 'ISSUE DATE', fontSize: 6.8, bold: true, color: GRAY },
                      { text: formatDate(pi.createdAt), fontSize: 8, bold: true, color: NAVY },
                    ],
                    margin: [4, 0, 0, 0],
                  },
                ],
                margin: [5, 4, 5, 4],
              },
              {
                columns: [
                  { svg: ICONS.clock(AMBER_DARK), width: 12, height: 12, margin: [0, 2, 0, 0] },
                  {
                    stack: [
                      { text: 'FINANCIAL YEAR', fontSize: 6.8, bold: true, color: GRAY },
                      { text: pi.financialYear || '2026-27', fontSize: 8, bold: true, color: NAVY },
                    ],
                    margin: [4, 0, 0, 0],
                  },
                ],
                margin: [5, 4, 5, 4],
              },
              {
                columns: [
                  { svg: ICONS.clock(AMBER_DARK), width: 12, height: 12, margin: [0, 2, 0, 0] },
                  {
                    stack: [
                      { text: 'VALID UNTIL', fontSize: 6.8, bold: true, color: GRAY },
                      {
                        text: pi.validUntil ? formatDate(pi.validUntil) : '30 Days from Issue',
                        fontSize: 8,
                        bold: true,
                        color: NAVY,
                      },
                    ],
                    margin: [4, 0, 0, 0],
                  },
                ],
                margin: [5, 4, 5, 4],
              },
            ],
          ],
        },
        layout: {
          hLineColor: () => BORDER_LIGHT,
          vLineColor: () => BORDER_LIGHT,
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
        },
        margin: [0, 0, 0, 8],
      },

      // ── Customer Dossier & Delivery Dossier ─────────────────────────────────
      {
        columns: [
          // Left: Billed To (Buyer)
          {
            width: '49%',
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    stack: [
                      {
                        columns: [
                          { svg: ICONS.user(AMBER_DARK), width: 10, height: 10, margin: [0, 1, 0, 0] },
                          { text: 'BILLED TO (BUYER)', fontSize: 7.5, bold: true, color: AMBER_DARK, margin: [4, 0, 0, 0] },
                        ],
                        margin: [0, 0, 0, 2],
                      },
                      { text: pi.companyName || pi.customerName, fontSize: 9, bold: true, color: NAVY, margin: [0, 1, 0, 1] },
                      ...(pi.companyName ? [{ text: `Attn: ${pi.customerName}`, fontSize: 7.5, color: DARK_GRAY, margin: [0, 0, 0, 1] as [number, number, number, number] }] : []),
                      ...(pi.gstin ? [{ text: `GSTIN: ${pi.gstin}`, fontSize: 7.5, bold: true, color: NAVY, margin: [0, 0, 0, 1] as [number, number, number, number] }] : []),
                      { text: `Email: ${pi.customerEmail}`, fontSize: 7.2, color: DARK_GRAY, margin: [0, 0, 0, 1] },
                      ...(pi.customerPhone ? [{ text: `Phone: ${pi.customerPhone}`, fontSize: 7.2, color: DARK_GRAY, margin: [0, 0, 0, 1] as [number, number, number, number] }] : []),
                      ...(pi.billingAddress ? [{ text: `Billing: ${pi.billingAddress}`, fontSize: 7, color: GRAY, margin: [0, 1, 0, 0] as [number, number, number, number] }] : []),
                    ],
                    fillColor: '#ffffff',
                    margin: [6, 5, 6, 5],
                  },
                ],
              ],
            },
            layout: {
              hLineColor: () => BORDER_LIGHT,
              vLineColor: () => BORDER_LIGHT,
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
            },
          },
          { width: '2%', text: '' },
          // Right: Order References & Terms
          {
            width: '49%',
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    stack: [
                      {
                        columns: [
                          { svg: ICONS.shield(AMBER_DARK), width: 10, height: 10, margin: [0, 1, 0, 0] },
                          { text: 'ORDER TERMS & REFERENCES', fontSize: 7.5, bold: true, color: AMBER_DARK, margin: [4, 0, 0, 0] },
                        ],
                        margin: [0, 0, 0, 2],
                      },
                      {
                        table: {
                          widths: [70, 6, '*'],
                          body: [
                            ...(pi.quoteNumber
                              ? [
                                  [
                                    { text: 'Linked Quote', fontSize: 7.2, color: GRAY },
                                    { text: ':', fontSize: 7.2, color: GRAY },
                                    { text: pi.quoteNumber, fontSize: 7.2, bold: true, color: NAVY },
                                  ],
                                ]
                              : []),
                            ...(pi.customerPoNumber || pi.poNumber
                              ? [
                                  [
                                    { text: 'Client PO #', fontSize: 7.2, color: GRAY },
                                    { text: ':', fontSize: 7.2, color: GRAY },
                                    { text: pi.customerPoNumber || pi.poNumber || 'N/A', fontSize: 7.2, bold: true, color: NAVY },
                                  ],
                                ]
                              : []),
                            [
                              { text: 'Payment Terms', fontSize: 7.2, color: GRAY },
                              { text: ':', fontSize: 7.2, color: GRAY },
                              { text: `${Number(pi.advancePercentage)}% Advance, Balance at Dispatch`, fontSize: 7.2, bold: true, color: AMBER_DARK },
                            ],
                            [
                              { text: 'Place of Supply', fontSize: 7.2, color: GRAY },
                              { text: ':', fontSize: 7.2, color: GRAY },
                              { text: pi.placeOfSupply || 'Karnataka', fontSize: 7.2, bold: true, color: NAVY },
                            ],
                            [
                              { text: 'Delivery SLA', fontSize: 7.2, color: GRAY },
                              { text: ':', fontSize: 7.2, color: GRAY },
                              { text: pi.deliveryTimeline || '7-10 Business Days', fontSize: 7.2, color: DARK_GRAY },
                            ],
                          ],
                        },
                        layout: 'noBorders',
                      },
                      ...(pi.shippingAddress
                        ? [{ text: `Site Delivery: ${pi.shippingAddress}`, fontSize: 7, color: GRAY, margin: [0, 3, 0, 0] as [number, number, number, number] }]
                        : []),
                    ],
                    fillColor: '#ffffff',
                    margin: [6, 5, 6, 5],
                  },
                ],
              ],
            },
            layout: {
              hLineColor: () => BORDER_LIGHT,
              vLineColor: () => BORDER_LIGHT,
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
            },
          },
        ],
        margin: [0, 0, 0, 8],
      },

      // ── Line Items Table ───────────────────────────────────────────────────
      {
        table: {
          headerRows: 1,
          widths: [18, '*', 38, 42, 54, 54, 52, 58],
          body: tableRows,
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 0.75 : 0.4),
          vLineWidth: () => 0.4,
          hLineColor: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? BORDER_DARK : BORDER_SUBTLE),
          vLineColor: () => BORDER_SUBTLE,
        },
        margin: [0, 0, 0, 8],
      },

      // ── Lower Section: Bank Details + Advance Summary ──────────────────────
      {
        columns: [
          // Left Column: Bank Details & Digital Seal Box
          {
            width: '52%',
            stack: [
              // Bank Details Box
              {
                table: {
                  widths: ['*'],
                  body: [
                    [
                      {
                        stack: [
                          {
                            columns: [
                              { svg: ICONS.bank(AMBER_DARK), width: 10, height: 10, margin: [0, 1, 0, 0] },
                              { text: 'BANK & RTGS / NEFT REMITTANCE DETAILS', fontSize: 7.5, bold: true, color: AMBER_DARK, margin: [4, 0, 0, 0] },
                            ],
                            margin: [0, 0, 0, 3],
                          },
                          {
                            table: {
                              widths: [65, 6, '*'],
                              body: [
                                [
                                  { text: 'Bank Name', fontSize: 7, color: GRAY },
                                  { text: ':', fontSize: 7, color: GRAY },
                                  { text: bank.bankName || 'HDFC Bank Ltd.', fontSize: 7, bold: true, color: NAVY },
                                ],
                                [
                                  { text: 'Account Name', fontSize: 7, color: GRAY },
                                  { text: ':', fontSize: 7, color: GRAY },
                                  { text: bank.accountName || 'Pacific Products and Solutions', fontSize: 7, bold: true, color: NAVY },
                                ],
                                [
                                  { text: 'Account No.', fontSize: 7, color: GRAY },
                                  { text: ':', fontSize: 7, color: GRAY },
                                  { text: bank.accountNumber || '50200012345678', fontSize: 7.2, bold: true, color: AMBER_DARK },
                                ],
                                [
                                  { text: 'IFSC Code', fontSize: 7, color: GRAY },
                                  { text: ':', fontSize: 7, color: GRAY },
                                  { text: bank.ifsc || 'HDFC0001234', fontSize: 7.2, bold: true, color: NAVY },
                                ],
                                [
                                  { text: 'UPI / VPA', fontSize: 7, color: GRAY },
                                  { text: ':', fontSize: 7, color: GRAY },
                                  { text: bank.upiId || 'pacificproducts@hdfcbank', fontSize: 7, color: DARK_GRAY },
                                ],
                              ],
                            },
                            layout: 'noBorders',
                          },
                        ],
                        fillColor: '#ffffff',
                        margin: [6, 5, 6, 5],
                      },
                    ],
                  ],
                },
                layout: {
                  hLineColor: () => BORDER_LIGHT,
                  vLineColor: () => BORDER_LIGHT,
                  hLineWidth: () => 0.5,
                  vLineWidth: () => 0.5,
                },
                margin: [0, 0, 0, 6],
              },

              // Digital Signature Box
              {
                table: {
                  widths: ['*'],
                  body: [
                    [
                      {
                        stack: [
                          {
                            columns: [
                              {
                                columns: [
                                  { svg: ICONS.shield(AMBER_DARK), width: 10, height: 10, margin: [0, 1, 0, 0] },
                                  { text: 'DIGITAL AUTHENTICITY STAMP', color: AMBER_DARK, bold: true, fontSize: 7.5, margin: [4, 0, 0, 0] },
                                ],
                                width: '*',
                              },
                              { text: 'HMAC-SHA256', fontSize: 7, color: GRAY, alignment: 'right', width: 'auto' },
                            ],
                            margin: [0, 0, 0, 2],
                          },
                          qrSection,
                        ],
                        margin: [6, 5, 6, 5],
                        fillColor: '#ffffff',
                      },
                    ],
                  ],
                },
                layout: {
                  hLineColor: () => BORDER_DARK,
                  vLineColor: () => BORDER_DARK,
                  hLineWidth: () => 0.75,
                  vLineWidth: () => 0.75,
                },
              },
            ],
          },

          { width: '3%', text: '' },

          // Right Column: Financial Summary & Advance Schedule
          {
            width: '45%',
            stack: [
              {
                table: {
                  widths: ['58%', '42%'],
                  body: [
                    [
                      makeCell('Taxable Value (Basic):', { fontSize: 7.2, color: GRAY }),
                      makeCell(formatINR(pi.taxableAmount || pi.subtotal), { align: 'right', fontSize: 7.2, bold: true, color: NAVY }),
                    ],
                    ...(Number(pi.discount || 0) > 0
                      ? [
                          [
                            makeCell('Discount:', { fontSize: 7.2, color: GRAY }),
                            makeCell(`- ${formatINR(pi.discount)}`, { align: 'right', fontSize: 7.2, color: DARK_GRAY }),
                          ],
                        ]
                      : []),
                    ...(isInterstate
                      ? [
                          [
                            makeCell('Integrated GST (IGST 18%):', { fontSize: 7.2, color: GRAY }),
                            makeCell(formatINR(pi.igst), { align: 'right', fontSize: 7.2, bold: true, color: NAVY }),
                          ],
                        ]
                      : [
                          [
                            makeCell('Central GST (CGST 9%):', { fontSize: 7.2, color: GRAY }),
                            makeCell(formatINR(pi.cgst), { align: 'right', fontSize: 7.2, bold: true, color: NAVY }),
                          ],
                          [
                            makeCell('State GST (SGST 9%):', { fontSize: 7.2, color: GRAY }),
                            makeCell(formatINR(pi.sgst), { align: 'right', fontSize: 7.2, bold: true, color: NAVY }),
                          ],
                        ]),
                    ...(Number(pi.shippingCost || 0) > 0
                      ? [
                          [
                            makeCell('Logistics & Freight:', { fontSize: 7.2, color: GRAY }),
                            makeCell(formatINR(pi.shippingCost), { align: 'right', fontSize: 7.2, color: DARK_GRAY }),
                          ],
                        ]
                      : []),
                    ...(Number(pi.roundOff || 0) !== 0
                      ? [
                          [
                            makeCell('Round Off:', { fontSize: 7.2, color: GRAY }),
                            makeCell(formatINR(pi.roundOff), { align: 'right', fontSize: 7.2, color: DARK_GRAY }),
                          ],
                        ]
                      : []),
                    [
                      makeCell('Grand Total (INR):', { fontSize: 8.5, bold: true, color: NAVY, fillColor: '#f1f5f9' }),
                      makeCell(formatINR(pi.grandTotal), { align: 'right', fontSize: 8.5, bold: true, color: NAVY, fillColor: '#f1f5f9' }),
                    ],
                    [
                      makeCell(`Advance Payable (${Number(pi.advancePercentage)}%):`, { fontSize: 8, bold: true, color: AMBER_DARK, fillColor: '#fffbeb' }),
                      makeCell(formatINR(pi.advanceAmount), { align: 'right', fontSize: 8, bold: true, color: AMBER_DARK, fillColor: '#fffbeb' }),
                    ],
                    [
                      makeCell('Balance Due at Dispatch:', { fontSize: 7.2, bold: true, color: DARK_GRAY }),
                      makeCell(formatINR(pi.balanceDue), { align: 'right', fontSize: 7.2, bold: true, color: DARK_GRAY }),
                    ],
                  ],
                },
                layout: {
                  hLineWidth: () => 0.4,
                  vLineWidth: () => 0,
                  hLineColor: () => BORDER_SUBTLE,
                  paddingTop: () => 3,
                  paddingBottom: () => 3,
                },
              },

              // Authorised Signatory Stamp
              {
                columns: [
                  { width: '*', text: '' },
                  {
                    width: 120,
                    stack: [
                      { text: 'For PRC Hardware', fontSize: 7.2, bold: true, color: NAVY, alignment: 'right', margin: [0, 8, 0, 2] },
                      { svg: ICONS.signatureSvg, width: 95, height: 24, alignment: 'right', margin: [0, 0, 0, 2] },
                      { text: 'Authorized Signatory', fontSize: 7, color: GRAY, alignment: 'right' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        margin: [0, 0, 0, 6],
      },
    ],
    styles: {} as StyleDictionary,
  };

  const doc = pdfmake.createPdf(docDefinition);
  const buffer = await doc.getBuffer();
  return buffer;
}
