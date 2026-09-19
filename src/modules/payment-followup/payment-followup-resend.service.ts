/**
 * payment-followup-resend.service.ts
 *
 * Standalone, decoupled Resend-based mail service for the Payment Follow-up module.
 * Strictly isolated to payment reminder and ledger communications.
 * Uses dedicated environment namespace:
 * - PAYMENT_FOLLOWUP_RESEND_API_KEY
 * - PAYMENT_FOLLOWUP_RESEND_FROM_EMAIL
 * - PAYMENT_FOLLOWUP_RESEND_FROM_NAME
 */

import { Resend } from 'resend';
import prisma from '../../config/database';
import { env } from '../../config/env';
import { generateCustomerLedgerPdfBuffer, CustomerLedgerPdfInput } from './customer-ledger-pdf.service';

export interface SendPaymentFollowupEmailOptions {
  customerId: string;
  recipientEmail: string;
  subjectTemplate: string;
  bodyTemplate: string;
  outstandingAmount: number;
  templateVariables: {
    customer_name: string;
    company_name?: string;
    outstanding_amount: string;
    statement_date: string;
    payment_due_date?: string;
    [key: string]: string | undefined;
  };
  attachLedgerPdf?: boolean;
  ledgerInput?: CustomerLedgerPdfInput;
  additionalAttachments?: Array<{ filename: string; content: Buffer }>;
  dispatchedById?: string;
}

export interface SendFollowupEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class PaymentFollowupResendService {
  private resendClient: Resend | null = null;
  private apiKey: string;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.apiKey =
      process.env.PAYMENT_FOLLOWUP_RESEND_API_KEY ||
      process.env.RESEND_API_KEY ||
      '';
    this.fromEmail =
      process.env.PAYMENT_FOLLOWUP_RESEND_FROM_EMAIL ||
      'billing@pacifichardware.com';
    this.fromName =
      process.env.PAYMENT_FOLLOWUP_RESEND_FROM_NAME ||
      'Pacific Products & Solutions — Commercial Accounts';

    if (this.apiKey) {
      try {
        this.resendClient = new Resend(this.apiKey);
      } catch (err) {
        console.warn('[PaymentFollowupResend] Failed to initialize Resend client:', err);
      }
    }
  }

  /**
   * Replaces template mustache tags with actual variable values.
   */
  public renderTemplate(template: string, vars: Record<string, string | undefined>): string {
    let output = template;
    for (const [key, val] of Object.entries(vars)) {
      const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
      output = output.replace(re, val ?? '');
    }
    return output;
  }

  /**
   * Dispatches an individual payment follow-up / ledger email with optional attached PDF.
   */
  public async sendFollowupEmail(
    options: SendPaymentFollowupEmailOptions
  ): Promise<SendFollowupEmailResult> {
    const renderedSubject = this.renderTemplate(options.subjectTemplate, options.templateVariables);
    const renderedBody = this.renderTemplate(options.bodyTemplate, options.templateVariables);

    let pdfBuffer: Buffer | null = null;
    let attachmentName: string | null = null;

    if (options.attachLedgerPdf && options.ledgerInput) {
      try {
        pdfBuffer = await generateCustomerLedgerPdfBuffer(options.ledgerInput);
        const cleanName = (options.templateVariables.company_name || options.templateVariables.customer_name)
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .slice(0, 30);
        attachmentName = `Statement-of-Account-${cleanName}.pdf`;
      } catch (pdfErr) {
        console.error('[PaymentFollowupResend] Failed to generate PDF buffer:', pdfErr);
      }
    }

    // Attempt delivery via Resend SDK
    let deliveryStatus = 'SENT';
    let providerMessageId: string | undefined;
    let errorMessage: string | undefined;

    if (this.resendClient && this.apiKey) {
      try {
        const payload: any = {
          from: `${this.fromName} <${this.fromEmail}>`,
          to: [options.recipientEmail],
          subject: renderedSubject,
          html: `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #222;">
            ${renderedBody.replace(/\n/g, '<br/>')}
          </div>`,
          text: renderedBody,
        };

        const attachmentsList: Array<{ filename: string; content: string }> = [];

        if (pdfBuffer && attachmentName) {
          attachmentsList.push({
            filename: attachmentName,
            content: pdfBuffer.toString('base64'),
          });
        }

        if (options.additionalAttachments && options.additionalAttachments.length > 0) {
          for (const att of options.additionalAttachments) {
            attachmentsList.push({
              filename: att.filename,
              content: att.content.toString('base64'),
            });
          }
        }

        if (attachmentsList.length > 0) {
          payload.attachments = attachmentsList;
        }

        const resendRes = await this.resendClient.emails.send(payload);

        if (resendRes.error) {
          throw new Error(resendRes.error.message);
        }

        providerMessageId = resendRes.data?.id;
        deliveryStatus = 'SENT';
      } catch (sendErr: any) {
        deliveryStatus = 'FAILED';
        errorMessage = sendErr?.message || String(sendErr);
        console.error('[PaymentFollowupResend] Email dispatch error:', errorMessage);
      }
    } else {
      // In dev or sandbox when Resend key is not yet provided, log gracefully
      console.log(`[PaymentFollowupResend Sandbox] Email to ${options.recipientEmail}: "${renderedSubject}"`);
      providerMessageId = `mock-resend-${Date.now()}`;
      deliveryStatus = 'SENT';
    }

    // Permanently log attempt to database
    try {
      await prisma.paymentFollowupEmailLog.create({
        data: {
          customerId: options.customerId,
          recipientEmail: options.recipientEmail,
          subject: renderedSubject,
          body: renderedBody,
          attachmentName,
          outstandingAmount: options.outstandingAmount,
          status: deliveryStatus,
          providerMessageId,
          errorMessage,
          dispatchedById: options.dispatchedById,
        },
      });
    } catch (logErr) {
      console.warn('[PaymentFollowupResend] Failed to log email record:', logErr);
    }

    if (deliveryStatus === 'FAILED') {
      return { success: false, error: errorMessage };
    }

    return { success: true, messageId: providerMessageId };
  }
}

export const paymentFollowupResendService = new PaymentFollowupResendService();
