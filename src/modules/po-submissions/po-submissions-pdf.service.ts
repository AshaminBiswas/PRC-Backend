/**
 * po-submissions-pdf.service.ts
 *
 * Production-grade B2B Purchase Order Acknowledgement PDF generator using pdfmake.
 * Generates the official binding acknowledgement document referencing the customer's PO.
 */

import path from 'path';
import QRCode from 'qrcode';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require('pdfmake');
import type { TDocumentDefinitions, Margins, TableCell } from 'pdfmake/interfaces';
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
  console.warn('[PO Ack PDF] Font initialization warning:', e?.message || e);
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

function formatINR(value: number | null | undefined): string {
  const n = Number(value || 0);
  return `\u20B9${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

export interface PoAcknowledgementPdfData {
  ackNumber: string;
  submissionNumber: string;
  customerPoNumber: string;
  customerPoDate?: Date | string | null;
  sourceType: string;
  submittedAt: Date | string;
  issuedAt: Date | string;
  issuedByName?: string | null;
  expectedDeliveryDate?: Date | string | null;
  paymentTerms?: string | null;
  customerName: string;
  customerCompany?: string | null;
  customerEmail: string;
  customerPhone?: string | null;
  customerGstin?: string | null;
  billToAddress?: any;
  shipToAddress?: any;
  items: Array<{
    slNo: number;
    description: string;
    sku?: string | null;
    unit: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  currency?: string;
}

export async function generatePoAcknowledgementPdfBuffer(data: PoAcknowledgementPdfData): Promise<Buffer> {
  const cur = data.currency || 'INR';

  // Generate verification QR code
  const qrPayload = JSON.stringify({
    type: 'PRC_PO_ACKNOWLEDGEMENT',
    ackNumber: data.ackNumber,
    submissionNumber: data.submissionNumber,
    customerPoNumber: data.customerPoNumber,
    grandTotal: data.grandTotal,
    issuedAt: data.issuedAt,
  });

  let qrDataUrl: string | undefined;
  try {
    qrDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 80,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
  } catch (err) {
    console.warn('[PO Ack PDF] QR generation error:', err);
  }

  // Format Bill-To & Ship-To text
  const formatAddr = (addr: any) => {
    if (!addr) return 'As per customer account records';
    const lines = [
      addr.attentionTo ? `Attn: ${addr.attentionTo}` : '',
      addr.companyName || '',
      addr.addressLine1 || '',
      addr.addressLine2 || '',
      [addr.city, addr.state, addr.postalCode].filter(Boolean).join(', '),
      addr.phone ? `Phone: ${addr.phone}` : '',
      addr.email ? `Email: ${addr.email}` : '',
    ].filter(Boolean);
    return lines.join('\n');
  };

  const itemRows: TableCell[][] = data.items.map((item, idx) => {
    const isEven = idx % 2 === 0;
    const bg = isEven ? '#ffffff' : '#f8fafc';
    return [
      makeCell(String(item.slNo || idx + 1), { align: 'center', fillColor: bg }),
      makeCell(item.description, { bold: true, fillColor: bg }),
      makeCell(item.sku || '-', { align: 'center', color: GRAY, fillColor: bg }),
      makeCell(String(item.quantity), { align: 'center', bold: true, fillColor: bg }),
      makeCell(item.unit || 'PCS', { align: 'center', color: GRAY, fillColor: bg }),
      makeCell(formatINR(item.unitPrice), { align: 'right', fillColor: bg }),
      makeCell(formatINR(item.lineTotal), { align: 'right', bold: true, fillColor: bg }),
    ];
  });

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [36, 36, 36, 40] as Margins,
    content: [
      // ─── Header: Brand Logo + Document Title ─────────────────────────────────
      {
        columns: [
          {
            width: 140,
            ...(PRC_LOGO_DATA_URL
              ? [{ image: PRC_LOGO_DATA_URL, width: 130, margin: [0, 0, 0, 6] }]
              : [{ text: 'PRC HARDWARE', fontSize: 18, bold: true, color: NAVY }]),
          },
          {
            width: '*',
            alignment: 'right',
            stack: [
              { text: 'ORDER ACKNOWLEDGEMENT', fontSize: 16, bold: true, color: NAVY, letterSpacing: 1 },
              { text: 'FORMAL ACCEPTANCE & CONFIRMATION', fontSize: 8, bold: true, color: AMBER, margin: [0, 2, 0, 4] },
              {
                columns: [
                  { text: 'Ack Ref #:', fontSize: 9, bold: true, color: GRAY, width: 80, alignment: 'right' },
                  { text: data.ackNumber, fontSize: 10, bold: true, color: NAVY, width: 120, alignment: 'right' },
                ],
              },
              {
                columns: [
                  { text: 'Date Issued:', fontSize: 8, color: GRAY, width: 80, alignment: 'right' },
                  { text: formatDate(data.issuedAt), fontSize: 8, bold: true, color: NAVY, width: 120, alignment: 'right' },
                ],
              },
            ],
          },
        ],
      },

      // ─── Divider Line ──────────────────────────────────────────────────────
      {
        canvas: [{ type: 'line', x1: 0, y1: 8, x2: 523, y2: 8, lineWidth: 2, lineColor: AMBER }],
        margin: [0, 0, 0, 12],
      },

      // ─── Reference Metadata Box ─────────────────────────────────────────────
      {
        table: {
          widths: ['25%', '25%', '25%', '25%'],
          body: [
            [
              makeCell('CUSTOMER PO REF', { bold: true, fontSize: 7.5, color: GRAY, fillColor: LIGHT_BG }),
              makeCell('SUBMISSION REF #', { bold: true, fontSize: 7.5, color: GRAY, fillColor: LIGHT_BG }),
              makeCell('INTAKE METHOD', { bold: true, fontSize: 7.5, color: GRAY, fillColor: LIGHT_BG }),
              makeCell('EST. DELIVERY DATE', { bold: true, fontSize: 7.5, color: GRAY, fillColor: LIGHT_BG }),
            ],
            [
              makeCell(data.customerPoNumber, { bold: true, fontSize: 9, color: NAVY }),
              makeCell(data.submissionNumber, { bold: true, fontSize: 9, color: NAVY }),
              makeCell(data.sourceType === 'PDF_UPLOAD' ? 'Native PDF Document' : 'Structured Portal Form', { fontSize: 8.5, color: NAVY }),
              makeCell(data.expectedDeliveryDate ? formatDate(data.expectedDeliveryDate) : 'Subject to Production Schedule', { bold: true, fontSize: 8.5, color: GREEN }),
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => BORDER,
          vLineColor: () => BORDER,
        },
        margin: [0, 0, 0, 12],
      },

      // ─── Addresses & Customer Info ──────────────────────────────────────────
      {
        columns: [
          {
            width: '50%',
            margin: [0, 0, 6, 0],
            table: {
              widths: ['*'],
              body: [
                [makeCell('BUYER / BILL TO', { bold: true, fontSize: 8, color: '#ffffff', fillColor: TABLE_HEADER_BG })],
                [
                  {
                    text: [
                      { text: `${data.customerCompany || data.customerName}\n`, bold: true, fontSize: 9, color: NAVY },
                      { text: `${formatAddr(data.billToAddress)}\n`, fontSize: 8, color: '#334155' },
                      ...(data.customerGstin ? [{ text: `GSTIN: ${data.customerGstin}\n`, bold: true, fontSize: 8, color: NAVY }] : []),
                    ],
                    margin: [6, 6, 6, 6],
                    fillColor: LIGHT_BG,
                  },
                ],
              ],
            },
            layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => BORDER, vLineColor: () => BORDER },
          },
          {
            width: '50%',
            margin: [6, 0, 0, 0],
            table: {
              widths: ['*'],
              body: [
                [makeCell('CONSIGNEE / SHIP TO', { bold: true, fontSize: 8, color: '#ffffff', fillColor: TABLE_HEADER_BG })],
                [
                  {
                    text: [
                      { text: `${data.customerCompany || data.customerName}\n`, bold: true, fontSize: 9, color: NAVY },
                      { text: `${formatAddr(data.shipToAddress || data.billToAddress)}\n`, fontSize: 8, color: '#334155' },
                    ],
                    margin: [6, 6, 6, 6],
                    fillColor: LIGHT_BG,
                  },
                ],
              ],
            },
            layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => BORDER, vLineColor: () => BORDER },
          },
        ],
        margin: [0, 0, 0, 14],
      },

      // ─── Mapped Line Items Table ───────────────────────────────────────────
      {
        table: {
          headerRows: 1,
          widths: ['6%', '42%', '14%', '8%', '8%', '11%', '11%'],
          body: [
            [
              makeCell('#', { bold: true, align: 'center', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
              makeCell('ITEM / PRODUCT SPECIFICATION', { bold: true, color: '#ffffff', fillColor: TABLE_HEADER_BG }),
              makeCell('SKU / CODE', { bold: true, align: 'center', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
              makeCell('QTY', { bold: true, align: 'center', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
              makeCell('UOM', { bold: true, align: 'center', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
              makeCell('UNIT RATE', { bold: true, align: 'right', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
              makeCell('AMOUNT', { bold: true, align: 'right', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
            ],
            ...itemRows,
          ],
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5),
          vLineWidth: () => 0.5,
          hLineColor: () => BORDER,
          vLineColor: () => BORDER,
        },
        margin: [0, 0, 0, 12],
      },

      // ─── Totals & Commercial Summary ────────────────────────────────────────
      {
        columns: [
          {
            width: '58%',
            stack: [
              {
                text: 'COMMERCIAL TERMS & ORDER ACCEPTANCE NOTES',
                fontSize: 8,
                bold: true,
                color: NAVY,
                margin: [0, 0, 0, 4],
              },
              {
                ul: [
                  'This document constitutes formal acknowledgement and acceptance of the customer purchase order referenced above.',
                  data.paymentTerms ? `Payment Terms: ${data.paymentTerms}` : 'Payment Terms: As per standard B2B commercial agreement.',
                  'Delivery dates are estimated based on catalog product mapping and warehouse stock allocation.',
                  'All items supplied are backed by standard manufacturer warranty against manufacturing defects.',
                ],
                fontSize: 7.5,
                color: GRAY,
                lineHeight: 1.3,
              },
            ],
          },
          {
            width: '42%',
            margin: [10, 0, 0, 0],
            table: {
              widths: ['55%', '45%'],
              body: [
                [
                  makeCell('Taxable Value:', { align: 'right', color: GRAY }),
                  makeCell(formatINR(data.subtotal), { align: 'right', bold: true, color: NAVY }),
                ],
                ...(data.taxTotal > 0
                  ? [
                      [
                        makeCell('Applicable Taxes (GST):', { align: 'right', color: GRAY }),
                        makeCell(formatINR(data.taxTotal), { align: 'right', color: NAVY }),
                      ],
                    ]
                  : []),
                [
                  makeCell('TOTAL ORDER VALUE:', {
                    align: 'right',
                    bold: true,
                    fontSize: 9,
                    color: '#ffffff',
                    fillColor: NAVY,
                  }),
                  makeCell(formatINR(data.grandTotal), {
                    align: 'right',
                    bold: true,
                    fontSize: 10,
                    color: AMBER,
                    fillColor: NAVY,
                  }),
                ],
              ],
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => BORDER,
              vLineColor: () => BORDER,
            },
          },
        ],
        margin: [0, 0, 0, 16],
      },

      // ─── Digital Signoff & Verification Card ────────────────────────────────
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                fillColor: '#f0fdf4',
                margin: [8, 8, 8, 8],
                columns: [
                  {
                    width: '*',
                    stack: [
                      {
                        columns: [
                          { text: '✓ DIGITALLY ACKNOWLEDGED & ACCEPTED', fontSize: 9, bold: true, color: GREEN },
                        ],
                      },
                      {
                        text: `Issued by: ${data.issuedByName || 'PRC Commercial Operations Team'} on ${new Date(data.issuedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
                        fontSize: 8,
                        color: '#1e293b',
                        margin: [0, 2, 0, 2],
                      },
                      {
                        text: 'This acknowledgement triggers ERP fulfillment, inventory reservation, and dispatch planning.',
                        fontSize: 7.5,
                        color: GRAY,
                      },
                    ],
                  },
                  ...(qrDataUrl
                    ? [
                        {
                          width: 56,
                          image: qrDataUrl,
                          alignment: 'right' as const,
                          margin: [0, 0, 0, 0] as Margins,
                        },
                      ]
                    : []),
                ],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => '#10b981',
          vLineColor: () => '#10b981',
        },
      },
    ],
    footer: (currentPage: number, pageCount: number) => {
      return {
        margin: [36, 0, 36, 0] as Margins,
        columns: [
          {
            text: `PRC Hardware Order Acknowledgement: ${data.ackNumber} | Customer PO: ${data.customerPoNumber}`,
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
}
