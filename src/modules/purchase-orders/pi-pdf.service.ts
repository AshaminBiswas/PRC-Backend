/**
 * pi-pdf.service.ts
 *
 * Production-grade Proforma Invoice (PI) PDF generation for B2B Purchase Orders using pdfmake.
 * Generates an official commercial Proforma Invoice prior to dispatch with itemized pricing,
 * GST breakdown, advance adjustment, balance payable, and bank RTGS/NEFT coordinates.
 */

import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require('pdfmake');
import type { TDocumentDefinitions, Margins, TableCell } from 'pdfmake/interfaces';

// Configure fonts from pdfmake package
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
  console.warn('[PI PDF] Font initialization warning:', e?.message || e);
}

// Brand Colours
const NAVY = '#0f172a';
const AMBER = '#b45309';
const BLUE = '#1d4ed8';
const GREEN = '#065f46';
const LIGHT_BG = '#f8fafc';
const BORDER = '#e2e8f0';
const GRAY = '#64748b';
const TABLE_HEADER_BG = '#1e293b';

function formatCurrency(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(Number(num))) return '₹0.00';
  return `₹${Number(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  } = {}
): TableCell {
  return {
    text,
    bold: options.bold ?? false,
    alignment: options.align ?? 'left',
    color: options.color ?? '#1e293b',
    fillColor: options.fillColor,
    fontSize: options.fontSize ?? 8.5,
    margin: [4, 4, 4, 4] as Margins,
    colSpan: options.colSpan,
  };
}

export interface ProformaInvoicePdfData {
  piNumber: string;
  poNumber: string;
  quotationNumber?: string | null;
  customerPoReferenceNumber?: string | null;
  issuedAt: Date | string;
  validUntil?: Date | string | null;
  customerName: string;
  customerCompany?: string | null;
  customerEmail: string;
  customerPhone: string;
  customerGstin?: string | null;
  billingAddress: any;
  deliveryAddress: any;
  items: Array<{
    slNo: number;
    productName: string;
    sku?: string | null;
    hsnCode?: string | null;
    unit: string;
    quantity: number;
    rate: number;
    amount: number;
    taxRate?: number;
    taxAmount?: number;
    total: number;
  }>;
  subtotal: number;
  taxTotal: number;
  discountTotal?: number;
  shippingCost?: number;
  grandTotal: number;
  advanceAmountRequired: number;
  advancePercentage?: number;
  advanceAmountPaid?: number;
  balanceDue: number;
  bankDetails?: {
    accountHolderName: string;
    bankName: string;
    accountNumber: string;
    ifscOrRoutingNumber: string;
    branch?: string | null;
    swiftCode?: string | null;
  };
}

export const generateProformaInvoicePdfBuffer = async (
  data: ProformaInvoicePdfData
): Promise<Buffer> => {
  const itemRows: TableCell[][] = [
    [
      makeCell('#', { bold: true, align: 'center', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('Item Description', { bold: true, color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('HSN / SKU', { bold: true, align: 'center', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('Qty', { bold: true, align: 'center', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('Unit Rate', { bold: true, align: 'right', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('GST %', { bold: true, align: 'center', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
      makeCell('Amount', { bold: true, align: 'right', color: '#ffffff', fillColor: TABLE_HEADER_BG }),
    ],
  ];

  data.items.forEach((item, index) => {
    const isEven = index % 2 === 0;
    const rowBg = isEven ? '#ffffff' : LIGHT_BG;
    const hsnSku = [item.hsnCode ? `HSN: ${item.hsnCode}` : '', item.sku || ''].filter(Boolean).join('\n') || '—';

    itemRows.push([
      makeCell(String(item.slNo || index + 1), { align: 'center', fillColor: rowBg }),
      makeCell(item.productName, { bold: true, fillColor: rowBg }),
      makeCell(hsnSku, { align: 'center', color: GRAY, fontSize: 7.5, fillColor: rowBg }),
      makeCell(`${item.quantity} ${item.unit || 'PCS'}`, { align: 'center', bold: true, fillColor: rowBg }),
      makeCell(formatCurrency(item.rate), { align: 'right', fillColor: rowBg }),
      makeCell(item.taxRate ? `${item.taxRate}%` : '18%', { align: 'center', color: GRAY, fillColor: rowBg }),
      makeCell(formatCurrency(item.total || item.amount), { align: 'right', bold: true, fillColor: rowBg }),
    ]);
  });

  const billTo = data.billingAddress || {};
  const shipTo = data.deliveryAddress || billTo;

  const docDefinition = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [36, 36, 36, 44] as Margins,
    defaultStyle: {
      font: 'Roboto',
      fontSize: 8.5,
      color: NAVY,
      lineHeight: 1.2,
    },
    content: [
      // Top Header
      {
        columns: [
          {
            width: '55%',
            stack: [
              { text: 'PRC HARDWARE ENTERPRISE', fontSize: 16, bold: true, color: NAVY },
              { text: 'Architectural Hardware & Glass Fitting Systems', fontSize: 8, color: AMBER, bold: true, margin: [0, 2, 0, 4] },
              { text: 'Corporate Desk: Mandoli Industrial Area, Delhi - 110093, India', fontSize: 7.5, color: GRAY },
              { text: 'GSTIN: 07AAECP1234F1Z5 | PAN: AAECP1234F | Email: b2b@prchardware.com', fontSize: 7.5, color: GRAY },
            ],
          },
          {
            width: '45%',
            stack: [
              {
                table: {
                  widths: ['100%'],
                  body: [
                    [
                      {
                        fillColor: '#eff6ff',
                        margin: [8, 6, 8, 6],
                        stack: [
                          { text: 'PROFORMA INVOICE', fontSize: 13, bold: true, color: BLUE, alignment: 'right' },
                          { text: `PI Ref: ${data.piNumber}`, fontSize: 10, bold: true, color: NAVY, alignment: 'right', margin: [0, 2, 0, 2] },
                          { text: `Date: ${formatDate(data.issuedAt)}`, fontSize: 8, color: GRAY, alignment: 'right' },
                          ...(data.validUntil ? [{ text: `Valid Until: ${formatDate(data.validUntil)}`, fontSize: 8, color: AMBER, alignment: 'right' }] : []),
                        ],
                      },
                    ],
                  ],
                },
                layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#bfdbfe', vLineColor: () => '#bfdbfe' },
              },
            ],
          },
        ],
        margin: [0, 0, 0, 14],
      },

      // Reference Grid
      {
        table: {
          widths: ['25%', '25%', '25%', '25%'],
          body: [
            [
              { text: 'Master PO Number', fontSize: 7.5, bold: true, color: GRAY, fillColor: '#f1f5f9' },
              { text: 'Quotation Ref', fontSize: 7.5, bold: true, color: GRAY, fillColor: '#f1f5f9' },
              { text: 'Client PO Reference', fontSize: 7.5, bold: true, color: GRAY, fillColor: '#f1f5f9' },
              { text: 'Payment Terms', fontSize: 7.5, bold: true, color: GRAY, fillColor: '#f1f5f9' },
            ],
            [
              { text: data.poNumber, fontSize: 8.5, bold: true, color: NAVY },
              { text: data.quotationNumber || '—', fontSize: 8.5, color: NAVY },
              { text: data.customerPoReferenceNumber || '—', fontSize: 8.5, color: NAVY },
              { text: `${data.advancePercentage || 30}% Advance / Balance On Dispatch`, fontSize: 8, bold: true, color: BLUE },
            ],
          ],
        },
        layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => BORDER, vLineColor: () => BORDER },
        margin: [0, 0, 0, 12],
      },

      // Addresses
      {
        columns: [
          {
            width: '50%',
            stack: [
              { text: 'BUYER / BILLED TO:', fontSize: 8, bold: true, color: GRAY },
              { text: data.customerCompany || data.customerName, fontSize: 9.5, bold: true, color: NAVY, margin: [0, 2, 0, 1] },
              { text: billTo.addressLine1 || '—', fontSize: 8, color: '#334155' },
              ...(billTo.addressLine2 ? [{ text: billTo.addressLine2, fontSize: 8, color: '#334155' }] : []),
              { text: `${billTo.city || ''}, ${billTo.state || ''} - ${billTo.postalCode || ''}`, fontSize: 8, color: '#334155' },
              { text: `Contact: ${data.customerPhone || billTo.phone || '—'} | Email: ${data.customerEmail || billTo.email || '—'}`, fontSize: 7.5, color: GRAY, margin: [0, 2, 0, 0] },
              { text: `GSTIN: ${data.customerGstin || billTo.gstin || 'Unregistered'}`, fontSize: 8, bold: true, color: data.customerGstin ? NAVY : GRAY },
            ],
          },
          {
            width: '50%',
            stack: [
              { text: 'CONSIGNEE / SHIPPED TO:', fontSize: 8, bold: true, color: GRAY },
              { text: shipTo.companyName || shipTo.attentionTo || data.customerName, fontSize: 9.5, bold: true, color: NAVY, margin: [0, 2, 0, 1] },
              { text: shipTo.addressLine1 || '—', fontSize: 8, color: '#334155' },
              ...(shipTo.addressLine2 ? [{ text: shipTo.addressLine2, fontSize: 8, color: '#334155' }] : []),
              { text: `${shipTo.city || ''}, ${shipTo.state || ''} - ${shipTo.postalCode || ''}`, fontSize: 8, color: '#334155' },
              { text: `Attention: ${shipTo.attentionTo || data.customerName} (${shipTo.phone || data.customerPhone || '—'})`, fontSize: 7.5, color: GRAY, margin: [0, 2, 0, 0] },
            ],
          },
        ],
        margin: [0, 0, 0, 14],
      },

      // Line Items Table
      {
        table: {
          headerRows: 1,
          widths: [20, '*', 70, 50, 60, 40, 65],
          body: itemRows,
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0,
          hLineColor: () => BORDER,
        },
        margin: [0, 0, 0, 12],
      },

      // Financial Calculation Summary
      {
        columns: [
          {
            width: '55%',
            stack: [
              { text: 'BANK PAYMENT COORDINATES (RTGS / NEFT / IMPS):', fontSize: 8, bold: true, color: NAVY },
              {
                table: {
                  widths: ['35%', '65%'],
                  body: [
                    [{ text: 'Account Name', color: GRAY }, { text: data.bankDetails?.accountHolderName || 'PRC Hardware Enterprise Pvt Ltd', bold: true }],
                    [{ text: 'Bank Name', color: GRAY }, { text: data.bankDetails?.bankName || 'HDFC Bank Ltd', bold: true }],
                    [{ text: 'Account Number', color: GRAY }, { text: data.bankDetails?.accountNumber || '50200088991122', bold: true, color: BLUE }],
                    [{ text: 'IFSC Code', color: GRAY }, { text: data.bankDetails?.ifscOrRoutingNumber || 'HDFC0001234', bold: true }],
                    [{ text: 'Branch', color: GRAY }, { text: data.bankDetails?.branch || 'Mandoli Industrial Area, Delhi' }],
                  ],
                },
                layout: { hLineWidth: () => 0.5, vLineWidth: () => 0, hLineColor: () => BORDER },
                margin: [0, 3, 0, 0],
              },
            ],
          },
          {
            width: '45%',
            table: {
              widths: ['55%', '45%'],
              body: [
                [{ text: 'Subtotal (Taxable Value)', color: GRAY }, { text: formatCurrency(data.subtotal), alignment: 'right' }],
                ...(data.discountTotal ? [[{ text: 'Discount Total', color: GRAY }, { text: `-${formatCurrency(data.discountTotal)}`, alignment: 'right', color: '#16a34a' }]] : []),
                [{ text: 'Goods & Services Tax (GST)', color: GRAY }, { text: formatCurrency(data.taxTotal), alignment: 'right' }],
                [{ text: 'Shipping & Freight', color: GRAY }, { text: data.shippingCost ? formatCurrency(data.shippingCost) : 'Included', alignment: 'right' }],
                [
                  { text: 'TOTAL COMMERCIAL VALUE', bold: true, color: NAVY, fillColor: '#f1f5f9' },
                  { text: formatCurrency(data.grandTotal), bold: true, alignment: 'right', color: NAVY, fillColor: '#f1f5f9' },
                ],
                [
                  { text: `Advance Required (${data.advancePercentage || 30}%)`, bold: true, color: BLUE },
                  { text: formatCurrency(data.advanceAmountRequired), bold: true, alignment: 'right', color: BLUE },
                ],
                [
                  { text: 'Balance Payable on Dispatch', bold: true, color: AMBER },
                  { text: formatCurrency(data.balanceDue), bold: true, alignment: 'right', color: AMBER },
                ],
              ],
            },
            layout: { hLineWidth: () => 0.5, vLineWidth: () => 0, hLineColor: () => BORDER },
          },
        ],
        margin: [0, 0, 0, 14],
      },

      // Terms & Authorized Signatory
      {
        columns: [
          {
            width: '60%',
            stack: [
              { text: 'TERMS & COMMERCIAL CONDITIONS', fontSize: 8, bold: true, color: NAVY },
              { text: '1. This Proforma Invoice is a commercial demand note for advance payment.', fontSize: 7, color: GRAY, margin: [0, 2, 0, 0] },
              { text: '2. Formal GST Tax Invoice and E-Way Bill will be issued upon warehouse allocation and dispatch.', fontSize: 7, color: GRAY },
              { text: '3. Production and dispatch will be scheduled upon receipt confirmation of required advance amount.', fontSize: 7, color: GRAY },
            ],
          },
          {
            width: '40%',
            stack: [
              {
                table: {
                  widths: ['100%'],
                  body: [
                    [
                      {
                        fillColor: '#f8fafc',
                        margin: [8, 6, 8, 6],
                        stack: [
                          { text: 'AUTHORIZED SIGNATORY', fontSize: 7, bold: true, color: GRAY, alignment: 'center' },
                          { text: 'PRC Hardware Commercial Operations', fontSize: 8, bold: true, color: NAVY, alignment: 'center', margin: [0, 14, 0, 2] },
                          { text: `Digitally Generated on ${formatDate(data.issuedAt)}`, fontSize: 6.5, color: GREEN, alignment: 'center' },
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
    footer: (currentPage: number, pageCount: number) => ({
      margin: [36, 0, 36, 0] as Margins,
      columns: [
        { text: `Proforma Invoice: ${data.piNumber} | Master PO: ${data.poNumber}`, fontSize: 7, color: GRAY },
        { text: `Page ${currentPage} of ${pageCount}`, fontSize: 7, color: GRAY, alignment: 'right' },
      ],
    }),
  };

  const doc = pdfmake.createPdf(docDefinition as unknown as TDocumentDefinitions);
  return await doc.getBuffer();
};
