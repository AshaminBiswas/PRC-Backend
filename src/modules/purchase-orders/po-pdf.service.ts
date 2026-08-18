/**
 * po-pdf.service.ts
 *
 * Production-grade B2B Commercial Purchase Order PDF generator using pdfmake.
 * Zero native binary dependencies — safe for Node/Cloud/Render environments.
 *
 * Brand: "PRC Hardware"
 * Address: "H -3, J.R. COMPLEX GATE NO 4, MELA RAM FARM, MANDOLI, DELHI 110093, INDIA"
 */

import path from 'path';
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
  console.warn('[PO PDF] Font initialization warning:', e?.message || e);
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

export interface PoPdfData {
  poNumber: string;
  quotationNumber: string;
  customerPoReferenceNumber?: string | null;
  status: string;
  createdAt: Date | string;
  requestedDeliveryDate?: Date | string | null;
  customerName: string;
  customerCompany?: string | null;
  customerEmail: string;
  customerPhone: string;
  customerGstin?: string | null;
  billingAddress: any;
  deliveryAddress: any;
  deliveryInstructions?: string | null;
  items: Array<{
    slNo: number;
    productName: string;
    sku?: string | null;
    unit: string;
    quantity: number;
    rate: number;
    taxRate?: number;
    taxAmount?: number;
    total: number;
  }>;
  subtotal: number;
  taxTotal: number;
  discountTotal?: number;
  shippingCost?: number;
  grandTotal: number;
  advancePercentage: number;
  advanceAmount: number;
  balanceAmount: number;
  bankDetails?: {
    accountHolderName: string;
    bankName: string;
    accountNumber: string;
    ifscOrRoutingNumber: string;
    branch?: string | null;
  };
}

/**
 * Generates a branded, professional B2B Purchase Order PDF buffer
 */
