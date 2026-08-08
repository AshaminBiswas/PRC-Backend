import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { Prisma } from '@prisma/client';
import { enqueueJob } from '../jobs/asyncJob.service';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

// ─── Brevo HTTP API Sender (for xkeysib- API keys) ───────────────────────────

const sendViaBrevoApi = async (options: SendMailOptions, apiKey: string): Promise<void> => {
  const body = JSON.stringify({
    sender: { name: env.smtp.fromName, email: env.smtp.fromEmail },
    to: [{ email: options.to }],
    subject: options.subject,
    htmlContent: options.html,
  });

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Brevo API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as { messageId?: string };
  console.log(`[Email Success] Brevo REST API → ${options.to} | Subject: "${options.subject}" | ID: ${data.messageId || 'sent'}`);
};

// ─── SMTP Sender (Port 465 SSL — 100% working for xsmtpsib- keys) ────────────

let transporter: Transporter | null = null;

const getTransporter = (): Transporter => {
  if (!transporter) {
    if (!env.smtp.user || !env.smtp.pass) {
      throw new Error('[Email] SMTP credentials missing in environment variables.');
    }

    // Default to Port 465 (SSL/TLS) for Brevo, as Port 587 STARTTLS is blocked on many ISPs/clouds
    const port = env.smtp.port || 465;
    const isSecure = port === 465 || env.smtp.secure;

    transporter = nodemailer.createTransport({
      host: env.smtp.host || 'smtp-relay.brevo.com',
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
  const info = await transport.sendMail({
    from: `"${env.smtp.fromName}" <${env.smtp.fromEmail}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
  console.log(`[Email Success] Brevo SMTP (Port 465 SSL) → ${options.to} | Subject: "${options.subject}" | ID: ${info.messageId}`);
};

// ─── Unified sendMail ─────────────────────────────────────────────────────────

export const sendMail = async (options: SendMailOptions): Promise<void> => {
  // 1. If explicit Brevo REST API key (xkeysib-) is provided, use Brevo HTTP REST API
  if (env.brevo.apiKey && env.brevo.apiKey.startsWith('xkeysib-')) {
    try {
      await sendViaBrevoApi(options, env.brevo.apiKey);
      return;
    } catch (apiErr: any) {
      console.warn('[Email Warning] Brevo REST API failed, trying SMTP fallback:', apiErr?.message || apiErr);
    }
  }

  // 2. Default/Primary: Nodemailer SMTP on Port 465 SSL (works for xsmtpsib- Brevo SMTP keys)
  if (env.smtp.user && env.smtp.pass) {
    try {
      await sendViaSmtp(options);
      return;
    } catch (smtpErr: any) {
      transporter = null;
      console.error(`[Email Error] SMTP failed for ${options.to}:`, smtpErr?.message || smtpErr);
      throw smtpErr;
    }
  }

  throw new Error('[Email] No valid email configuration found. Set SMTP_USER and SMTP_PASS in environment.');
};

// ─── Email Dispatcher ─────────────────────────────────────────────────────────

const enqueueEmail = async (options: SendMailOptions): Promise<void> => {
  // Execute email sending in the next event loop tick so Express responds to client instantly (<15ms)
  setImmediate(async () => {
    try {
      await sendMail(options);
    } catch (err: any) {
      console.error(`[Email] Delivery failed for "${options.subject}" → ${options.to}:`, err?.message || err);
    }
  });
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
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #1a1a2e; padding: 30px; text-align: center; }
    .header h1 { color: #f5a623; margin: 0; font-size: 24px; letter-spacing: 1px; }
    .body { padding: 32px; color: #333; line-height: 1.6; }
    .btn { display: inline-block; margin: 24px 0; padding: 14px 32px; background: #f5a623; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; }
    .otp-box { display: inline-block; margin: 24px 0; padding: 18px 40px; background: #1a1a2e; color: #f5a623; border-radius: 8px; font-size: 36px; font-weight: bold; letter-spacing: 12px; font-family: 'Courier New', monospace; }
    .footer { background: #f9f9f9; padding: 16px; text-align: center; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>PRC Hardware</h1></div>
    <div class="body">${content}</div>
    <div class="footer">Pacific Hardware Enterprise &copy; ${new Date().getFullYear()} &bull; All rights reserved.</div>
  </div>
</body>
</html>`;

// ─── OTP Email ────────────────────────────────────────────────────────────────

export const sendOtpEmail = async (to: string, firstName: string, otp: string): Promise<void> => {
  await enqueueEmail({
    to,
    subject: 'Your PRC Hardware verification code',
    html: baseTemplate(`
      <h2>Hello ${firstName},</h2>
      <p>Thank you for registering with PRC Hardware. Use the verification code below to confirm your email address.</p>
      <p style="text-align:center;"><span class="otp-box">${otp}</span></p>
      <p>This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
      <p>If you did not create an account, you can safely ignore this email.</p>
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
      <p>Please verify your email address to activate your account.</p>
      <p>This link expires in <strong>24 hours</strong>.</p>
      <a href="${link}" class="btn">Verify Email Address</a>
      <p>Or copy this link:<br/><small>${link}</small></p>
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
      <p>We received a request to reset your password. Click the button below to set a new password.</p>
      <p>This link expires in <strong>1 hour</strong>.</p>
      <a href="${link}" class="btn">Reset Password</a>
      <p>If you did not request a reset, ignore this email.</p>
      <p>Or copy this link:<br/><small>${link}</small></p>
    `),
  });
};

// ─── Password Changed Email ───────────────────────────────────────────────────

export const sendPasswordChangedEmail = async (to: string, firstName: string): Promise<void> => {
  await enqueueEmail({
    to,
    subject: 'Your PRC Hardware password has been changed',
    html: baseTemplate(`
      <h2>Hello ${firstName},</h2>
      <p>Your password was successfully changed. If you made this change, no further action is needed.</p>
      <p>If you did <strong>not</strong> make this change, please contact our support team immediately.</p>
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
      <p>Your email has been verified and your account is now active. You can now explore our full catalog of hardware products.</p>
      <a href="${env.frontend.url}/shop" class="btn">Start Shopping</a>
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
      <div style="background:#f9f9f9; padding:20px; border-radius:6px; margin:20px 0; border-left:4px solid #f5a623;">
        <p style="margin:4px 0;"><strong>Tracking ID:</strong> <span style="color:#f5a623; font-weight:bold; font-size:16px;">${params.trackingId}</span></p>
        <p style="margin:4px 0;"><strong>Booking Ref:</strong> ${params.appointmentNumber}</p>
        <p style="margin:4px 0;"><strong>Service:</strong> ${params.serviceName}</p>
        <p style="margin:4px 0;"><strong>Date:</strong> ${params.date}</p>
        <p style="margin:4px 0;"><strong>Time Slot:</strong> ${params.startTime} - ${params.endTime}</p>
        ${params.staffName ? `<p style="margin:4px 0;"><strong>Specialist:</strong> ${params.staffName}</p>` : ''}
        ${params.locationName ? `<p style="margin:4px 0;"><strong>Location:</strong> ${params.locationName}</p>` : ''}
      </div>
      <p>You can track or manage your appointment anytime using your Tracking ID.</p>
      <a href="${trackingLink}" class="btn">Track Appointment Status</a>
      <p>Direct Link:<br/><small>${trackingLink}</small></p>
    `),
  });
};
