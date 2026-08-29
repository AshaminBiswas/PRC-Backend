/**
 * po-pdf.service.ts
 *
 * Production-grade Commercial Purchase Order (PO) PDF generation using pdfmake.
 * Features:
 * - Clean architectural branding (PRC Hardware, Deep Navy #0f172a, Amber Gold #d97706).
 * - Complete customer, company, GSTIN, billing and shipping breakdown.
 * - Ordered line items table with approved unit rates and GST calculations.
 * - Advance deposit summary and commercial terms.
 * - Official digital verification seal.
 */

import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require('pdfmake');
import type { TDocumentDefinitions, StyleDictionary, TableCell } from 'pdfmake/interfaces';
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
  console.warn('[PO PDF Service] Font initialization warning:', e?.message || e);
}

// ── Brand Palette ─────────────────────────────────────────────────────────────
const NAVY = '#0f172a';
const AMBER_DARK = '#d97706';
const GREEN = '#047857';
const LIGHT_BG = '#f8fafc';
const BORDER_DARK = '#1e293b';
const BORDER_SUBTLE = '#e2e8f0';
const GRAY = '#475569';
const DARK_GRAY = '#1e293b';

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const ICONS = {
  shield: (color = AMBER_DARK) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`,
};

function formatINR(value: number | null | undefined): string {
  const n = Number(value || 0);
  return `\u20B9${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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
    margin?: [number, number, number, number];
  } = {}
): TableCell {
  return {
    text,
    bold: options.bold ?? false,
    alignment: options.align ?? 'left',
    color: options.color ?? DARK_GRAY,
    fillColor: options.fillColor,
    fontSize: options.fontSize ?? 8,
    margin: options.margin ?? [4, 4, 4, 4],
  };
}

export interface GeneratePoPdfInput {
  poSubmissionId: string;
  customerPoNumber?: string | null;
  quoteNumber?: string | null;
  customerName: string;
  companyName?: string | null;
  customerEmail: string;
  customerPhone?: string | null;
  gstin?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
  deliveryTimeline?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  source?: string | null;
  receivedAt?: Date | string;
  advancePercentage?: number | null;
  lineItems?: Array<{
    productName: string;
    sku?: string | null;
    quantity: number;
    unit?: string | null;
    targetRate?: number | null;
    totalPrice?: number | null;
    specifications?: string | null;
  }>;
}