export const generatePurchaseOrderPdfBuffer = async (data: PoPdfData): Promise<Buffer> => {
  const billTo = data.billingAddress || {};
  const shipTo = data.deliveryAddress || billTo;

  // ── Build Items Table ────────────────────────────────────────────────────
  const itemRows: any[][] = [
    [
      makeCell('SL', { bold: true, align: 'center', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('ITEM DESCRIPTION & SPECIFICATION', { bold: true, color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('SKU', { bold: true, align: 'center', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('QTY', { bold: true, align: 'center', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('RATE (\u20B9)', { bold: true, align: 'right', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('GST %', { bold: true, align: 'center', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('TOTAL (\u20B9)', { bold: true, align: 'right', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
    ],
  ];

  data.items.forEach((item, idx) => {
    const isEven = idx % 2 === 0;
    const rowBg = isEven ? '#ffffff' : LIGHT_BG;
    itemRows.push([
      makeCell(String(item.slNo || idx + 1), { align: 'center', fillColor: rowBg }),
      makeCell(item.productName, { bold: true, fillColor: rowBg }),
      makeCell(item.sku || '-', { align: 'center', color: GRAY, fillColor: rowBg }),
      makeCell(`${item.quantity} ${item.unit || 'PCS'}`, { align: 'center', bold: true, fillColor: rowBg }),
      makeCell(Number(item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 }), { align: 'right', fillColor: rowBg }),
      makeCell(item.taxRate ? `${item.taxRate}%` : '18%', { align: 'center', color: GRAY, fillColor: rowBg }),
      makeCell(Number(item.total).toLocaleString('en-IN', { minimumFractionDigits: 2 }), { align: 'right', bold: true, color: NAVY, fillColor: rowBg }),
    ]);
  });

  const defaultBank = {
    accountHolderName: 'PRC HARDWARE ENTERPRISE PRIVATE LIMITED',
    bankName: 'HDFC Bank Ltd',
    accountNumber: '50200088991122',
    ifscOrRoutingNumber: 'HDFC0001234',
    branch: 'Mandoli Industrial Area, Delhi',
  };
  const bank = data.bankDetails || defaultBank;

  const docDefinition: any = {
    pageSize: 'A4',
    pageMargins: [36, 36, 36, 40],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 8,
      color: NAVY,
    },
    content: [
      // ── Header: Logo + Brand Info + Document Title ──────────────────────────
      {
        columns: [
          {
            width: '60%',
            stack: [
              ...(PRC_LOGO_DATA_URL ? [{ image: PRC_LOGO_DATA_URL, width: 130, margin: [0, 0, 0, 4] }] : []),
              { text: 'PRC Hardware', fontSize: 13, bold: true, color: NAVY, margin: [0, 0, 0, 1] },
              { text: 'H -3, J.R. COMPLEX GATE NO 4, MELA RAM FARM, MANDOLI, DELHI 110093, INDIA', fontSize: 7, color: GRAY, lineHeight: 1.2 },
              { text: 'Email: support@prchardware.com | Web: www.prchardware.com', fontSize: 7, color: GRAY },
            ],
          },
          {
            width: '40%',
            stack: [
              {
                text: 'COMMERCIAL PURCHASE ORDER',
                fontSize: 11,
                bold: true,
                color: NAVY,
                alignment: 'right',
                margin: [0, 0, 0, 4],
              },
              {
                table: {
                  widths: ['45%', '55%'],
                  body: [
                    [
                      { text: 'PO Number:', fontSize: 7.5, bold: true, color: GRAY, border: [false, false, false, false] },
                      { text: data.poNumber, fontSize: 8, bold: true, color: NAVY, border: [false, false, false, false], alignment: 'right' },
                    ],
                    [
                      { text: 'Quotation Ref:', fontSize: 7.5, bold: true, color: GRAY, border: [false, false, false, false] },
                      { text: data.quotationNumber, fontSize: 7.5, bold: true, color: AMBER, border: [false, false, false, false], alignment: 'right' },
                    ],
                    ...(data.customerPoReferenceNumber
                      ? [
                          [
                            { text: 'Buyer PO Ref:', fontSize: 7.5, bold: true, color: GRAY, border: [false, false, false, false] },
                            { text: data.customerPoReferenceNumber, fontSize: 7.5, bold: true, color: NAVY, border: [false, false, false, false], alignment: 'right' },
                          ],
                        ]
                      : []),
                    [
                      { text: 'Order Date:', fontSize: 7.5, bold: true, color: GRAY, border: [false, false, false, false] },
                      { text: formatDate(data.createdAt), fontSize: 7.5, color: NAVY, border: [false, false, false, false], alignment: 'right' },
                    ],
                    [
                      { text: 'Delivery Req:', fontSize: 7.5, bold: true, color: GRAY, border: [false, false, false, false] },
                      { text: formatDate(data.requestedDeliveryDate), fontSize: 7.5, bold: true, color: NAVY, border: [false, false, false, false], alignment: 'right' },
                    ],
                    [
                      { text: 'Order Status:', fontSize: 7.5, bold: true, color: GRAY, border: [false, false, false, false] },
                      { text: data.status.replace(/_/g, ' '), fontSize: 7.5, bold: true, color: GREEN, border: [false, false, false, false], alignment: 'right' },
                    ],
                  ],
                },
                layout: 'noBorders',
              },
            ],
          },
        ],
        margin: [0, 0, 0, 10],
      },

      // Divider
      {
        canvas: [
          { type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 1.5, lineColor: NAVY },
        ],
        margin: [0, 0, 0, 10],
      },

      // ── Buyer & Destination Info (2-column box) ──────────────────────────
      {
        columns: [
          {
            width: '50%',
            style: 'cardBox',
            stack: [
              { text: 'BUYER / INVOICE TO (B2B CLIENT)', fontSize: 7.5, bold: true, color: GRAY, margin: [0, 0, 0, 3] },
              { text: data.customerCompany || data.customerName, fontSize: 9, bold: true, color: NAVY },
              { text: `Attention: ${data.customerName}`, fontSize: 7.5, color: NAVY },
              ...(data.customerGstin ? [{ text: `GSTIN: ${data.customerGstin}`, fontSize: 7.5, bold: true, color: NAVY }] : []),
              { text: `${billTo.addressLine1 || ''} ${billTo.addressLine2 || ''}`.trim(), fontSize: 7.5, color: NAVY },
              { text: `${billTo.city || ''}, ${billTo.state || ''} - ${billTo.postalCode || ''}`.trim(), fontSize: 7.5, color: NAVY },
              { text: `Phone: ${data.customerPhone || billTo.phone || 'N/A'} | Email: ${data.customerEmail}`, fontSize: 7, color: GRAY, margin: [0, 2, 0, 0] },
            ],
          },
          {
            width: '50%',
            style: 'cardBox',
            margin: [6, 0, 0, 0],
            stack: [
              { text: 'DELIVERY DESTINATION / UNLOADING SITE', fontSize: 7.5, bold: true, color: GRAY, margin: [0, 0, 0, 3] },
              { text: shipTo.companyName || data.customerCompany || data.customerName, fontSize: 9, bold: true, color: NAVY },
              { text: `Contact / Site Manager: ${shipTo.attentionTo || data.customerName}`, fontSize: 7.5, color: NAVY },
              { text: `${shipTo.addressLine1 || ''} ${shipTo.addressLine2 || ''}`.trim(), fontSize: 7.5, color: NAVY },
              { text: `${shipTo.city || ''}, ${shipTo.state || ''} - ${shipTo.postalCode || ''}`.trim(), fontSize: 7.5, color: NAVY },
              { text: `Contact Phone: ${shipTo.phone || data.customerPhone || 'N/A'}`, fontSize: 7.5, color: NAVY },
              ...(data.deliveryInstructions
                ? [
                    {
                      text: `Instructions: ${data.deliveryInstructions}`,
                      fontSize: 7,
                      bold: true,
                      color: AMBER,
                      margin: [0, 2, 0, 0],
                    },
                  ]
                : []),
            ],
          },
        ],
        margin: [0, 0, 0, 10],
      },

      // ── Line Items Table ──────────────────────────────────────────────────
      {
        table: {
          headerRows: 1,
          widths: ['6%', '40%', '15%', '10%', '13%', '8%', '15%'],
          body: itemRows,
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5),
          vLineWidth: () => 0,
          hLineColor: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? NAVY : BORDER),
          paddingLeft: () => 5,
          paddingRight: () => 5,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
        margin: [0, 0, 0, 10],
      },

      // ── Financial Summary & Advance Breakdown ──────────────────────────────
      {
        columns: [
          // Left: Bank Transfer Details for Advance Payment
          {
            width: '52%',
            stack: [
              {
                style: 'cardBox',
                stack: [
                  { text: 'OFFICIAL BANK DETAILS FOR NEFT / RTGS TRANSFER', fontSize: 7.5, bold: true, color: AMBER, margin: [0, 0, 0, 3] },
                  { text: `Account Holder: ${bank.accountHolderName}`, fontSize: 7.5, bold: true, color: NAVY },
                  { text: `Bank Name: ${bank.bankName}`, fontSize: 7.5, color: NAVY },
                  { text: `Account Number: ${bank.accountNumber}`, fontSize: 8, bold: true, color: NAVY },
                  { text: `IFSC Code: ${bank.ifscOrRoutingNumber}`, fontSize: 8, bold: true, color: NAVY },
                  ...(bank.branch ? [{ text: `Branch: ${bank.branch}`, fontSize: 7, color: GRAY }] : []),
                  {
                    text: '* Please mention PO Number in the NEFT/RTGS transaction remarks and upload the payment receipt in your B2B dashboard.',
                    fontSize: 6.5,
                    color: GRAY,
                    margin: [0, 4, 0, 0],
                  },
                ],
              },
            ],
          },
          // Right: Commercial Totals Table
          {
            width: '48%',
            margin: [8, 0, 0, 0],
            table: {
              widths: ['55%', '45%'],
              body: [
                [
                  { text: 'Subtotal (Basic Price):', fontSize: 7.5, color: GRAY, border: [false, false, false, false] },
                  { text: formatINR(data.subtotal), fontSize: 7.5, color: NAVY, alignment: 'right', border: [false, false, false, false] },
                ],
                [
                  { text: 'Goods & Services Tax (GST):', fontSize: 7.5, color: GRAY, border: [false, false, false, false] },
                  { text: formatINR(data.taxTotal), fontSize: 7.5, color: NAVY, alignment: 'right', border: [false, false, false, false] },
                ],
                ...(data.shippingCost
                  ? [
                      [
                        { text: 'Freight / Shipping:', fontSize: 7.5, color: GRAY, border: [false, false, false, false] },
                        { text: formatINR(data.shippingCost), fontSize: 7.5, color: NAVY, alignment: 'right', border: [false, false, false, false] },
                      ],
                    ]
                  : []),
                [
                  {
                    text: 'Grand Total Amount:',
                    fontSize: 9,
                    bold: true,
                    color: NAVY,
                    fillColor: '#f1f5f9',
                    border: [false, true, false, true],
                  },
                  {
                    text: formatINR(data.grandTotal),
                    fontSize: 9,
                    bold: true,
                    color: NAVY,
                    alignment: 'right',
                    fillColor: '#f1f5f9',
                    border: [false, true, false, true],
                  },
                ],
                [
                  {
                    text: `Advance Required (${data.advancePercentage}%):`,
                    fontSize: 8.5,
                    bold: true,
                    color: AMBER,
                    fillColor: '#fffbeb',
                    border: [false, false, false, false],
                  },
                  {
                    text: formatINR(data.advanceAmount),
                    fontSize: 8.5,
                    bold: true,
                    color: AMBER,
                    alignment: 'right',
                    fillColor: '#fffbeb',
                    border: [false, false, false, false],
                  },
                ],
                [
                  {
                    text: 'Balance on Dispatch / Delivery:',
                    fontSize: 8,
                    bold: true,
                    color: NAVY,
                    fillColor: '#f8fafc',
                    border: [false, false, false, false],
                  },
                  {
                    text: formatINR(data.balanceAmount),
                    fontSize: 8,
                    bold: true,
                    color: NAVY,
                    alignment: 'right',
                    fillColor: '#f8fafc',
                    border: [false, false, false, false],
                  },
                ],
              ],
            },
            layout: {
              paddingTop: () => 2.5,
              paddingBottom: () => 2.5,
              paddingLeft: () => 4,
              paddingRight: () => 4,
            },
          },
        ],
        margin: [0, 0, 0, 10],
      },

      // ── Terms & Commercial Acceptance ─────────────────────────────────────
      {
        columns: [
          {
            width: '65%',
            stack: [
              { text: 'TERMS & CONDITIONS', fontSize: 7, bold: true, color: GRAY, margin: [0, 0, 0, 2] },
              {
                text: '1. This Purchase Order is formally accepted against PRC Hardware digitally approved Quotation.\n2. Dispatch timeline initiates upon digital verification of the agreed advance payment credited to PRC Hardware bank account.\n3. Balance payment is strictly payable upon dispatch / delivery notification.\n4. Standard manufacturer warranty applies as defined per item specifications.',
                fontSize: 6.5,
                color: GRAY,
                lineHeight: 1.3,
              },
            ],
          },
          {
            width: '35%',
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
                          { text: 'AUTHORIZED SIGNATORY', fontSize: 6.5, bold: true, color: GRAY, alignment: 'center' },
                          { text: 'PRC Hardware Operations', fontSize: 7.5, bold: true, color: NAVY, alignment: 'center', margin: [0, 12, 0, 2] },
                          { text: 'Commercial B2B Division', fontSize: 6, color: GREEN, alignment: 'center' },
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
    styles: {
      cardBox: {
        fillColor: '#f8fafc',
        margin: [0, 0, 0, 0],
      },
    },
    footer: (currentPage: number, pageCount: number) => {
      return {
        margin: [36, 0, 36, 0],
        columns: [
          {
            text: `PRC Hardware B2B Purchase Order: ${data.poNumber} | Quotation: ${data.quotationNumber}`,
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
  return new Promise<Buffer>((resolve, reject) => {
    try {
      doc.getBuffer((buf: Buffer) => {
        if (buf) {
          resolve(buf);
        } else {
          reject(new Error('PO PDF generation produced an empty buffer'));
        }
      });
    } catch (err) {
      reject(err);
    }
  });
};
