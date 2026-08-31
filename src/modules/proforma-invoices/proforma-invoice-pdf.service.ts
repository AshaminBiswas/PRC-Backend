/**
 * proforma-invoice-pdf.service.ts
 *
 * Production-grade PDF generator for Commercial Proforma Invoices (PI) using pdfmake.
 * Matches exact executive branding, layout, color palette, logo, vector SVG icons,
 * line items table, digital signature seal with QR code, bank remittance box,
 * and Page 2 Terms & Conditions from Quotation & PO PDF generation.
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

// ── Website Brand Palette ─────────────────────────────────────────────────────
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
  project: (color = AMBER_DARK) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/></svg>`,
  listGrid: (color = AMBER_DARK) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`,
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
  const customerName = pi.customerName || pi.companyName || 'Valued B2B Client';
  const advancePct = Number(pi.advancePercentage || 50);

  // Default Bank Details
  const bank = pi.bankDetails || {
    bankName: 'HDFC Bank Ltd.',
    accountName: 'Pacific Products and Solutions',
    accountNumber: '50200012345678',
    ifsc: 'HDFC0001234',
    branch: 'Mandoli Industrial Area, Delhi',
    upiId: 'pacificproducts@hdfcbank',
  };

  // ── Line Items Table Body ───────────────────────────────────────────────────
  const tableRows: TableCell[][] = [
    [
      makeCell('#', { bold: true, align: 'center', color: '#ffffff', fillColor: NAVY_DARK, fontSize: 8 }),
      makeCell('DESCRIPTION / PRODUCT SPECIFICATION', { bold: true, color: '#ffffff', fillColor: NAVY_DARK, fontSize: 8 }),
      makeCell('HSN/SAC', { bold: true, align: 'center', color: '#ffffff', fillColor: NAVY_DARK, fontSize: 8 }),
      makeCell('UNIT', { bold: true, align: 'center', color: '#ffffff', fillColor: NAVY_DARK, fontSize: 8 }),
      makeCell('QTY', { bold: true, align: 'center', color: '#ffffff', fillColor: NAVY_DARK, fontSize: 8 }),
      makeCell('RATE (\u20B9)', { bold: true, align: 'right', color: '#ffffff', fillColor: NAVY_DARK, fontSize: 8 }),
      makeCell(isInterstate ? 'IGST (\u20B9)' : 'GST (\u20B9)', { bold: true, align: 'right', color: '#ffffff', fillColor: NAVY_DARK, fontSize: 8 }),
      makeCell('TOTAL (\u20B9)', { bold: true, align: 'right', color: '#ffffff', fillColor: NAVY_DARK, fontSize: 8 }),
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
        makeCell(String(idx + 1), { align: 'center', fillColor: rowBg, fontSize: 8 }),
        {
          stack: [
            { text: String(item.productName || 'HARDWARE FITTING').toUpperCase(), bold: true, fontSize: 8, color: NAVY },
            { text: `SKU: ${item.sku || 'N/A'}${item.description ? `  |  ${item.description}` : ''}`, fontSize: 7, color: GRAY },
          ],
          fillColor: rowBg,
          margin: [4, 3.5, 4, 3.5],
        },
        makeCell(item.hsnCode || '8302', { align: 'center', fillColor: rowBg, fontSize: 8 }),
        makeCell(item.unit || 'PCS', { align: 'center', fillColor: rowBg, fontSize: 8 }),
        makeCell(String(Number(item.quantity || 1)), { align: 'center', fillColor: rowBg, fontSize: 8, bold: true }),
        makeCell(Number(item.unitRate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), { align: 'right', fillColor: rowBg, fontSize: 8 }),
        makeCell(taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), { align: 'right', fillColor: rowBg, fontSize: 8 }),
        makeCell(Number(item.lineTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), { align: 'right', bold: true, fillColor: rowBg, fontSize: 8, color: NAVY }),
      ]);
    });
  }

  // ── QR Code Section (for signature verification) ───────────────────────────
  const qrSection: Content = pi.qrCodeDataUrl
    ? {
        columns: [
          {
            image: pi.qrCodeDataUrl,
            width: 55,
            height: 55,
          },
          {
            width: '*',
            stack: [
              { text: isSigned ? 'Verified Authenticity' : 'Official Verification Record', fontSize: 8.5, bold: true, color: isSigned ? GREEN : NAVY, margin: [6, 0, 0, 2] },
              { text: `Signed By: ${pi.signedBy || 'PRC Commercial Desk'}`, fontSize: 7.5, color: DARK_GRAY, margin: [6, 0, 0, 1] },
              { text: `Date: ${formatDate(pi.signedAt || pi.createdAt)}`, fontSize: 7.5, color: DARK_GRAY, margin: [6, 0, 0, 1] },
              { text: `SHA256: ${(pi.documentHash || '').slice(0, 20)}...`, fontSize: 7, color: GRAY, margin: [6, 0, 0, 0] },
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
        margin: [0, 8, 0, 8],
      };

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [34, 30, 34, 40],
    defaultStyle: { font: 'Roboto', fontSize: 8.5, color: NAVY },

    // ── Fixed Footer across all pages with Vector Icons ────────────────────────
    footer: (currentPage: number, pageCount: number): Content => ({
      stack: [
        {
          canvas: [
            {
              type: 'line',
              x1: 34,
              y1: 0,
              x2: 561,
              y2: 0,
              lineWidth: 0.5,
              lineColor: BORDER_LIGHT,
            },
          ],
          margin: [0, 0, 0, 5],
        },
        {
          columns: [
            // Left: Location Pin Icon & Address
            {
              width: '42%',
              columns: [
                { svg: ICONS.mapPin(AMBER_DARK), width: 11, height: 11, margin: [0, 1, 0, 0] },
                {
                  text: 'H -3, J.R. COMPLEX GATE NO 4,\nMELA RAM FARM, MANDOLI,\nDELHI 110093, INDIA',
                  fontSize: 6.8,
                  color: DARK_GRAY,
                  lineHeight: 1.25,
                  margin: [4, 0, 0, 0],
                },
              ],
            },
            // Center: Support Email Icon & Address
            {
              width: '28%',
              columns: [
                { svg: ICONS.mail(AMBER_DARK), width: 11, height: 11, margin: [0, 3, 0, 0] },
                {
                  text: 'billing@pacifichardware.com\n+91 98185 92113',
                  fontSize: 7,
                  color: DARK_GRAY,
                  margin: [4, 0, 0, 0],
                },
              ],
            },
            // Right: Ref Document Icon & Computer-Generated Notice
            {
              width: '24%',
              columns: [
                { svg: ICONS.docRef(GRAY), width: 11, height: 11, margin: [0, 1, 0, 0] },
                {
                  stack: [
                    { text: `PI: ${pi.piNumber}`, fontSize: 7, bold: true, color: DARK_GRAY },
                    { text: 'Official Commercial Proforma Invoice', fontSize: 6.2, color: GRAY },
                  ],
                  margin: [4, 0, 0, 0],
                },
              ],
            },
            // Page Number Pill
            {
              width: '6%',
              table: {
                widths: ['*'],
                body: [
                  [
                    {
                      text: `${currentPage} / ${pageCount}`,
                      fontSize: 7.5,
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
          margin: [34, 0, 34, 0],
        },
      ],
    }),

    content: [
      // ═════════════════════════════════════════════════════════════════════════
      // ─── PAGE 1: COMMERCIAL PROFORMA INVOICE (BALANCED ELEGANT BORDERS) ──────
      // ═════════════════════════════════════════════════════════════════════════

      // ── Top Header: Brand Left & Contact Info Right ─────────────────────────
      {
        columns: [
          // Left: Logo + Company Name & Address
          {
            width: '*',
            columns: [
              {
                image: PRC_LOGO_DATA_URL,
                width: 44,
                height: 44,
                margin: [0, 0, 10, 0],
              },
              {
                stack: [
                  { text: 'PRC Hardware', fontSize: 18, bold: true, color: NAVY, characterSpacing: 0.5 },
                  {
                    text: 'H -3, J.R. COMPLEX GATE NO 4, MELA RAM FARM,',
                    fontSize: 7.2,
                    bold: true,
                    color: DARK_GRAY,
                    margin: [0, 2, 0, 0],
                  },
                  { text: 'MANDOLI, DELHI 110093, INDIA', fontSize: 7.2, bold: true, color: DARK_GRAY },
                ],
              },
            ],
          },
          // Right: Contact Stack with Amber Icons
          {
            width: 175,
            stack: [
              {
                columns: [
                  { svg: ICONS.mail(AMBER_DARK), width: 11, height: 11, margin: [0, 1, 0, 0] },
                  { text: 'billing@pacifichardware.com', fontSize: 7.5, color: NAVY, margin: [4, 0, 0, 0] },
                ],
                margin: [0, 0, 0, 2],
              },
              {
                columns: [
                  { svg: ICONS.phone(AMBER_DARK), width: 11, height: 11, margin: [0, 1, 0, 0] },
                  { text: '+91 98185 92113', fontSize: 7.5, color: NAVY, margin: [4, 0, 0, 0] },
                ],
                margin: [0, 0, 0, 2],
              },
              {
                columns: [
                  { svg: ICONS.globe(AMBER_DARK), width: 11, height: 11, margin: [0, 1, 0, 0] },
                  { text: 'www.pacifichardware.com', fontSize: 7.5, color: NAVY, margin: [4, 0, 0, 0] },
                ],
              },
            ],
          },
        ],
        margin: [0, 0, 0, 8],
      },

      // ── Website Amber Accent Underline ───────────────────────────────────────
      {
        canvas: [{ type: 'rect', x: 0, y: 0, w: 527, h: 1.6, color: AMBER }],
        margin: [0, 0, 0, 9],
      },

      // ── PROFORMA INVOICE Title & PI No Pill Row ──────────────────────────────
      {
        columns: [
          // Left: Title
          {
            text: 'PROFORMA INVOICE',
            fontSize: 17,
            bold: true,
            color: NAVY,
            characterSpacing: 0.5,
            width: '*',
            margin: [0, 2, 0, 0],
          },
          // Right: PI NO. Badge with Crisp Frame
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
                    margin: [4, 4, 4, 4],
                  },
                  {
                    text: pi.piNumber,
                    fontSize: 8.5,
                    bold: true,
                    color: AMBER_DARK,
                    alignment: 'center',
                    fillColor: '#ffffff',
                    margin: [4, 4, 4, 4],
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

      // ── 3-Column Metadata Strip (Fine 0.5pt Border) ──────────────────────────
      {
        table: {
          widths: ['33.33%', '33.33%', '33.34%'],
          body: [
            [
              // Issue Date with Calendar SVG Icon
              {
                columns: [
                  { svg: ICONS.calendar(AMBER_DARK), width: 13, height: 13, margin: [0, 2, 0, 0] },
                  {
                    stack: [
                      { text: 'ISSUE DATE', fontSize: 7, bold: true, color: GRAY },
                      { text: formatDate(pi.createdAt), fontSize: 8.5, bold: true, color: NAVY },
                    ],
                    margin: [4, 0, 0, 0],
                  },
                ],
                margin: [6, 4, 6, 4],
              },
              // Financial Year with Clock/Calendar SVG Icon
              {
                columns: [
                  { svg: ICONS.clock(AMBER_DARK), width: 13, height: 13, margin: [0, 2, 0, 0] },
                  {
                    stack: [
                      { text: 'FINANCIAL YEAR', fontSize: 7, bold: true, color: GRAY },
                      { text: pi.financialYear || '2026-27', fontSize: 8.5, bold: true, color: NAVY },
                    ],
                    margin: [4, 0, 0, 0],
                  },
                ],
                margin: [6, 4, 6, 4],
              },
              // Valid Until with Clock SVG Icon
              {
                columns: [
                  { svg: ICONS.clock(AMBER_DARK), width: 13, height: 13, margin: [0, 2, 0, 0] },
                  {
                    stack: [
                      { text: 'VALID UNTIL', fontSize: 7, bold: true, color: GRAY },
                      {
                        text: pi.validUntil ? formatDate(pi.validUntil) : '30 days from date',
                        fontSize: 8.5,
                        bold: true,
                        color: NAVY,
                      },
                    ],
                    margin: [4, 0, 0, 0],
                  },
                ],
                margin: [6, 4, 6, 4],
              },
            ],
          ],
        },
        layout: {
          defaultBorder: true,
          hLineColor: () => BORDER_LIGHT,
          vLineColor: () => BORDER_LIGHT,
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
        },
        margin: [0, 0, 0, 9],
      },

      // ── BILL TO & PROJECT DETAILS (Fine 0.5pt Border) ────────────────────────
      {
        columns: [
          // Left: BILL TO Card
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
                          { svg: ICONS.user(AMBER_DARK), width: 11, height: 11, margin: [0, 1, 0, 0] },
                          { text: 'BILL TO (BUYER)', fontSize: 8, bold: true, color: AMBER_DARK, margin: [4, 0, 0, 0] },
                        ],
                        margin: [0, 0, 0, 2],
                      },
                      { text: customerName, fontSize: 9.5, bold: true, color: NAVY, margin: [0, 1, 0, 2] },
                      { text: pi.companyName || '', fontSize: 8, color: DARK_GRAY, margin: [0, 0, 0, 1] },
                      {
                        text: pi.gstin ? `GSTIN: ${pi.gstin}` : '',
                        fontSize: 8,
                        bold: true,
                        color: NAVY,
                        margin: [0, 0, 0, 1],
                      },
                      { text: pi.customerEmail || '', fontSize: 8, color: DARK_GRAY, margin: [0, 0, 0, 1] },
                      { text: pi.customerPhone ? `Ph: ${pi.customerPhone}` : '', fontSize: 8, color: DARK_GRAY },
                      ...(pi.billingAddress ? [{ text: `Billing: ${pi.billingAddress}`, fontSize: 7.5, color: GRAY, margin: [0, 2, 0, 0] as [number, number, number, number] }] : []),
                    ],
                    fillColor: '#ffffff',
                    margin: [8, 6, 8, 6],
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
          // Spacer
          { width: '2%', text: '' },
          // Right: ORDER & PROJECT DETAILS Card
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
                          { svg: ICONS.project(AMBER_DARK), width: 11, height: 11, margin: [0, 1, 0, 0] },
                          { text: 'ORDER & PROJECT DETAILS', fontSize: 8, bold: true, color: AMBER_DARK, margin: [4, 0, 0, 0] },
                        ],
                        margin: [0, 0, 0, 2],
                      },
                      {
                        text: pi.quoteNumber ? `Linked Quote #${pi.quoteNumber}` : (pi.customerPoNumber ? `Client PO #${pi.customerPoNumber}` : 'Commercial Supply Project'),
                        fontSize: 9.5,
                        bold: true,
                        color: NAVY,
                        margin: [0, 1, 0, 4],
                      },
                      {
                        table: {
                          widths: [65, 8, '*'],
                          body: [
                            [
                              { text: 'FY', fontSize: 8, color: GRAY },
                              { text: ':', fontSize: 8, color: GRAY },
                              { text: pi.financialYear || '2026-27', fontSize: 8, bold: true, color: NAVY },
                            ],
                            [
                              { text: 'PI Number', fontSize: 8, color: GRAY },
                              { text: ':', fontSize: 8, color: GRAY },
                              { text: pi.piNumber, fontSize: 8, bold: true, color: NAVY },
                            ],
                            [
                              { text: 'Payment Terms', fontSize: 8, color: GRAY },
                              { text: ':', fontSize: 8, color: GRAY },
                              {
                                text: `${advancePct}% Advance, Balance at Dispatch`,
                                fontSize: 8,
                                bold: true,
                                color: AMBER_DARK,
                              },
                            ],
                            [
                              { text: 'Place of Supply', fontSize: 8, color: GRAY },
                              { text: ':', fontSize: 8, color: GRAY },
                              { text: pi.placeOfSupply || 'Delhi (07)', fontSize: 8, bold: true, color: NAVY },
                            ],
                          ],
                        },
                        layout: 'noBorders',
                      },
                      ...(pi.shippingAddress ? [{ text: `Delivery: ${pi.shippingAddress}`, fontSize: 7.5, color: GRAY, margin: [0, 2, 0, 0] as [number, number, number, number] }] : []),
                    ],
                    fillColor: '#ffffff',
                    margin: [8, 6, 8, 6],
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
        margin: [0, 0, 0, 9],
      },

      // ── LINE ITEMS Section Header with Grid Icon ─────────────────────────────
      {
        columns: [
          { svg: ICONS.listGrid(AMBER_DARK), width: 11, height: 11, margin: [0, 1, 0, 0] },
          { text: 'LINE ITEMS & TAX BREAKDOWN', fontSize: 8.5, bold: true, color: AMBER_DARK, margin: [4, 0, 0, 0] },
        ],
        margin: [0, 0, 0, 4],
      },

      // ── Line Items Table (Clean 0.5pt subtle row dividers) ───────────────────
      {
        table: {
          headerRows: 1,
          widths: [20, '*', 45, 30, 26, 56, 52, 62],
          body: tableRows,
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 0.75 : 0.5),
          vLineWidth: () => 0.5,
          hLineColor: (i: number, node: any) => (i === 0 || i === node.table.body.length ? BORDER_DARK : BORDER_SUBTLE),
          vLineColor: () => BORDER_SUBTLE,
        },
        margin: [0, 0, 0, 9],
      },

      // ── Lower Section: Digital Signature & Pricing Summary ───────────────────
      {
        columns: [
          // Left: Digital Signature Seal & Signatory Stack
          {
            width: '*',
            stack: [
              // Digital Signature Box with Crisp 0.75pt Frame
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
                                  { svg: ICONS.shield(AMBER_DARK), width: 11, height: 11, margin: [0, 1, 0, 0] },
                                  { text: 'DIGITALLY SIGNED', color: AMBER_DARK, bold: true, fontSize: 8, margin: [4, 0, 0, 0] },
                                ],
                                width: '*',
                              },
                              {
                                text: 'HMAC-SHA256',
                                fontSize: 7.5,
                                color: GRAY,
                                alignment: 'right',
                                width: 'auto',
                              },
                            ],
                            margin: [0, 0, 0, 4],
                          },
                          qrSection,
                        ],
                        margin: [8, 6, 8, 6],
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

              // Bank Remittance Card with Fine 0.5pt Border
              {
                table: {
                  widths: ['*'],
                  body: [
                    [
                      {
                        stack: [
                          {
                            columns: [
                              { svg: ICONS.bank(AMBER_DARK), width: 11, height: 11, margin: [0, 1, 0, 0] },
                              { text: 'BANK RTGS / NEFT REMITTANCE DETAILS', fontSize: 7.5, bold: true, color: AMBER_DARK, margin: [4, 0, 0, 0] },
                            ],
                            margin: [0, 0, 0, 2],
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
                        margin: [6, 5, 6, 5],
                        fillColor: '#ffffff',
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
                margin: [0, 6, 0, 0],
              },

              // Signatory & Callout Row
              {
                columns: [
                  // Authorised Signatory Seal with Vector Signature
                  {
                    width: 110,
                    stack: [
                      { text: 'Authorised Signatory', fontSize: 7.5, bold: true, color: NAVY, margin: [0, 6, 0, 2] },
                      { svg: ICONS.signatureSvg, width: 95, height: 26, margin: [0, 0, 0, 2] },
                      { text: 'PRC Hardware', fontSize: 8, bold: true, color: NAVY },
                    ],
                  },
                  // Official Notice Card with Fine 0.5pt Border
                  {
                    width: '*',
                    table: {
                      widths: ['*'],
                      body: [
                        [
                          {
                            columns: [
                              { svg: ICONS.mail(AMBER_DARK), width: 13, height: 13, margin: [0, 2, 0, 0] },
                              {
                                text: 'This proforma invoice is an official advance commercial offer generated by Pacific Products and Solutions.',
                                fontSize: 6.8,
                                color: DARK_GRAY,
                                lineHeight: 1.25,
                                margin: [4, 0, 0, 0],
                                width: '*',
                              },
                            ],
                            margin: [5, 5, 5, 5],
                            fillColor: '#ffffff',
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
                    margin: [6, 6, 0, 0],
                  },
                ],
              },
            ],
          },

          // Spacer
          { width: 10, text: '' },

          // Right: Pricing Summary Table with Clean 0.5pt Borders
          {
            width: 235,
            table: {
              widths: ['*', 95],
              body: [
                [
                  makeCell('Taxable Value (Basic)', { align: 'left', fillColor: '#ffffff', fontSize: 8 }),
                  makeCell(formatINR(pi.taxableAmount || pi.subtotal), {
                    align: 'right',
                    fillColor: '#ffffff',
                    fontSize: 8,
                  }),
                ],
                ...(Number(pi.discount || 0) > 0
                  ? [
                      [
                        makeCell('Trade Discount', { align: 'left', fillColor: '#ffffff', fontSize: 8 }),
                        makeCell(`- ${formatINR(pi.discount)}`, { align: 'right', fillColor: '#ffffff', fontSize: 8 }),
                      ],
                    ]
                  : []),
                ...(isInterstate
                  ? [
                      [
                        makeCell('Integrated GST (IGST 18%)', { align: 'left', fillColor: '#ffffff', fontSize: 8 }),
                        makeCell(formatINR(pi.igst), { align: 'right', fillColor: '#ffffff', fontSize: 8 }),
                      ],
                    ]
                  : [
                      [
                        makeCell('Central GST (CGST 9%)', { align: 'left', fillColor: '#ffffff', fontSize: 8 }),
                        makeCell(formatINR(pi.cgst), { align: 'right', fillColor: '#ffffff', fontSize: 8 }),
                      ],
                      [
                        makeCell('State GST (SGST 9%)', { align: 'left', fillColor: '#ffffff', fontSize: 8 }),
                        makeCell(formatINR(pi.sgst), { align: 'right', fillColor: '#ffffff', fontSize: 8 }),
                      ],
                    ]),
                ...(Number(pi.shippingCost || 0) > 0
                  ? [
                      [
                        makeCell('Logistics & Freight', { align: 'left', fillColor: '#ffffff', fontSize: 8 }),
                        makeCell(formatINR(pi.shippingCost), { align: 'right', fillColor: '#ffffff', fontSize: 8 }),
                      ],
                    ]
                  : []),
                ...(Number(pi.roundOff || 0) !== 0
                  ? [
                      [
                        makeCell('Round Off Adjustment', { align: 'left', fillColor: '#ffffff', fontSize: 8 }),
                        makeCell(formatINR(pi.roundOff), { align: 'right', fillColor: '#ffffff', fontSize: 8 }),
                      ],
                    ]
                  : []),
                // GRAND TOTAL (Deep Navy & Amber Value)
                [
                  {
                    text: 'GRAND TOTAL',
                    bold: true,
                    alignment: 'left',
                    color: '#ffffff',
                    fillColor: NAVY_DARK,
                    fontSize: 9,
                    margin: [4, 5, 4, 5],
                  } as TableCell,
                  {
                    text: formatINR(pi.grandTotal),
                    bold: true,
                    alignment: 'right',
                    color: AMBER,
                    fillColor: NAVY_DARK,
                    fontSize: 9.5,
                    margin: [4, 5, 4, 5],
                  } as TableCell,
                ],
                [
                  makeCell(`Advance Payable (${advancePct}%)`, {
                    align: 'left',
                    bold: true,
                    color: AMBER_DARK,
                    fillColor: '#ffffff',
                    fontSize: 8,
                  }),
                  makeCell(formatINR(pi.advanceAmount), {
                    align: 'right',
                    bold: true,
                    color: AMBER_DARK,
                    fillColor: '#ffffff',
                    fontSize: 8,
                  }),
                ],
                [
                  makeCell(`Balance on Dispatch (${100 - advancePct}%)`, {
                    align: 'left',
                    color: NAVY,
                    fillColor: '#ffffff',
                    fontSize: 8,
                  }),
                  makeCell(formatINR(pi.balanceDue), {
                    align: 'right',
                    color: NAVY,
                    fillColor: '#ffffff',
                    fontSize: 8,
                  }),
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
        margin: [0, 0, 0, 0],
      },

      // ═════════════════════════════════════════════════════════════════════════
      // ─── PAGE 2: GENERAL TERMS & CONDITIONS (BORDERLESS + CLEAN TYPOGRAPHY) ──
      // ═════════════════════════════════════════════════════════════════════════
      {
        text: 'GENERAL TERMS & CONDITIONS',
        style: 'page2Title',
        pageBreak: 'before',
        margin: [0, 0, 0, 3],
      },
      {
        text: 'Official Commercial, Operational, Manufacturing & Statutory Compliance Guidelines \u2022 Pacific Products and Solutions',
        style: 'page2Subtitle',
        margin: [0, 0, 0, 8],
      },
      {
        canvas: [{ type: 'rect', x: 0, y: 0, w: 527, h: 1.6, color: AMBER }],
        margin: [0, 0, 0, 12],
      },

      // ── 1. Specifications Required for Production ──
      { text: '1. SPECIFICATIONS REQUIRED FOR PRODUCTION', style: 'termsSectionHeader' },
      {
        text: 'The following technical parameters and approvals are strictly required prior to commencing manufacturing:',
        style: 'termsText',
        margin: [0, 0, 0, 4],
      },
      {
        ol: [
          'Actual site measurements verified and certified by the client / project architect.',
          'Formal shop drawing approval signed off by the client or authorized project consultant.',
          'Written approval and selection of colors for compact laminate boards and hardware finishes.',
        ],
        style: 'termsList',
        margin: [0, 0, 0, 10],
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
        margin: [0, 0, 0, 10],
      },

      // ── 3. Payment Terms for Supply ──
      { text: '3. PAYMENT TERMS FOR SUPPLY', style: 'termsSectionHeader' },
      {
        ol: [
          `${advancePct}% advance along with confirmed Proforma Invoice (and balance ${100 - advancePct}% prior to dispatch / on delivery).`,
          'Payments are to be made by the client based on the agreed terms and conditions with us, failing to do the same Pacific Products & Solutions reserves the right to cancel the order.',
        ],
        style: 'termsList',
        margin: [0, 0, 0, 10],
      },

      // ── 4. Special Note: Site Hold & Payment Policy ──
      { text: '4. SPECIAL NOTE (SITE DELAY & PAYMENT LIABILITY)', style: 'termsSectionHeader', color: AMBER_DARK },
      {
        text: 'If your site gets prolonged or is put on hold for whatever reason for more than 30 days from the date of delivery of material at your site, then we will be liable for 100% payment against material. You cannot delay our payment on account of unfinished project. However we will extend all help in installation etc. when you are ready for the same & we will provide you back up for the quality assurance therefore please do not hold back our payment for any reason in the interest of speedy supply to you.',
        style: 'termsText',
        margin: [0, 0, 0, 10],
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
            margin: [0, 0, 6, 0],
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
                margin: [0, 0, 0, 3],
              },
              {
                ol: [
                  'SEZ approval certificate',
                  'FORM - I confirmation from the client',
                ],
                style: 'termsList',
              },
            ],
            margin: [6, 0, 0, 0],
          },
        ],
        margin: [0, 0, 0, 14],
      },

      // ── Dual Signatures on Page 2 ──
      {
        columns: [
          // Client Acceptance
          {
            width: '48%',
            stack: [
              {
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.75, lineColor: BORDER_DARK }],
                margin: [0, 16, 0, 4],
              },
              {
                text: isSigned
                  ? `\u2714 Digitally Accepted by: ${customerName}`
                  : 'Client Acceptance & Confirmed Signature',
                fontSize: 8.5,
                bold: true,
                color: isSigned ? GREEN : NAVY,
              },
              {
                text: isSigned
                  ? `Date: ${formatDate(pi.signedAt || pi.createdAt)} \u2022 Company Seal`
                  : 'Name, Designation & Company Official Stamp',
                fontSize: 8,
                color: DARK_GRAY,
              },
            ],
          },
          { width: '4%', text: '' },
          // Pacific Products and Solutions Signatory
          {
            width: '48%',
            stack: [
              {
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.75, lineColor: BORDER_DARK }],
                margin: [0, 16, 0, 4],
              },
              {
                text: 'For Pacific Products and Solutions, Delhi',
                fontSize: 8.5,
                bold: true,
                color: NAVY,
              },
              {
                text: `Authorised Signatory (${pi.signedBy || 'Executive Desk'})`,
                fontSize: 8,
                color: DARK_GRAY,
              },
            ],
          },
        ],
        margin: [0, 6, 0, 0],
      },
    ],

    styles: {
      page2Title: {
        fontSize: 15,
        bold: true,
        color: NAVY,
        characterSpacing: 0.5,
      },
      page2Subtitle: {
        fontSize: 8.5,
        color: GRAY,
      },
      termsSectionHeader: {
        fontSize: 9.5,
        bold: true,
        color: NAVY,
        margin: [0, 4, 0, 3],
      },
      termsList: {
        fontSize: 8.2,
        color: DARK_GRAY,
        lineHeight: 1.38,
      },
      termsText: {
        fontSize: 8.2,
        color: DARK_GRAY,
        lineHeight: 1.38,
      },
    } as StyleDictionary,
  };

  const doc = pdfmake.createPdf(docDefinition);
  const buffer = await doc.getBuffer();
  return buffer;
}
