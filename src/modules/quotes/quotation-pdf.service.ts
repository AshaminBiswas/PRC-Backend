/**
 * quotation-pdf.service.ts
 *
 * Pixel-perfect production-grade PDF generation for B2B Quotations using pdfmake.
 * Redesigned to match PRC Hardware corporate specification identically:
 * - Brand: "PRC Hardware" with top header, contact stack, and orange accent rule.
 * - Bold QUOTATION heading with framed "QUOTE NO." badge.
 * - 3-Column Metadata Strip: DATE, FINANCIAL YEAR, VALID UNTIL.
 * - Side-by-side BILL TO and PROJECT DETAILS cards with aligned fields.
 * - Deep navy LINE ITEMS table with alternating row backgrounds and INR formatting.
 * - Left column: Digital Signature verification box with QR code, Authorised Signatory seal, and official notice.
 * - Right column: Clean Pricing Summary table with Grand Total in deep navy and advance breakdown.
 * - Fixed footer across all pages with company address, email, reference number, and page count badge.
 * - Dedicated Page 2 for official GENERAL TERMS & CONDITIONS, specifications, and statutory compliance.
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

// ── Brand Palette (Matches PRC Hardware Corporate Identity) ───────────────────
const NAVY = '#0f172a';
const NAVY_DARK = '#0b1e38';
const ORANGE = '#ea580c';
const ORANGE_LIGHT_BG = '#fff7ed';
const GREEN = '#047857';
const LIGHT_BG = '#f8fafc';
const BORDER = '#e2e8f0';
const GRAY = '#64748b';
const DARK_GRAY = '#334155';

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
    // Deep Navy Header Row matching image
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
                text: `Signed By: ${quote.signedBy || 'ejaj@pacificproduct.in'}`,
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

    // ── Fixed Footer across all pages ──────────────────────────────────────────
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
              lineWidth: 0.75,
              lineColor: BORDER,
            },
          ],
          margin: [0, 0, 0, 5],
        },
        {
          columns: [
            // Left: Location & Address
            {
              width: '42%',
              columns: [
                { text: '\u2316', fontSize: 9, color: ORANGE, width: 14 },
                {
                  text: 'H -3, J.R. COMPLEX GATE NO 4,\nMELA RAM FARM, MANDOLI,\nDELHI 110093, INDIA',
                  fontSize: 6.8,
                  color: GRAY,
                  lineHeight: 1.25,
                },
              ],
            },
            // Center: Support Email
            {
              width: '28%',
              columns: [
                { text: '\u2709', fontSize: 9, color: ORANGE, width: 14 },
                {
                  text: 'support@pacifichardware.com',
                  fontSize: 7,
                  color: GRAY,
                  margin: [0, 3, 0, 0],
                },
              ],
            },
            // Right: Ref & Computer-Generated Notice
            {
              width: '24%',
              stack: [
                { text: `Ref: ${referenceNo}`, fontSize: 7, bold: true, color: DARK_GRAY },
                { text: 'This is an official computer-generated document', fontSize: 6.2, color: GRAY },
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
                      fillColor: LIGHT_BG,
                      margin: [1, 2, 1, 2],
                    },
                  ],
                ],
              },
              layout: {
                hLineColor: () => BORDER,
                vLineColor: () => BORDER,
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
      // ─── PAGE 1: COMMERCIAL QUOTATION ────────────────────────────────────────
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
          // Right: Contact Stack with Orange Icons
          {
            width: 175,
            stack: [
              {
                columns: [
                  { text: '\u2709', fontSize: 8.5, color: ORANGE, width: 12 },
                  { text: 'support@pacifichardware.com', fontSize: 7.5, color: NAVY },
                ],
                margin: [0, 0, 0, 2],
              },
              {
                columns: [
                  { text: '\u260E', fontSize: 8.5, color: ORANGE, width: 12 },
                  { text: '+91 98185 92113', fontSize: 7.5, color: NAVY },
                ],
                margin: [0, 0, 0, 2],
              },
              {
                columns: [
                  { text: '\u25C8', fontSize: 8.5, color: ORANGE, width: 12 },
                  { text: 'www.pacifichardware.com', fontSize: 7.5, color: NAVY },
                ],
              },
            ],
          },
        ],
        margin: [0, 0, 0, 8],
      },

      // ── Orange Accent Underline ──────────────────────────────────────────────
      {
        canvas: [{ type: 'rect', x: 0, y: 0, w: 527, h: 1.8, color: ORANGE }],
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
          // Right: QUOTE NO. Badge
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
                    color: NAVY,
                    alignment: 'center',
                    fillColor: '#ffffff',
                    margin: [4, 4, 4, 4],
                  },
                ],
              ],
            },
            layout: {
              hLineColor: () => ORANGE,
              vLineColor: () => ORANGE,
              hLineWidth: () => 1,
              vLineWidth: () => 1,
            },
          },
        ],
        margin: [0, 0, 0, 8],
      },

      // ── 3-Column Metadata Strip (DATE, FINANCIAL YEAR, VALID UNTIL) ───────────
      {
        table: {
          widths: ['33.33%', '33.33%', '33.34%'],
          body: [
            [
              // Date
              {
                columns: [
                  { text: '\u22A1', fontSize: 13, color: GRAY, width: 18 },
                  {
                    stack: [
                      { text: 'DATE', fontSize: 7, bold: true, color: GRAY },
                      { text: formatDate(quote.createdAt), fontSize: 8.5, bold: true, color: NAVY },
                    ],
                  },
                ],
                margin: [6, 4, 6, 4],
              },
              // Financial Year
              {
                columns: [
                  { text: '\u23F0', fontSize: 12, color: GRAY, width: 18 },
                  {
                    stack: [
                      { text: 'FINANCIAL YEAR', fontSize: 7, bold: true, color: GRAY },
                      { text: quote.financialYear || '2026-27', fontSize: 8.5, bold: true, color: NAVY },
                    ],
                  },
                ],
                margin: [6, 4, 6, 4],
              },
              // Valid Until
              {
                columns: [
                  { text: '\u25F7', fontSize: 13, color: GRAY, width: 18 },
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
                  },
                ],
                margin: [6, 4, 6, 4],
              },
            ],
          ],
        },
        layout: {
          defaultBorder: true,
          hLineColor: () => BORDER,
          vLineColor: () => BORDER,
          hLineWidth: () => 0.75,
          vLineWidth: () => 0.75,
        },
        margin: [0, 0, 0, 9],
      },

      // ── BILL TO & PROJECT DETAILS (Two Equal Side-by-Side Cards) ──────────────
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
                          { text: '\u25CB', fontSize: 8, color: ORANGE, width: 12 },
                          { text: 'BILL TO', fontSize: 8, bold: true, color: ORANGE },
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
              hLineColor: () => BORDER,
              vLineColor: () => BORDER,
              hLineWidth: () => 0.75,
              vLineWidth: () => 0.75,
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
                          { text: '\u2630', fontSize: 8, color: ORANGE, width: 12 },
                          { text: 'PROJECT DETAILS', fontSize: 8, bold: true, color: ORANGE },
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
                                color: NAVY,
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
              hLineColor: () => BORDER,
              vLineColor: () => BORDER,
              hLineWidth: () => 0.75,
              vLineWidth: () => 0.75,
            },
          },
        ],
        margin: [0, 0, 0, 9],
      },

      // ── LINE ITEMS Section Header ────────────────────────────────────────────
      {
        columns: [
          { text: '\u229E', fontSize: 8.5, color: ORANGE, width: 12 },
          { text: 'LINE ITEMS', fontSize: 8.5, bold: true, color: ORANGE },
        ],
        margin: [0, 0, 0, 4],
      },

      // ── Line Items Table ─────────────────────────────────────────────────────
      {
        table: {
          headerRows: 1,
          widths: [24, '*', 38, 30, 68, 74],
          body: tableBody,
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 1 : 0.5),
          vLineWidth: () => 0.5,
          hLineColor: () => BORDER,
          vLineColor: () => BORDER,
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
                                text: [
                                  { text: '\u26E8 ', color: ORANGE },
                                  { text: 'DIGITALLY SIGNED', color: ORANGE, bold: true },
                                ],
                                fontSize: 8,
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
                  hLineColor: () => ORANGE,
                  vLineColor: () => ORANGE,
                  hLineWidth: () => 0.8,
                  vLineWidth: () => 0.8,
                },
              },
              // Signatory & Callout Row
              {
                columns: [
                  // Authorised Signatory Seal
                  {
                    width: 105,
                    stack: [
                      { text: 'Authorised Signatory', fontSize: 7.5, bold: true, color: NAVY, margin: [0, 6, 0, 2] },
                      // Calligraphy signature representation
                      {
                        canvas: [
                          {
                            type: 'polyline',
                            lineWidth: 1.2,
                            lineColor: NAVY,
                            points: [
                              { x: 2, y: 14 },
                              { x: 12, y: 3 },
                              { x: 20, y: 18 },
                              { x: 32, y: 6 },
                              { x: 42, y: 16 },
                              { x: 55, y: 2 },
                              { x: 68, y: 14 },
                              { x: 80, y: 12 },
                            ],
                          },
                          { type: 'line', x1: 0, y1: 20, x2: 85, y2: 20, lineWidth: 0.75, lineColor: BORDER },
                        ],
                        margin: [0, 0, 0, 2],
                      },
                      { text: 'PRC Hardware', fontSize: 8, bold: true, color: NAVY },
                    ],
                  },
                  // Official Notice Card
                  {
                    width: '*',
                    table: {
                      widths: ['*'],
                      body: [
                        [
                          {
                            columns: [
                              { text: '\u2709', color: ORANGE, fontSize: 13, width: 16 },
                              {
                                text: 'This quotation is an official commercial offer generated by Pacific Products and Solutions.',
                                fontSize: 6.8,
                                color: DARK_GRAY,
                                lineHeight: 1.25,
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
                      hLineColor: () => ORANGE,
                      vLineColor: () => ORANGE,
                      hLineWidth: () => 0.6,
                      vLineWidth: () => 0.6,
                    },
                    margin: [8, 6, 0, 0],
                  },
                ],
              },
            ],
          },

          // Spacer
          { width: 10, text: '' },

          // Right: Pricing Summary & Grand Total Table
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
                    color: '#f59e0b',
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
                          color: ORANGE,
                          fillColor: '#ffffff',
                          fontSize: 8,
                        }),
                        makeCell(formatINR(advanceAmount), {
                          align: 'right',
                          bold: true,
                          color: ORANGE,
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
              hLineColor: () => BORDER,
              vLineColor: () => BORDER,
              hLineWidth: () => 0.6,
              vLineWidth: () => 0.6,
            },
          },
        ],
        margin: [0, 0, 0, 0],
      },

      // ═════════════════════════════════════════════════════════════════════════
      // ─── PAGE 2: GENERAL TERMS & CONDITIONS (DEDICATED PAGE) ─────────────────
      // ═════════════════════════════════════════════════════════════════════════
      {
        text: 'GENERAL TERMS & CONDITIONS',
        style: 'page2Title',
        pageBreak: 'before',
        margin: [0, 0, 0, 2],
      },
      {
        text: 'Official Commercial, Operational, Manufacturing & Statutory Compliance Guidelines \u2022 Pacific Products and Solutions',
        style: 'page2Subtitle',
        margin: [0, 0, 0, 6],
      },
      {
        canvas: [{ type: 'rect', x: 0, y: 0, w: 527, h: 1.8, color: ORANGE }],
        margin: [0, 0, 0, 8],
      },

      // ── 1. Specifications Required for Production ──
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: [
                  { text: '1. SPECIFICATIONS REQUIRED FOR PRODUCTION', style: 'termsSectionHeader' },
                  {
                    text: 'The following technical parameters and approvals are strictly required prior to commencing manufacturing:',
                    style: 'termsText',
                    margin: [0, 2, 0, 3],
                  },
                  {
                    ol: [
                      'Actual site measurements verified and certified by the client / project architect.',
                      'Formal shop drawing approval signed off by the client or authorized project consultant.',
                      'Written approval and selection of colors for compact laminate boards and hardware finishes.',
                    ],
                    style: 'termsList',
                  },
                ],
                fillColor: '#f8fafc',
                margin: [8, 5, 8, 5],
              },
            ],
          ],
        },
        layout: {
          hLineColor: () => BORDER,
          vLineColor: () => BORDER,
          hLineWidth: () => 1,
          vLineWidth: () => 1,
        },
        margin: [0, 0, 0, 6],
      },

      // ── 2. Commercial & Operational Terms ──
      { text: '2. OTHER TERMS & CONDITIONS', style: 'termsSectionHeader', margin: [0, 2, 0, 3] },
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
        margin: [0, 0, 0, 6],
      },

      // ── 3. Payment Terms for Supply ──
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: [
                  { text: '3. PAYMENT TERMS FOR SUPPLY', style: 'termsSectionHeader' },
                  {
                    ol: [
                      advancePct !== null
                        ? `${advancePct}% advance along with PO (and balance ${100 - advancePct}% prior to dispatch / on delivery).`
                        : '100% advance along with PO.',
                      'Payments are to be made by the client based on the agreed terms and conditions with us, failing to do the same Pacific Products & Solutions reserves the right to cancel the order.',
                    ],
                    style: 'termsList',
                    margin: [0, 2, 0, 0],
                  },
                ],
                fillColor: '#f0fdf4',
                margin: [8, 5, 8, 5],
              },
            ],
          ],
        },
        layout: {
          hLineColor: () => '#86efac',
          vLineColor: () => '#86efac',
          hLineWidth: () => 1,
          vLineWidth: () => 1,
        },
        margin: [0, 0, 0, 6],
      },

      // ── 4. Special Note: Site Hold & Payment Policy ──
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: [
                  { text: '4. SPECIAL NOTE (SITE DELAY & PAYMENT LIABILITY)', style: 'termsSectionHeader', color: ORANGE },
                  {
                    text: 'If your site gets prolonged or is put on hold for whatever reason for more than 30 days from the date of delivery of material at your site, then we will be liable for 100% payment against material. You cannot delay our payment on account of unfinished project. However we will extend all help in installation etc. when you are ready for the same & we will provide you back up for the quality assurance therefore please do not hold back our payment for any reason in the interest of speedy supply to you.',
                    style: 'termsText',
                    margin: [0, 2, 0, 0],
                  },
                ],
                fillColor: '#fffbeb',
                margin: [8, 5, 8, 5],
              },
            ],
          ],
        },
        layout: {
          hLineColor: () => '#fcd34d',
          vLineColor: () => '#fcd34d',
          hLineWidth: () => 1,
          vLineWidth: () => 1,
        },
        margin: [0, 0, 0, 6],
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
                text: '12 - 15 working days from the date of your clear Advance Payment, purchase order, approval of shop drawing, and colour approval for compact board & hardware.',
                style: 'termsText',
                margin: [0, 2, 0, 0],
              },
            ],
            margin: [0, 0, 4, 0],
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
                margin: [0, 2, 0, 2],
              },
              {
                ol: [
                  'SEZ approval certificate',
                  'FORM - I confirmation from the client',
                ],
                style: 'termsList',
              },
            ],
            margin: [4, 0, 0, 0],
          },
        ],
        margin: [0, 0, 0, 8],
      },

      // ── Dual Signatures on Page 2 ──
      {
        columns: [
          // Client Acceptance
          {
            width: '48%',
            stack: [
              {
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 190, y2: 0, lineWidth: 0.75, lineColor: GRAY }],
                margin: [0, 14, 0, 3],
              },
              {
                text: isAccepted
                  ? `\u2714 Digitally Accepted by: ${customerName}`
                  : 'Client Acceptance & Confirmed Signature',
                fontSize: 7.5,
                bold: true,
                color: isAccepted ? GREEN : NAVY,
              },
              {
                text: isAccepted
                  ? `Date: ${formatDate(quote.customerResponseAt || quote.updatedAt)} \u2022 Company Seal`
                  : 'Name, Designation & Company Official Stamp',
                style: 'termsText',
              },
            ],
          },
          { width: '4%', text: '' },
          // Pacific Products and Solutions Signatory
          {
            width: '48%',
            stack: [
              {
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 190, y2: 0, lineWidth: 0.75, lineColor: NAVY }],
                margin: [0, 14, 0, 3],
              },
              {
                text: 'For Pacific Products and Solutions, Delhi',
                fontSize: 7.5,
                bold: true,
                color: NAVY,
              },
              {
                text: `Authorised Signatory (${quote.signedBy || 'Executive Desk'})`,
                style: 'termsText',
              },
            ],
          },
        ],
        margin: [0, 4, 0, 0],
      },
    ],

    styles: {
      page2Title: {
        fontSize: 12.5,
        bold: true,
        color: NAVY,
        characterSpacing: 0.5,
      },
      page2Subtitle: {
        fontSize: 7.5,
        color: GRAY,
      },
      termsSectionHeader: {
        fontSize: 8,
        bold: true,
        color: NAVY,
      },
      termsList: {
        fontSize: 7.2,
        color: DARK_GRAY,
        lineHeight: 1.3,
      },
      termsText: {
        fontSize: 7.2,
        color: DARK_GRAY,
        lineHeight: 1.3,
      },
    } as StyleDictionary,
  };

  const doc = pdfmake.createPdf(docDefinition);
  const buffer = await doc.getBuffer();
  return buffer;
}
