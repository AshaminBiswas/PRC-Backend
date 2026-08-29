import nodemailer, { Transporter } from 'nodemailer';
import { Resend } from 'resend';
import { env } from '../config/env';
import { Prisma } from '@prisma/client';
import { enqueueJob } from '../jobs/asyncJob.service';
import dns from 'dns';

// Force Node.js to use IPv4 for DNS resolution (Fixes Render ENETUNREACH IPv6 error)
dns.setDefaultResultOrder('ipv4first');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  inReplyTo?: string;
  references?: string | string[];
  attachments?: EmailAttachment[];
}

// ─── Resend Official SDK Sender (primary modern choice — re_...) ───────────────

let resendClient: Resend | null = null;

const sendViaResend = async (options: SendMailOptions, apiKey: string): Promise<void> => {
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  const plainText = options.text || options.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const toList = Array.isArray(options.to) ? options.to : [options.to];
  const ccList = options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : undefined;
  const bccList = options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : undefined;

  const headers: Record<string, string> = {};
  if (options.inReplyTo) headers['In-Reply-To'] = options.inReplyTo;
  if (options.references) {
    headers['References'] = Array.isArray(options.references) ? options.references.join(' ') : options.references;
  }

  const payload: any = {
    from: `${env.smtp.fromName} <${env.smtp.fromEmail}>`,
    to: toList,
    subject: options.subject,
    html: options.html,
    text: plainText,
    ...(options.replyTo && { reply_to: options.replyTo }),
    ...(ccList && { cc: ccList }),
    ...(bccList && { bcc: bccList }),
    ...(Object.keys(headers).length > 0 && { headers }),
  };

  if (options.attachments?.length) {
    payload.attachments = options.attachments.map((a) => ({
      filename: a.filename,
      content: a.content.toString('base64'),
    }));
  }

  const { data, error } = await resendClient.emails.send(payload);

  if (error) {
    throw new Error(`Resend SDK error: ${error.message}`);
  }

  console.log(`[Email Success] Resend SDK → ${options.to} | Subject: "${options.subject}" | ID: ${data?.id || 'sent'}`);
};

// ─── Brevo HTTP API Sender (for xkeysib- API keys) ───────────────────────────

const sendViaBrevoApi = async (options: SendMailOptions, apiKey: string): Promise<void> => {
  const senderEmail = env.smtp.user?.includes('@') ? env.smtp.user : env.smtp.fromEmail;
  const plainText = options.text || options.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const toRecipients = Array.isArray(options.to)
    ? options.to.map((email) => ({ email }))
    : [{ email: options.to }];
  const ccRecipients = options.cc
    ? (Array.isArray(options.cc) ? options.cc : [options.cc]).map((email) => ({ email }))
    : undefined;
  const bccRecipients = options.bcc
    ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]).map((email) => ({ email }))
    : undefined;

  const headers: Record<string, string> = {};
  if (options.inReplyTo) headers['In-Reply-To'] = options.inReplyTo;
  if (options.references) {
    headers['References'] = Array.isArray(options.references) ? options.references.join(' ') : options.references;
  }

  const payload: any = {
    sender: { name: env.smtp.fromName, email: senderEmail },
    to: toRecipients,
    subject: options.subject,
    htmlContent: options.html,
    textContent: plainText,
    ...(options.replyTo && { replyTo: { email: options.replyTo } }),
    ...(ccRecipients && { cc: ccRecipients }),
    ...(bccRecipients && { bcc: bccRecipients }),
    ...(Object.keys(headers).length > 0 && { headers }),
  };

  if (options.attachments?.length) {
    payload.attachment = options.attachments.map((a) => ({
      name: a.filename,
      content: a.content.toString('base64'),
    }));
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Brevo API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as { messageId?: string };
  console.log(`[Email Success] Brevo REST API → ${options.to} | Subject: "${options.subject}" | ID: ${data.messageId || 'sent'}`);
};

// ─── SMTP Sender (Port 465 SSL — Gmail App Password or Brevo SMTP) ───────────

let transporter: Transporter | null = null;

