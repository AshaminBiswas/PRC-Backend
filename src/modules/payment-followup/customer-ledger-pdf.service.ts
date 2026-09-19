/**
 * customer-ledger-pdf.service.ts
 *
 * Vector Black & White Statement of Account PDF Generator for Customer Dues.
 * Follows strict Proforma Invoice & Purchase Order styling:
 * - Pure Monochrome (#000000 high contrast, solid lines, #F2F2F2 table headers)
 * - Two-column company & client dossier
 * - Running balance calculation per transaction
 * - Amount in Indian currency words & prominent TOTAL OUTSTANDING
 * - Official bank remittance info & dual signatory boxes
 */

import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require('pdfmake');
import type { TDocumentDefinitions, TableCell, Alignment } from 'pdfmake/interfaces';
import { PACIFIC_LOGO_DATA_URL } from '../../assets/pacific_logo.base64';
import { numberToIndianWords } from '../inventory/purchase-order.service';

// ── Configure Roboto Fonts from pdfmake ──────────────────────────────────────
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
  console.warn('[Ledger PDF] Font initialization warning:', e?.message || e);
}

const BLACK = '#000000';
const DARK_GRAY = '#222222';
const MUTED_GRAY = '#444444';
const LIGHT_BG = '#F2F2F2';
const BORDER_BLACK = '#000000';

function formatINR(val: number | null | undefined): string {
  const n = Number(val || 0);
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
    align?: Alignment;
    color?: string;
    fillColor?: string;
    fontSize?: number;
    colSpan?: number;
    margin?: [number, number, number, number];
  } = {}
): TableCell {
  return {
    text,
    bold: options.bold ?? false,
    alignment: options.align || 'left',
    color: options.color || BLACK,
    fillColor: options.fillColor,
    fontSize: options.fontSize || 8.5,
    colSpan: options.colSpan,
    margin: options.margin || [4, 4, 4, 4],
  };
}

export interface StatementLedgerRow {
  date: string;
  refNo: string;
  description: string;
  debit: number;  // Invoiced / Billed
  credit: number; // Paid
  balance: number; // Running balance
}

