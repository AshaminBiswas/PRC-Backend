/**
 * quotation-pdf.service.ts
 *
 * Production-grade PDF generation for B2B Quotations using pdfmake.
 * Zero native binary dependencies — safe for Render free tier.
 *
 * Layout customizations:
 * - Brand: "PRC Hardware"
 * - Top-right logo
 * - Two-line metadata header (Ref No, Date, FY, Valid Until)
 * - Single-line horizontal layout for Digital Signature & Grand Total
 * - Cleaned notes & single main heading
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

// ── Brand Colours ──────────────────────────────────────────────────────────────
const NAVY = '#0f172a';
const AMBER = '#b45309';
const GREEN = '#065f46';
const LIGHT_BG = '#f8fafc';
const BORDER = '#e2e8f0';
const GRAY = '#64748b';
const TABLE_HEADER_BG = '#1e293b';

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
    margin?: number[];
    italics?: boolean;
  } = {}
): TableCell {
  return {
    text,
    style: options.bold ? 'tableHeaderCell' : 'tableBodyCell',
    bold: options.bold,
    alignment: options.align || 'left',
    color: options.color,
    fillColor: options.fillColor,
    fontSize: options.fontSize,
    colSpan: options.colSpan,
    rowSpan: options.rowSpan,
    margin: options.margin || [4, 5, 4, 5],
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
  const referenceNo = quote.referenceNo || quote.quoteNumber || quote.id.slice(0, 8).toUpperCase();
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
    // Header row
    [
      makeCell('Sl.', { bold: true, align: 'center', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('Description / Product', { bold: true, color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('Unit', { bold: true, align: 'center', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('Qty', { bold: true, align: 'center', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('Rate (₹)', { bold: true, align: 'right', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('Amount (₹)', { bold: true, align: 'right', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
    ],
  ];

  if (items.length === 0) {
    tableBody.push([
      {
        text: 'No line items found',
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
      tableBody.push([
        makeCell(String(item.slNo ?? idx + 1), { align: 'center', fillColor: rowBg }),
        makeCell(item.productNameSnapshot || 'Hardware Product', { fillColor: rowBg }),
        makeCell(item.unit || 'PCS', { align: 'center', fillColor: rowBg }),
        makeCell(String(item.quantity ?? 1), { align: 'center', fillColor: rowBg }),
        makeCell(
          Number(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
          { align: 'right', fillColor: rowBg }
        ),
        makeCell(
          Number(item.amount ?? item.total ?? (Number(item.rate || 0) * Number(item.quantity || 1))).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
          }),
          { align: 'right', fillColor: rowBg }
        ),
      ]);
    });
  }

  // ── QR Code Section (for side-by-side signature box) ─────────────────────────
  const qrSection: Content = isSigned && quote.qrCodeData
    ? {
        columns: [
          {
            image: quote.qrCodeData,
            width: 60,
            height: 60,
          },
          {
            width: '*',
            stack: [
              { text: 'Verified Authenticity', style: 'smallLabel', bold: true, color: GREEN, margin: [6, 0, 0, 2] },
              {
                text: `Signed By: ${quote.signedBy || 'Authorised Signatory'}`,
                style: 'smallLabel',
                margin: [6, 0, 0, 2],
              },
              {
                text: `Date: ${formatDate(quote.signedAt)}`,
                style: 'smallLabel',
                margin: [6, 0, 0, 2],
              },
              {
                text: `SHA256: ${(quote.digitalSignature || '').slice(0, 18)}...`,
                style: 'signatureHash',
                margin: [6, 0, 0, 2],
              },
              ...(isAccepted
                ? [
                    {
                      text: `✔ Client Accepted: ${formatDate(quote.customerResponseAt || quote.updatedAt)}`,
                      style: 'smallLabel',
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
        style: 'smallLabel',
        italics: true,
        color: GRAY,
        margin: [0, 8, 0, 8],
      };

  // ── Document Definition ──────────────────────────────────────────────────────
  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 86, 40, 75],
    defaultStyle: { font: 'Roboto', fontSize: 9.5, color: NAVY },

    // ── Header (with Top-Right Logo and PRC Hardware heading only) ─────────────
    header: (_currentPage: number, _pageCount: number): Content => ({
      columns: [
        {
          stack: [
            { text: 'PRC Hardware', style: 'companyName' },
            {
              text: 'H -3, J.R. COMPLEX GATE NO 4, MELA RAM FARM, MANDOLI, DELHI 110093, INDIA',
              style: 'companyTagline',
            },
          ],
          width: '*',
        },
        {
          image: PRC_LOGO_DATA_URL,
          width: 58,
          height: 58,
          alignment: 'right',
        },
      ],
      margin: [40, 16, 40, 0],
    }),

    // ── Footer ─────────────────────────────────────────────────────────────────
    footer: (): Content => ({
      stack: [
        {
          canvas: [
            {
              type: 'line',
              x1: 40,
              y1: 0,
              x2: 555,
              y2: 0,
              lineWidth: 1,
              lineColor: BORDER,
            },
          ],
          margin: [0, 0, 0, 6],
        },
        {
          columns: [
            {
              text: 'PRC Hardware  •  support@pacifichardware.com',
              style: 'footerText',
            },
            {
              text: `Ref: ${referenceNo}  •  This is an official computer-generated document`,
              style: 'footerText',
              alignment: 'right',
            },
          ],
          margin: [40, 0, 40, 0],
        },
      ],
      margin: [0, 8, 0, 0],
    }),

    content: [
      // ── Amber accent line under header ───────────────────────────────────────
      {
        canvas: [{ type: 'rect', x: 0, y: 0, w: 515, h: 2.5, color: AMBER }],
        margin: [0, 0, 0, 12],
      },

      // ── Two-Line Metadata Block (Splitted into 2 clean lines across the page) ──
      {
        table: {
          widths: ['50%', '50%'],
          body: [
            // Line 1: Reference No (Left) & Date (Right)
            [
              {
                columns: [
                  { text: 'Reference No:', style: 'metaLabel', width: 90 },
                  { text: referenceNo, style: 'metaValue', width: '*' },
                ],
                border: [false, false, false, false],
                margin: [0, 2, 0, 2],
              },
              {
                columns: [
                  { text: 'Date:', style: 'metaLabel', width: 80 },
                  { text: formatDate(quote.createdAt), style: 'metaValue', width: '*' },
                ],
                border: [false, false, false, false],
                margin: [0, 2, 0, 2],
              },
            ],
            // Line 2: Financial Year (Left) & Valid Until (Right)
            [
              {
                columns: [
                  { text: 'Financial Year:', style: 'metaLabel', width: 90 },
                  { text: quote.financialYear || '2026-27', style: 'metaValue', width: '*' },
                ],
                border: [false, false, false, false],
                margin: [0, 2, 0, 2],
              },
              {
                columns: [
                  { text: 'Valid Until:', style: 'metaLabel', width: 80 },
                  {
                    text: quote.validUntil ? formatDate(quote.validUntil) : '30 days from date',
                    style: 'metaValue',
                    width: '*',
                  },
                ],
                border: [false, false, false, false],
                margin: [0, 2, 0, 2],
              },
            ],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 14],
      },

      // ── Customer / Project info boxes ─────────────────────────────────────────
      {
        table: {
          widths: ['50%', '50%'],
          body: [
            [
              {
                stack: [
                  { text: 'BILL TO', style: 'infoBoxTitle' },
                  { text: customerName, style: 'infoBoxPrimary', margin: [0, 3, 0, 2] },
                  { text: quote.companyName || '', style: 'infoBoxSecondary', margin: [0, 0, 0, 2] },
                  {
                    text: quote.gstNo ? `GSTIN: ${quote.gstNo}` : '',
                    style: 'infoBoxSmall',
                    margin: [0, 0, 0, 2],
                  },
                  {
                    text: quote.email || '',
                    style: 'infoBoxSmall',
                    margin: [0, 0, 0, 2],
                  },
                  {
                    text: quote.phone ? `Ph: ${quote.phone}` : '',
                    style: 'infoBoxSmall',
                  },
                ],
                fillColor: LIGHT_BG,
                margin: [10, 10, 10, 10],
              },
              {
                stack: [
                  { text: 'PROJECT DETAILS', style: 'infoBoxTitle' },
                  {
                    text: quote.projectName || 'Commercial Hardware Project',
                    style: 'infoBoxPrimary',
                    margin: [0, 3, 0, 2],
                  },
                  {
                    columns: [
                      { text: 'FY:', style: 'infoBoxSmall', width: 50 },
                      { text: quote.financialYear || '2026-27', style: 'infoBoxSecondary', width: '*' },
                    ],
                    margin: [0, 0, 0, 2],
                  },
                  {
                    columns: [
                      { text: 'Quote No:', style: 'infoBoxSmall', width: 50 },
                      { text: quote.quoteNumber || referenceNo, style: 'infoBoxSecondary', width: '*' },
                    ],
                    margin: [0, 0, 0, 2],
                  },
                  {
                    columns: [
                      { text: 'Terms:', style: 'infoBoxSmall', width: 50 },
                      {
                        text: advancePct !== null ? `${advancePct}% Advance Payment` : '100% Advance Payment',
                        style: 'infoBoxSecondary',
                        width: '*',
                      },
                    ],
                    margin: [0, 0, 0, 2],
                  },
                  ...(isAccepted
                    ? [
                        {
                          columns: [
                            { text: 'Status:', style: 'infoBoxSmall', width: 50 },
                            {
                              text: `Accepted by Client (${formatDate(quote.customerResponseAt || quote.updatedAt)})`,
                              style: 'infoBoxSecondary',
                              color: GREEN,
                              bold: true,
                              width: '*',
                            },
                          ],
                        },
                      ]
                    : []),
                ],
                fillColor: LIGHT_BG,
                margin: [10, 10, 10, 10],
              },
            ],
          ],
        },
        layout: {
          defaultBorder: true,
          hLineColor: () => BORDER,
          vLineColor: () => BORDER,
          hLineWidth: () => 1,
          vLineWidth: () => 1,
        },
        margin: [0, 0, 0, 14],
      },

      // ── Line Items Table ─────────────────────────────────────────────────────
      { text: 'LINE ITEMS', style: 'sectionTitle', margin: [0, 0, 0, 5] },
      {
        table: {
          headerRows: 1,
          widths: [26, '*', 36, 30, 65, 68],
          body: tableBody,
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 1 : 0.5),
          vLineWidth: () => 0.5,
          hLineColor: () => BORDER,
          vLineColor: () => BORDER,
        },
        margin: [0, 0, 0, 0],
      },

      // ── Single-Line Side-by-Side: Digital Signature (Left) & Grand Total (Right) ──
      {
        columns: [
          // Left: Digital Signature Seal
          {
            width: '*',
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    stack: [
                      {
                        columns: [
                          {
                            text: isSigned ? '✔ DIGITALLY SIGNED' : 'DIGITAL SIGNATURE',
                            style: isSigned ? 'signedBadge' : 'sectionTitle',
                            width: '*',
                          },
                          {
                            text: isSigned ? 'HMAC-SHA256' : 'Pending',
                            style: 'smallLabel',
                            color: isSigned ? GREEN : GRAY,
                            alignment: 'right',
                            width: 'auto',
                          },
                        ],
                        margin: [0, 0, 0, 6],
                      },
                      qrSection as Content,
                    ],
                    margin: [10, 8, 10, 8],
                    fillColor: isSigned ? '#f0fdf4' : LIGHT_BG,
                  },
                ],
              ],
            },
            layout: {
              hLineColor: () => (isSigned ? '#10b981' : BORDER),
              vLineColor: () => (isSigned ? '#10b981' : BORDER),
              hLineWidth: () => 1,
              vLineWidth: () => 1,
            },
          },
          // Spacer
          { width: 12, text: '' },
          // Right: Pricing Summary & Grand Total
          {
            width: 235,
            table: {
              widths: ['*', 98],
              body: [
                [
                  makeCell('Basic Price (Excl. GST)', { align: 'right', fillColor: LIGHT_BG }),
                  makeCell(formatINR(quote.basicPrice ?? quote.subtotal), {
                    align: 'right',
                    fillColor: LIGHT_BG,
                  }),
                ],
                [
                  makeCell('GST @ 18%', { align: 'right', fillColor: LIGHT_BG }),
                  makeCell(formatINR(quote.gstAmount ?? quote.taxTotal), {
                    align: 'right',
                    fillColor: LIGHT_BG,
                  }),
                ],
                ...(quote.shippingCost != null
                  ? [
                      [
                        makeCell('Shipping & Freight', { align: 'right', fillColor: LIGHT_BG }),
                        makeCell(formatINR(quote.shippingCost), { align: 'right', fillColor: LIGHT_BG }),
                      ],
                    ]
                  : []),
                [
                  {
                    text: 'GRAND TOTAL',
                    bold: true,
                    alignment: 'right',
                    color: '#ffffff',
                    fillColor: NAVY,
                    fontSize: 10,
                    margin: [4, 6, 4, 6],
                  } as TableCell,
                  {
                    text: formatINR(quote.grandTotal),
                    bold: true,
                    alignment: 'right',
                    color: '#f59e0b',
                    fillColor: NAVY,
                    fontSize: 10,
                    margin: [4, 6, 4, 6],
                  } as TableCell,
                ],
                ...(advancePct !== null
                  ? [
                      [
                        makeCell(`Advance Payable (${advancePct}%)`, {
                          align: 'right',
                          bold: true,
                          color: '#047857',
                          fillColor: '#ecfdf5',
                        }),
                        makeCell(formatINR(advanceAmount), {
                          align: 'right',
                          bold: true,
                          color: '#047857',
                          fillColor: '#ecfdf5',
                        }),
                      ],
                      [
                        makeCell(`Balance on Delivery (${100 - advancePct}%)`, {
                          align: 'right',
                          color: GRAY,
                          fillColor: LIGHT_BG,
                        }),
                        makeCell(formatINR(balanceAmount), {
                          align: 'right',
                          color: NAVY,
                          fillColor: LIGHT_BG,
                        }),
                      ],
                    ]
                  : []),
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
        margin: [0, 14, 0, 14],
      },

      // ── Page 1 Bottom: Authorised Signatory & Note to see Page 2 ─────────────
      {
        columns: [
          {
            width: '*',
            stack: [
              {
                text: '• This quotation is an official commercial offer generated by Pacific Products and Solutions.',
                style: 'termsText',
              },
              {
                text: '• Detailed production specifications, statutory compliance, and commercial terms are set out on Page 2.',
                style: 'termsText',
                bold: true,
                color: NAVY,
              },
            ],
            margin: [0, 8, 0, 0],
          },
          {
            width: 170,
            stack: [
              {
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 1, lineColor: NAVY }],
                margin: [0, 10, 0, 3],
              },
              { text: 'Authorised Signatory', style: 'smallLabel', alignment: 'center' },
              {
                text: 'Pacific Products and Solutions',
                style: 'bodyText',
                alignment: 'center',
                bold: true,
                margin: [0, 1, 0, 0],
              },
            ],
          },
        ],
        margin: [0, 2, 0, 0],
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
        text: 'Official Commercial, Operational, Manufacturing & Statutory Compliance Guidelines • Pacific Products and Solutions',
        style: 'page2Subtitle',
        margin: [0, 0, 0, 6],
      },
      {
        canvas: [{ type: 'rect', x: 0, y: 0, w: 515, h: 2, color: AMBER }],
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
                  { text: '4. SPECIAL NOTE (SITE DELAY & PAYMENT LIABILITY)', style: 'termsSectionHeader', color: AMBER },
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
                  ? `✔ Digitally Accepted by: ${customerName}`
                  : 'Client Acceptance & Confirmed Signature',
                style: 'smallLabel',
                bold: true,
                color: isAccepted ? GREEN : NAVY,
              },
              {
                text: isAccepted
                  ? `Date: ${formatDate(quote.customerResponseAt || quote.updatedAt)} • Company Seal`
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
                style: 'smallLabel',
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
      companyName: {
        fontSize: 17,
        bold: true,
        color: NAVY,
        characterSpacing: 0.5,
      },
      companyTagline: {
        fontSize: 8,
        color: GRAY,
        margin: [0, 2, 0, 0],
      },
      sectionTitle: {
        fontSize: 9.5,
        bold: true,
        color: NAVY,
        characterSpacing: 0.5,
      },
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
      metaLabel: {
        fontSize: 8.5,
        color: GRAY,
      },
      metaValue: {
        fontSize: 8.5,
        bold: true,
        color: NAVY,
      },
      infoBoxTitle: {
        fontSize: 7.5,
        bold: true,
        color: GRAY,
        characterSpacing: 1,
      },
      infoBoxPrimary: {
        fontSize: 10,
        bold: true,
        color: NAVY,
      },
      infoBoxSecondary: {
        fontSize: 8.5,
        bold: true,
        color: NAVY,
      },
      infoBoxSmall: {
        fontSize: 8.5,
        color: GRAY,
      },
      tableHeaderCell: {
        fontSize: 8.5,
        bold: true,
        color: '#ffffff',
      },
      tableBodyCell: {
        fontSize: 8.5,
        color: NAVY,
      },
      signedBadge: {
        fontSize: 9.5,
        bold: true,
        color: GREEN,
        characterSpacing: 0.5,
      },
      signatureHash: {
        fontSize: 7.5,
        color: GRAY,
        font: 'Roboto',
      },
      smallLabel: {
        fontSize: 7.5,
        color: GRAY,
      },
      bodyText: {
        fontSize: 8.5,
        color: NAVY,
        lineHeight: 1.3,
      },
      termsList: {
        fontSize: 7.2,
        color: '#334155',
        lineHeight: 1.3,
      },
      termsText: {
        fontSize: 7.2,
        color: '#334155',
        lineHeight: 1.3,
      },
      footerText: {
        fontSize: 7.5,
        color: GRAY,
      },
    } as StyleDictionary,
  };

  const doc = pdfmake.createPdf(docDefinition);
  const buffer = await doc.getBuffer();
  return buffer;
}
