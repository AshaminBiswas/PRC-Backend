import { sendMail, sendMailWithAttachment } from '../../utils/email.utils';
import { env } from '../../config/env';

interface QuoteEmailContext {
  to: string;
  customerName: string;
  companyName: string;
  referenceNo: string;
  projectName: string;
  grandTotal?: number;
  advancePercentage?: number;
  statusReason?: string;
  accessToken?: string;
  customerResponse?: string;
  customerResponseNotes?: string;
  quoteNumber?: string;
}

const getFrontendUrl = (): string => {
  const customUrl = env.frontend.url;
  if (customUrl && !customUrl.includes('localhost')) {
    return customUrl.replace(/\/+$/, '');
  }
  return process.env.NODE_ENV === 'production' || process.env.RENDER
    ? 'https://frontend-sage-pi-65.vercel.app'
    : (customUrl || 'http://localhost:5173').replace(/\/+$/, '');
};

const getAdminUrl = (): string => {
  const customUrl = env.frontend.adminUrl;
  if (customUrl && !customUrl.includes('localhost')) {
    return customUrl.replace(/\/+$/, '');
  }
  return process.env.NODE_ENV === 'production' || process.env.RENDER
    ? 'https://admin-delta-kohl.vercel.app'
    : (customUrl || 'http://localhost:5174').replace(/\/+$/, '');
};