export async function generatePoPdfBuffer(po: GeneratePoPdfInput): Promise<Buffer> {
  const lineItems = Array.isArray(po.lineItems) ? po.lineItems : [];
  
  // Calculate Totals
  const basicPrice = lineItems.reduce((sum, item) => sum + (Number(item.totalPrice) || (Number(item.quantity || 1) * Number(item.targetRate || 0))), 0);
  const gstAmount = Math.round(basicPrice * 0.18);
  const grandTotal = basicPrice + gstAmount;
  const advancePercent = Number(po.advancePercentage || 30);
  const advanceAmount = Math.round(grandTotal * (advancePercent / 100));
  const balanceDue = grandTotal - advanceAmount;

  // Build Line Items Table
  const tableRows: TableCell[][] = [];

  // Header Row
  tableRows.push([
    makeCell('#', { bold: true, align: 'center', color: '#ffffff', fillColor: NAVY, fontSize: 8 }),
    makeCell('PRODUCT / SPECIFICATION', { bold: true, color: '#ffffff', fillColor: NAVY, fontSize: 8 }),
    makeCell('SKU / MODEL', { bold: true, color: '#ffffff', fillColor: NAVY, fontSize: 8 }),
    makeCell('QTY', { bold: true, align: 'center', color: '#ffffff', fillColor: NAVY, fontSize: 8 }),
    makeCell('UNIT RATE (INR)', { bold: true, align: 'right', color: '#ffffff', fillColor: NAVY, fontSize: 8 }),
    makeCell('TOTAL AMOUNT (INR)', { bold: true, align: 'right', color: '#ffffff', fillColor: NAVY, fontSize: 8 }),
  ]);

  if (lineItems.length > 0) {
    lineItems.forEach((item, index) => {
      const rowFill = index % 2 === 0 ? '#ffffff' : LIGHT_BG;
      const itemTotal = Number(item.totalPrice) || (Number(item.quantity || 1) * Number(item.targetRate || 0));

      tableRows.push([
        makeCell(String(index + 1), { align: 'center', fillColor: rowFill, color: GRAY, fontSize: 8 }),
        {
          stack: [
            { text: item.productName || 'Hardware Fitting', bold: true, fontSize: 8.5, color: NAVY },
            ...(item.specifications
              ? [{ text: item.specifications, fontSize: 7, color: GRAY, margin: [0, 1, 0, 0] as [number, number, number, number] }]
              : []),
          ],
          fillColor: rowFill,
          margin: [4, 4, 4, 4],
        },
        makeCell(item.sku || 'PRC-HW', { fillColor: rowFill, color: GRAY, fontSize: 7.5 }),
        makeCell(`${item.quantity} ${item.unit || 'PCS'}`, { align: 'center', bold: true, fillColor: rowFill, fontSize: 8 }),
        makeCell(formatINR(item.targetRate || 0), { align: 'right', fillColor: rowFill, fontSize: 8 }),
        makeCell(formatINR(itemTotal), { align: 'right', bold: true, fillColor: rowFill, fontSize: 8, color: NAVY }),
      ]);
    });
  } else {
    tableRows.push([
      makeCell('1', { align: 'center', fillColor: '#ffffff' }),
      makeCell('Purchase Order as per attached technical document & specifications', { bold: true, fillColor: '#ffffff' }),
      makeCell('DOCUMENT-PO', { fillColor: '#ffffff', color: GRAY }),
      makeCell('1 LOT', { align: 'center', bold: true, fillColor: '#ffffff' }),
      makeCell('As Agreed', { align: 'right', fillColor: '#ffffff' }),
      makeCell('As Agreed', { align: 'right', bold: true, fillColor: '#ffffff', color: NAVY }),
    ]);
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [32, 28, 32, 28],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 8.5,
      color: DARK_GRAY,
      lineHeight: 1.15,
    },
    content: [
      // ── Header Band ──────────────────────────────────────────────────────────
      {
        columns: [
          {
            image: PRC_LOGO_DATA_URL,
            width: 50,
            height: 50,
          },
          {
            stack: [
              {
                text: 'PRC HARDWARE',
                fontSize: 14,
                bold: true,
                color: NAVY,
                characterSpacing: 0.5,
              },
              {
                text: 'Commercial Hardware & Architectural Solutions',
                fontSize: 7.5,
                color: AMBER_DARK,
                bold: true,
              },
              {
                text: 'H -3, J.R. Complex, Gate No 4, Mela Ram Farm, Mandoli, Delhi - 110093',
                fontSize: 7,
                color: GRAY,
                margin: [0, 1, 0, 0],
              },
              {
                text: 'GSTIN: 27AABCP1234F1Z9  |  Email: po@pacifichardware.com  |  Web: pacifichardware.com',
                fontSize: 7,
                color: GRAY,
              },
            ],
            margin: [8, 0, 0, 0],
          },
          {
            stack: [
              {
                text: 'PURCHASE ORDER',
                fontSize: 13,
                bold: true,
                color: NAVY,
                alignment: 'right',
              },
              {
                text: `PO REF: ${po.poSubmissionId}`,
                fontSize: 8.5,
                bold: true,
                color: AMBER_DARK,
                alignment: 'right',
                margin: [0, 1, 0, 0],
              },
              ...(po.customerPoNumber
                ? [
                    {
                      text: `Client PO #: ${po.customerPoNumber}`,
                      fontSize: 8,
                      bold: true,
                      color: NAVY,
                      alignment: 'right' as const,
                    },
                  ]
                : []),
              ...(po.quoteNumber
                ? [
                    {
                      text: `Linked Quote: ${po.quoteNumber}`,
                      fontSize: 7.5,
                      color: GRAY,
                      alignment: 'right' as const,
                    },
                  ]
                : []),
              {
                text: `Date: ${formatDate(po.receivedAt)}`,
                fontSize: 7.5,
                color: GRAY,
                alignment: 'right',
              },
            ],
          },
        ],
      },

      // Thin divider
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 531, y2: 0, lineWidth: 1, lineColor: BORDER_DARK }],
        margin: [0, 8, 0, 8],
      },

      // ── Customer & Shipping Information ──────────────────────────────────────
      {
        columns: [
          // Buyer / Billed To
          {
            stack: [
              {
                text: 'BUYER / BILLED TO:',
                fontSize: 8,
                bold: true,
                color: AMBER_DARK,
                margin: [0, 0, 0, 3],
              },
              {
                text: po.companyName || po.customerName,
                fontSize: 9.5,
                bold: true,
                color: NAVY,
              },
              ...(po.companyName ? [{ text: `Attn: ${po.customerName}`, fontSize: 8, color: DARK_GRAY }] : []),
              { text: `Email: ${po.customerEmail}`, fontSize: 7.5, color: GRAY },
              ...(po.customerPhone ? [{ text: `Phone: ${po.customerPhone}`, fontSize: 7.5, color: GRAY }] : []),
              ...(po.gstin ? [{ text: `GSTIN: ${po.gstin}`, fontSize: 7.5, bold: true, color: NAVY }] : []),
              ...(po.billingAddress
                ? [{ text: `Billing: ${po.billingAddress}`, fontSize: 7.5, color: GRAY, margin: [0, 2, 0, 0] as [number, number, number, number] }]
                : []),
            ],
            width: '50%',
          },
          // Shipping / Site Delivery
          {
            stack: [
              {
                text: 'DELIVERY & COMMERCIAL TERMS:',
                fontSize: 8,
                bold: true,
                color: AMBER_DARK,
                margin: [0, 0, 0, 3],
              },
              {
                text: `Delivery Timeline: ${po.deliveryTimeline || 'Immediate (Within 7-10 Working Days)'}`,
                fontSize: 8,
                bold: true,
                color: NAVY,
              },
              {
                text: `Payment Terms: ${po.paymentTerms || `Advance payment of ${advancePercent}% against Proforma Invoice`}`,
                fontSize: 7.5,
                color: DARK_GRAY,
              },
              ...(po.shippingAddress
                ? [
                    {
                      text: `Site Delivery Address: ${po.shippingAddress}`,
                      fontSize: 7.5,
                      color: GRAY,
                      margin: [0, 2, 0, 0] as [number, number, number, number],
                    },
                  ]
                : []),
              ...(po.notes
                ? [
                    {
                      text: `Special Remarks: "${po.notes}"`,
                      fontSize: 7,
                      italics: true,
                      color: DARK_GRAY,
                      margin: [0, 2, 0, 0] as [number, number, number, number],
                    },
                  ]
                : []),
            ],
            width: '50%',
          },
        ],
        margin: [0, 0, 0, 10],
      },

      // ── Line Items Table ─────────────────────────────────────────────────────
      {
        table: {
          headerRows: 1,
          widths: [20, '*', 70, 45, 65, 75],
          body: tableRows,
        },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? 0.75 : 0.4),
          vLineWidth: () => 0,
          hLineColor: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? BORDER_DARK : BORDER_SUBTLE),
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 3.5,
          paddingBottom: () => 3.5,
        },
        margin: [0, 0, 0, 8],
      },

      // ── Totals & Financial Summary ────────────────────────────────────────────
      {
        columns: [
          // Left side: Verification Seal & Declaration
          {
            stack: [
              {
                text: 'COMMERCIAL EXECUTION DECLARATION:',
                fontSize: 7.5,
                bold: true,
                color: NAVY,
                margin: [0, 0, 0, 2],
              },
              {
                text: 'This Purchase Order confirms receipt and acceptance of commercial specifications. Material dispatch and manufacturing will commence upon verification of advance deposit against Proforma Invoice.',
                fontSize: 7,
                color: GRAY,
                lineHeight: 1.25,
              },
              {
                columns: [
                  {
                    svg: ICONS.shield(GREEN),
                    width: 14,
                    height: 14,
                  },
                  {
                    text: 'AUTHENTICATED DIGITAL PURCHASE ORDER RECORD',
                    fontSize: 7,
                    bold: true,
                    color: GREEN,
                    margin: [4, 2, 0, 0],
                  },
                ],
                margin: [0, 6, 0, 0],
              },
            ],
            width: '55%',
          },
          // Right side: Totals Box
          {
            stack: [
              {
                table: {
                  widths: ['55%', '45%'],
                  body: [
                    [
                      makeCell('Basic Subtotal:', { fontSize: 7.5, color: GRAY }),
                      makeCell(formatINR(basicPrice), { align: 'right', fontSize: 7.5, bold: true, color: NAVY }),
                    ],
                    [
                      makeCell('GST (18%):', { fontSize: 7.5, color: GRAY }),
                      makeCell(formatINR(gstAmount), { align: 'right', fontSize: 7.5, bold: true, color: NAVY }),
                    ],
                    [
                      makeCell('Grand Total:', { fontSize: 8.5, bold: true, color: NAVY, fillColor: '#f1f5f9' }),
                      makeCell(formatINR(grandTotal), { align: 'right', fontSize: 8.5, bold: true, color: NAVY, fillColor: '#f1f5f9' }),
                    ],
                    [
                      makeCell(`Advance Payable (${advancePercent}%):`, { fontSize: 7.5, bold: true, color: AMBER_DARK }),
                      makeCell(formatINR(advanceAmount), { align: 'right', fontSize: 7.5, bold: true, color: AMBER_DARK }),
                    ],
                    [
                      makeCell('Balance Due at Dispatch:', { fontSize: 7.5, color: GRAY }),
                      makeCell(formatINR(balanceDue), { align: 'right', fontSize: 7.5, color: GRAY }),
                    ],
                  ],
                },
                layout: {
                  hLineWidth: () => 0.4,
                  vLineWidth: () => 0,
                  hLineColor: () => BORDER_SUBTLE,
                  paddingTop: () => 2.5,
                  paddingBottom: () => 2.5,
                },
              },
            ],
            width: '45%',
          },
        ],
        margin: [0, 0, 0, 10],
      },

      // ── Signatures & Authorization ───────────────────────────────────────────
      {
        columns: [
          {
            stack: [
              {
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.75, lineColor: BORDER_DARK }],
                margin: [0, 20, 0, 3],
              },
              {
                text: 'Authorized Customer Representative',
                fontSize: 7.5,
                bold: true,
                color: NAVY,
              },
              {
                text: `${po.customerName} (${po.companyName || 'Buyer'})`,
                fontSize: 7,
                color: GRAY,
              },
            ],
            width: '50%',
          },
          {
            stack: [
              {
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.75, lineColor: BORDER_DARK }],
                margin: [0, 20, 0, 3],
              },
              {
                text: 'For PRC Hardware (Pacific Products)',
                fontSize: 7.5,
                bold: true,
                color: NAVY,
                alignment: 'right',
              },
              {
                text: 'Authorized Commercial Desk, Delhi',
                fontSize: 7,
                color: GRAY,
                alignment: 'right',
              },
            ],
            width: '50%',
          },
        ],
      },
    ],
    styles: {} as StyleDictionary,
  };

  const doc = pdfmake.createPdf(docDefinition);
  const buffer = await doc.getBuffer();
  return buffer;
}
