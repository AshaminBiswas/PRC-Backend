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
  <meta name="x-apple-disable-message-reformatting" />
  <title>${title}</title>
  <style>
    html, body { margin:0 !important; padding:0 !important; width:100% !important; }
    body {
      background:#f4f6f8;
      color:#1f2937;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
      -webkit-font-smoothing:antialiased;
      text-rendering:optimizeLegibility;
    }
    table { border-collapse:collapse; }
    img { border:0; outline:none; text-decoration:none; display:block; }
    a { text-decoration:none; }
    .preheader { display:none !important; visibility:hidden; opacity:0; color:transparent; height:0; width:0; overflow:hidden; }
    .page { width:100%; background:#f4f6f8; padding:32px 16px; }
    .shell { width:100%; max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; }
    .brandbar { background:#1f2937; padding:22px 32px; border-bottom:3px solid #d39858; }
    .brand { font-size:19px; line-height:24px; font-weight:800; letter-spacing:.02em; color:#ffffff; }
    .tagline { margin-top:4px; font-size:11px; line-height:16px; letter-spacing:.08em; text-transform:uppercase; color:#d39858; }
    .content { padding:40px 40px 32px; }
    .eyebrow {
      margin:0 0 10px;
      font-size:11px;
      line-height:16px;
      font-weight:700;
      letter-spacing:.1em;
      text-transform:uppercase;
      color:#9a6a37;
    }
    h2 { margin:0 0 14px; color:#111827; font-size:25px; line-height:32px; font-weight:750; letter-spacing:-.02em; }
    h3 { margin:0 0 10px; color:#111827; font-size:16px; line-height:22px; font-weight:700; }
    p { margin:0 0 16px; color:#4b5563; font-size:15px; line-height:24px; }
    .muted { color:#6b7280 !important; font-size:13px !important; line-height:20px !important; }
    .divider { height:1px; background:#e5e7eb; margin:28px 0; }
    .btn-wrap { padding:8px 0 18px; text-align:left; }
    .btn {
      display:inline-block;
      background:#34150f;
      color:#ffffff !important;
      padding:13px 22px;
      border-radius:5px;
      font-size:14px;
      line-height:20px;
      font-weight:700;
      letter-spacing:.01em;
    }
    .btn:hover { background:#24100c; }
    .card {
      margin:24px 0;
      border:1px solid #e5e7eb;
      border-radius:6px;
      background:#f8fafc;
      padding:20px;
    }
    .card-accent {
      border-left:4px solid #d39858;
      padding-left:17px;
    }
    .dark-card {
      margin:24px 0;
      border-radius:6px;
      background:#1f2937;
      padding:22px;
    }
    .dark-card h3 { color:#d39858; }
    .dark-card p { color:#d1d5db; margin-bottom:8px; }
    .dark-card strong { color:#ffffff; }
    .credential {
      display:inline-block;
      margin-left:4px;
      padding:3px 7px;
      border-radius:4px;
      background:#111827;
      color:#f1d6b3;
      font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
      font-size:14px;
      font-weight:700;
    }
    .notice {
      margin:20px 0;
      padding:14px 16px;
      border:1px solid #ead8c1;
      border-radius:5px;
      background:#fffaf4;
      color:#5f4630;
      font-size:13px;
      line-height:20px;
    }
    .details { width:100%; }
    .details td { padding:10px 0; border-bottom:1px solid #e5e7eb; vertical-align:top; }
    .details tr:last-child td { border-bottom:0; }
    .label { width:38%; color:#6b7280; font-size:13px; }
    .value { color:#111827; font-size:14px; font-weight:600; }
    .footer {
      border-top:1px solid #e5e7eb;
      background:#fafafa;
      padding:24px 40px 28px;
    }
    .footer p { margin:0 0 7px; color:#6b7280; font-size:12px; line-height:18px; }
    .footer a { color:#7b542c; }
    .footer .legal { margin-top:14px; color:#9ca3af; font-size:11px; }
    @media only screen and (max-width:600px) {
      .page { padding:12px 8px !important; }
      .brandbar { padding:20px 22px !important; }
      .content { padding:28px 22px 22px !important; }
      .footer { padding:20px 22px 24px !important; }
      h2 { font-size:22px !important; line-height:29px !important; }
      p { font-size:14px !important; line-height:22px !important; }
      .btn { display:block !important; text-align:center !important; }
      .label { width:42% !important; }
    }
  </style>
</head>
<body>
  <div class="preheader">${title}</div>
  <table role="presentation" width="100%" class="page">
    <tr><td align="center">
      <table role="presentation" class="shell">
        <tr><td class="brandbar">
          <table role="presentation" width="100%">
            <tr>
              <td width="64" valign="middle">
                <img src="${env.frontend.url}/prc-logo.png" alt="PRC Logo" style="width: auto; height: 56px; display: block;" />
              </td>
              <td valign="middle" style="padding-left: 16px;">
                <div class="brand">PRC HARDWARE</div>
                <div class="tagline">Premium Architectural Hardware</div>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td class="content">
          ${bodyContent}
        </td></tr>
        <tr><td class="footer">
          <p><strong>PRC Hardware</strong> · New Delhi, India</p>
          <p>Need assistance? Contact your account representative or support team.</p>
          <p class="legal">This is an automated operational email. Please do not reply directly to this message.</p>
          <p class="legal">&copy; ${new Date().getFullYear()} PRC Hardware. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
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
    
    <div class="card card-accent">
      <p style="margin: 4px 0;"><strong>Quotation Reference No:</strong> <span class="credential">${ctx.referenceNo}</span></p>
      <p style="margin: 4px 0;"><strong>Project Name:</strong> ${ctx.projectName}</p>
      <p style="margin: 4px 0;"><strong>Estimated Amount:</strong> <strong style="color:#34150F;">${formattedTotal}</strong></p>
      <p style="margin: 4px 0;"><strong>Current Status:</strong> <span style="color:#b45309; font-weight:bold;">SUBMITTED (Pending Estimator Review)</span></p>
    </div>

    <p>Our commercial hardware estimating team is reviewing your requested product specifications and volume contractor pricing. Once approved, you will automatically receive an update with your official digitally-signed quotation and pricing terms.</p>

    <p style="text-align:center;">
      <a href="${trackingUrl}" class="btn">Track Quotation Live</a>
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
    
    <div class="card card-accent">
      <p style="margin: 4px 0;"><strong>Quotation Ref:</strong> <span class="credential">${ctx.referenceNo}</span></p>
      <p style="margin: 4px 0;"><strong>Customer:</strong> ${ctx.customerName} (${ctx.companyName})</p>
      <p style="margin: 4px 0;"><strong>Email / Phone:</strong> ${ctx.email || 'N/A'} | ${ctx.phone || 'N/A'}</p>
      <p style="margin: 4px 0;"><strong>GSTIN:</strong> ${ctx.gstNo || 'N/A'}</p>
      <p style="margin: 4px 0;"><strong>Project:</strong> ${ctx.projectName}</p>
      <p style="margin: 4px 0;"><strong>Line Items Count:</strong> ${ctx.itemsCount || 0}</p>
      <p style="margin: 4px 0;"><strong>Estimated Total:</strong> <strong style="color:#047857;">${formattedTotal}</strong></p>
    </div>

    <p style="text-align:center;">
      <a href="${reviewUrl}" class="btn">Review in Admin Panel</a>
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
    
    <div class="card card-accent" style="border-left-color: #0284c7; background:#f0f9ff;">
      <p style="margin: 4px 0;"><strong>Quotation Reference No:</strong> <span class="credential">${ctx.referenceNo}</span></p>
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
    
    <div class="card card-accent" style="border-left-color: #eab308; background:#fefce8;">
      <p style="margin: 4px 0;"><strong>Quotation Reference No:</strong> <span class="credential">${ctx.referenceNo}</span></p>
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
    
    <div class="card card-accent" style="border-left-color: #10b981; background:#f0fdf4;">
      <p style="margin: 4px 0;"><strong>Quotation Reference No:</strong> <span class="credential">${ctx.referenceNo}</span></p>
      <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color:#047857; font-weight:bold; font-size:15px;">✔ APPROVED & SIGNED</span></p>
      <p style="margin: 4px 0;"><strong>Approved Grand Total:</strong> <span style="font-size:18px; font-weight:bold; color:#065f46;">${formattedTotal}</span> (Incl. 18% GST)</p>
      <p style="margin: 4px 0;"><strong>Payment Terms:</strong> <span style="color:#047857; font-weight:600;">${advanceText}</span></p>
    </div>

    <p>Click the button below to inspect all line items, download your official PDF, and record your formal Acceptance:</p>
    
    <p style="text-align:center;">
      <a href="${viewUrl}" class="btn" style="background:#10b981; color:#ffffff;">View & Approve Quotation</a>
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
    
    <div class="card card-accent" style="border-left-color: #10b981; background:#f0fdf4;">
      <p style="margin: 4px 0;"><strong>Quotation Reference No:</strong> <span class="credential">${ctx.referenceNo}</span></p>
      <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color:#047857; font-weight:bold; font-size:15px;">✔ APPROVED &amp; DIGITALLY SIGNED</span></p>
      <p style="margin: 4px 0;"><strong>Approved Grand Total:</strong> <span style="font-size:18px; font-weight:bold; color:#065f46;">${formattedTotal}</span> (Incl. 18% GST)</p>
      <p style="margin: 4px 0;"><strong>Payment Terms:</strong> <span style="color:#047857; font-weight:600;">${advanceText}</span></p>
      <p style="margin: 4px 0;"><strong>PDF Attachment:</strong> <span style="color:#059669; font-weight:bold;">📎 ${fileName}</span></p>
    </div>

    <p>You can also review the line items and record your formal Acceptance online:</p>
    
    <p style="text-align:center;">
      <a href="${viewUrl}" class="btn" style="background:#10b981; color:#ffffff;">View &amp; Accept Quotation</a>
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
    
    <div class="card card-accent" style="border-left-color: #ef4444; background:#fef2f2;">
      <p style="margin: 4px 0;"><strong>Quotation Reference No:</strong> <span class="credential">${ctx.referenceNo}</span></p>
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
    
    <div class="card card-accent" style="border-left-color: ${badgeColor};">
      <p style="margin: 4px 0;"><strong>Quotation Reference:</strong> <span class="credential">${ctx.referenceNo}</span></p>
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
    
    <div class="card card-accent" style="border-left-color: #f59e0b; background:#fefce8;">
      <p style="margin: 4px 0;"><strong>Quotation Reference No:</strong> <span class="credential">${ctx.referenceNo}</span></p>
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
    
    <div class="card card-accent" style="border-left-color: #f59e0b;">
      <p style="margin: 4px 0;"><strong>Quotation Reference:</strong> <span class="credential">${ctx.referenceNo}</span></p>
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
