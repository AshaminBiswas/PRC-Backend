/**
 * quotation-pdf.service.ts
 *
 * Production-grade PDF generation for B2B Quotations using pdfmake.
 * Refined styling:
 * - Balanced, elegant thin borders (0.5pt / 0.75pt) using dark slate (#1e293b / #cbd5e1) without heavy black lines.
 * - Selective emphasis: Deep navy table headers, amber accents, and clean structural framing.
 * - Website color combination: Warm Amber Gold (#d97706 / #f59e0b) and Deep Obsidian Navy (#0f172a).
 * - Real vector SVG icons for all markers, contacts, and badges.
 * - Terms & Conditions (Page 2): Completely borderless with increased, highly legible font sizes.
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
  console.warn('[PDF Service] Font initialization warning:', e?.message || e);
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
  signatureSvg: `
    <svg viewBox="0 0 110 32" fill="none" stroke="#0f172a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 24 C 14 6, 18 4, 26 21 C 30 28, 36 8, 44 16 C 52 24, 58 6, 68 20 C 76 12, 86 16, 98 22" />
      <line x1="2" y1="30" x2="108" y2="30" stroke="#94a3b8" stroke-width="0.75" />
    </svg>`,
};

// ── Helpers ────────────────────────────────────────────────────────────────────
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
    rowSpan?: number;
    margin?: [number, number, number, number];
    italics?: boolean;
  } = {}
): TableCell {
  return {
    text,
    style: options.bold ? 'tableHeaderCell' : 'tableBodyCell',
    bold: options.bold,
    alignment: options.align || 'left',
    color: options.color || NAVY,
    fillColor: options.fillColor,
    fontSize: options.fontSize || 8.5,
    colSpan: options.colSpan,
    rowSpan: options.rowSpan,
    margin: options.margin || [4, 4.5, 4, 4.5],
    italics: options.italics,
  } as TableCell;
}

// ── Exported interface for quote data ─────────────────────────────────────────
export interface QuotePdfData {
  id: string;
  quoteNumber?: string;
  referenceNo?: string;
  financialYear?: string;
  sequenceNo?: number;
  projectName?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  gstNo?: string;
  email?: string;
  phone?: string;
  status?: string;
  basicPrice?: number;
  gstAmount?: number;
  shippingCost?: number | null;
  subtotal?: number;
  taxTotal?: number;
  grandTotal?: number;
  advancePercentage?: number | null;
  customerProposedAdvancePercent?: number | null;
  customerResponse?: 'pending' | 'accepted' | 'declined' | string | null;
  customerResponseNotes?: string | null;
  customerResponseAt?: Date | string | null;
  customerEditRemark?: string | null;
  notes?: string | null;
  adminNotes?: string | null;
  termsAccepted?: boolean;
  accessToken?: string;
  digitalSignature?: string | null;
  signedBy?: string | null;
  signedAt?: Date | string | null;
  qrCodeData?: string | null;
  validUntil?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  items?: Array<{
    id: string;
    slNo?: number;
    productNameSnapshot?: string | null;
    variantId?: string | null;
    unit?: string;
    quantity?: number;
    rate?: number;
    amount?: number;
    total?: number;
  }>;
}

// ── Main PDF Generator ─────────────────────────────────────────────────────────
export async function generateQuotationPdf(quote: QuotePdfData): Promise<Buffer> {
  const referenceNo = quote.quoteNumber || quote.referenceNo || quote.id.slice(0, 8).toUpperCase();
  const customerName = [quote.firstName, quote.lastName].filter(Boolean).join(' ') || 'Valued Client';
  const items = quote.items || [];
  const isSigned = !!quote.digitalSignature;

  // ── Dynamic Advance Terms & Customer Acceptance ──────────────────────────────
  const advancePct =
    quote.advancePercentage !== null && quote.advancePercentage !== undefined
      ? Number(quote.advancePercentage)
      : null;
  const grandTotal = Number(quote.grandTotal || 0);
  const advanceAmount =
    advancePct !== null ? Math.round(((grandTotal * advancePct) / 100) * 100) / 100 : null;
  const balanceAmount =
    advanceAmount !== null ? Math.round((grandTotal - advanceAmount) * 100) / 100 : null;
  const isAccepted = quote.customerResponse === 'accepted';

  // ── Line Items Table ─────────────────────────────────────────────────────────
  const tableBody: TableCell[][] = [
    // Deep Navy Header Row matching reference design
    [
      makeCell('SL.', { bold: true, align: 'center', color: '#ffffff', fillColor: NAVY_DARK, fontSize: 8 }),
      makeCell('DESCRIPTION / PRODUCT', { bold: true, color: '#ffffff', fillColor: NAVY_DARK, fontSize: 8 }),
      makeCell('UNIT', { bold: true, align: 'center', color: '#ffffff', fillColor: NAVY_DARK, fontSize: 8 }),
      makeCell('QTY', { bold: true, align: 'center', color: '#ffffff', fillColor: NAVY_DARK, fontSize: 8 }),
      makeCell('RATE (\u20B9)', { bold: true, align: 'right', color: '#ffffff', fillColor: NAVY_DARK, fontSize: 8 }),
      makeCell('AMOUNT (\u20B9)', { bold: true, align: 'right', color: '#ffffff', fillColor: NAVY_DARK, fontSize: 8 }),
    ],
  ];

  if (items.length === 0) {
    tableBody.push([
      {
        text: 'No line items found in quotation',
        colSpan: 6,
        alignment: 'center',
        color: GRAY,
        italics: true,
        margin: [4, 10, 4, 10],
      } as TableCell,
      ...Array(5).fill({ text: '' } as TableCell),
    ]);
  } else {
    items.forEach((item, idx) => {
      const rowBg = idx % 2 === 0 ? '#ffffff' : LIGHT_BG;
      const rateVal = Number(item.rate || 0);
      const qtyVal = Number(item.quantity || 1);
      const amountVal = Number(item.amount ?? item.total ?? (rateVal * qtyVal));

      tableBody.push([
        makeCell(String(item.slNo ?? idx + 1), { align: 'center', fillColor: rowBg, fontSize: 8 }),
        makeCell(String(item.productNameSnapshot || 'HARDWARE PRODUCT').toUpperCase(), {
          fillColor: rowBg,
          fontSize: 8,
          color: NAVY,
        }),
        makeCell(item.unit || 'PCS', { align: 'center', fillColor: rowBg, fontSize: 8 }),
        makeCell(String(qtyVal), { align: 'center', fillColor: rowBg, fontSize: 8 }),
        makeCell(
          rateVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          { align: 'right', fillColor: rowBg, fontSize: 8 }
        ),
        makeCell(
          amountVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          { align: 'right', fillColor: rowBg, fontSize: 8 }
        ),
      ]);
    });
  }

  // ── QR Code Section (for signature box) ──────────────────────────────────────
  const qrSection: Content = isSigned && quote.qrCodeData
    ? {
        columns: [
          {
            image: quote.qrCodeData,
            width: 55,
            height: 55,
          },
          {
            width: '*',
            stack: [
              { text: 'Verified Authenticity', fontSize: 8.5, bold: true, color: NAVY, margin: [6, 0, 0, 2] },
              {
                text: `Signed By: ${quote.signedBy || 'Authorised Signatory'}`,
                fontSize: 7.5,
                color: DARK_GRAY,
                margin: [6, 0, 0, 2],
              },
              {
                text: `Date: ${formatDate(quote.signedAt || quote.createdAt)}`,
                fontSize: 7.5,
                color: DARK_GRAY,
                margin: [6, 0, 0, 2],
              },
              {
                text: `SHA256: ${(quote.digitalSignature || 'ff225fc588da0fbe8c').slice(0, 20)}...`,
                fontSize: 7,
                color: GRAY,
                margin: [6, 0, 0, 0],
              },
              ...(isAccepted
                ? [
                    {
                      text: `\u2714 Client Accepted: ${formatDate(quote.customerResponseAt || quote.updatedAt)}`,
                      fontSize: 7.5,
                      bold: true,
                      color: GREEN,
                      margin: [6, 2, 0, 0] as [number, number, number, number],
                    } as Content,
                  ]
                : []),
            ],
          },
        ],
        margin: [0, 2, 0, 0],
      }
    : {
        text: 'Awaiting digital signature & verification',
        fontSize: 7.5,
        italics: true,
        color: GRAY,
        margin: [0, 10, 0, 10],
      };

  // ── Document Definition ──────────────────────────────────────────────────────
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
                  text: 'support@pacifichardware.com',
                  fontSize: 7,
                  color: DARK_GRAY,
                  margin: [4, 3, 0, 0],
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
                    { text: `Ref: ${referenceNo}`, fontSize: 7, bold: true, color: DARK_GRAY },
                    { text: 'This is an official computer-generated document', fontSize: 6.2, color: GRAY },
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
      // ─── PAGE 1: COMMERCIAL QUOTATION (BALANCED ELEGANT BORDERS) ─────────────
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
                  { text: 'support@pacifichardware.com', fontSize: 7.5, color: NAVY, margin: [4, 0, 0, 0] },
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

      // ── QUOTATION Title & Quote No Pill Row ──────────────────────────────────
      {
        columns: [
          // Left: QUOTATION
          {
            text: 'QUOTATION',
            fontSize: 17,
            bold: true,
            color: NAVY,
            characterSpacing: 0.5,
            width: '*',
            margin: [0, 2, 0, 0],
          },
          // Right: QUOTE NO. Badge with Crisp Frame
          {
            width: 175,
            table: {
              widths: [65, '*'],
              body: [
                [
                  {
                    text: 'QUOTE NO.',
                    fontSize: 7.5,
                    bold: true,
                    color: NAVY,
                    alignment: 'center',
                    fillColor: '#ffffff',
                    margin: [4, 4, 4, 4],
                  },
                  {
                    text: referenceNo,
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
              // Date with Calendar SVG Icon
              {
                columns: [
                  { svg: ICONS.calendar(AMBER_DARK), width: 13, height: 13, margin: [0, 2, 0, 0] },
                  {
                    stack: [
                      { text: 'DATE', fontSize: 7, bold: true, color: GRAY },
                      { text: formatDate(quote.createdAt), fontSize: 8.5, bold: true, color: NAVY },
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
                      { text: quote.financialYear || '2026-27', fontSize: 8.5, bold: true, color: NAVY },
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
                        text: quote.validUntil ? formatDate(quote.validUntil) : '30 days from date',
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
                          { text: 'BILL TO', fontSize: 8, bold: true, color: AMBER_DARK, margin: [4, 0, 0, 0] },
                        ],
                        margin: [0, 0, 0, 2],
                      },
                      { text: customerName, fontSize: 9.5, bold: true, color: NAVY, margin: [0, 1, 0, 2] },
                      { text: quote.companyName || '', fontSize: 8, color: DARK_GRAY, margin: [0, 0, 0, 1] },
                      {
                        text: quote.gstNo ? `GSTIN: ${quote.gstNo}` : '',
                        fontSize: 8,
                        color: DARK_GRAY,
                        margin: [0, 0, 0, 1],
                      },
                      { text: quote.email || '', fontSize: 8, color: DARK_GRAY, margin: [0, 0, 0, 1] },
                      { text: quote.phone ? `Ph: ${quote.phone}` : '', fontSize: 8, color: DARK_GRAY },
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
          // Right: PROJECT DETAILS Card
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
                          { text: 'PROJECT DETAILS', fontSize: 8, bold: true, color: AMBER_DARK, margin: [4, 0, 0, 0] },
                        ],
                        margin: [0, 0, 0, 2],
                      },
                      {
                        text: quote.projectName || 'Commercial Project',
                        fontSize: 9.5,
                        bold: true,
                        color: NAVY,
                        margin: [0, 1, 0, 4],
                      },
                      {
                        table: {
                          widths: [45, 8, '*'],
                          body: [
                            [
                              { text: 'FY', fontSize: 8, color: GRAY },
                              { text: ':', fontSize: 8, color: GRAY },
                              { text: quote.financialYear || '2026-27', fontSize: 8, bold: true, color: NAVY },
                            ],
                            [
                              { text: 'Quote No', fontSize: 8, color: GRAY },
                              { text: ':', fontSize: 8, color: GRAY },
                              { text: referenceNo, fontSize: 8, bold: true, color: NAVY },
                            ],
                            [
                              { text: 'Terms', fontSize: 8, color: GRAY },
                              { text: ':', fontSize: 8, color: GRAY },
                              {
                                text:
                                  advancePct !== null
                                    ? `${advancePct}% Advance Payment`
                                    : '100% Advance Payment',
                                fontSize: 8,
                                bold: true,
                                color: AMBER_DARK,
                              },
                            ],
                          ],
                        },
                        layout: 'noBorders',
                      },
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
          { text: 'LINE ITEMS', fontSize: 8.5, bold: true, color: AMBER_DARK, margin: [4, 0, 0, 0] },
        ],
        margin: [0, 0, 0, 4],
      },

      // ── Line Items Table (Clean 0.5pt subtle row dividers) ───────────────────
      {
        table: {
          headerRows: 1,
          widths: [24, '*', 38, 30, 68, 74],
          body: tableBody,
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 0.75 : 0.5),
          vLineWidth: () => 0.5,
          hLineColor: (i: number, node: any) => (i === 0 || i === node.table.body.length ? BORDER_DARK : BORDER_SUBTLE),
          vLineColor: () => BORDER_SUBTLE,
        },
        margin: [0, 0, 0, 9],
      },

      // ── Lower Section: Signature Box & Pricing Summary ───────────────────────
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
              // Signatory & Callout Row
              {
                columns: [
                  // Authorised Signatory Seal with Vector Signature
                  {
                    width: 105,
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
                              { svg: ICONS.mail(AMBER_DARK), width: 14, height: 14, margin: [0, 2, 0, 0] },
                              {
                                text: 'This quotation is an official commercial offer generated by Pacific Products and Solutions.',
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
                    margin: [8, 6, 0, 0],
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
                  makeCell('Basic Price (Excl. GST)', { align: 'left', fillColor: '#ffffff', fontSize: 8 }),
                  makeCell(formatINR(quote.basicPrice ?? quote.subtotal), {
                    align: 'right',
                    fillColor: '#ffffff',
                    fontSize: 8,
                  }),
                ],
                [
                  makeCell('GST @ 18%', { align: 'left', fillColor: '#ffffff', fontSize: 8 }),
                  makeCell(formatINR(quote.gstAmount ?? quote.taxTotal), {
                    align: 'right',
                    fillColor: '#ffffff',
                    fontSize: 8,
                  }),
                ],
                ...(quote.shippingCost != null
                  ? [
                      [
                        makeCell('Shipping & Freight', { align: 'left', fillColor: '#ffffff', fontSize: 8 }),
                        makeCell(formatINR(quote.shippingCost), {
                          align: 'right',
                          fillColor: '#ffffff',
                          fontSize: 8,
                        }),
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
                    text: formatINR(quote.grandTotal),
                    bold: true,
                    alignment: 'right',
                    color: AMBER,
                    fillColor: NAVY_DARK,
                    fontSize: 9.5,
                    margin: [4, 5, 4, 5],
                  } as TableCell,
                ],
                ...(advancePct !== null
                  ? [
                      [
                        makeCell(`Advance Payable (${advancePct}%)`, {
                          align: 'left',
                          bold: true,
                          color: AMBER_DARK,
                          fillColor: '#ffffff',
                          fontSize: 8,
                        }),
                        makeCell(formatINR(advanceAmount), {
                          align: 'right',
                          bold: true,
                          color: AMBER_DARK,
                          fillColor: '#ffffff',
                          fontSize: 8,
                        }),
                      ],
                      [
                        makeCell(`Balance on Delivery (${100 - advancePct}%)`, {
                          align: 'left',
                          color: NAVY,
                          fillColor: '#ffffff',
                          fontSize: 8,
                        }),
                        makeCell(formatINR(balanceAmount), {
                          align: 'right',
                          color: NAVY,
                          fillColor: '#ffffff',
                          fontSize: 8,
                        }),
                      ],
                    ]
                  : []),
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

      // ── 1. Specifications Required for Production (Clean Borderless) ──
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

      // ── 2. Commercial & Operational Terms (Clean Borderless) ──
      { text: '2. OTHER TERMS & CONDITIONS', style: 'termsSectionHeader' },
      {
        ol: [
          'Price quoted is based on the bill of quantities (BOQ) given by you and is subject to revision if final site requirement differs.',
          'The client will provide a safety place for storage of material at site with lock and key facilities.',
          'The client will provide electric power facility at free of cost up to the work place.',
          'Required purchase order only for supply because assembly is free of cost due to product nature.',
          'This quotation is valid for 30 days only from the date of issuance.',
          'All materials should be installed / erected within 30 days from the date of delivery.',
          'All invoices will be made on number of cubicle basis.',
          'Unloading and shifting of material at site is in the scope of client only.',
          'PO should be raised in the name of Pacific Products and Solutions, Delhi.',
          'Freight charge will be extra as actual.',
        ],
        style: 'termsList',
        margin: [0, 0, 0, 10],
      },

      // ── 3. Payment Terms for Supply (Clean Borderless) ──
      { text: '3. PAYMENT TERMS FOR SUPPLY', style: 'termsSectionHeader' },
      {
        ol: [
          advancePct !== null
            ? `${advancePct}% advance along with PO (and balance ${100 - advancePct}% prior to dispatch / on delivery).`
            : '100% advance along with PO.',
          'Payments are to be made by the client based on the agreed terms and conditions with us, failing to do the same Pacific Products & Solutions reserves the right to cancel the order.',
        ],
        style: 'termsList',
        margin: [0, 0, 0, 10],
      },

      // ── 4. Special Note: Site Hold & Payment Policy (Clean Borderless) ──
      { text: '4. SPECIAL NOTE (SITE DELAY & PAYMENT LIABILITY)', style: 'termsSectionHeader', color: AMBER_DARK },
      {
        text: 'If your site gets prolonged or is put on hold for whatever reason for more than 30 days from the date of delivery of material at your site, then we will be liable for 100% payment against material. You cannot delay our payment on account of unfinished project. However we will extend all help in installation etc. when you are ready for the same & we will provide you back up for the quality assurance therefore please do not hold back our payment for any reason in the interest of speedy supply to you.',
        style: 'termsText',
        margin: [0, 0, 0, 10],
      },

      // ── 5. Delivery & 6. Statutory Compliance (Clean Borderless Columns) ──
      {
        columns: [
          // Delivery
          {
            width: '49%',
            stack: [
              { text: '5. DELIVERY TIMELINE', style: 'termsSectionHeader' },
              {
                text: '12 - 15 working days from the date of your clear Advance Payment, purchase order, approval of shop drawing, and colour approval for compact board & hardware.',
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
                text: isAccepted
                  ? `\u2714 Digitally Accepted by: ${customerName}`
                  : 'Client Acceptance & Confirmed Signature',
                fontSize: 8.5,
                bold: true,
                color: isAccepted ? GREEN : NAVY,
              },
              {
                text: isAccepted
                  ? `Date: ${formatDate(quote.customerResponseAt || quote.updatedAt)} \u2022 Company Seal`
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
                text: `Authorised Signatory (${quote.signedBy || 'Executive Desk'})`,
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
