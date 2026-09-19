/**
 * purchase-order-pdf.service.ts
 *
 * Production-grade Purchase Order PDF Generator.
 * Strict Pure Black & White (Monochrome) Design mirroring the Proforma Invoice layout:
 * - High contrast black text (#000000)
 * - Solid black dividing rules and table grid (#000000 / #333333)
 * - Clean white / neutral table background (#F2F2F2 / #FFFFFF)
 * - Letterhead with Brand Logo (Pacific Products & Solutions or PRC Hardware)
 * - Two-column dossier: Vendor Block (Left) + Ship-To Branch Block (Right)
 * - Line item table with HSN codes, quantity, unit rate, and GST breakup
 * - Terms & conditions and dual signatory blocks
 */

import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require('pdfmake');
import type { TDocumentDefinitions, Content, StyleDictionary, TableCell, Alignment } from 'pdfmake/interfaces';
import { PRC_LOGO_DATA_URL } from '../../assets/logo.base64';
import { PACIFIC_LOGO_DATA_URL } from '../../assets/pacific_logo.base64';

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
  console.warn('[PO PDF Service] Font initialization warning:', e?.message || e);
}

// ── Strict Pure Black & White Palette ─────────────────────────────────────────
const BLACK = '#000000';
const DARK_GRAY = '#222222';
const MUTED_GRAY = '#444444';
const LIGHT_BG = '#F2F2F2';
const BORDER_BLACK = '#000000';

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
    italics?: boolean;
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
    italics: options.italics,
  } as TableCell;
}

