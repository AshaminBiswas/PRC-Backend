/**
 * quotation-pdf.service.ts
 *
 * Production-grade PDF generation for B2B Quotations using pdfmake.
 * Zero native binary dependencies — safe for Render free tier.
 *
 * Generates a professional, branded quotation PDF with:
 * - Company letterhead
 * - Quote metadata & customer info
 * - Full line items table
 * - GST breakup & grand total
 * - Digital signature details
 * - Embedded QR Code (base64 PNG)
 * - Terms & Conditions
 */

import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require('pdfmake');
import type { TDocumentDefinitions, Content, StyleDictionary, TableCell } from 'pdfmake/interfaces';

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
    margin: options.margin || [4, 6, 4, 6],
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
  const customerName = [quote.firstName, quote.lastName].filter(Boolean).join(' ') || 'Valued Customer';
  const items = quote.items || [];
  const isApproved = quote.status === 'APPROVED';
  const isSigned = !!quote.digitalSignature;

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
        margin: [4, 12, 4, 12],
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

  // ── QR Code Section ──────────────────────────────────────────────────────────
  const qrSection: Content = isSigned && quote.qrCodeData
    ? {
        columns: [
          {
            image: quote.qrCodeData,
            width: 80,
            height: 80,
          },
          {
            width: '*',
            stack: [
              { text: 'Scan to Verify Authenticity', style: 'smallLabel', margin: [8, 0, 0, 4] },
              {
                text: `Signature (SHA-256):`,
                style: 'smallLabel',
                margin: [8, 4, 0, 2],
              },
              {
                text: (quote.digitalSignature || '').slice(0, 32) + '...',
                style: 'signatureHash',
                margin: [8, 0, 0, 4],
              },
              {
                text: `Signed by: ${quote.signedBy || 'Admin'}`,
                style: 'smallLabel',
                margin: [8, 0, 0, 2],
              },
              {
                text: `Signed at: ${formatDate(quote.signedAt)}`,
                style: 'smallLabel',
                margin: [8, 0, 0, 0],
              },
            ],
          },
        ],
        margin: [0, 0, 0, 0],
      }
    : {
        text: 'Awaiting digital signature',
        style: 'smallLabel',
        italics: true,
        color: GRAY,
      };

  // ── Notes Section ────────────────────────────────────────────────────────────
  const notesSection: Content[] = [];
  if (quote.notes) {
    notesSection.push(
      { text: 'Notes & Specifications:', style: 'sectionTitle', margin: [0, 16, 0, 4] },
      { text: quote.notes, style: 'bodyText', margin: [0, 0, 0, 8] }
    );
  }
  if (quote.adminNotes) {
    notesSection.push(
      { text: 'Commercial Notes:', style: 'sectionTitle', margin: [0, 8, 0, 4] },
      { text: quote.adminNotes, style: 'bodyText', margin: [0, 0, 0, 8] }
    );
  }

  // ── Document Definition ──────────────────────────────────────────────────────
  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 80],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: NAVY },

    // ── Header ─────────────────────────────────────────────────────────────────
    header: (currentPage: number, pageCount: number): Content => ({
      columns: [
        {
          stack: [
            { text: 'PACIFIC PRODUCTS & SOLUTIONS', style: 'companyName' },
            {
              text: 'Architectural Hardware  •  Restroom Cubicles  •  Locker Systems',
              style: 'companyTagline',
            },
          ],
          width: '*',
        },
        {
          stack: [
            {
              text: isApproved ? '✔ APPROVED QUOTATION' : 'QUOTATION',
              style: isApproved ? 'approvedBadge' : 'quotationLabel',
              alignment: 'right',
            },
            {
              text: `Page ${currentPage} of ${pageCount}`,
              alignment: 'right',
              fontSize: 8,
              color: GRAY,
              margin: [0, 2, 0, 0],
            },
          ],
          width: 'auto',
        },
      ],
      margin: [40, 20, 40, 0],
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
              text: 'Pacific Products & Solutions  •  support@pacifichardware.com',
              style: 'footerText',
            },
            {
              text: `Ref: ${referenceNo}  •  This is a computer-generated document`,
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
        canvas: [{ type: 'rect', x: 0, y: 0, w: 515, h: 3, color: AMBER }],
        margin: [0, 0, 0, 16],
      },

      // ── Reference + Date block ───────────────────────────────────────────────
      {
        columns: [
          {
            width: '*',
            stack: [
              {
                columns: [
                  { text: 'Reference No:', style: 'metaLabel', width: 100 },
                  { text: referenceNo, style: 'metaValue', width: '*' },
                ],
                margin: [0, 0, 0, 4],
              },
              {
                columns: [
                  { text: 'Financial Year:', style: 'metaLabel', width: 100 },
                  { text: quote.financialYear || '2026-27', style: 'metaValue', width: '*' },
                ],
                margin: [0, 0, 0, 4],
              },
              {
                columns: [
                  { text: 'Date:', style: 'metaLabel', width: 100 },
                  { text: formatDate(quote.createdAt), style: 'metaValue', width: '*' },
                ],
                margin: [0, 0, 0, 4],
              },
              {
                columns: [
                  { text: 'Valid Until:', style: 'metaLabel', width: 100 },
                  {
                    text: quote.validUntil ? formatDate(quote.validUntil) : '30 days from date',
                    style: 'metaValue',
                    width: '*',
                  },
                ],
              },
            ],
          },
          {
            width: 'auto',
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    stack: [
                      { text: 'STATUS', style: 'smallLabel', alignment: 'center' },
                      {
                        text: (quote.status || 'PENDING').replace('_', ' '),
                        style: isApproved ? 'statusApproved' : 'statusPending',
                        alignment: 'center',
                      },
                    ],
                    fillColor: isApproved ? '#d1fae5' : '#fef3c7',
                    margin: [16, 8, 16, 8],
                  },
                ],
              ],
            },
            layout: {
              defaultBorder: false,
              hLineColor: () => (isApproved ? '#10b981' : '#f59e0b'),
              vLineColor: () => (isApproved ? '#10b981' : '#f59e0b'),
              hLineWidth: () => 1,
              vLineWidth: () => 1,
            },
          },
        ],
        margin: [0, 0, 0, 16],
      },

      // ── Customer / Project info ───────────────────────────────────────────────
      {
        table: {
          widths: ['50%', '50%'],
          body: [
            [
              {
                stack: [
                  { text: 'BILL TO', style: 'infoBoxTitle' },
                  { text: customerName, style: 'infoBoxPrimary', margin: [0, 4, 0, 2] },
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
                margin: [12, 12, 12, 12],
              },
              {
                stack: [
                  { text: 'PROJECT DETAILS', style: 'infoBoxTitle' },
                  {
                    text: quote.projectName || 'Commercial Hardware Project',
                    style: 'infoBoxPrimary',
                    margin: [0, 4, 0, 2],
                  },
                  {
                    columns: [
                      { text: 'FY:', style: 'infoBoxSmall', width: 60 },
                      { text: quote.financialYear || '2026-27', style: 'infoBoxSecondary', width: '*' },
                    ],
                    margin: [0, 0, 0, 2],
                  },
                  {
                    columns: [
                      { text: 'Quote No:', style: 'infoBoxSmall', width: 60 },
                      { text: quote.quoteNumber || referenceNo, style: 'infoBoxSecondary', width: '*' },
                    ],
                    margin: [0, 0, 0, 2],
                  },
                  {
                    columns: [
                      { text: 'Terms:', style: 'infoBoxSmall', width: 60 },
                      { text: 'Against Advance', style: 'infoBoxSecondary', width: '*' },
                    ],
                  },
                ],
                fillColor: LIGHT_BG,
                margin: [12, 12, 12, 12],
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
        margin: [0, 0, 0, 20],
      },

      // ── Line Items Table ─────────────────────────────────────────────────────
      { text: 'LINE ITEMS', style: 'sectionTitle', margin: [0, 0, 0, 6] },
      {
        table: {
          headerRows: 1,
          widths: [28, '*', 38, 32, 70, 72],
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

      // ── Pricing Summary ──────────────────────────────────────────────────────
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 260,
            table: {
              widths: ['*', 110],
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
                    fontSize: 11,
                    margin: [4, 8, 4, 8],
                  } as TableCell,
                  {
                    text: formatINR(quote.grandTotal),
                    bold: true,
                    alignment: 'right',
                    color: '#f59e0b',
                    fillColor: NAVY,
                    fontSize: 11,
                    margin: [4, 8, 4, 8],
                  } as TableCell,
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
        margin: [0, 0, 0, 20],
      },

      // ── Notes ────────────────────────────────────────────────────────────────
      ...notesSection,

      // ── Digital Signature ─────────────────────────────────────────────────────
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
                        text: isSigned ? '✔ DIGITALLY SIGNED & VERIFIED' : 'DIGITAL SIGNATURE',
                        style: isSigned ? 'signedBadge' : 'sectionTitle',
                        width: '*',
                      },
                      {
                        text: isSigned ? 'HMAC-SHA256 Authenticated' : 'Pending Approval',
                        style: 'smallLabel',
                        color: isSigned ? GREEN : GRAY,
                        alignment: 'right',
                        width: 'auto',
                      },
                    ],
                    margin: [0, 0, 0, 10],
                  },
                  qrSection as Content,
                ],
                margin: [16, 14, 16, 14],
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
        margin: [0, 0, 0, 20],
      },

      // ── Terms & Conditions ────────────────────────────────────────────────────
      { text: 'TERMS & CONDITIONS', style: 'sectionTitle', margin: [0, 0, 0, 6] },
      {
        ol: [
          'Prices are valid for 30 days from the date of this quotation unless otherwise specified.',
          'All prices are exclusive of GST at 18% unless otherwise stated.',
          'Delivery timelines are subject to stock availability and will be confirmed upon order placement.',
          'Payment terms: 100% advance payment unless a credit account has been pre-approved in writing.',
          'This quotation is computer-generated and constitutes an official commercial offer by Pacific Products & Solutions.',
        ],
        style: 'termsText',
        margin: [0, 0, 0, 16],
      },

      // ── Authorised Signatory ─────────────────────────────────────────────────
      {
        columns: [
          { text: '', width: '*' },
          {
            width: 180,
            stack: [
              {
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 160, y2: 0, lineWidth: 1, lineColor: NAVY }],
                margin: [0, 24, 0, 4],
              },
              { text: 'Authorised Signatory', style: 'smallLabel', alignment: 'center' },
              {
                text: 'Pacific Products & Solutions',
                style: 'bodyText',
                alignment: 'center',
                bold: true,
                margin: [0, 2, 0, 0],
              },
            ],
          },
        ],
      },
    ],

    styles: {
      companyName: {
        fontSize: 16,
        bold: true,
        color: NAVY,
        characterSpacing: 1,
      },
      companyTagline: {
        fontSize: 8,
        color: GRAY,
        margin: [0, 2, 0, 0],
      },
      quotationLabel: {
        fontSize: 14,
        bold: true,
        color: NAVY,
        characterSpacing: 2,
      },
      approvedBadge: {
        fontSize: 11,
        bold: true,
        color: GREEN,
        characterSpacing: 1,
      },
      sectionTitle: {
        fontSize: 10,
        bold: true,
        color: NAVY,
        characterSpacing: 1,
      },
      metaLabel: {
        fontSize: 9,
        color: GRAY,
      },
      metaValue: {
        fontSize: 9,
        bold: true,
        color: NAVY,
      },
      infoBoxTitle: {
        fontSize: 8,
        bold: true,
        color: GRAY,
        characterSpacing: 1,
      },
      infoBoxPrimary: {
        fontSize: 11,
        bold: true,
        color: NAVY,
      },
      infoBoxSecondary: {
        fontSize: 9,
        bold: true,
        color: NAVY,
      },
      infoBoxSmall: {
        fontSize: 9,
        color: GRAY,
      },
      tableHeaderCell: {
        fontSize: 9,
        bold: true,
        color: '#ffffff',
      },
      tableBodyCell: {
        fontSize: 9,
        color: NAVY,
      },
      statusApproved: {
        fontSize: 12,
        bold: true,
        color: GREEN,
      },
      statusPending: {
        fontSize: 11,
        bold: true,
        color: '#92400e',
      },
      signedBadge: {
        fontSize: 11,
        bold: true,
        color: GREEN,
        characterSpacing: 0.5,
      },
      signatureHash: {
        fontSize: 8,
        color: GRAY,
        font: 'Roboto',
      },
      smallLabel: {
        fontSize: 8,
        color: GRAY,
      },
      bodyText: {
        fontSize: 9,
        color: NAVY,
        lineHeight: 1.4,
      },
      termsText: {
        fontSize: 8,
        color: GRAY,
        lineHeight: 1.5,
      },
      footerText: {
        fontSize: 8,
        color: GRAY,
      },
    } as StyleDictionary,
  };

  const doc = pdfmake.createPdf(docDefinition);
  const buffer = await doc.getBuffer();
  return buffer;
}