const getTransporter = (): Transporter => {
  if (!transporter) {
    if (!env.smtp.user || !env.smtp.pass) {
      throw new Error('[Email] SMTP credentials missing in environment variables.');
    }

    const port = env.smtp.port || 465;
    const isSecure = port === 465 || env.smtp.secure;

    transporter = nodemailer.createTransport({
      host: env.smtp.host || 'smtp.gmail.com',
      port,
      secure: isSecure,
      family: 4, // Explicitly force IPv4 for Alpine/Docker on Render
      auth: { user: env.smtp.user, pass: env.smtp.pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    } as any);
  }
  return transporter;
};

const sendViaSmtp = async (options: SendMailOptions): Promise<void> => {
  const transport = getTransporter();
  const senderEmail =
    env.smtp.host?.includes('gmail') && env.smtp.user?.includes('@')
      ? env.smtp.user
      : env.smtp.fromEmail;

  const plainText = options.text || options.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const extraHeaders: Record<string, string> = {
    'X-Priority': '1',
    'X-MSMail-Priority': 'High',
    Importance: 'high',
  };

  if (options.inReplyTo) extraHeaders['In-Reply-To'] = options.inReplyTo;
  if (options.references) {
    extraHeaders['References'] = Array.isArray(options.references) ? options.references.join(' ') : options.references;
  }

  const mailPayload: any = {
    from: `"${env.smtp.fromName}" <${senderEmail}>`,
    to: options.to,
    subject: options.subject,
    text: plainText,
    html: options.html,
    headers: extraHeaders,
    ...(options.replyTo && { replyTo: options.replyTo }),
    ...(options.cc && { cc: options.cc }),
    ...(options.bcc && { bcc: options.bcc }),
  };

  if (options.attachments?.length) {
    mailPayload.attachments = options.attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    }));
  }

  const info = await transport.sendMail(mailPayload);
  console.log(`[Email Success] Nodemailer SMTP → ${options.to} | Subject: "${options.subject}" | ID: ${info.messageId}`);
};

// ─── Unified sendMail Cascade ─────────────────────────────────────────────────

export const sendMail = async (options: SendMailOptions): Promise<void> => {
  const logger = await import('../config/logger').then(m => m.logger);

  // 1. Try Resend HTTP API if RESEND_API_KEY (re_...) is set
  if (env.resend.apiKey && env.resend.apiKey.startsWith('re_')) {
    try {
      logger.info(`[Email] Trying Resend → ${options.to}`);
      await sendViaResend(options, env.resend.apiKey);
      return;
    } catch (resendErr: any) {
      logger.warn(`[Email] Resend failed → ${resendErr?.message || resendErr}. Trying Brevo...`);
    }
  } else {
    logger.info(`[Email] Resend skipped (no valid RESEND_API_KEY)`);
  }

  // 2. Try Brevo REST API if BREVO_API_KEY (xkeysib-) is set
  if (env.brevo.apiKey && env.brevo.apiKey.startsWith('xkeysib-')) {
    try {
      logger.info(`[Email] Trying Brevo REST API → ${options.to}`);
      await sendViaBrevoApi(options, env.brevo.apiKey);
      return;
    } catch (apiErr: any) {
      logger.warn(`[Email] Brevo REST failed → ${apiErr?.message || apiErr}. Trying SMTP...`);
    }
  } else {
    logger.info(`[Email] Brevo REST skipped (no valid BREVO_API_KEY)`);
  }

  // 3. Try Nodemailer SMTP (Brevo SMTP on port 587 or 465)
  if (env.smtp.user && env.smtp.pass) {
    try {
      logger.info(`[Email] Trying SMTP (${env.smtp.host}:${env.smtp.port}) → ${options.to}`);
      await sendViaSmtp(options);
      return;
    } catch (smtpErr: any) {
      transporter = null;
      logger.error(`[Email] SMTP failed → ${smtpErr?.message || smtpErr}`);
      throw smtpErr;
    }
  } else {
    logger.warn(`[Email] SMTP skipped (SMTP_USER or SMTP_PASS not set)`);
  }

  throw new Error('[Email] All providers failed or unconfigured. Check RESEND_API_KEY, BREVO_API_KEY, SMTP_USER/SMTP_PASS in Render dashboard.');
};


/**
 * Convenience wrapper — sends an email with one or more file attachments.
 * Falls back gracefully: if sendMail fails the attachment route, throws the error.
 */
export const sendMailWithAttachment = async (
  options: Omit<SendMailOptions, 'attachments'>,
  attachments: EmailAttachment[]
): Promise<void> => {
  return sendMail({ ...options, attachments });
};

// ─── Email Dispatcher ─────────────────────────────────────────────────────────

const enqueueEmail = async (options: SendMailOptions): Promise<void> => {
  try {
    await sendMail(options);
  } catch (err: any) {
    console.error(`[Email] Delivery failed for "${options.subject}" → ${options.to}:`, err?.message || err);
  }
};

// ─── Base Template ────────────────────────────────────────────────────────────