const baseQuotationTemplate = (title: string, bodyContent: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title} - PRC Hardware</title>
  <style>
    /* Reset & Base */
    body, p, h1, h2, h3, h4, h5, h6 { margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; -webkit-font-smoothing: antialiased; }
    
    /* Layout */
    .wrapper { width: 100%; background-color: #f3f4f6; padding: 40px 0; }
    .container { max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); }
    
    /* Header */
    .header { background-color: #34150F; padding: 32px 40px; text-align: center; border-bottom: 4px solid #D39858; }
    .header h1 { color: #EACEAA; font-size: 24px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
    .header p { color: #D39858; font-size: 12px; margin-top: 6px; letter-spacing: 0.5px; text-transform: uppercase; }
    
    /* Body */
    .body { padding: 40px; color: #374151; font-size: 16px; line-height: 1.625; }
    .body h2 { color: #111827; font-size: 20px; font-weight: 600; margin-bottom: 16px; }
    .body p { margin-bottom: 16px; }
    
    /* Components */
    .ref-badge { display: inline-block; background: #fef3c7; color: #92400e; padding: 6px 14px; border-radius: 6px; font-weight: 800; font-family: monospace; font-size: 15px; border: 1px solid #fde68a; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #D39858; border-radius: 6px; padding: 18px; margin: 20px 0; }
    .btn-primary { display: inline-block; background-color: #D39858; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 15px; text-align: center; margin: 8px 0; transition: background-color 0.2s; }
    
    /* Footer */
    .footer { background-color: #f9fafb; padding: 32px 40px; text-align: center; border-top: 1px solid #e5e7eb; }
    .footer p { color: #6b7280; font-size: 13px; line-height: 1.5; margin-bottom: 8px; }
    .footer .links { margin-top: 16px; }
    .footer a { color: #D39858; text-decoration: none; font-size: 13px; }
    /* Responsive Media Queries */
    @media only screen and (max-width: 600px) {
      .wrapper { padding: 10px 0 !important; }
      .container { max-width: 100% !important; border-radius: 4px !important; margin: 0 10px !important; width: auto !important; }
      .header { padding: 24px 20px !important; }
      .body { padding: 24px 20px !important; }
      .footer { padding: 24px 20px !important; }
      .header h1 { font-size: 20px !important; }
      .logo-img { height: 50px !important; }
      .otp-box { font-size: 24px !important; letter-spacing: 4px !important; padding: 15px !important; min-width: 140px !important; }
      .info-card { padding: 12px !important; font-size: 14px !important; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <img src="https://ui-avatars.com/api/?name=PRC+Hardware&background=EACEAA&color=34150F&size=128&bold=true" alt="PRC Hardware Logo" class="logo-img" style="height: 64px; margin-bottom: 16px; border-radius: 50%; box-shadow: 0 4px 6px rgba(0,0,0,0.3); border: 2px solid #D39858;" />
        <h1>PRC Hardware</h1>
        <p>Premium Architectural Hardware</p>
      </div>
      <div class="body">
        ${bodyContent}
      </div>
      <div class="footer">
        <p><strong>PRC Hardware</strong><br>Official B2B Quotation Notification</p>
        <p>This is an automated operational email. Please direct inquiries to support@pacifichardware.com.</p>
        <p>&copy; ${new Date().getFullYear()} PRC Hardware. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

/**
 * 1. Customer Email: Quotation Submitted (RFQ Received)
 */
export const sendQuotationSubmittedEmail = async (ctx: QuoteEmailContext): Promise<void> => {
  const frontendUrl = getFrontendUrl();
  const trackingUrl = ctx.accessToken
    ? `${frontendUrl}/quote/${ctx.accessToken}`
    : `${frontendUrl}/track-order`;
  const formattedTotal = ctx.grandTotal ? `₹${Number(ctx.grandTotal).toLocaleString('en-IN')}` : 'Estimated at review';

  const content = `
    <h2 style="margin-top:0; color:#34150F;">Quotation Request Received Successfully</h2>
    <p>Dear <strong>${ctx.customerName}</strong> (${ctx.companyName}),</p>
    <p>Thank you for submitting your quotation request for project <strong>"${ctx.projectName}"</strong>. We have logged your request in our system under the unique Quotation Reference Number below:</p>
    
    <div class="info-card">
      <p style="margin: 4px 0;"><strong>Quotation Reference No:</strong> <span class="ref-badge">${ctx.referenceNo}</span></p>
      <p style="margin: 4px 0;"><strong>Project Name:</strong> ${ctx.projectName}</p>
      <p style="margin: 4px 0;"><strong>Estimated Amount:</strong> <strong style="color:#34150F;">${formattedTotal}</strong></p>
      <p style="margin: 4px 0;"><strong>Current Status:</strong> <span style="color:#b45309; font-weight:bold;">SUBMITTED (Pending Estimator Review)</span></p>
    </div>

    <p>Our commercial hardware estimating team is reviewing your requested product specifications and volume contractor pricing. Once approved, you will automatically receive an update with your official digitally-signed quotation and pricing terms.</p>

    <p style="text-align:center;">
      <a href="${trackingUrl}" class="btn-primary">Track Quotation Live</a>
    </p>

    <p style="font-size:12px; color:#64748b; margin-top:20px;">
      You can track this quote anytime on our portal using your Quotation Reference No <strong>${ctx.referenceNo}</strong> or registered email address.
    </p>
  `;

  await sendMail({
    to: ctx.to,
    subject: `Quotation Received: ${ctx.referenceNo} - PRC Hardware`,
    html: baseQuotationTemplate('Quotation Request Received', content),
  }).catch((err) => console.warn('[Email Warning]:', err.message));
};

/**
 * 2. Admin Alert: New Quotation Submission Notification
 */
export const sendQuotationNewSubmissionAdminNotification = async (ctx: {
  to: string;
  customerName: string;
  companyName: string;
  referenceNo: string;
  projectName: string;
  grandTotal?: number;
  phone?: string;
  email?: string;
  gstNo?: string;
  itemsCount?: number;
}): Promise<void> => {
  const adminUrl = getAdminUrl();
  const reviewUrl = `${adminUrl}/quotes`;
  const formattedTotal = ctx.grandTotal ? `₹${Number(ctx.grandTotal).toLocaleString('en-IN')}` : 'N/A';

  const content = `
    <h2 style="margin-top:0; color:#34150F;">New B2B Quotation Request Submitted</h2>
    <p>A new quotation request <strong>${ctx.referenceNo}</strong> has been submitted by <strong>${ctx.customerName}</strong>.</p>
    
    <div class="info-card">
      <p style="margin: 4px 0;"><strong>Quotation Ref:</strong> <span class="ref-badge">${ctx.referenceNo}</span></p>
      <p style="margin: 4px 0;"><strong>Customer:</strong> ${ctx.customerName} (${ctx.companyName})</p>
      <p style="margin: 4px 0;"><strong>Email / Phone:</strong> ${ctx.email || 'N/A'} | ${ctx.phone || 'N/A'}</p>
      <p style="margin: 4px 0;"><strong>GSTIN:</strong> ${ctx.gstNo || 'N/A'}</p>
      <p style="margin: 4px 0;"><strong>Project:</strong> ${ctx.projectName}</p>
      <p style="margin: 4px 0;"><strong>Line Items Count:</strong> ${ctx.itemsCount || 0}</p>
      <p style="margin: 4px 0;"><strong>Estimated Total:</strong> <strong style="color:#047857;">${formattedTotal}</strong></p>
    </div>

    <p style="text-align:center;">
      <a href="${reviewUrl}" class="btn-primary">Review in Admin Panel</a>
    </p>
  `;

  await sendMail({
    to: ctx.to,
    subject: `[New Quotation RFQ] ${ctx.referenceNo} - ${ctx.companyName}`,
    html: baseQuotationTemplate('New Quotation Request', content),
  }).catch((err) => console.warn('[Email Warning]:', err.message));
};

/**
 * 3. Customer Email: Quotation Under Review
 */
export const sendQuotationUnderReviewEmail = async (ctx: QuoteEmailContext): Promise<void> => {
  const content = `
    <h2 style="margin-top:0; color:#34150F;">Your Quotation is Under Review</h2>
    <p>Dear <strong>${ctx.customerName}</strong>,</p>
    <p>Your quotation for project <strong>"${ctx.projectName}"</strong> has been assigned to a designated technical hardware estimator and is currently <strong>Under Review</strong>.</p>
    
    <div class="info-card" style="border-left-color: #0284c7; background:#f0f9ff;">
      <p style="margin: 4px 0;"><strong>Quotation Reference No:</strong> <span class="ref-badge">${ctx.referenceNo}</span></p>
      <p style="margin: 4px 0;"><strong>Current Status:</strong> <span style="color:#0284c7; font-weight:bold;">Under Technical Review</span></p>
    </div>

    <p>We are validating stock allocation, volume contractor discounts, and transport logistics. You will receive an update once the final quotation is approved.</p>
  `;

  await sendMail({
    to: ctx.to,
    subject: `Quotation Under Review - [${ctx.referenceNo}] - PRC Hardware`,
    html: baseQuotationTemplate('Quotation Under Review', content),
  }).catch((err) => console.warn('[Email Warning]:', err.message));
};

/**
 * 4. Customer Email: Quotation Pending Additional Information
 */
export const sendQuotationPendingEmail = async (ctx: QuoteEmailContext): Promise<void> => {
  const content = `
    <h2 style="margin-top:0; color:#34150F;">Information Required for Quotation</h2>
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

/**
 * 5. Customer Email: Quotation APPROVED & Signed (HTML only)
 */
export const sendQuotationApprovedEmail = async (ctx: QuoteEmailContext): Promise<void> => {
  const frontendUrl = getFrontendUrl();
  const viewUrl = `${frontendUrl}/quote/${ctx.accessToken || ''}`;
  const formattedTotal = ctx.grandTotal ? `₹${Number(ctx.grandTotal).toLocaleString('en-IN')}` : 'View in link';
  const advanceText = ctx.advancePercentage ? `${ctx.advancePercentage}% Advance Payment Terms` : 'Standard Payment Terms';

  const content = `
    <h2 style="margin-top:0; color:#065f46;">🎉 Your Quotation Has Been Approved!</h2>
    <p>Dear <strong>${ctx.customerName}</strong> (${ctx.companyName}),</p>
    <p>We are pleased to inform you that your quotation for <strong>"${ctx.projectName}"</strong> has been <strong>approved with official commercial pricing and digitally signed</strong>.</p>
    
    <div class="info-card" style="border-left-color: #10b981; background:#f0fdf4;">
      <p style="margin: 4px 0;"><strong>Quotation Reference No:</strong> <span class="ref-badge">${ctx.referenceNo}</span></p>
      <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color:#047857; font-weight:bold; font-size:15px;">✔ APPROVED & SIGNED</span></p>
      <p style="margin: 4px 0;"><strong>Approved Grand Total:</strong> <span style="font-size:18px; font-weight:bold; color:#065f46;">${formattedTotal}</span> (Incl. 18% GST)</p>
      <p style="margin: 4px 0;"><strong>Payment Terms:</strong> <span style="color:#047857; font-weight:600;">${advanceText}</span></p>
    </div>

    <p>Click the button below to inspect all line items, download your official PDF, and record your formal Acceptance:</p>
    
    <p style="text-align:center;">
      <a href="${viewUrl}" class="btn-primary" style="background:#10b981; color:#ffffff;">View & Approve Quotation</a>
    </p>

    <p style="font-size:12px; color:#64748b;">Direct Link: <br/><a href="${viewUrl}" style="color:#0284c7;">${viewUrl}</a></p>
  `;

  await sendMail({
    to: ctx.to,
    subject: `Approved Quotation: ${ctx.referenceNo} - PRC Hardware`,
    html: baseQuotationTemplate('Quotation Approved', content),
  }).catch((err) => console.warn('[Email Warning]:', err.message));
};

/**
 * 6. Customer Email: Quotation APPROVED with PDF Attachment
 */
export const sendQuotationApprovedEmailWithPdf = async (
  ctx: QuoteEmailContext,
  pdfBuffer: Buffer
): Promise<void> => {
  const frontendUrl = getFrontendUrl();
  const viewUrl = `${frontendUrl}/quote/${ctx.accessToken || ''}`;
  const formattedTotal = ctx.grandTotal ? `₹${Number(ctx.grandTotal).toLocaleString('en-IN')}` : 'View in link';
  const cleanRef = String(ctx.referenceNo || ctx.quoteNumber || 'PRC').replace(/[\/\\]/g, '-');
  const fileName = `Quotation-${cleanRef}.pdf`;
  const advanceText = ctx.advancePercentage ? `${ctx.advancePercentage}% Advance Payment Terms` : 'Standard Payment Terms';

  const content = `
    <h2 style="margin-top:0; color:#065f46;">🎉 Your Official Quotation is Approved!</h2>
    <p>Dear <strong>${ctx.customerName}</strong> (${ctx.companyName}),</p>
    <p>Your quotation for project <strong>"${ctx.projectName}"</strong> has been <strong>approved with commercial contractor pricing and digitally signed</strong>.</p>
    <p>The official signed quotation PDF (<strong>${fileName}</strong>) is attached to this email for your records.</p>
    
    <div class="info-card" style="border-left-color: #10b981; background:#f0fdf4;">
      <p style="margin: 4px 0;"><strong>Quotation Reference No:</strong> <span class="ref-badge">${ctx.referenceNo}</span></p>
      <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color:#047857; font-weight:bold; font-size:15px;">✔ APPROVED &amp; DIGITALLY SIGNED</span></p>
      <p style="margin: 4px 0;"><strong>Approved Grand Total:</strong> <span style="font-size:18px; font-weight:bold; color:#065f46;">${formattedTotal}</span> (Incl. 18% GST)</p>
      <p style="margin: 4px 0;"><strong>Payment Terms:</strong> <span style="color:#047857; font-weight:600;">${advanceText}</span></p>
      <p style="margin: 4px 0;"><strong>PDF Attachment:</strong> <span style="color:#059669; font-weight:bold;">📎 ${fileName}</span></p>
    </div>

    <p>You can also review the line items and record your formal Acceptance online:</p>
    
    <p style="text-align:center;">
      <a href="${viewUrl}" class="btn-primary" style="background:#10b981; color:#ffffff;">View &amp; Accept Quotation</a>
    </p>

    <p style="font-size:12px; color:#64748b;">Direct Link: <br/><a href="${viewUrl}" style="color:#0284c7;">${viewUrl}</a></p>
  `;

  await sendMailWithAttachment(
    {
      to: ctx.to,
      subject: `Approved Quotation PDF: ${ctx.referenceNo} - PRC Hardware`,
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
    sendQuotationApprovedEmail(ctx).catch(() => {});
  });
};

/**
 * 7. Customer Email: Quotation Rejected
 */
export const sendQuotationRejectedEmail = async (ctx: QuoteEmailContext): Promise<void> => {
  const content = `
    <h2 style="margin-top:0; color:#991b1b;">Quotation Status Update</h2>
    <p>Dear <strong>${ctx.customerName}</strong>,</p>
    <p>We regret to inform you that your quotation request for <strong>"${ctx.projectName}"</strong> (${ctx.referenceNo}) could not be approved at this time.</p>
    
    <div class="info-card" style="border-left-color: #ef4444; background:#fef2f2;">
      <p style="margin: 4px 0;"><strong>Quotation Reference No:</strong> <span class="ref-badge">${ctx.referenceNo}</span></p>
      <p style="margin: 8px 0 4px 0; color:#991b1b;"><strong>Reason:</strong></p>
      <p style="margin: 0; color:#7f1d1d; font-weight:600;">${ctx.statusReason || 'Specifications outside commercial capability or MOQ.'}</p>
    </div>

    <p>If you would like to revise the project scope or discuss alternate hardware models, please contact support@pacifichardware.com.</p>
  `;

  await sendMail({
    to: ctx.to,
    subject: `Quotation Status Update: ${ctx.referenceNo} - PRC Hardware`,
    html: baseQuotationTemplate('Quotation Declined', content),
  }).catch((err) => console.warn('[Email Warning]:', err.message));
};

/**
 * 8. Customer Response Notification to Admin
 */
export const sendQuotationCustomerResponseNotification = async (ctx: QuoteEmailContext): Promise<void> => {
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || env.smtp.fromEmail || 'admin@pacifichardware.com';
  const isAccepted = ctx.customerResponse === 'accepted';
  const badgeColor = isAccepted ? '#10b981' : '#ef4444';

  const content = `
    <h2 style="margin-top:0; color:#34150F;">Customer Response: Quotation ${ctx.referenceNo}</h2>
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

/**
 * 9. Revision Emails
 */
export const sendQuotationRevisionSubmittedEmail = async (ctx: QuoteEmailContext & { proposedAdvancePercent?: number; remark?: string }): Promise<void> => {
  const content = `
    <h2 style="margin-top:0; color:#34150F;">Quotation Revision Request Received</h2>
    <p>Dear <strong>${ctx.customerName}</strong> (${ctx.companyName}),</p>
    <p>We have received your requested revision for quotation <strong>"${ctx.projectName}"</strong>.</p>
    
    <div class="info-card" style="border-left-color: #f59e0b; background:#fefce8;">
      <p style="margin: 4px 0;"><strong>Quotation Reference No:</strong> <span class="ref-badge">${ctx.referenceNo}</span></p>
      ${ctx.proposedAdvancePercent !== undefined ? `<p style="margin: 4px 0;"><strong>Proposed Advance Percentage:</strong> <span style="font-weight:bold; color:#b45309;">${ctx.proposedAdvancePercent}%</span></p>` : ''}
      ${ctx.remark ? `<p style="margin: 6px 0 0 0;"><strong>Your Reason / Remark:</strong> <em>${ctx.remark}</em></p>` : ''}
      <p style="margin: 8px 0 0 0;"><strong>Status:</strong> <span style="color:#0284c7; font-weight:bold;">Under Admin Review</span></p>
    </div>

    <p>Your quotation number <strong>${ctx.referenceNo}</strong> remains unchanged. Our commercial estimating team is reviewing your requested terms and will notify you once re-approved.</p>
  `;

  await sendMail({
    to: ctx.to,
    subject: `Quotation Revision Under Review: ${ctx.referenceNo} - PRC Hardware`,
    html: baseQuotationTemplate('Quotation Revision Received', content),
  }).catch((err) => console.warn('[Email Warning]:', err.message));
};

export const sendQuotationRevisionAdminNotification = async (ctx: QuoteEmailContext & { proposedAdvancePercent?: number; remark?: string; previousAdvancePercent?: number }): Promise<void> => {
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || env.smtp.fromEmail || 'admin@pacifichardware.com';

  const content = `
    <h2 style="margin-top:0; color:#34150F;">⚠️ Customer Requested Quotation Revision</h2>
    <p>B2B Client <strong>${ctx.customerName}</strong> (${ctx.companyName}) has submitted their one-time revision request for quotation <strong>${ctx.referenceNo}</strong>.</p>
    
    <div class="info-card" style="border-left-color: #f59e0b;">
      <p style="margin: 4px 0;"><strong>Quotation Reference:</strong> <span class="ref-badge">${ctx.referenceNo}</span></p>
      <p style="margin: 4px 0;"><strong>Project Name:</strong> ${ctx.projectName}</p>
      ${ctx.previousAdvancePercent !== undefined ? `<p style="margin: 4px 0;"><strong>Previous Advance %:</strong> ${ctx.previousAdvancePercent}%</p>` : ''}
      ${ctx.proposedAdvancePercent !== undefined ? `<p style="margin: 4px 0;"><strong>Customer Proposed Advance %:</strong> <span style="color:#b45309; font-weight:bold; font-size:15px;">${ctx.proposedAdvancePercent}%</span></p>` : ''}
      ${ctx.remark ? `<p style="margin: 6px 0 0 0; color:#78350f;"><strong>Customer Reason:</strong> <em>"${ctx.remark}"</em></p>` : ''}
    </div>

    <p>Please log in to the admin panel to review the customer's proposed terms and digitally sign/re-approve the quotation.</p>
  `;

  await sendMail({
    to: adminEmail,
    subject: `[Customer Revision Request] Quotation ${ctx.referenceNo} - ${ctx.companyName}`,
    html: baseQuotationTemplate('Customer Revision Request', content),
  }).catch((err) => console.warn('[Email Warning]:', err.message));
};
