import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require('pdfmake');
import type { TDocumentDefinitions, Content, TableCell, Alignment } from 'pdfmake/interfaces';
import { PRC_LOGO_DATA_URL } from '../../assets/logo.base64';

// ── Configure Roboto Fonts from pdfmake package ──────────────────────────────
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
  console.warn('[Installer Bill PDF Service] Font initialization warning:', e?.message || e);
}

// ── Design Palette ───────────────────────────────────────────────────────────
const NAVY = '#0f172a';
const NAVY_DARK = '#0b1e38';
const AMBER = '#d97706';
const EMERALD = '#047857';
const GRAY = '#475569';
const DARK_GRAY = '#1e293b';
const LIGHT_BG = '#f8fafc';
const BORDER_COLOR = '#cbd5e1';

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
    color: options.color || DARK_GRAY,
    fillColor: options.fillColor,
    fontSize: options.fontSize || 8.5,
    colSpan: options.colSpan,
    margin: options.margin || [4, 4, 4, 4],
  } as TableCell;
}

export interface InstallerBillPdfData {
  billNo: string;
  installerName: string;
  installerEmail: string;
  installDate: Date | string;
  isNcr: boolean;
  travelExpenses: number;
  umpQuantity?: number;
  umpRate?: number;
  umpTotal?: number;
  siteAddress: string;
  sitePin: string;
  deductionAmount?: number;
  deductionReason?: string | null;
  subtotal: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: string;
  paymentDate?: Date | string | null;
  notes?: string | null;
  items: Array<{
    category?: string;
    modelName: string;
    quantity: number;
    installationPrice: number;
    lineTotal: number;
  }>;
  payments?: Array<{
    amount: number;
    paymentDate: Date | string;
    paymentMode?: string | null;
    referenceNote?: string | null;
  }>;
}

/**
 * Generate formatted invoice-style PDF bill for an installer payment record.
 */
