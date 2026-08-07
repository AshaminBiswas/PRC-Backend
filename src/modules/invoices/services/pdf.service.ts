import { Invoice, InvoiceItem, Warehouse, User, Order } from '@prisma/client';
import { generateDocumentVerification } from './qr.service';

export interface FullInvoiceData extends Invoice {
  items: InvoiceItem[];
  customer?: User | null;
  warehouse?: Warehouse | null;
  order?: Order | null;
  hsnSummary?: Array<{
    hsnCode: string;
    taxableValue: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    cessAmount: number;
    totalTax: number;
  }>;
}

/**
 * Generates an Enterprise A4 Print-Ready HTML Document with Vector Branding, HSN Summaries, Bank Details, and Digital Signature Block.
 */
export const generateInvoiceHtml = async (invoice: FullInvoiceData): Promise<string> => {
  const { qrCodeDataUrl, verificationUrl } = await generateDocumentVerification(
    invoice.invoiceNumber,
    Number(invoice.grandTotal),
    invoice.createdAt.toISOString()
  );

  const titleMap: Record<string, string> = {
    TAX_INVOICE: 'TAX INVOICE',
    PROFORMA_INVOICE: 'PROFORMA INVOICE',
    QUOTATION: 'QUOTATION / ESTIMATE',
    DELIVERY_CHALLAN: 'DELIVERY CHALLAN',
    PACKING_SLIP: 'PACKING SLIP',
    PURCHASE_ORDER: 'PURCHASE ORDER',
    CREDIT_NOTE: 'CREDIT NOTE',
    DEBIT_NOTE: 'DEBIT NOTE',
    COMMERCIAL_INVOICE: 'COMMERCIAL INVOICE',
  };

  const documentTitle = titleMap[invoice.invoiceType] || 'TAX INVOICE';

  const company = {
    name: 'Pacific Hardware Enterprise',
    address: '123 Industrial Logistics Park, Peenya Phase 1, Bengaluru, Karnataka 560058',
    gstin: '29ABCDE1234F1Z5',
    pan: 'ABCDE1234F',
    cin: 'U28990KA2020PTC123456',
    email: 'billing@pacifichardware.com',
    phone: '+91 80 2345 6789',
    website: 'https://pacifichardware.com',
  };

  const bank = {
    bankName: 'HDFC Bank Ltd.',
    accountName: 'Pacific Hardware Enterprise Pvt Ltd',
    accountNumber: '50200012345678',
    ifsc: 'HDFC0001234',
    branch: 'Peenya Industrial Estate Branch, Bengaluru',
    upiId: 'pacifichardware@hdfcbank',
  };

  const itemRowsHtml = invoice.items
    .map(
      (item, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td><strong>${item.sku}</strong></td>
        <td>
          <div style="font-weight: 600;">${item.productName}</div>
          ${item.description ? `<div style="font-size: 11px; color: #64748b;">${item.description}</div>` : ''}
        </td>
        <td style="text-align: center;">${item.hsnCode || '8467'}</td>
        <td style="text-align: center;">${item.unit || 'PCS'}</td>
        <td style="text-align: right;">${item.quantity}</td>
        <td style="text-align: right;">₹${Number(item.unitPrice).toFixed(2)}</td>
        <td style="text-align: right;">₹${Number(item.discount).toFixed(2)}</td>
        <td style="text-align: right;">₹${Number(item.taxableValue).toFixed(2)}</td>
        <td style="text-align: right;">₹${(Number(item.cgstAmount) + Number(item.sgstAmount) + Number(item.igstAmount)).toFixed(2)}</td>
        <td style="text-align: right; font-weight: 600;">₹${Number(item.lineTotal).toFixed(2)}</td>
      </tr>
    `
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${documentTitle} - ${invoice.invoiceNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; padding: 15px; font-size: 12px; line-height: 1.4; background: #fff; }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
    .title-badge { font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; text-align: right; }
    .meta-box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; background: #f8fafc; margin-bottom: 15px; }
    .grid-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    .grid-table th { background: #0f172a; color: #fff; text-align: left; padding: 8px; font-size: 11px; text-transform: uppercase; }
    .grid-table td { padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
    .grid-table tr:nth-child(even) { background: #f8fafc; }
    .summary-box { width: 45%; float: right; margin-bottom: 15px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; background: #f8fafc; }
    .bank-box { width: 50%; float: left; margin-bottom: 15px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; }
    .clearfix::after { content: ""; clear: both; display: table; }
    .signature-block { border: 1px solid #94a3b8; border-radius: 6px; padding: 10px; text-align: center; background: #f1f5f9; }
  </style>
</head>
<body>

  <!-- Header -->
  <table class="header-table">
    <tr>
      <td style="width: 60%;">
        <div style="font-size: 22px; font-weight: 900; color: #0f172a;">${company.name}</div>
        <div style="font-size: 11px; color: #475569;">${company.address}</div>
        <div style="font-size: 11px; color: #475569;"><strong>GSTIN:</strong> ${company.gstin} | <strong>PAN:</strong> ${company.pan} | <strong>CIN:</strong> ${company.cin}</div>
        <div style="font-size: 11px; color: #475569;">Email: ${company.email} | Phone: ${company.phone}</div>
      </td>
      <td style="width: 40%; text-align: right; vertical-align: top;">
        <div class="title-badge">${documentTitle}</div>
        <div style="font-size: 14px; font-weight: 700; color: #2563eb; margin-top: 4px;">${invoice.invoiceNumber}</div>
        <div style="font-size: 11px; color: #64748b;">Financial Year: <strong>${invoice.financialYear}</strong></div>
        <div style="font-size: 11px; color: #64748b;">Date: <strong>${new Date(invoice.createdAt).toLocaleDateString('en-IN')}</strong></div>
        <div style="font-size: 11px; color: #64748b;">Status: <span style="font-weight: 700; color: green;">${invoice.status}</span></div>
      </td>
    </tr>
  </table>

  <!-- Customer & Warehouse Meta -->
  <div class="meta-box">
    <table style="width: 100%;">
      <tr>
        <td style="width: 50%; vertical-align: top;">
          <div style="font-weight: 700; text-transform: uppercase; color: #475569; font-size: 10px; margin-bottom: 4px;">Billed To (Customer)</div>
          <div style="font-weight: 700; font-size: 13px;">${invoice.customer ? `${invoice.customer.firstName} ${invoice.customer.lastName}` : 'Valued Customer'}</div>
          ${invoice.customer?.companyName ? `<div>${invoice.customer.companyName}</div>` : ''}
          ${invoice.customer?.gstin ? `<div><strong>Customer GSTIN:</strong> ${invoice.customer.gstin}</div>` : ''}
          <div><strong>Place of Supply:</strong> ${invoice.placeOfSupply || 'Karnataka'}</div>
        </td>
        <td style="width: 50%; vertical-align: top;">
          <div style="font-weight: 700; text-transform: uppercase; color: #475569; font-size: 10px; margin-bottom: 4px;">Dispatched From (Warehouse)</div>
          <div style="font-weight: 700; font-size: 13px;">${invoice.warehouse ? invoice.warehouse.name : 'Primary Regional Distribution Center'}</div>
          <div>${invoice.warehouse?.address || 'Industrial Zone'}</div>
          <div>${invoice.warehouse?.city || ''}, ${invoice.warehouse?.state || ''} - ${invoice.warehouse?.pincode || ''}</div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Line Items Table -->
  <table class="grid-table">
    <thead>
      <tr>
        <th style="width: 4%;">#</th>
        <th style="width: 12%;">SKU</th>
        <th style="width: 26%;">Product Name</th>
        <th style="width: 8%; text-align: center;">HSN</th>
        <th style="width: 6%; text-align: center;">Unit</th>
        <th style="width: 6%; text-align: right;">Qty</th>
        <th style="width: 8%; text-align: right;">Rate</th>
        <th style="width: 8%; text-align: right;">Disc</th>
        <th style="width: 10%; text-align: right;">Taxable</th>
        <th style="width: 12%; text-align: right;">Tax</th>
        <th style="width: 10%; text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRowsHtml}
    </tbody>
  </table>

  <!-- Summary and Bank Details -->
  <div class="clearfix">
    <div class="bank-box">
      <div style="font-weight: 700; font-size: 11px; text-transform: uppercase; margin-bottom: 6px; color: #0f172a;">Bank & Payment Details</div>
      <div><strong>Bank Name:</strong> ${bank.bankName}</div>
      <div><strong>Account Name:</strong> ${bank.accountName}</div>
      <div><strong>Account No:</strong> ${bank.accountNumber}</div>
      <div><strong>IFSC Code:</strong> ${bank.ifsc}</div>
      <div><strong>UPI ID:</strong> ${bank.upiId}</div>
    </div>

    <div class="summary-box">
      <table style="width: 100%; font-size: 11px;">
        <tr><td>Subtotal:</td><td style="text-align: right;">₹${Number(invoice.subtotal).toFixed(2)}</td></tr>
        <tr><td>Discount:</td><td style="text-align: right;">- ₹${Number(invoice.discount).toFixed(2)}</td></tr>
        <tr><td>Taxable Amount:</td><td style="text-align: right;"><strong>₹${Number(invoice.taxableAmount).toFixed(2)}</strong></td></tr>
        ${Number(invoice.cgst) > 0 ? `<tr><td>CGST:</td><td style="text-align: right;">₹${Number(invoice.cgst).toFixed(2)}</td></tr>` : ''}
        ${Number(invoice.sgst) > 0 ? `<tr><td>SGST:</td><td style="text-align: right;">₹${Number(invoice.sgst).toFixed(2)}</td></tr>` : ''}
        ${Number(invoice.igst) > 0 ? `<tr><td>IGST:</td><td style="text-align: right;">₹${Number(invoice.igst).toFixed(2)}</td></tr>` : ''}
        ${Number(invoice.cess) > 0 ? `<tr><td>CESS:</td><td style="text-align: right;">₹${Number(invoice.cess).toFixed(2)}</td></tr>` : ''}
        <tr><td>Round Off:</td><td style="text-align: right;">₹${Number(invoice.roundOff).toFixed(2)}</td></tr>
        <tr style="font-size: 13px; font-weight: 800; border-top: 2px solid #0f172a;">
          <td style="padding-top: 6px;">Grand Total:</td>
          <td style="text-align: right; padding-top: 6px; color: #059669;">₹${Number(invoice.grandTotal).toFixed(2)}</td>
        </tr>
      </table>
    </div>
  </div>

  <div style="font-weight: 700; font-size: 11px; margin-bottom: 15px; background: #e2e8f0; padding: 6px 10px; border-radius: 4px;">
    Amount in Words: <em>${invoice.amountInWords || 'Rupees Only'}</em>
  </div>

  <!-- Verification & Signature Footer -->
  <table style="width: 100%; border-top: 1px solid #cbd5e1; padding-top: 10px; margin-top: 15px;">
    <tr>
      <td style="width: 25%; text-align: center; vertical-align: top;">
        <img src="${qrCodeDataUrl}" style="width: 100px; height: 100px;" alt="QR Verification" />
        <div style="font-size: 9px; color: #64748b; margin-top: 4px;">Scan to Verify Authenticity</div>
      </td>
      <td style="width: 45%; vertical-align: top; font-size: 10px; color: #475569; padding-left: 10px;">
        <div><strong>Document SHA-256 Hash:</strong></div>
        <div style="font-family: monospace; font-size: 9px; word-break: break-all; color: #0f172a;">${invoice.documentHash}</div>
        <div style="margin-top: 6px;"><strong>Verification ID:</strong> ${invoice.verificationId}</div>
        <div><strong>Public Verification Link:</strong> <a href="${verificationUrl}">${verificationUrl}</a></div>
      </td>
      <td style="width: 30%; vertical-align: top;">
        <div class="signature-block">
          <div style="font-size: 10px; color: #64748b; font-weight: 700;">DIGITALLY SIGNED DOCUMENT</div>
          <div style="font-size: 12px; font-weight: 800; color: #0f172a; margin: 6px 0;">Pacific Hardware Admin</div>
          <div style="font-size: 9px; color: #059669;">Status: ${invoice.digitalSignatureStatus}</div>
          <div style="font-size: 8px; color: #94a3b8;">${new Date().toISOString()}</div>
        </div>
      </td>
    </tr>
  </table>

</body>
</html>
  `;
};