export interface PurchaseOrderPdfData {
  id: string;
  poNumber: string;
  revision?: number;
  financialYear: string;
  companyEntity?: string;
  companyLogo?: string;
  issueDate: Date | string;
  expectedDeliveryDate?: Date | string | null;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  termsAndConditions?: string | null;
  subtotal: number;
  discountTotal: number;
  taxableAmount: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  grandTotal: number;
  totalInWords?: string | null;
  isInterState: boolean;
  notes?: string | null;
  supplier: {
    name: string;
    contactPerson?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    gstNumber?: string | null;
  };
  branch: {
    name: string;
    code?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    gstin?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  items: Array<{
    itemSku: string;
    itemName: string;
    description?: string | null;
    hsnCode?: string | null;
    quantity: number;
    unit: string;
    unitRate: number;
    discountPercent: number;
    taxableAmount: number;
    gstRate: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    lineTotal: number;
  }>;
}

/**
 * Company profile presets
 */
export const COMPANY_PROFILES: Record<string, {
  name: string;
  title: string;
  gstin: string;
  address: string;
  phone: string;
  email: string;
  signatory: string;
}> = {
  PACIFIC_PRODUCTS: {
    name: 'Pacific Products & Solutions',
    title: 'PACIFIC PRODUCTS & SOLUTIONS',
    gstin: '07AADFP3948F1Z1',
    address: 'H-3, J.R. Complex, Gate No 4, Mela Ram Farm, Mandoli, Delhi - 110093',
    phone: '+91 98185 92113 / +91 11 2233 4455',
    email: 'billing@pacifichardware.com',
    signatory: 'Pacific Products & Solutions, Delhi',
  },
  PRC_HARDWARE: {
    name: 'PRC Hardware',
    title: 'PRC HARDWARE (Pacific Rehousing Corp.)',
    gstin: '07AABCP1234F1Z9',
    address: 'H-5, J.R. Complex, Melaram Farm Gate No. 4, Sewa Dham Rd, Mandoli, Delhi 201102',
    phone: '+91 98185 92113',
    email: 'purchase@prchardware.com',
    signatory: 'PRC Hardware, Delhi',
  },
};

/**
 * Generates a pure black & white print-ready Purchase Order PDF Buffer.
 */
export async function generatePurchaseOrderPdfBuffer(po: PurchaseOrderPdfData): Promise<Buffer> {
  const entityKey = (po.companyEntity || 'PACIFIC_PRODUCTS').toUpperCase();
  const profile = COMPANY_PROFILES[entityKey] || COMPANY_PROFILES.PACIFIC_PRODUCTS;

  // Determine Logo
  const logoChoice = po.companyLogo || (entityKey === 'PRC_HARDWARE' ? 'prc' : 'pacific');
  const selectedLogoDataUrl = logoChoice === 'prc' ? PRC_LOGO_DATA_URL : PACIFIC_LOGO_DATA_URL;

  const fullPoNumber = po.revision && po.revision > 0 ? `${po.poNumber}-R${po.revision}` : po.poNumber;
  const isInterState = Boolean(po.isInterState || Number(po.igstTotal || 0) > 0);

  // Line items table
  const itemRows: TableCell[][] = [
    [
      makeCell('Sr.', { bold: true, align: 'center', fillColor: LIGHT_BG, fontSize: 8 }),
      makeCell('Item / SKU', { bold: true, fillColor: LIGHT_BG, fontSize: 8 }),
      makeCell('HSN', { bold: true, align: 'center', fillColor: LIGHT_BG, fontSize: 8 }),
      makeCell('Qty', { bold: true, align: 'right', fillColor: LIGHT_BG, fontSize: 8 }),
      makeCell('Unit', { bold: true, align: 'center', fillColor: LIGHT_BG, fontSize: 8 }),
      makeCell('Rate', { bold: true, align: 'right', fillColor: LIGHT_BG, fontSize: 8 }),
      makeCell('Taxable', { bold: true, align: 'right', fillColor: LIGHT_BG, fontSize: 8 }),
      makeCell('GST', { bold: true, align: 'center', fillColor: LIGHT_BG, fontSize: 8 }),
      makeCell('Amount (\u20B9)', { bold: true, align: 'right', fillColor: LIGHT_BG, fontSize: 8 }),
    ],
  ];

  po.items.forEach((item, idx) => {
    itemRows.push([
      makeCell(String(idx + 1), { align: 'center', fontSize: 8 }),
      {
        stack: [
          { text: item.itemName, bold: true, fontSize: 8.5, color: BLACK },
          { text: `SKU: ${item.itemSku}${item.description ? ` | ${item.description}` : ''}`, fontSize: 7.5, color: MUTED_GRAY, margin: [0, 1, 0, 0] },
        ],
        margin: [4, 4, 4, 4],
      } as TableCell,
      makeCell(item.hsnCode || '8302', { align: 'center', fontSize: 7.5 }),
      makeCell(String(item.quantity), { align: 'right', bold: true, fontSize: 8.5 }),
      makeCell(item.unit || 'PCS', { align: 'center', fontSize: 7.5 }),
      makeCell(formatINR(item.unitRate), { align: 'right', fontSize: 8 }),
      makeCell(formatINR(item.taxableAmount), { align: 'right', fontSize: 8 }),
      makeCell(`${Number(item.gstRate || 18)}%`, { align: 'center', fontSize: 7.5 }),
      makeCell(formatINR(item.lineTotal), { align: 'right', bold: true, fontSize: 8.5 }),
    ]);
  });

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [28, 24, 28, 24],

    content: [
      // ── Header: Logo (Left) + Company Info (Center) + PO Meta (Right) ──────
      {
        table: {
          widths: ['18%', '52%', '30%'],
          body: [
            [
              {
                image: selectedLogoDataUrl,
                fit: [70, 70],
                alignment: 'left',
              },
              {
                stack: [
                  { text: profile.title, bold: true, fontSize: 13, color: BLACK, margin: [0, 0, 0, 2] },
                  { text: profile.address, fontSize: 8.5, color: DARK_GRAY, margin: [0, 0, 0, 1.5] },
                  { text: `GSTIN: ${profile.gstin}  |  Email: ${profile.email}`, fontSize: 8.5, color: DARK_GRAY, margin: [0, 0, 0, 1] },
                  { text: `Phone: ${profile.phone}`, fontSize: 8.5, color: DARK_GRAY },
                ],
                alignment: 'left',
                margin: [4, 0, 0, 0],
              },
              {
                stack: [
                  { text: 'PURCHASE ORDER', bold: true, fontSize: 14, alignment: 'right', color: BLACK, margin: [0, 0, 0, 2] },
                  { text: `PO #: ${fullPoNumber}`, bold: true, fontSize: 10, alignment: 'right', color: BLACK, margin: [0, 0, 0, 2] },
                  { text: `Date: ${formatDate(po.issueDate)}`, fontSize: 8.5, alignment: 'right', color: DARK_GRAY },
                  {
                    text: `Delivery Due: ${po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : 'Within 10 Days'}`,
                    fontSize: 8,
                    bold: true,
                    alignment: 'right',
                    color: DARK_GRAY,
                  },
                ],
              },
            ],
          ],
        },
        layout: 'noBorders',
      },

      // Solid dividing rule
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 539, y2: 0, lineWidth: 1.2, lineColor: BORDER_BLACK }],
        margin: [0, 6, 0, 6],
      },

      // ── Two Column Dossier: Vendor (Left) vs Ship-To Branch (Right) ──────────
      {
        table: {
          widths: ['49%', '2%', '49%'],
          body: [
            [
              {
                stack: [
                  { text: 'VENDOR / SUPPLIER DETAILS', bold: true, fontSize: 9, color: BLACK, margin: [0, 0, 0, 3] },
                  { text: po.supplier.name, bold: true, fontSize: 10.5, color: BLACK, margin: [0, 0, 0, 2] },
                  { text: po.supplier.address || 'Address on file', fontSize: 8.5, color: DARK_GRAY, margin: [0, 0, 0, 1.5] },
                  { text: `Contact: ${po.supplier.contactPerson || 'Purchasing Desk'} ${po.supplier.phone ? `(${po.supplier.phone})` : ''}`, fontSize: 8.5, color: DARK_GRAY, margin: [0, 0, 0, 1.5] },
                  { text: `GSTIN: ${po.supplier.gstNumber || 'Unregistered / Not Provided'}`, bold: true, fontSize: 8.5, color: BLACK, margin: [0, 0, 0, 1.5] },
                  { text: `Email: ${po.supplier.email || 'N/A'}`, fontSize: 8.5, color: DARK_GRAY },
                ],
                fillColor: LIGHT_BG,
                margin: [6, 6, 6, 6],
              },
              { text: '' },
              {
                stack: [
                  { text: 'SHIP-TO / DELIVERY LOCATION', bold: true, fontSize: 9, color: BLACK, margin: [0, 0, 0, 3] },
                  { text: `${po.branch.name} Depot`, bold: true, fontSize: 10.5, color: BLACK, margin: [0, 0, 0, 2] },
                  { text: po.branch.address || profile.address, fontSize: 8.5, color: DARK_GRAY, margin: [0, 0, 0, 1.5] },
                  { text: `${po.branch.city || 'Delhi'}, ${po.branch.state || 'Delhi'}`, fontSize: 8.5, color: DARK_GRAY, margin: [0, 0, 0, 1.5] },
                  { text: `Receiving GSTIN: ${po.branch.gstin || profile.gstin}`, bold: true, fontSize: 8.5, color: BLACK, margin: [0, 0, 0, 1.5] },
                  { text: `Depot Contact: ${po.branch.phone || profile.phone}`, fontSize: 8.5, color: DARK_GRAY },
                ],
                fillColor: LIGHT_BG,
                margin: [6, 6, 6, 6],
              },
            ],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 6],
      },

      // Thin dividing rule
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 539, y2: 0, lineWidth: 0.8, lineColor: BORDER_BLACK }],
        margin: [0, 2, 0, 6],
      },

      // ── Line Items Table ───────────────────────────────────────────────────
      {
        table: {
          headerRows: 1,
          widths: ['5%', '33%', '9%', '8%', '7%', '12%', '12%', '6%', '14%'],
          body: itemRows,
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => BORDER_BLACK,
          vLineColor: () => BORDER_BLACK,
          paddingLeft: () => 3,
          paddingRight: () => 3,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
        margin: [0, 0, 0, 6],
      },

      // ── Bottom Summary: Terms & Notes (Left) + Tax Calculation (Right) ─────
      {
        table: {
          widths: ['54%', '2%', '44%'],
          body: [
            [
              // Terms & Notes Left
              {
                stack: [
                  { text: 'TERMS & CONDITIONS', bold: true, fontSize: 8.5, color: BLACK, margin: [0, 0, 0, 3] },
                  {
                    text: [
                      `1. Payment Terms: ${po.paymentTerms || '30 days from clear physical material receipt and tax invoice submission.'}\n`,
                      `2. Delivery Terms: ${po.deliveryTerms || 'Door delivery at destination branch with freight paid by supplier.'}\n`,
                      `3. Quality & Inspection: Material subject to factory incoming QC. Rejected items to be replaced within 7 days at vendor cost.\n`,
                      `4. Statutory: Taxes charged strictly per valid GST rules. HSN codes must match vendor delivery challan and invoice.`,
                    ],
                    fontSize: 7.5,
                    color: DARK_GRAY,
                    lineHeight: 1.3,
                  },
                  po.notes ? {
                    stack: [
                      { text: 'Special Instructions:', bold: true, fontSize: 8, color: BLACK, margin: [0, 4, 0, 1] },
                      { text: po.notes, fontSize: 7.5, color: MUTED_GRAY, italics: true },
                    ],
                  } : { text: '' },
                ],
              },
              { text: '' },
              // Tax Breakdown Table Right
              {
                table: {
                  widths: ['58%', '42%'],
                  body: [
                    [
                      makeCell('Subtotal (Taxable):', { fontSize: 8 }),
                      makeCell(formatINR(po.taxableAmount), { align: 'right', bold: true, fontSize: 8 }),
                    ],
                    ...(isInterState
                      ? [
                          [
                            makeCell('IGST (Integrated Tax):', { fontSize: 8 }),
                            makeCell(formatINR(po.igstTotal), { align: 'right', fontSize: 8 }),
                          ],
                        ]
                      : [
                          [
                            makeCell('CGST (Central Tax):', { fontSize: 8 }),
                            makeCell(formatINR(po.cgstTotal), { align: 'right', fontSize: 8 }),
                          ],
                          [
                            makeCell('SGST (State Tax):', { fontSize: 8 }),
                            makeCell(formatINR(po.sgstTotal), { align: 'right', fontSize: 8 }),
                          ],
                        ]),
                    [
                      makeCell('TOTAL ORDER VALUE:', { bold: true, fontSize: 9.5, color: BLACK, fillColor: LIGHT_BG }),
                      makeCell(formatINR(po.grandTotal), { bold: true, align: 'right', fontSize: 10.5, color: BLACK, fillColor: LIGHT_BG }),
                    ],
                  ],
                },
                layout: {
                  hLineWidth: () => 0.4,
                  vLineWidth: () => 0.4,
                  hLineColor: () => '#444444',
                  vLineColor: () => '#444444',
                },
              },
            ],
          ],
        },
        layout: 'noBorders',
        margin: [0, 2, 0, 6],
      },

      // Amount in words
      {
        table: {
          widths: ['100%'],
          body: [
            [
              {
                text: `Amount in Words: ${po.totalInWords || 'Indian Rupees Only'}`,
                bold: true,
                fontSize: 8,
                color: BLACK,
                fillColor: LIGHT_BG,
                margin: [4, 3, 4, 3],
              },
            ],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 16],
      },

      // ── Dual Signatory Blocks at Bottom ─────────────────────────────────────
      {
        table: {
          widths: ['48%', '4%', '48%'],
          body: [
            [
              // Vendor Acceptance
              {
                stack: [
                  { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.8, lineColor: BORDER_BLACK }], margin: [0, 28, 0, 4] },
                  { text: 'Vendor Acceptance & Signature', bold: true, fontSize: 8.5, color: BLACK },
                  { text: 'Authorised Representative with Firm Stamp', fontSize: 7.5, color: MUTED_GRAY },
                ],
              },
              { text: '' },
              // Company Signatory
              {
                stack: [
                  { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.8, lineColor: BORDER_BLACK }], margin: [0, 28, 0, 4] },
                  { text: `For ${profile.signatory}`, bold: true, fontSize: 8.5, color: BLACK },
                  { text: 'Authorised Signatory (Procurement Desk)', fontSize: 7.5, color: MUTED_GRAY },
                ],
              },
            ],
          ],
        },
        layout: 'noBorders',
      },

      // Footer
      {
        table: {
          widths: ['50%', '50%'],
          body: [
            [
              { text: `Ref: ${fullPoNumber}  |  Computer Generated Purchase Order`, fontSize: 7, color: MUTED_GRAY },
              { text: 'Page 1 of 1', fontSize: 7, color: MUTED_GRAY, alignment: 'right' },
            ],
          ],
        },
        layout: 'noBorders',
        margin: [0, 16, 0, 0],
      },
    ],

    styles: {
      tableHeader: {
        bold: true,
        fontSize: 8.5,
        color: BLACK,
        fillColor: LIGHT_BG,
      },
    } as StyleDictionary,
  };

  const doc = pdfmake.createPdf(docDefinition);
  const buffer: Buffer = await doc.getBuffer();
  return buffer;
}
