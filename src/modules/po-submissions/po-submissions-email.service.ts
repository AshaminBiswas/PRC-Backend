/**
 * po-submissions-email.service.ts
 *
 * Transactional email service for PO Submissions intake lifecycle.
 */

import { sendMail } from '../../utils/email.utils';
import { env } from '../../config/env';

const formatCurrency = (val: number, cur = 'INR') => {
  return `${cur === 'INR' ? '₹' : cur + ' '}${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const baseTemplate = (title: string, bodyContent: string): string => `
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
    .success-card { background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #16a34a; border-radius: 6px; padding: 18px; margin: 20px 0; }
    .danger-card { background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #dc2626; border-radius: 6px; padding: 18px; margin: 20px 0; }
    .btn-primary { display: inline-block; margin: 20px 0; padding: 14px 28px; background: #f59e0b; color: #0f172a !important; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; text-align: center; }
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
      <p>This is an automated notification from PRC Hardware Commercial Desk.</p>
      <p>For assistance, contact sales@prchardware.com or your account manager.</p>
    </div>
  </div>
</body>
</html>
`;

export async function sendSubmissionReceivedEmail(data: {
  to: string;
  customerName: string;
  submissionNumber: string;
  customerPoNumber: string;
  sourceType: string;
  statedTotal?: number | null;
  currency?: string;
}) {
  const content = `
    <h2 style="color: #0f172a; margin-top: 0;">Purchase Order Received & Under Review</h2>
    <p>Dear <strong>${data.customerName}</strong>,</p>
    <p>Thank you for submitting your Purchase Order. Our commercial engineering team has received your submission and is reviewing the details against our catalog.</p>
    
    <div class="info-card">
      <p style="margin: 0 0 8px 0;"><strong>Submission Reference:</strong> <span class="ref-badge">${data.submissionNumber}</span></p>
      <p style="margin: 0 0 8px 0;"><strong>Your PO Number:</strong> <strong>${data.customerPoNumber}</strong></p>
      <p style="margin: 0 0 8px 0;"><strong>Submission Mode:</strong> ${data.sourceType === 'PDF_UPLOAD' ? 'Native PDF Document' : 'Structured Portal Form'}</p>
      ${data.statedTotal ? `<p style="margin: 0;"><strong>Stated Total Value:</strong> ${formatCurrency(data.statedTotal, data.currency || 'INR')}</p>` : ''}
    </div>

    <p><strong>What happens next?</strong></p>
    <ol style="color: #475569; padding-left: 20px; line-height: 1.8;">
      <li>Our team will verify specifications, pricing, and current stock availability.</li>
      <li>For PDF submissions, our team will map your line items to our catalog SKUs.</li>
      <li>Upon commercial sign-off, you will receive an official <strong>Order Acknowledgement PDF</strong>.</li>
    </ol>

    <div style="text-align: center; margin-top: 25px;">
      <a href="${env.frontend.url || 'https://prchardware.com'}/po-submissions" class="btn-primary">Track Submission Status</a>
    </div>
  `;

  await sendMail({
    to: data.to,
    subject: `[PRC Hardware] PO Received: ${data.customerPoNumber} (${data.submissionNumber})`,
    html: baseTemplate('Purchase Order Received', content),
  }).catch((err) => {
    console.error('[PoSubmissionsEmail] Failed to send submission received email:', err?.message || err);
  });
}

export async function sendChangesRequestedEmail(data: {
  to: string;
  customerName: string;
  submissionNumber: string;
  customerPoNumber: string;
  reason: string;
}) {
  const content = `
    <h2 style="color: #d97706; margin-top: 0;">Action Required: Changes Requested on PO</h2>
    <p>Dear <strong>${data.customerName}</strong>,</p>
    <p>Our commercial desk has reviewed your Purchase Order <strong>${data.customerPoNumber}</strong> (${data.submissionNumber}) and requires the following clarifications/modifications before we can proceed:</p>
    
    <div class="danger-card">
      <p style="margin: 0 0 6px 0; font-weight: bold; color: #991b1b;">Reviewer Comments / Clarification Needed:</p>
      <p style="margin: 0; color: #7f1d1d; font-size: 14px; white-space: pre-line;">${data.reason}</p>
    </div>

    <p>Please update and resubmit your details through the customer portal so we can finalize approval.</p>

    <div style="text-align: center; margin-top: 25px;">
      <a href="${env.frontend.url || 'https://prchardware.com'}/po-submissions" class="btn-primary">Review & Resubmit</a>
    </div>
  `;

  await sendMail({
    to: data.to,
    subject: `[PRC Hardware] Action Required: Clarification on PO ${data.customerPoNumber}`,
    html: baseTemplate('Changes Requested', content),
  }).catch((err) => {
    console.error('[PoSubmissionsEmail] Failed to send changes requested email:', err?.message || err);
  });
}

export async function sendPoApprovedEmail(data: {
  to: string;
  customerName: string;
  submissionNumber: string;
  customerPoNumber: string;
  mappedTotal?: number | null;
  currency?: string;
}) {
  const content = `
    <h2 style="color: #16a34a; margin-top: 0;">Purchase Order Approved</h2>
    <p>Dear <strong>${data.customerName}</strong>,</p>
    <p>We are pleased to inform you that your Purchase Order <strong>${data.customerPoNumber}</strong> (${data.submissionNumber}) has been approved by our commercial team.</p>
    
    <div class="success-card">
      <p style="margin: 0 0 8px 0;"><strong>Submission Reference:</strong> <span class="ref-badge">${data.submissionNumber}</span></p>
      <p style="margin: 0 0 8px 0;"><strong>PO Number:</strong> <strong>${data.customerPoNumber}</strong></p>
      ${data.mappedTotal ? `<p style="margin: 0;"><strong>Final Approved Value:</strong> ${formatCurrency(data.mappedTotal, data.currency || 'INR')}</p>` : ''}
    </div>

    <p>Our operations desk is now preparing your formal <strong>Order Acknowledgement Document</strong>.</p>
  `;

  await sendMail({
    to: data.to,
    subject: `[PRC Hardware] PO Approved: ${data.customerPoNumber}`,
    html: baseTemplate('PO Approved', content),
  }).catch((err) => {
    console.error('[PoSubmissionsEmail] Failed to send PO approved email:', err?.message || err);
  });
}

export async function sendPoRejectedEmail(data: {
  to: string;
  customerName: string;
  submissionNumber: string;
  customerPoNumber: string;
  reason: string;
}) {
  const content = `
    <h2 style="color: #dc2626; margin-top: 0;">Purchase Order Notice</h2>
    <p>Dear <strong>${data.customerName}</strong>,</p>
    <p>We regret to inform you that we are unable to accept Purchase Order <strong>${data.customerPoNumber}</strong> (${data.submissionNumber}) at this time.</p>
    
    <div class="danger-card">
      <p style="margin: 0 0 6px 0; font-weight: bold; color: #991b1b;">Reason:</p>
      <p style="margin: 0; color: #7f1d1d; font-size: 14px; white-space: pre-line;">${data.reason}</p>
    </div>

    <p>If you have questions or would like to submit a revised quotation request, please reach out to your sales representative.</p>
  `;

  await sendMail({
    to: data.to,
    subject: `[PRC Hardware] Update on Purchase Order: ${data.customerPoNumber}`,
    html: baseTemplate('Purchase Order Status', content),
  }).catch((err) => {
    console.error('[PoSubmissionsEmail] Failed to send PO rejected email:', err?.message || err);
  });
}

export async function sendAcknowledgementIssuedEmail(data: {
  to: string;
  customerName: string;
  ackNumber: string;
  submissionNumber: string;
  customerPoNumber: string;
  grandTotal: number;
  currency?: string;
  pdfBuffer?: Buffer;
}) {
  const content = `
    <h2 style="color: #16a34a; margin-top: 0;">Formal Order Acknowledgement Issued</h2>
    <p>Dear <strong>${data.customerName}</strong>,</p>
    <p>We have formally acknowledged and accepted your Purchase Order <strong>${data.customerPoNumber}</strong>. The official Acknowledgement Document <strong>${data.ackNumber}</strong> has been issued and attached for your records.</p>
    
    <div class="success-card">
      <p style="margin: 0 0 8px 0;"><strong>Acknowledgement Number:</strong> <span class="ref-badge">${data.ackNumber}</span></p>
      <p style="margin: 0 0 8px 0;"><strong>Customer PO Number:</strong> <strong>${data.customerPoNumber}</strong></p>
      <p style="margin: 0 0 8px 0;"><strong>Submission Reference:</strong> ${data.submissionNumber}</p>
      <p style="margin: 0;"><strong>Total Acknowledged Value:</strong> <strong>${formatCurrency(data.grandTotal, data.currency || 'INR')}</strong></p>
    </div>

    <p>This document is the binding system-of-record triggering warehouse allocation, production planning, and dispatch scheduling.</p>

    <div style="text-align: center; margin-top: 25px;">
      <a href="${env.frontend.url || 'https://prchardware.com'}/po-submissions" class="btn-primary">View in Customer Portal</a>
    </div>
  `;

  const attachments = data.pdfBuffer
    ? [
        {
          filename: `PRC_Acknowledgement_${data.ackNumber}.pdf`,
          content: data.pdfBuffer,
          contentType: 'application/pdf',
        },
      ]
    : undefined;

  await sendMail({
    to: data.to,
    subject: `[PRC Hardware] Order Acknowledgement: ${data.ackNumber} (Ref: ${data.customerPoNumber})`,
    html: baseTemplate('Order Acknowledgement Issued', content),
    attachments,
  }).catch((err) => {
    console.error('[PoSubmissionsEmail] Failed to send ack email:', err?.message || err);
  });
}
