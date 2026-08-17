import { sendMail, sendMailWithAttachment } from '../../utils/email.utils';
import { env } from '../../config/env';

interface QuoteEmailContext {
  to: string;
  customerName: string;
  companyName: string;
  referenceNo: string;
  projectName: string;
  grandTotal?: number;
  statusReason?: string;
  accessToken?: string;
  customerResponse?: string;
  customerResponseNotes?: string;
  quoteNumber?: string;
}

const baseQuotationTemplate = (title: string, bodyContent: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title} - Pacific Products & Solutions</title>
  <style>
    body { font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 620px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
    .header { background: #0f172a; padding: 28px; text-align: center; border-bottom: 3px solid #f59e0b; }
    .header h1 { color: #f59e0b; margin: 0; font-size: 22px; letter-spacing: 0.5px; font-weight: 800; }
    .header p { color: #94a3b8; margin: 4px 0 0 0; font-size: 12px; }
    .body { padding: 32px 28px; color: #1e293b; line-height: 1.6; }
    .ref-badge { display: inline-block; background: #f1f5f9; color: #0f172a; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-family: monospace; font-size: 14px; border: 1px solid #cbd5e1; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 18px; margin: 20px 0; }
    .btn-primary { display: inline-block; margin: 20px 0; padding: 14px 28px; background: #f59e0b; color: #0f172a; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; text-align: center; }
    .footer { background: #0f172a; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Pacific Products & Solutions</h1>
      <p>Architectural Hardware • Restroom Cubicles • Locker Systems</p>
    </div>
    <div class="body">
      ${bodyContent}
    </div>
    <div class="footer">
      Pacific Products & Solutions &bull; Official B2B Quotation Notification &bull; support@pacifichardware.com
    </div>
  </div>
</body>
</html>`;

export const sendQuotationSubmittedEmail = async (ctx: QuoteEmailContext): Promise<void> => {
  const content = `
    <h2 style="margin-top:0; color:#0f172a;">Quotation Request Received</h2>
    <p>Dear <strong>${ctx.customerName}</strong> (${ctx.companyName}),</p>
    <p>Thank you for submitting your B2B quotation request for project <strong>"${ctx.projectName}"</strong>. Our commercial hardware estimating team is currently reviewing your requested specifications and volume pricing.</p>
    
    <div class="info-card">
      <p style="margin: 4px 0;"><strong>Quotation Reference No:</strong> <span class="ref-badge">${ctx.referenceNo}</span></p>
      <p style="margin: 4px 0;"><strong>Project Name:</strong> ${ctx.projectName}</p>
      <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color:#f59e0b; font-weight:bold;">Submitted (Pending Initial Review)</span></p>
    </div>

    <p>You can track the live progress of your quotation anytime on our portal using your <strong>Quotation Reference No</strong>, <strong>Email</strong>, <strong>GSTIN</strong>, or <strong>Phone Number</strong>.</p>
  `;

  await sendMail({
    to: ctx.to,
    subject: `Quotation Request Received - [${ctx.referenceNo}] - Pacific Hardware`,
    html: baseQuotationTemplate('Quotation Request Received', content),
  }).catch((err) => console.warn('[Email Warning]:', err.message));
};

export const sendQuotationUnderReviewEmail = async (ctx: QuoteEmailContext): Promise<void> => {
  const content = `
    <h2 style="margin-top:0; color:#0f172a;">Your Quotation is Under Review</h2>
    <p>Dear <strong>${ctx.customerName}</strong>,</p>
    <p>Your quotation for project <strong>"${ctx.projectName}"</strong> has been assigned to a designated technical hardware estimator and is currently <strong>Under Review</strong>.</p>
    
    <div class="info-card">
      <p style="margin: 4px 0;"><strong>Quotation Reference No:</strong> <span class="ref-badge">${ctx.referenceNo}</span></p>
      <p style="margin: 4px 0;"><strong>Current Status:</strong> <span style="color:#0284c7; font-weight:bold;">Under Review</span></p>
    </div>

    <p>We are validating stock allocation, volume contractor discounts, and transport logistics. You will receive an update once the final quotation is approved.</p>
  `;

  await sendMail({
    to: ctx.to,
    subject: `Quotation Under Review - [${ctx.referenceNo}] - Pacific Hardware`,
    html: baseQuotationTemplate('Quotation Under Review', content),
  }).catch((err) => console.warn('[Email Warning]:', err.message));
};

export const sendQuotationPendingEmail = async (ctx: QuoteEmailContext): Promise<void> => {
  const content = `
    <h2 style="margin-top:0; color:#0f172a;">Information Required for Quotation</h2>
    <p>Dear <strong>${ctx.customerName}</strong>,</p>
    <p>Our estimating team requires additional details to finalize your quotation for <strong>"${ctx.projectName}"</strong>.</p>
    
    <div class="info-card" style="border-left-color: #eab308; background:#fefce8;">
      <p style="margin: 4px 0;"><strong>Quotation Reference No:</strong> <span class="ref-badge">${ctx.referenceNo}</span></p>
      <p style="margin: 8px 0 4px 0; color:#854d0e;"><strong>Estimator Notes / Reason:</strong></p>
      <p style="margin: 0; font-weight:600; color:#713f12;">${ctx.statusReason || 'Please contact our B2B team to clarify dimensions/specifications.'}</p>
    </div>

    <p>Please reply to this email or contact your representative quoting reference <strong>${ctx.referenceNo}</strong>.</p>
  `;

  await sendMail({
    to: ctx.to,
    subject: `Action Required: Quotation [${ctx.referenceNo}] Pending Details`,
    html: baseQuotationTemplate('Quotation Pending Details', content),
  }).catch((err) => console.warn('[Email Warning]:', err.message));
};

export const sendQuotationApprovedEmail = async (ctx: QuoteEmailContext): Promise<void> => {
  const viewUrl = `${env.frontend.url}/quote/${ctx.accessToken}`;
  const formattedTotal = ctx.grandTotal ? `₹${Number(ctx.grandTotal).toLocaleString('en-IN')}` : 'View in link';

  const content = `
    <h2 style="margin-top:0; color:#0f172a;">🎉 Your Quotation Has Been Approved & Digitally Signed!</h2>
    <p>Dear <strong>${ctx.customerName}</strong> (${ctx.companyName}),</p>
    <p>We are pleased to inform you that your quotation for <strong>"${ctx.projectName}"</strong> has been approved, finalized with B2B contract pricing, and digitally signed with cryptographic verification.</p>
    
    <div class="info-card" style="border-left-color: #10b981; background:#f0fdf4;">
      <p style="margin: 4px 0;"><strong>Quotation Ref No:</strong> <span class="ref-badge">${ctx.referenceNo}</span></p>
      <p style="margin: 4px 0;"><strong>Approved Grand Total:</strong> <span style="font-size:18px; font-weight:bold; color:#065f46;">${formattedTotal}</span></p>
      <p style="margin: 4px 0;"><strong>Digital Signature:</strong> <span style="color:#059669; font-weight:bold;">✔ Verified & QR Code Encoded</span></p>
    </div>

    <p>Click below to inspect the complete line items, download your official digitally-signed PDF, and record your Acceptance:</p>
    
    <p style="text-align:center;">
      <a href="${viewUrl}" class="btn-primary" style="background:#10b981; color:#ffffff;">View & Approve Quotation</a>
    </p>

    <p style="font-size:12px; color:#64748b;">Direct Link: <br/><a href="${viewUrl}" style="color:#0284c7;">${viewUrl}</a></p>
  `;

  await sendMail({
    to: ctx.to,
    subject: `Official Quotation Approved & Signed - [${ctx.referenceNo}] - Pacific Hardware`,
    html: baseQuotationTemplate('Quotation Approved', content),
  }).catch((err) => console.warn('[Email Warning]:', err.message));
};

/**
 * Sends the approved quotation email WITH the PDF attached.
 * Used automatically when admin signs/approves a quotation.
 * Falls back to the non-attachment email if PDF fails.
 */
export const sendQuotationApprovedEmailWithPdf = async (
  ctx: QuoteEmailContext,
  pdfBuffer: Buffer
): Promise<void> => {
  const viewUrl = `${env.frontend.url}/quote/${ctx.accessToken}`;
  const formattedTotal = ctx.grandTotal ? `₹${Number(ctx.grandTotal).toLocaleString('en-IN')}` : 'View in link';
  const fileName = `Quotation-${ctx.referenceNo || ctx.quoteNumber || 'PRC'}.pdf`;

  const content = `
    <h2 style="margin-top:0; color:#0f172a;">🎉 Your Official Quotation is Ready!</h2>
    <p>Dear <strong>${ctx.customerName}</strong> (${ctx.companyName}),</p>
    <p>Your quotation for project <strong>"${ctx.projectName}"</strong> has been <strong>approved, finalized with B2B contract pricing, and digitally signed</strong>.</p>
    <p>The official signed quotation PDF is attached to this email for your records.</p>
    
    <div class="info-card" style="border-left-color: #10b981; background:#f0fdf4;">
      <p style="margin: 4px 0;"><strong>Quotation Ref No:</strong> <span class="ref-badge">${ctx.referenceNo}</span></p>
      <p style="margin: 4px 0;"><strong>Approved Grand Total:</strong> <span style="font-size:18px; font-weight:bold; color:#065f46;">${formattedTotal}</span></p>
      <p style="margin: 4px 0;"><strong>Digital Signature:</strong> <span style="color:#059669; font-weight:bold;">&#x2714; Verified &amp; QR Code Encoded</span></p>
      <p style="margin: 4px 0;"><strong>PDF Attached:</strong> <span style="color:#059669; font-weight:bold;">📎 ${fileName}</span></p>
    </div>

    <p>You can also view your quotation online, inspect all line items, and record your formal Acceptance or Rejection:</p>
    
    <p style="text-align:center;">
      <a href="${viewUrl}" class="btn-primary" style="background:#10b981; color:#ffffff;">View & Respond to Quotation</a>
    </p>

    <p style="font-size:12px; color:#64748b;">Direct Link: <br/><a href="${viewUrl}" style="color:#0284c7;">${viewUrl}</a></p>
  `;

  await sendMailWithAttachment(
    {
      to: ctx.to,
      subject: `Official Quotation PDF - [${ctx.referenceNo}] - Pacific Hardware`,
      html: baseQuotationTemplate('Official Quotation Approved', content),
    },
    [
      {
        filename: fileName,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ]
  ).catch((err) => {
    console.warn('[Email Warning] PDF email failed, falling back to text-only approval email:', err.message);
    // Fallback to plain approval email (no PDF)
    sendQuotationApprovedEmail(ctx).catch(() => {});
  });
};

export const sendQuotationRejectedEmail = async (ctx: QuoteEmailContext): Promise<void> => {
  const content = `
    <h2 style="margin-top:0; color:#0f172a;">Quotation Status Update</h2>
    <p>Dear <strong>${ctx.customerName}</strong>,</p>
    <p>We regret to inform you that your quotation request for <strong>"${ctx.projectName}"</strong> (${ctx.referenceNo}) could not be approved at this time.</p>
    
    <div class="info-card" style="border-left-color: #ef4444; background:#fef2f2;">
      <p style="margin: 4px 0;"><strong>Quotation Reference No:</strong> <span class="ref-badge">${ctx.referenceNo}</span></p>
      <p style="margin: 8px 0 4px 0; color:#991b1b;"><strong>Reason:</strong></p>
      <p style="margin: 0; color:#7f1d1d;">${ctx.statusReason || 'Specifications outside commercial capability or MOQ.'}</p>
    </div>

    <p>If you would like to revise the project scope or discuss alternate hardware models, please contact support@pacifichardware.com.</p>
  `;

  await sendMail({
    to: ctx.to,
    subject: `Quotation Status Update - [${ctx.referenceNo}] - Pacific Hardware`,
    html: baseQuotationTemplate('Quotation Declined', content),
  }).catch((err) => console.warn('[Email Warning]:', err.message));
};

export const sendQuotationCustomerResponseNotification = async (ctx: QuoteEmailContext): Promise<void> => {
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || env.smtp.fromEmail || 'admin@pacifichardware.com';
  const isAccepted = ctx.customerResponse === 'accepted';
  const badgeColor = isAccepted ? '#10b981' : '#ef4444';

  const content = `
    <h2 style="margin-top:0; color:#0f172a;">Customer Response: Quotation ${ctx.referenceNo}</h2>
    <p>B2B Client <strong>${ctx.customerName}</strong> (${ctx.companyName}) has recorded their response to quotation <strong>${ctx.referenceNo}</strong>.</p>
    
    <div class="info-card" style="border-left-color: ${badgeColor};">
      <p style="margin: 4px 0;"><strong>Quotation Reference:</strong> <span class="ref-badge">${ctx.referenceNo}</span></p>
      <p style="margin: 4px 0;"><strong>Customer Decision:</strong> <span style="color:${badgeColor}; font-weight:bold; font-size:16px; text-transform:uppercase;">${ctx.customerResponse}</span></p>
      ${ctx.customerResponseNotes ? `<p style="margin: 6px 0 0 0;"><strong>Client Notes:</strong> ${ctx.customerResponseNotes}</p>` : ''}
    </div>
  `;

  await sendMail({
    to: adminEmail,
    subject: `[Client ${ctx.customerResponse?.toUpperCase()}] Quotation ${ctx.referenceNo} - ${ctx.companyName}`,
    html: baseQuotationTemplate('Customer Quotation Response', content),
  }).catch((err) => console.warn('[Email Warning]:', err.message));
};