const baseTemplate = (content: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="x-apple-disable-message-reformatting" />
  <title>PRC Hardware</title>
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
    .otp {
      margin:26px auto;
      max-width:260px;
      border:1px solid #ead8c1;
      border-radius:8px;
      background:#fffaf4;
      padding:18px 22px;
      text-align:center;
      color:#34150f;
      font-size:31px;
      line-height:38px;
      font-weight:800;
      letter-spacing:7px;
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
      .otp { font-size:27px !important; letter-spacing:5px !important; }
    }
  </style>
</head>
<body>
  <div class="preheader">PRC Hardware — premium architectural hardware and B2B solutions.</div>
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
          ${content}
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

// ─── OTP Email (calls sendMail directly — errors must propagate to caller) ────

export const sendOtpEmail = async (to: string, firstName: string, otp: string): Promise<void> => {
  const plainText = `Hello ${firstName || 'User'},\n\nYour PRC Hardware verification code is: ${otp}\n\nThis verification code expires in 10 minutes. Never share this code with anyone.\n\nIf you did not request this verification code, please ignore this email.\n\n— PRC Hardware Security Team`;

  await sendMail({
    to,
    subject: `${otp} is your PRC Hardware verification code`,
    text: plainText,
    html: baseTemplate(`
      <div class="eyebrow">Email Verification</div>
      <h2>Verify your email address</h2>
      <p>Hello ${firstName || 'Valued Customer'},</p>
      <p>Thank you for signing up with PRC Hardware. Enter the verification code below to confirm your account and get started.</p>
      <div class="otp">${otp}</div>
      <p><strong>This code expires in 10 minutes.</strong> Never share this code with anyone.</p>
      <div class="divider"></div>
      <p class="muted">If you did not request this verification code, you can safely ignore this email.</p>
    `),
  });
};

// ─── Verification Link Email (legacy) ─────────────────────────────────────────

export const sendVerificationEmail = async (to: string, firstName: string, token: string): Promise<void> => {
  const link = `${env.frontend.url}/verify-email?token=${token}`;
  await enqueueEmail({
    to,
    subject: 'Verify your PRC Hardware account',
    html: baseTemplate(`
      <div class="eyebrow">Account verification</div>
      <h2>Confirm your email</h2>
      <p>Hello ${firstName},</p>
      <p>Welcome to PRC Hardware. Confirm your email address to activate your account.</p>
      <div class="btn-wrap">
        <a href="${link}" class="btn">Verify email address</a>
      </div>
      <p class="muted">This verification link expires in 24 hours.</p>
    `),
  });
};

// ─── Password Reset Email ─────────────────────────────────────────────────────

export const sendPasswordResetEmail = async (to: string, firstName: string, token: string): Promise<void> => {
  const isOtp = /^\d{6}$/.test(token);
  const link = `${env.frontend.url}/reset-password?token=${token}`;
  const subject = isOtp
    ? `${token} is your PRC Hardware password reset code`
    : 'Reset your PRC Hardware password';

  const plainText = isOtp
    ? `Hello ${firstName || 'User'},\n\nYour PRC Hardware password reset verification code is: ${token}\n\nThis verification code expires in 15 minutes. Never share this code with anyone.\n\n— PRC Hardware Security Team`
    : `Hello ${firstName || 'User'},\n\nWe received a request to reset your password. Reset link: ${link}\n\nThis link expires in 1 hour.\n\n— PRC Hardware Security Team`;

  await sendMail({
    to,
    subject,
    text: plainText,
    html: baseTemplate(`
      <div class="eyebrow">Account Security</div>
      <h2>Reset your password</h2>
      <p>Hello ${firstName || 'Valued Customer'},</p>
      <p>We received a request to reset your PRC Hardware account password.</p>
      ${
        isOtp
          ? `<p>Enter the 6-digit password reset verification code below to set a new password:</p>
             <div class="otp">${token}</div>
             <p><strong>This code expires in 15 minutes.</strong> Never share this code with anyone.</p>`
          : `<p>Use the button below to choose a new password:</p>
             <div class="btn-wrap">
               <a href="${link}" class="btn">Reset password</a>
             </div>
             <p class="muted">This link expires in 1 hour.</p>`
      }
      <div class="divider"></div>
      <p class="muted">If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
    `),
  });
};

// ─── Password Changed Email ───────────────────────────────────────────────────

export const sendPasswordChangedEmail = async (to: string, firstName: string): Promise<void> => {
  await enqueueEmail({
    to,
    subject: 'Your PRC Hardware password was changed',
    html: baseTemplate(`
      <div class="eyebrow">Account security</div>
      <h2>Password changed successfully</h2>
      <p>Hello ${firstName},</p>
      <p>This is a confirmation that your PRC Hardware account password was changed successfully.</p>
      <div class="notice"><strong>Didn't make this change?</strong> Contact our support team immediately to secure your account.</div>
    `),
  });
};

// ─── Welcome Email ────────────────────────────────────────────────────────────

export const sendWelcomeEmail = async (to: string, firstName: string): Promise<void> => {
  await enqueueEmail({
    to,
    subject: 'Welcome to PRC Hardware!',
    html: baseTemplate(`
      <div class="eyebrow">Account activated</div>
      <h2>Welcome to PRC Hardware, ${firstName}</h2>
      <p>Your email has been verified and your account is now active.</p>
      <p>You can now explore the full catalog of architectural hardware products.</p>
      <div class="btn-wrap">
        <a href="${env.frontend.url}/shop" class="btn">Explore catalog</a>
      </div>
    `),
  });
};

// ─── Appointment Booking Email ────────────────────────────────────────────────

export const sendAppointmentBookingEmail = async (params: {
  to: string;
  customerName: string;
  trackingId: string;
  appointmentNumber: string;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  locationName?: string;
  staffName?: string;
}): Promise<void> => {
  const trackingLink = `${env.frontend.url}/appointments/track/${params.trackingId}`;
  await enqueueEmail({
    to: params.to,
    subject: `Appointment Booking Confirmation - ${params.trackingId}`,
    html: baseTemplate(`
      <h2>Booking Confirmed!</h2>
      <p>Hello <strong>${params.customerName}</strong>,</p>
      <p>Your appointment has been successfully scheduled. Here are your booking details:</p>
      
      <div class="info-card">
        <p style="margin:4px 0;"><strong>Tracking ID:</strong> <span style="color:#D39858; font-weight:bold; font-size:16px;">${params.trackingId}</span></p>
        <p style="margin:4px 0;"><strong>Booking Ref:</strong> ${params.appointmentNumber}</p>
        <p style="margin:4px 0;"><strong>Service:</strong> ${params.serviceName}</p>
        <p style="margin:4px 0;"><strong>Date:</strong> ${params.date}</p>
        <p style="margin:4px 0;"><strong>Time Slot:</strong> ${params.startTime} - ${params.endTime}</p>
        ${params.staffName ? `<p style="margin:4px 0;"><strong>Specialist:</strong> ${params.staffName}</p>` : ''}
        ${params.locationName ? `<p style="margin:4px 0;"><strong>Location:</strong> ${params.locationName}</p>` : ''}
      </div>

      <p>You can track or manage your appointment anytime using your Tracking ID.</p>
      <div class="text-center">
        <a href="${trackingLink}" class="btn">Track Appointment Status</a>
      </div>
      <p>Direct Link:<br/><small style="color: #D39858;">${trackingLink}</small></p>
    `),
  });
};

// ─── B2B Customer Account Created with Temporary Password Email ───────────────

export const sendB2BCustomerWelcomeEmail = async (params: {
  to: string;
  firstName: string;
  lastName?: string;
  companyName?: string;
  temporaryPassword: string;
}): Promise<void> => {
  const loginUrl = `${env.frontend.url}`;
  await enqueueEmail({
    to: params.to,
    subject: 'Welcome to PRC Hardware B2B Wholesale Portal - Your Account Details',
    html: baseTemplate(`
      <h2>Welcome to PRC Hardware B2B, ${params.firstName}!</h2>
      <p>An enterprise wholesale account has been provisioned for <strong>${params.companyName || `${params.firstName} ${params.lastName || ''}`}</strong> by our administration team.</p>
      
      <div class="info-card" style="background:#34150F; color:#ffffff; border-color:#34150F;">
        <h3 style="margin-top:0; color:#D39858; font-size:16px;">🔑 Your Temporary Login Credentials</h3>
        <p style="margin:6px 0; color:#cbd5e1;"><strong>Login Email:</strong> <span style="color:#ffffff;">${params.to}</span></p>
        <p style="margin:6px 0; color:#cbd5e1;"><strong>Temporary Password:</strong> <span style="color:#EACEAA; font-family:monospace; font-size:16px; font-weight:bold; background:#1e293b; padding:4px 8px; border-radius:4px;">${params.temporaryPassword}</span></p>
      </div>

      <p style="color:#b45309; font-weight:600;">⚠️ Security Note: Upon your first login, the portal will automatically prompt you to set your own permanent, secure password before accessing your custom pricing matrix and bulk ordering catalog.</p>

      <div class="text-center">
        <a href="${loginUrl}" class="btn">Login to B2B Portal</a>
      </div>
      
      <div class="divider"></div>
      <p class="muted">If you have any questions or need custom contract volume quotes, contact your designated account representative or email support@pacifichardware.com.</p>
    `),
  });
};