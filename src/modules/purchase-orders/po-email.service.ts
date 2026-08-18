import { sendMail } from '../../utils/email.utils';
import { env } from '../../config/env';
import prisma from '../../config/database';
import { PoNotificationType, PoNotificationStatus } from '@prisma/client';

interface AdvancePaymentEmailContext {
  poId: string;
  to: string;
  customerName: string;
  companyName?: string;
  poNumber: string;
  quotationNumber: string;
  totalAmount: number;
  currency: string;
  advancePercentage: number;
  advanceAmount: number;
  balanceAmount: number;
  dueDate?: string;
  bankDetails: {
    accountHolderName: string;
    bankName: string;
    accountNumber: string;
    ifscOrRoutingNumber: string;
    swiftCode?: string | null;
    branch?: string | null;
  };
}

interface PaymentAcknowledgedEmailContext {
  poId: string;
  to: string;
  customerName: string;
  poNumber: string;
  quotationNumber: string;
  amountReceived: number;
  currency: string;
  paymentDate: string;
  paymentReference: string;
  paymentMethod: string;
  balanceAmount: number;
  remarks?: string | null;
}

interface PackingListReadyEmailContext {
  poId: string;
  to: string;
  customerName: string;
  poNumber: string;
  quotationNumber: string;
  totalPackages?: number;
  totalQuantity: number;
}

export interface InvoiceReadyEmailContext {
  poId: string;
  poNumber: string;
  quotationNumber: string;
  invoiceNumber: string;
  customerEmail: string;
  customerName: string;
  totalAmount: number;
  amountPaidAdvance: number;
  balanceDue: number;
  carrierName?: string;
  trackingNumber?: string | null;
}

