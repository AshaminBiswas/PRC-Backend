import nodemailer, { Transporter } from 'nodemailer';
import { Resend } from 'resend';
import { env } from '../config/env';
import { Prisma } from '@prisma/client';
import { enqueueJob } from '../jobs/asyncJob.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

// ─── Resend Official SDK Sender (primary modern choice — re_...) ───────────────

let resendClient: Resend | null = null;

const sendViaResend = async (options: SendMailOptions, apiKey: string): Promise<void> => {
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  const payload: any = {
    from: `${env.smtp.fromName} <${env.smtp.fromEmail}>`,
    to: [options.to],
    subject: options.subject,
    html: options.html,
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
  const payload: any = {
    sender: { name: env.smtp.fromName, email: env.smtp.fromEmail },
    to: [{ email: options.to }],
    subject: options.subject,
    htmlContent: options.html,
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
      auth: { user: env.smtp.user, pass: env.smtp.pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
  }
  return transporter;
};

const sendViaSmtp = async (options: SendMailOptions): Promise<void> => {
  const transport = getTransporter();
  const mailPayload: any = {
    from: `"${env.smtp.fromName}" <${env.smtp.fromEmail}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
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
  <title>PRC Hardware</title>
  <style>
    /* Reset & Base */
    body, p, h1, h2, h3, h4, h5, h6 { margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; -webkit-font-smoothing: antialiased; }
    
    /* Layout */
    .wrapper { width: 100%; background-color: #f3f4f6; padding: 40px 0; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); }
    
    /* Header */
    .header { background-color: #34150F; padding: 32px 40px; text-align: center; border-bottom: 4px solid #D39858; }
    .header h1 { color: #EACEAA; font-size: 24px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
    .header p { color: #D39858; font-size: 12px; margin-top: 6px; letter-spacing: 0.5px; text-transform: uppercase; }
    
    /* Body */
    .body { padding: 40px; color: #374151; font-size: 16px; line-height: 1.625; }
    .body h2 { color: #111827; font-size: 20px; font-weight: 600; margin-bottom: 16px; }
    .body p { margin-bottom: 16px; }
    
    /* Components */
    .btn { display: inline-block; background-color: #D39858; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 15px; text-align: center; margin: 8px 0; transition: background-color 0.2s; }
    .otp-box { display: block; margin: 32px auto; padding: 20px; background-color: #f9fafb; border: 2px dashed #D39858; color: #34150F; border-radius: 8px; font-size: 32px; font-weight: 700; letter-spacing: 8px; text-align: center; width: fit-content; min-width: 180px; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #D39858; border-radius: 6px; padding: 18px; margin: 20px 0; font-size: 15px; }
    
    /* Footer */
    .footer { background-color: #f9fafb; padding: 32px 40px; text-align: center; border-top: 1px solid #e5e7eb; }
    .footer p { color: #6b7280; font-size: 13px; line-height: 1.5; margin-bottom: 8px; }
    .footer .links { margin-top: 16px; }
    .footer a { color: #D39858; text-decoration: none; font-size: 13px; }
    
    /* Utilities */
    .text-center { text-align: center; }
    .muted { color: #6b7280; font-size: 14px; }
    .divider { height: 1px; background-color: #e5e7eb; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>PRC Hardware</h1>
        <p>Architectural &amp; Commercial Solutions</p>
      </div>
      <div class="body">
        ${content}
      </div>
      <div class="footer">
        <p><strong>PRC Hardware</strong><br>New Delhi, India</p>
        <p>This is an automated operational email. Please do not reply directly to this address.</p>
        <p>&copy; ${new Date().getFullYear()} PRC Hardware. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

// ─── OTP Email (calls sendMail directly — errors must propagate to caller) ────

export const sendOtpEmail = async (to: string, firstName: string, otp: string): Promise<void> => {
  // NOTE: intentionally NOT using enqueueEmail — OTP errors must throw so the
  // caller (auth.service register/resend) can detect delivery failure and tell the user.
  await sendMail({
    to,
    subject: 'Your PRC Hardware verification code',
    html: baseTemplate(`
      <h2>Hello ${firstName},</h2>
      <p>Thank you for registering with PRC Hardware. Use the verification code below to confirm your email address.</p>
      <div class="otp-box">${otp}</div>
      <p>This code expires in <strong>10 minutes</strong>. Please do not share it with anyone.</p>
      <div class="divider"></div>
      <p class="muted">If you did not request this code, you can safely ignore this email. Someone may have typed their email address incorrectly.</p>
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
      <h2>Hello ${firstName},</h2>
      <p>Welcome to PRC Hardware! Please verify your email address by clicking the button below.</p>
      <div class="text-center">
        <a href="${link}" class="btn">Verify Email Address</a>
      </div>
      <p>Or copy and paste this link into your browser:</p>
      <p class="muted"><a href="${link}" style="color: #D39858;">${link}</a></p>
      <div class="divider"></div>
      <p class="muted">This link expires in 24 hours.</p>
    `),
  });
};

// ─── Password Reset Email ─────────────────────────────────────────────────────

export const sendPasswordResetEmail = async (to: string, firstName: string, token: string): Promise<void> => {
  const link = `${env.frontend.url}/reset-password?token=${token}`;
  await enqueueEmail({
    to,
    subject: 'Reset your PRC Hardware password',
    html: baseTemplate(`
      <h2>Hello ${firstName},</h2>
      <p>We received a request to reset your password. Click the button below to choose a new one.</p>
      <div class="text-center">
        <a href="${link}" class="btn">Reset Password</a>
      </div>
      <p>Or copy and paste this link into your browser:</p>
      <p class="muted"><a href="${link}" style="color: #D39858;">${link}</a></p>
      <div class="divider"></div>
      <p class="muted">If you did not request a password reset, please ignore this email. This link expires in 1 hour.</p>
    `),
  });
};

// ─── Password Changed Email ───────────────────────────────────────────────────

export const sendPasswordChangedEmail = async (to: string, firstName: string): Promise<void> => {
  await enqueueEmail({
    to,
    subject: 'Your PRC Hardware password was changed',
    html: baseTemplate(`
      <h2>Hello ${firstName},</h2>
      <p>This is a confirmation that the password for your PRC Hardware account was just changed.</p>
      <p>If you made this change, you can safely ignore this email.</p>
      <div class="divider"></div>
      <p class="muted"><strong>Didn't change your password?</strong> Please contact our support team immediately to secure your account.</p>
    `),
  });
};

// ─── Welcome Email ────────────────────────────────────────────────────────────

export const sendWelcomeEmail = async (to: string, firstName: string): Promise<void> => {
  await enqueueEmail({
    to,
    subject: 'Welcome to PRC Hardware!',
    html: baseTemplate(`
      <h2>Welcome, ${firstName}!</h2>
      <p>Thank you for creating an account with PRC Hardware. We are thrilled to have you on board.</p>
      <p>Your email has been verified and your account is now active. You can now explore our full catalog of hardware products.</p>
      <div class="text-center">
        <a href="${env.frontend.url}/shop" class="btn">Start Shopping</a>
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


