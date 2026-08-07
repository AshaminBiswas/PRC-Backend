import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { Prisma } from '@prisma/client';
import { enqueueJob } from '../jobs/asyncJob.service';

// ─── Transporter ─────────────────────────────────────────────────────────────

let transporter: Transporter;

const getTransporter = (): Transporter => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: {
        user: env.smtp.user,
        pass: env.smtp.pass,
      },
    });
  }
  return transporter;
};

// ─── Base Send ────────────────────────────────────────────────────────────────

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

export const sendMail = async (options: SendMailOptions): Promise<void> => {
  if (!env.smtp.user || !env.smtp.pass) {
    console.warn(`[Email Warning] SMTP_USER or SMTP_PASS is missing in environment variables. Email to ${options.to} was not dispatched.`);
    return;
  }

  try {
    const transport = getTransporter();
    const info = await transport.sendMail({
      from: `"${env.smtp.fromName}" <${env.smtp.fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    console.log(`[Email Success] Sent to ${options.to} | Subject: "${options.subject}" | MessageID: ${info.messageId}`);
  } catch (error: any) {
    console.error(`[Email Error] Failed sending email to ${options.to}:`, error?.message || error);
    throw error;
  }
};

// ─── Email Dispatcher ─────────────────────────────────────────────────────────

const enqueueEmail = async (options: SendMailOptions): Promise<void> => {
  // If async jobs are disabled or in dev mode, send email directly via Nodemailer
  if (env.isDev || !env.asyncJobs.enabled) {
    await sendMail(options);
    return;
  }

  try {
    const job = await enqueueJob('email.send', options as unknown as Prisma.InputJsonObject, { queue: 'default' });
    if (!job) {
      await sendMail(options);
    }
  } catch (error) {
    console.error('[Email] Enqueue failed, falling back to direct send:', error);
    await sendMail(options);
  }
};

// ─── Email Templates ──────────────────────────────────────────────────────────

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

// ─── Specific Emails ──────────────────────────────────────────────────────────

export const sendVerificationEmail = async (
  to: string,
  firstName: string,
  token: string
): Promise<void> => {
  const link = `${env.frontend.url}/verify-email?token=${token}`;
  await enqueueEmail({
    to,
    subject: 'Verify your PRC Hardware account',
    html: baseTemplate(`
      <h2>Hello ${firstName},</h2>
      <p>Thank you for registering with PRC Hardware. Please verify your email address to activate your account.</p>
      <p>This link expires in <strong>24 hours</strong>.</p>
      <a href="${link}" class="btn">Verify Email Address</a>
      <p>If you did not create an account, you can safely ignore this email.</p>
      <p>Or copy this link:<br/><small>${link}</small></p>
    `),
  });
};

export const sendPasswordResetEmail = async (
  to: string,
  firstName: string,
  token: string
): Promise<void> => {
  const link = `${env.frontend.url}/reset-password?token=${token}`;
  await enqueueEmail({
    to,
    subject: 'Reset your PRC Hardware password',
    html: baseTemplate(`
      <h2>Hello ${firstName},</h2>
      <p>We received a request to reset your password. Click the button below to set a new password.</p>
      <p>This link expires in <strong>1 hour</strong>.</p>
      <a href="${link}" class="btn">Reset Password</a>
      <p>If you did not request a password reset, please ignore this email — your password will not change.</p>
      <p>Or copy this link:<br/><small>${link}</small></p>
    `),
  });
};

export const sendPasswordChangedEmail = async (
  to: string,
  firstName: string
): Promise<void> => {
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

export const sendWelcomeEmail = async (
  to: string,
  firstName: string
): Promise<void> => {
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
      <p>You can track or manage your appointment status anytime using your Tracking ID.</p>
      <a href="${trackingLink}" class="btn">Track Appointment Status</a>
      <p>Direct Link:<br/><small>${trackingLink}</small></p>
    `),
  });
};