const formatCurrency = (val: number, cur = 'INR') => {
  return `${cur === 'INR' ? '₹' : cur + ' '}${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const basePoEmailTemplate = (title: string, bodyContent: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title} - PRC Hardware</title>
  <style>
    body { font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 620px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
    .header { background: #0f172a; padding: 28px; text-align: center; border-bottom: 3px solid #f59e0b; }
    .header h1 { color: #f59e0b; margin: 0; font-size: 22px; letter-spacing: 0.5px; font-weight: 800; }
    .header p { color: #94a3b8; margin: 4px 0 0 0; font-size: 11px; }
    .body { padding: 32px 28px; color: #1e293b; line-height: 1.6; }
    .ref-badge { display: inline-block; background: #f1f5f9; color: #0f172a; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-family: monospace; font-size: 14px; border: 1px solid #cbd5e1; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 18px; margin: 20px 0; }
    .bank-card { background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #16a34a; border-radius: 6px; padding: 18px; margin: 20px 0; }
    .btn-primary { display: inline-block; margin: 20px 0; padding: 14px 28px; background: #f59e0b; color: #0f172a; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; text-align: center; }
    .footer { background: #0f172a; padding: 20px; text-align: center; font-size: 11px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>PRC Hardware</h1>
      <p>H -3, J.R. COMPLEX GATE NO 4, MELA RAM FARM, MANDOLI, DELHI 110093, INDIA</p>
    </div>
    <div class="body">
      ${bodyContent}
    </div>
    <div class="footer">
      PRC Hardware &bull; Official Purchase Order System &bull; support@pacifichardware.com
    </div>
  </div>
</body>
</html>`;

/**
 * 1. Sends Advance Payment Request Email with Bank Details
 */
export const sendAdvancePaymentRequestEmail = async (ctx: AdvancePaymentEmailContext): Promise<void> => {
  const uploadLink = `${env.frontend.url}/purchase-orders/${ctx.poId}`;

  const content = `
    <h2 style="margin-top:0; color:#0f172a;">Advance Payment Required for Purchase Order</h2>
    <p>Dear <strong>${ctx.customerName}</strong> ${ctx.companyName ? `(${ctx.companyName})` : ''},</p>
    <p>Your Purchase Order <strong>${ctx.poNumber}</strong> against Quotation <strong>${ctx.quotationNumber}</strong> has been validated and accepted by PRC Hardware.</p>
    
    <div class="info-card">
      <p style="margin: 4px 0;"><strong>Purchase Order No:</strong> <span class="ref-badge">${ctx.poNumber}</span></p>
      <p style="margin: 4px 0;"><strong>Quotation Ref No:</strong> ${ctx.quotationNumber}</p>
      <p style="margin: 4px 0;"><strong>Total PO Amount:</strong> ${formatCurrency(ctx.totalAmount, ctx.currency)}</p>
      <p style="margin: 4px 0;"><strong>Advance Required (${ctx.advancePercentage}%):</strong> <span style="color:#b45309; font-size: 16px; font-weight: bold;">${formatCurrency(ctx.advanceAmount, ctx.currency)}</span></p>
      <p style="margin: 4px 0;"><strong>Balance on Dispatch:</strong> ${formatCurrency(ctx.balanceAmount, ctx.currency)}</p>
    </div>

    <h3 style="color:#166534; margin-bottom: 6px;">Bank Account Details for Direct Transfer:</h3>
    <div class="bank-card">
      <p style="margin: 3px 0;"><strong>Account Holder:</strong> ${ctx.bankDetails.accountHolderName}</p>
      <p style="margin: 3px 0;"><strong>Bank Name:</strong> ${ctx.bankDetails.bankName}</p>
      <p style="margin: 3px 0;"><strong>Account Number:</strong> <span style="font-family: monospace; font-size: 14px; font-weight: bold;">${ctx.bankDetails.accountNumber}</span></p>
      <p style="margin: 3px 0;"><strong>IFSC / Routing Code:</strong> <span style="font-family: monospace; font-size: 14px; font-weight: bold;">${ctx.bankDetails.ifscOrRoutingNumber}</span></p>
      ${ctx.bankDetails.branch ? `<p style="margin: 3px 0;"><strong>Branch:</strong> ${ctx.bankDetails.branch}</p>` : ''}
      ${ctx.bankDetails.swiftCode ? `<p style="margin: 3px 0;"><strong>SWIFT Code:</strong> ${ctx.bankDetails.swiftCode}</p>` : ''}
    </div>

    <p>After completing the bank transfer / NEFT / RTGS, please click below to upload your payment receipt / UTR acknowledgement (PDF, JPEG, or PNG up to 2MB):</p>

    <div style="text-align: center;">
      <a href="${uploadLink}" class="btn-primary">Upload Payment Receipt</a>
    </div>
  `;

  try {
    const result = await sendMail({
      to: ctx.to,
      subject: `Advance Payment Request: ${ctx.poNumber} [${ctx.quotationNumber}] - PRC Hardware`,
      html: basePoEmailTemplate('Advance Payment Request', content),
    });

    await prisma.poNotificationLog.create({
      data: {
        purchaseOrderId: ctx.poId,
        type: PoNotificationType.ADVANCE_PAYMENT_REQUEST,
        recipient: ctx.to,
        status: PoNotificationStatus.SENT,
        providerMessageId: (result as any)?.messageId || null,
        attempts: 1,
        sentAt: new Date(),
      },
    }).catch(() => {});
  } catch (err: any) {
    console.error('[PO Email Error]:', err.message);
    await prisma.poNotificationLog.create({
      data: {
        purchaseOrderId: ctx.poId,
        type: PoNotificationType.ADVANCE_PAYMENT_REQUEST,
        recipient: ctx.to,
        status: PoNotificationStatus.FAILED,
        error: err.message,
        attempts: 1,
      },
    }).catch(() => {});
  }
};

/**
 * 2. Sends Payment Acknowledgment Email
 */
export const sendPaymentAcknowledgedEmail = async (ctx: PaymentAcknowledgedEmailContext): Promise<void> => {
  const content = `
    <h2 style="margin-top:0; color:#0f172a;">Payment Acknowledgment Received</h2>
    <p>Dear <strong>${ctx.customerName}</strong>,</p>
    <p>We have successfully received and recorded your advance payment for Purchase Order <strong>${ctx.poNumber}</strong>.</p>
    
    <div class="info-card">
      <p style="margin: 4px 0;"><strong>Purchase Order No:</strong> <span class="ref-badge">${ctx.poNumber}</span></p>
      <p style="margin: 4px 0;"><strong>Amount Received:</strong> <span style="color:#16a34a; font-weight:bold; font-size:15px;">${formatCurrency(ctx.amountReceived, ctx.currency)}</span></p>
      <p style="margin: 4px 0;"><strong>Payment Date:</strong> ${ctx.paymentDate}</p>
      <p style="margin: 4px 0;"><strong>Payment Method:</strong> ${ctx.paymentMethod}</p>
      <p style="margin: 4px 0;"><strong>Payment Ref / UTR:</strong> <span style="font-family: monospace; font-weight:bold;">${ctx.paymentReference}</span></p>
      <p style="margin: 4px 0;"><strong>Remaining Balance:</strong> ${formatCurrency(ctx.balanceAmount, ctx.currency)}</p>
      ${ctx.remarks ? `<p style="margin: 4px 0;"><strong>Remarks:</strong> ${ctx.remarks}</p>` : ''}
    </div>

    <p>Our accounts team will complete digital verification against bank statements. Once verified, your commercial packing list will be generated automatically.</p>
  `;

  try {
    const result = await sendMail({
      to: ctx.to,
      subject: `Payment Acknowledged: ${ctx.poNumber} - PRC Hardware`,
      html: basePoEmailTemplate('Payment Acknowledged', content),
    });

    await prisma.poNotificationLog.create({
      data: {
        purchaseOrderId: ctx.poId,
        type: PoNotificationType.PAYMENT_ACKNOWLEDGMENT,
        recipient: ctx.to,
        status: PoNotificationStatus.SENT,
        providerMessageId: (result as any)?.messageId || null,
        attempts: 1,
        sentAt: new Date(),
      },
    }).catch(() => {});
  } catch (err: any) {
    console.error('[PO Email Error]:', err.message);
    await prisma.poNotificationLog.create({
      data: {
        purchaseOrderId: ctx.poId,
        type: PoNotificationType.PAYMENT_ACKNOWLEDGMENT,
        recipient: ctx.to,
        status: PoNotificationStatus.FAILED,
        error: err.message,
        attempts: 1,
      },
    }).catch(() => {});
  }
};

/**
 * 3. Sends Packing List Ready Email
 */
export const sendPackingListReadyEmail = async (ctx: PackingListReadyEmailContext): Promise<void> => {
  const downloadLink = `${env.frontend.url}/purchase-orders/${ctx.poId}`;

  const content = `
    <h2 style="margin-top:0; color:#0f172a;">Commercial Packing List Generated</h2>
    <p>Dear <strong>${ctx.customerName}</strong>,</p>
    <p>Your advance payment has been verified and your <strong>Commercial Packing List</strong> for Purchase Order <strong>${ctx.poNumber}</strong> (Quotation: ${ctx.quotationNumber}) is now ready.</p>
    
    <div class="info-card">
      <p style="margin: 4px 0;"><strong>Purchase Order No:</strong> <span class="ref-badge">${ctx.poNumber}</span></p>
      <p style="margin: 4px 0;"><strong>Quotation Ref No:</strong> ${ctx.quotationNumber}</p>
      <p style="margin: 4px 0;"><strong>Total Items to Dispatch:</strong> ${ctx.totalQuantity} PCS</p>
      <p style="margin: 4px 0;"><strong>Total Packages:</strong> ${ctx.totalPackages || 1} Package(s)</p>
      <p style="margin: 4px 0;"><strong>Warehouse Status:</strong> <span style="color:#16a34a; font-weight:bold;">Ready for Dispatch Packaging</span></p>
    </div>

    <p>You can download the official Packing List PDF directly from your portal account:</p>

    <div style="text-align: center;">
      <a href="${downloadLink}" class="btn-primary">View & Download Packing List</a>
    </div>
  `;

  try {
    const result = await sendMail({
      to: ctx.to,
      subject: `Packing List Ready: ${ctx.poNumber} [${ctx.quotationNumber}] - PRC Hardware`,
      html: basePoEmailTemplate('Packing List Ready', content),
    });

    await prisma.poNotificationLog.create({
      data: {
        purchaseOrderId: ctx.poId,
        type: PoNotificationType.PACKING_LIST_READY,
        recipient: ctx.to,
        status: PoNotificationStatus.SENT,
        providerMessageId: (result as any)?.messageId || null,
        attempts: 1,
        sentAt: new Date(),
      },
    }).catch(() => {});
  } catch (err: any) {
    console.error('[PO Email Error]:', err.message);
    await prisma.poNotificationLog.create({
      data: {
        purchaseOrderId: ctx.poId,
        type: PoNotificationType.PACKING_LIST_READY,
        recipient: ctx.to,
        status: PoNotificationStatus.FAILED,
        error: err.message,
        attempts: 1,
      },
    }).catch(() => {});
  }
};

/**
 * 4. Sends Tax Invoice Ready Email
 */
export const sendInvoiceReadyEmail = async (ctx: InvoiceReadyEmailContext): Promise<void> => {
  const downloadLink = `${env.frontend.url}/purchase-orders/${ctx.poId}`;

  const content = `
    <h2 style="margin-top:0; color:#0f172a;">Commercial Tax Invoice Generated</h2>
    <p>Dear <strong>${ctx.customerName}</strong>,</p>
    <p>Your order has been dispatched and the formal <strong>Commercial Tax Invoice #${ctx.invoiceNumber}</strong> has been generated for Purchase Order <strong>${ctx.poNumber}</strong>.</p>
    
    <div class="info-card">
      <p style="margin: 4px 0;"><strong>Tax Invoice Number:</strong> <span class="ref-badge">${ctx.invoiceNumber}</span></p>
      <p style="margin: 4px 0;"><strong>Purchase Order No:</strong> ${ctx.poNumber}</p>
      <p style="margin: 4px 0;"><strong>Quotation Ref No:</strong> ${ctx.quotationNumber}</p>
      <p style="margin: 4px 0;"><strong>Total Invoice Value:</strong> <span style="font-weight:bold; color:#0f172a;">${formatCurrency(ctx.totalAmount)}</span></p>
      <p style="margin: 4px 0;"><strong>Advance Credited:</strong> <span style="color:#16a34a; font-weight:bold;">(-) ${formatCurrency(ctx.amountPaidAdvance)}</span></p>
      <p style="margin: 4px 0;"><strong>Balance Due:</strong> <span style="color:#b45309; font-weight:bold;">${formatCurrency(ctx.balanceDue)}</span></p>
      ${ctx.carrierName ? `<p style="margin: 4px 0;"><strong>Carrier / Dispatch:</strong> ${ctx.carrierName} ${ctx.trackingNumber ? `(AWB: ${ctx.trackingNumber})` : ''}</p>` : ''}
    </div>

    <p>You can view and download your official Tax Invoice PDF with HSN & GST breakdown anytime from your portal:</p>

    <div style="text-align: center;">
      <a href="${downloadLink}" class="btn-primary">View & Download Tax Invoice</a>
    </div>
  `;

  try {
    const result = await sendMail({
      to: ctx.customerEmail,
      subject: `Tax Invoice ${ctx.invoiceNumber}: PO ${ctx.poNumber} - PRC Hardware`,
      html: basePoEmailTemplate('Tax Invoice Ready', content),
    });

    await prisma.poNotificationLog.create({
      data: {
        purchaseOrderId: ctx.poId,
        type: PoNotificationType.INVOICE_READY,
        recipient: ctx.customerEmail,
        status: PoNotificationStatus.SENT,
        providerMessageId: (result as any)?.messageId || null,
        attempts: 1,
        sentAt: new Date(),
      },
    }).catch(() => {});
  } catch (err: any) {
    console.error('[PO Email Error - Invoice Ready]:', err.message);
    await prisma.poNotificationLog.create({
      data: {
        purchaseOrderId: ctx.poId,
        type: PoNotificationType.INVOICE_READY,
        recipient: ctx.customerEmail,
        status: PoNotificationStatus.FAILED,
        error: err.message,
        attempts: 1,
      },
    }).catch(() => {});
  }
};