export async function generateInstallerBillPdf(data: InstallerBillPdfData): Promise<Buffer> {
  const isCleared = data.paymentStatus === 'CLEARED';

  // Items table body
  const itemRows: TableCell[][] = [
    [
      makeCell('#', { bold: true, align: 'center', color: '#ffffff', fillColor: NAVY }),
      makeCell('Installation Item / Scope Specification', { bold: true, color: '#ffffff', fillColor: NAVY }),
      makeCell('Quantity', { bold: true, align: 'center', color: '#ffffff', fillColor: NAVY }),
      makeCell('Installation Price', { bold: true, align: 'right', color: '#ffffff', fillColor: NAVY }),
      makeCell('Line Total', { bold: true, align: 'right', color: '#ffffff', fillColor: NAVY }),
    ],
  ];

  data.items.forEach((item, index) => {
    const bg = index % 2 === 0 ? '#ffffff' : LIGHT_BG;
    const categoryPrefix = item.category ? `[${item.category}] ` : '';
    itemRows.push([
      makeCell(String(index + 1), { align: 'center', fillColor: bg }),
      makeCell(`${categoryPrefix}${item.modelName}`, { bold: true, fillColor: bg }),
      makeCell(String(item.quantity), { align: 'center', fillColor: bg }),
      makeCell(formatINR(item.installationPrice), { align: 'right', fillColor: bg }),
      makeCell(formatINR(item.lineTotal), { bold: true, align: 'right', fillColor: bg }),
    ]);
  });

  // If legacy UMP (Urinal Modesty Panel) installed without being in items array, append line item
  const hasUmpInItems = data.items.some((i) => i.category === 'UMP');
  if (!hasUmpInItems && data.umpQuantity && Number(data.umpQuantity) > 0) {
    const bg = data.items.length % 2 === 0 ? '#ffffff' : LIGHT_BG;
    const rate = Number(data.umpRate || 0);
    const total = Number(data.umpTotal || Number(data.umpQuantity) * rate);
    itemRows.push([
      makeCell(String(itemRows.length), { align: 'center', fillColor: bg }),
      makeCell('[UMP] Urinal Modesty Panel Installation', { bold: true, fillColor: bg }),
      makeCell(String(data.umpQuantity), { align: 'center', fillColor: bg }),
      makeCell(formatINR(rate), { align: 'right', fillColor: bg }),
      makeCell(formatINR(total), { bold: true, align: 'right', fillColor: bg }),
    ]);
  }

  // Payment installment history rows
  const paymentHistoryContent: Content[] = [];
  if (data.payments && data.payments.length > 0) {
    const paymentRows: TableCell[][] = [
      [
        makeCell('#', { bold: true, align: 'center', color: '#ffffff', fillColor: NAVY_DARK }),
        makeCell('Payment Date', { bold: true, color: '#ffffff', fillColor: NAVY_DARK }),
        makeCell('Mode', { bold: true, color: '#ffffff', fillColor: NAVY_DARK }),
        makeCell('Reference / UTR Note', { bold: true, color: '#ffffff', fillColor: NAVY_DARK }),
        makeCell('Amount Paid', { bold: true, align: 'right', color: '#ffffff', fillColor: NAVY_DARK }),
      ],
    ];

    data.payments.forEach((p, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : LIGHT_BG;
      paymentRows.push([
        makeCell(String(idx + 1), { align: 'center', fillColor: bg }),
        makeCell(formatDate(p.paymentDate), { fillColor: bg }),
        makeCell(p.paymentMode || 'N/A', { fillColor: bg }),
        makeCell(p.referenceNote || '-', { fillColor: bg }),
        makeCell(formatINR(p.amount), { bold: true, align: 'right', color: EMERALD, fillColor: bg }),
      ]);
    });

    paymentHistoryContent.push(
      { text: 'Payment Disbursement History', style: 'sectionHeader', margin: [0, 14, 0, 4] },
      {
        table: {
          headerRows: 1,
          widths: [20, 80, 80, '*', 90],
          body: paymentRows,
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => BORDER_COLOR,
          vLineColor: () => BORDER_COLOR,
        },
      }
    );
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [32, 28, 32, 36],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 8.5,
      color: DARK_GRAY,
    },
    content: [
      // Header: Logo & Company Title
      {
        columns: [
          {
            image: PRC_LOGO_DATA_URL,
            width: 140,
          },
          {
            alignment: 'right',
            stack: [
              { text: 'PACIFIC PRODUCTS & SOLUTIONS', bold: true, fontSize: 13, color: NAVY },
              { text: 'Modular Restroom Restroom Hardware & Cubicle Solutions', fontSize: 8, color: GRAY },
              { text: 'GSTIN: 07AAACP0123A1Z5 | Support: support@prchardware.com', fontSize: 7.5, color: GRAY, margin: [0, 2, 0, 0] },
              { text: 'New Delhi HQ | Kolkata Hub | Pan-India Installations', fontSize: 7.5, color: GRAY },
            ],
          },
        ],
      },

      // Horizontal separator band
      {
        canvas: [{ type: 'line', x1: 0, y1: 8, x2: 531, y2: 8, lineWidth: 1.5, lineColor: NAVY }],
        margin: [0, 0, 0, 10],
      },

      // Bill Title Banner
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                fillColor: LIGHT_BG,
                margin: [8, 6, 8, 6],
                columns: [
                  {
                    text: 'INSTALLER PAYMENT BILL / DISBURSEMENT ADVICE',
                    bold: true,
                    fontSize: 10.5,
                    color: NAVY,
                  },
                  {
                    text: `BILL NO: ${data.billNo}`,
                    bold: true,
                    fontSize: 11,
                    color: AMBER,
                    alignment: 'right',
                  },
                ],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => BORDER_COLOR,
          vLineColor: () => BORDER_COLOR,
        },
        margin: [0, 0, 0, 10],
      },

      // 2-Column Info Dossier: Installer & Installation Site
      {
        columns: [
          // Left: Installer Details
          {
            width: '49%',
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    fillColor: LIGHT_BG,
                    margin: [6, 4, 6, 4],
                    text: 'INSTALLER DETAILS',
                    bold: true,
                    fontSize: 8.5,
                    color: NAVY,
                  },
                ],
                [
                  {
                    margin: [6, 6, 6, 6],
                    stack: [
                      { text: [{ text: 'Name: ', bold: true }, data.installerName] },
                      { text: [{ text: 'Email: ', bold: true }, data.installerEmail], margin: [0, 2, 0, 0] },
                      { text: [{ text: 'Install Date: ', bold: true }, formatDate(data.installDate)], margin: [0, 2, 0, 0] },
                      {
                        text: [
                          { text: 'Payment Status: ', bold: true },
                          {
                            text: isCleared ? 'FULL / CLEARED' : 'PARTIAL',
                            bold: true,
                            color: isCleared ? EMERALD : AMBER,
                          },
                        ],
                        margin: [0, 2, 0, 0],
                      },
                      data.paymentDate
                        ? { text: [{ text: 'Date of Payment: ', bold: true }, formatDate(data.paymentDate)], margin: [0, 2, 0, 0] }
                        : { text: '' },
                    ],
                  },
                ],
              ],
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => BORDER_COLOR,
              vLineColor: () => BORDER_COLOR,
            },
          },
          // Spacer
          { width: '2%', text: '' },
          // Right: Installation Site Details
          {
            width: '49%',
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    fillColor: LIGHT_BG,
                    margin: [6, 4, 6, 4],
                    text: 'INSTALLATION SITE & LOGISTICS',
                    bold: true,
                    fontSize: 8.5,
                    color: NAVY,
                  },
                ],
                [
                  {
                    margin: [6, 6, 6, 6],
                    stack: [
                      { text: [{ text: 'Site Address: ', bold: true }, data.siteAddress] },
                      { text: [{ text: 'Site Postal PIN: ', bold: true }, data.sitePin], margin: [0, 2, 0, 0] },
                      {
                        text: [
                          { text: 'NCR Region: ', bold: true },
                          data.isNcr ? 'YES (Within Delhi NCR — Travel Waived)' : 'NO (Outstation Installation)',
                        ],
                        margin: [0, 2, 0, 0],
                      },
                      {
                        text: [
                          { text: 'Travel Expenses: ', bold: true },
                          data.isNcr ? '₹0.00 (NCR Waived)' : formatINR(data.travelExpenses),
                        ],
                        margin: [0, 2, 0, 0],
                      },
                    ],
                  },
                ],
              ],
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => BORDER_COLOR,
              vLineColor: () => BORDER_COLOR,
            },
          },
        ],
        margin: [0, 0, 0, 12],
      },

      // Cubicle Installation Scope Table
      { text: 'Cubicle Installation Scope & Line Items', style: 'sectionHeader', margin: [0, 0, 0, 4] },
      {
        table: {
          headerRows: 1,
          widths: [24, '*', 50, 95, 95],
          body: itemRows,
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => BORDER_COLOR,
          vLineColor: () => BORDER_COLOR,
        },
      },

      // Financial Calculation Summary Box
      {
        margin: [0, 8, 0, 0],
        columns: [
          // Left side: Internal Notes / Remarks
          {
            width: '52%',
            stack: [
              data.notes
                ? {
                    table: {
                      widths: ['*'],
                      body: [
                        [
                          {
                            fillColor: LIGHT_BG,
                            margin: [6, 4, 6, 4],
                            text: 'INTERNAL NOTES / SPECIAL INSTRUCTIONS',
                            bold: true,
                            fontSize: 7.5,
                            color: GRAY,
                          },
                        ],
                        [{ text: data.notes, fontSize: 8, margin: [6, 6, 6, 6] }],
                      ],
                    },
                    layout: {
                      hLineWidth: () => 0.5,
                      vLineWidth: () => 0.5,
                      hLineColor: () => BORDER_COLOR,
                      vLineColor: () => BORDER_COLOR,
                    },
                  }
                : { text: '' },
            ],
          },
          { width: '4%', text: '' },
          // Right side: Financial Summary
          {
            width: '44%',
            table: {
              widths: ['*', 90],
              body: (() => {
                const hasUmp = Boolean(data.umpQuantity && Number(data.umpQuantity) > 0);
                const umpRateVal = Number(data.umpRate || 0);
                const umpTotalVal = Number(data.umpTotal || (data.umpQuantity ? Number(data.umpQuantity) * umpRateVal : 0));
                const modelsSubtotalVal = Math.max(0, data.subtotal - umpTotalVal);
                const rows: TableCell[][] = [];

                if (hasUmp) {
                  rows.push([
                    makeCell('Cubicle Models Subtotal:', { align: 'right', color: GRAY }),
                    makeCell(formatINR(modelsSubtotalVal), { align: 'right', bold: true }),
                  ]);
                  rows.push([
                    makeCell(`UMP Installation (${data.umpQuantity} × ${formatINR(umpRateVal)}):`, { align: 'right', color: GRAY }),
                    makeCell(formatINR(umpTotalVal), { align: 'right', bold: true }),
                  ]);
                }

                rows.push([
                  makeCell('Installation Subtotal:', { align: 'right', color: GRAY }),
                  makeCell(formatINR(data.subtotal), { align: 'right', bold: true }),
                ]);
                rows.push([
                  makeCell('Travel Expenses:', { align: 'right', color: GRAY }),
                  makeCell(data.isNcr ? '₹0.00 (NCR)' : formatINR(data.travelExpenses), { align: 'right', bold: true }),
                ]);
                if (data.deductionAmount && Number(data.deductionAmount) > 0) {
                  const reasonLabel = data.deductionReason ? ` (${data.deductionReason})` : '';
                  rows.push([
                    makeCell(`Deductions / Adjustments${reasonLabel}:`, { align: 'right', color: '#dc2626' }),
                    makeCell(`-${formatINR(data.deductionAmount)}`, { align: 'right', bold: true, color: '#dc2626' }),
                  ]);
                }
                rows.push([
                  makeCell('Net Disbursement Due:', { align: 'right', bold: true, color: NAVY, fontSize: 9.5 }),
                  makeCell(formatINR(data.total), { align: 'right', bold: true, color: NAVY, fontSize: 9.5 }),
                ]);
                rows.push([
                  makeCell('Amount Paid to Date:', { align: 'right', bold: true, color: EMERALD }),
                  makeCell(formatINR(data.amountPaid), { align: 'right', bold: true, color: EMERALD }),
                ]);
                rows.push([
                  makeCell('Balance Due:', {
                    align: 'right',
                    bold: true,
                    color: data.balanceDue > 0 ? AMBER : EMERALD,
                    fontSize: 9.5,
                  }),
                  makeCell(formatINR(data.balanceDue), {
                    align: 'right',
                    bold: true,
                    color: data.balanceDue > 0 ? AMBER : EMERALD,
                    fontSize: 9.5,
                  }),
                ]);
                return rows;
              })(),
            },
            layout: {
              hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 1 : 0.5),
              vLineWidth: () => 0.5,
              hLineColor: () => BORDER_COLOR,
              vLineColor: () => BORDER_COLOR,
            },
          },
        ],
      },

      // Payment History if present
      ...paymentHistoryContent,

      // Signatory & Authentication Footer
      {
        margin: [0, 24, 0, 0],
        columns: [
          {
            width: '50%',
            stack: [
              { text: 'Terms of Installer Disbursement:', bold: true, fontSize: 7.5, color: GRAY },
              {
                text: '1. All payments are disbursed per verified site completion and quality inspection sign-off.',
                fontSize: 7,
                color: GRAY,
              },
              {
                text: '2. In case of outstation sites (NCR = No), travel expense bills are reconciled against verified claims.',
                fontSize: 7,
                color: GRAY,
              },
              {
                text: '3. Full payment clearance automatically triggers this official payment advice voucher.',
                fontSize: 7,
                color: GRAY,
              },
            ],
          },
          {
            width: '50%',
            alignment: 'right',
            stack: [
              { text: 'For PACIFIC PRODUCTS & SOLUTIONS', bold: true, fontSize: 8.5, color: NAVY },
              { text: '[Authorized Signatory / Accounts Desk]', fontSize: 7.5, color: GRAY, margin: [0, 28, 0, 0] },
              { text: `Generated On: ${formatDate(new Date())}`, fontSize: 7, color: GRAY },
            ],
          },
        ],
      },
    ],
    styles: {
      sectionHeader: {
        fontSize: 9,
        bold: true,
        color: NAVY,
      },
    },
  };

  const doc = pdfmake.createPdf(docDefinition);
  return await doc.getBuffer();
}