export interface CustomerLedgerPdfInput {
  customer: {
    name: string;
    companyName?: string | null;
    phone?: string | null;
    email?: string | null;
    gstin?: string | null;
    billingAddress?: string | null;
  };
  statementDate?: string;
  periodStart?: string;
  periodEnd?: string;
  openingBalance?: number;
  transactions: StatementLedgerRow[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  agingBreakdown?: {
    bucket0_30: number;
    bucket31_60: number;
    bucket61_90: number;
    bucket90_plus: number;
  };
}

export const generateCustomerLedgerPdfBuffer = async (
  input: CustomerLedgerPdfInput
): Promise<Buffer> => {
  const statementDateStr = formatDate(input.statementDate || new Date());
  const wordsAmount = numberToIndianWords(Math.max(0, input.closingBalance));

  const tableBody: TableCell[][] = [
    // Header Row
    [
      makeCell('Date', { bold: true, fillColor: LIGHT_BG, align: 'center', fontSize: 8 }),
      makeCell('Particulars / Reference', { bold: true, fillColor: LIGHT_BG, fontSize: 8 }),
      makeCell('Debit (\u20B9)', { bold: true, fillColor: LIGHT_BG, align: 'right', fontSize: 8 }),
      makeCell('Credit (\u20B9)', { bold: true, fillColor: LIGHT_BG, align: 'right', fontSize: 8 }),
      makeCell('Balance (\u20B9)', { bold: true, fillColor: LIGHT_BG, align: 'right', fontSize: 8 }),
    ],
  ];

  // Optional Opening Balance row
  if (input.openingBalance !== undefined && input.openingBalance > 0) {
    tableBody.push([
      makeCell(input.periodStart ? formatDate(input.periodStart) : statementDateStr, { align: 'center', fontSize: 8 }),
      makeCell('Opening Historical Balance', { bold: true, fontSize: 8 }),
      makeCell(formatINR(input.openingBalance), { align: 'right', fontSize: 8 }),
      makeCell('-', { align: 'right', fontSize: 8 }),
      makeCell(formatINR(input.openingBalance), { bold: true, align: 'right', fontSize: 8 }),
    ]);
  }

  // Transactions rows
  for (const t of input.transactions) {
    tableBody.push([
      makeCell(formatDate(t.date), { align: 'center', fontSize: 8 }),
      makeCell(`${t.refNo} — ${t.description}`, { fontSize: 8 }),
      makeCell(t.debit > 0 ? formatINR(t.debit) : '-', { align: 'right', fontSize: 8 }),
      makeCell(t.credit > 0 ? formatINR(t.credit) : '-', { align: 'right', fontSize: 8 }),
      makeCell(formatINR(t.balance), { bold: true, align: 'right', fontSize: 8 }),
    ]);
  }

  // Total Summary row
  tableBody.push([
    makeCell('TOTALS', { bold: true, colSpan: 2, fillColor: LIGHT_BG, align: 'right', fontSize: 8.5 }),
    makeCell('', {}),
    makeCell(formatINR(input.totalDebit), { bold: true, fillColor: LIGHT_BG, align: 'right', fontSize: 8.5 }),
    makeCell(formatINR(input.totalCredit), { bold: true, fillColor: LIGHT_BG, align: 'right', fontSize: 8.5 }),
    makeCell(formatINR(input.closingBalance), { bold: true, fillColor: LIGHT_BG, align: 'right', fontSize: 8.5 }),
  ]);

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [28, 28, 28, 28],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 8.5,
      color: BLACK,
    },
    content: [
      // ── Letterhead & Title ────────────────────────────────────────────────
      {
        columns: [
          {
            image: PACIFIC_LOGO_DATA_URL,
            width: 140,
          },
          {
            stack: [
              { text: 'PACIFIC PRODUCTS & SOLUTIONS', bold: true, fontSize: 13, alignment: 'right' },
              { text: 'Kh. No. 59/23, Gali No. 8, Friends Colony, Industrial Area, Mandoli, Delhi - 110093', fontSize: 8, color: MUTED_GRAY, alignment: 'right' },
              { text: 'GSTIN: 07AADFP3948F1Z1 | Email: billing@pacifichardware.com | Ph: +91 99990 00000', fontSize: 8, color: MUTED_GRAY, alignment: 'right' },
            ],
          },
        ],
        margin: [0, 0, 0, 8],
      },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 539, y2: 0, lineWidth: 1.5, lineColor: BORDER_BLACK }],
        margin: [0, 0, 0, 8],
      },

      // ── Document Heading ──────────────────────────────────────────────────
      {
        columns: [
          { text: 'STATEMENT OF ACCOUNT', bold: true, fontSize: 13, color: BLACK },
          { text: `As on: ${statementDateStr}`, bold: true, fontSize: 9, alignment: 'right', color: DARK_GRAY },
        ],
        margin: [0, 0, 0, 10],
      },

      // ── Client & Summary Dossier Box ──────────────────────────────────────
      {
        table: {
          widths: ['55%', '45%'],
          body: [
            [
              {
                stack: [
                  { text: 'CUSTOMER / BUYER DOSSIER', bold: true, fontSize: 8, color: MUTED_GRAY },
                  { text: input.customer.companyName || input.customer.name, bold: true, fontSize: 10, margin: [0, 2, 0, 2] },
                  input.customer.companyName && input.customer.name !== input.customer.companyName
                    ? { text: `Attn: ${input.customer.name}`, fontSize: 8, color: DARK_GRAY }
                    : { text: '' },
                  input.customer.billingAddress
                    ? { text: `Address: ${input.customer.billingAddress}`, fontSize: 8, color: DARK_GRAY }
                    : { text: '' },
                  input.customer.gstin ? { text: `GSTIN: ${input.customer.gstin}`, fontSize: 8, bold: true } : { text: '' },
                  input.customer.phone ? { text: `Phone: ${input.customer.phone}`, fontSize: 8 } : { text: '' },
                  input.customer.email ? { text: `Email: ${input.customer.email}`, fontSize: 8 } : { text: '' },
                ],
                margin: [6, 6, 6, 6],
              },
              {
                stack: [
                  { text: 'ACCOUNT RECEIVABLES SUMMARY', bold: true, fontSize: 8, color: MUTED_GRAY },
                  {
                    columns: [
                      { text: 'Total Invoiced:', fontSize: 8.5 },
                      { text: formatINR(input.totalDebit), bold: true, fontSize: 8.5, alignment: 'right' },
                    ],
                    margin: [0, 3, 0, 0],
                  },
                  {
                    columns: [
                      { text: 'Total Payments Received:', fontSize: 8.5 },
                      { text: formatINR(input.totalCredit), bold: true, fontSize: 8.5, alignment: 'right' },
                    ],
                    margin: [0, 2, 0, 0],
                  },
                  {
                    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 215, y2: 0, lineWidth: 1, lineColor: BORDER_BLACK }],
                    margin: [0, 4, 0, 4],
                  },
                  {
                    columns: [
                      { text: 'TOTAL OUTSTANDING:', bold: true, fontSize: 10 },
                      { text: formatINR(input.closingBalance), bold: true, fontSize: 11, alignment: 'right', color: BLACK },
                    ],
                  },
                ],
                fillColor: LIGHT_BG,
                margin: [6, 6, 6, 6],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => BORDER_BLACK,
          vLineColor: () => BORDER_BLACK,
        },
        margin: [0, 0, 0, 10],
      },

      // ── Itemized Ledger Table ─────────────────────────────────────────────
      {
        table: {
          headerRows: 1,
          widths: ['14%', '42%', '14%', '14%', '16%'],
          body: tableBody,
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#CCCCCC',
          vLineColor: () => '#CCCCCC',
        },
        margin: [0, 0, 0, 8],
      },

      // ── Prominent Total Banner & Words ────────────────────────────────────
      {
        table: {
          widths: ['100%'],
          body: [
            [
              {
                stack: [
                  {
                    columns: [
                      { text: 'TOTAL OUTSTANDING BALANCE DUE:', bold: true, fontSize: 11 },
                      { text: formatINR(input.closingBalance), bold: true, fontSize: 13, alignment: 'right' },
                    ],
                  },
                  {
                    text: `Amount in Words: ${wordsAmount}`,
                    italics: true,
                    fontSize: 8.5,
                    color: DARK_GRAY,
                    margin: [0, 2, 0, 0],
                  },
                ],
                fillColor: LIGHT_BG,
                margin: [8, 6, 8, 6],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 1.5,
          vLineWidth: () => 1.5,
          hLineColor: () => BORDER_BLACK,
          vLineColor: () => BORDER_BLACK,
        },
        margin: [0, 0, 0, 10],
      },

      // ── Optional Aging Breakdown Box ──────────────────────────────────────
      input.agingBreakdown
        ? {
            table: {
              widths: ['25%', '25%', '25%', '25%'],
              body: [
                [
                  makeCell('0 – 30 Days', { bold: true, fillColor: LIGHT_BG, align: 'center', fontSize: 7.5 }),
                  makeCell('31 – 60 Days', { bold: true, fillColor: LIGHT_BG, align: 'center', fontSize: 7.5 }),
                  makeCell('61 – 90 Days', { bold: true, fillColor: LIGHT_BG, align: 'center', fontSize: 7.5 }),
                  makeCell('90+ Days (Overdue)', { bold: true, fillColor: LIGHT_BG, align: 'center', fontSize: 7.5 }),
                ],
                [
                  makeCell(formatINR(input.agingBreakdown.bucket0_30), { align: 'center', fontSize: 8 }),
                  makeCell(formatINR(input.agingBreakdown.bucket31_60), { align: 'center', fontSize: 8 }),
                  makeCell(formatINR(input.agingBreakdown.bucket61_90), { align: 'center', fontSize: 8 }),
                  makeCell(formatINR(input.agingBreakdown.bucket90_plus), { bold: true, align: 'center', fontSize: 8 }),
                ],
              ],
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#CCCCCC',
              vLineColor: () => '#CCCCCC',
            },
            margin: [0, 0, 0, 10],
          }
        : { text: '' },

      // ── Bank Remittance & Dual Signatory Blocks ───────────────────────────
      {
        columns: [
          {
            width: '60%',
            stack: [
              { text: 'OFFICIAL BANK REMITTANCE PARTICULARS:', bold: true, fontSize: 8, color: MUTED_GRAY },
              { text: 'Bank Name: HDFC Bank Ltd.', fontSize: 8 },
              { text: 'Account Name: Pacific Products and Solutions', fontSize: 8 },
              { text: 'Current A/C No: 50200088991122', bold: true, fontSize: 8 },
              { text: 'IFSC Code: HDFC0001234 | Branch: Mandoli, Delhi - 110093', fontSize: 8 },
              { text: 'UPI / VPA: prchardware@hdfcbank', fontSize: 8 },
              { text: 'Kindly share bank UTR / payment receipt upon transfer for instant reconciliation.', italics: true, fontSize: 7.5, color: MUTED_GRAY, margin: [0, 3, 0, 0] },
            ],
          },
          {
            width: '40%',
            stack: [
              { text: 'For PACIFIC PRODUCTS & SOLUTIONS', bold: true, fontSize: 8.5, alignment: 'right' },
              { text: '', margin: [0, 24, 0, 0] }, // Signature spacer
              {
                canvas: [{ type: 'line', x1: 50, y1: 0, x2: 215, y2: 0, lineWidth: 1, lineColor: BORDER_BLACK }],
                alignment: 'right',
              },
              { text: 'Authorized Signatory / Accounts Desk', fontSize: 8, alignment: 'right', color: MUTED_GRAY, margin: [0, 2, 0, 0] },
            ],
          },
        ],
        margin: [0, 4, 0, 0],
      },
    ],
  };

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const pdfDoc = pdfmake.createPdf(docDefinition);
      pdfDoc.getBuffer((buffer: Buffer) => {
        resolve(buffer);
      });
    } catch (err) {
      reject(err);
    }
  });
};
