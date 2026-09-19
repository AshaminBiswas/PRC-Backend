/**
 * sms-reminder.service.ts
 *
 * HTTP-based SMS sender and logging service for Payment Follow-up reminders.
 * Connects to configured HTTP SMS gateway with template interpolation and graceful failure resilience.
 */

import prisma from '../../config/database';

export interface SendSmsReminderOptions {
  customerId: string;
  phoneNumber: string;
  template: string;
  templateVariables: {
    customer_name: string;
    outstanding_amount: string;
    due_date?: string;
    [key: string]: string | undefined;
  };
  outstandingAmount: number;
  templateName?: string;
  dispatchedById?: string;
}

export interface SendSmsResult {
  success: boolean;
  messageId?: string;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  error?: string;
}

export class SmsReminderService {
  private gatewayUrl: string;
  private apiKey: string;
  private senderId: string;

  constructor() {
    this.gatewayUrl = process.env.SMS_GATEWAY_URL || '';
    this.apiKey = process.env.SMS_API_KEY || '';
    this.senderId = process.env.SMS_SENDER_ID || 'PRCHRD';
  }

  /**
   * Replaces mustache variables in SMS template
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
   * Cleans phone number to standard 10-digit Indian mobile
   */
  public cleanPhoneNumber(phone: string): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return digits;
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    return null;
  }

  /**
   * Sends an SMS reminder via HTTP POST/GET to the gateway and logs to database.
   */
  public async sendSmsReminder(options: SendSmsReminderOptions): Promise<SendSmsResult> {
    const cleanPhone = this.cleanPhoneNumber(options.phoneNumber);

    if (!cleanPhone) {
      const errorMsg = 'Invalid phone number format';
      await this.logSms(options, options.phoneNumber, 'FAILED', null, errorMsg);
      return { success: false, status: 'FAILED', error: errorMsg };
    }

    const messageText = this.renderTemplate(options.template, options.templateVariables);

    let deliveryStatus: 'SENT' | 'FAILED' = 'SENT';
    let providerResponse: string | null = null;
    let errorMessage: string | null = null;
    let messageId: string | undefined;

    if (this.gatewayUrl && this.apiKey) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        const response = await fetch(this.gatewayUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            sender: this.senderId,
            to: `91${cleanPhone}`,
            message: messageText,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const resText = await response.text();
        providerResponse = resText.slice(0, 1000);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${resText.slice(0, 200)}`);
        }

        try {
          const json = JSON.parse(resText);
          messageId = json.messageId || json.id || json.reqId;
        } catch {}

        deliveryStatus = 'SENT';
      } catch (err: any) {
        deliveryStatus = 'FAILED';
        errorMessage = err?.name === 'AbortError' ? 'SMS Gateway Timeout (8s)' : (err?.message || String(err));
        console.warn(`[SmsReminder] Failed to send SMS to ${cleanPhone}:`, errorMessage);
      }
    } else {
      // In development or sandbox when gateway is not configured
      console.log(`[SmsReminder Sandbox] SMS to 91${cleanPhone}: "${messageText}"`);
      deliveryStatus = 'SENT';
      providerResponse = JSON.stringify({ status: 'success', sandbox: true });
      messageId = `mock-sms-${Date.now()}`;
    }

    await this.logSms(options, cleanPhone, deliveryStatus, providerResponse, errorMessage);

    if (deliveryStatus === 'FAILED') {
      return { success: false, status: 'FAILED', error: errorMessage || 'SMS dispatch failed' };
    }

    return { success: true, status: 'SENT', messageId };
  }

  private async logSms(
    options: SendSmsReminderOptions,
    phone: string,
    status: 'SENT' | 'FAILED',
    providerResponse: string | null,
    errorMessage: string | null
  ): Promise<void> {
    try {
      await prisma.paymentFollowupSmsLog.create({
        data: {
          customerId: options.customerId,
          phoneNumber: phone,
          message: this.renderTemplate(options.template, options.templateVariables),
          templateUsed: options.templateName || 'DEFAULT_DUE_REMINDER',
          outstandingAmount: options.outstandingAmount,
          status,
          providerResponse,
          errorMessage,
          dispatchedById: options.dispatchedById,
        },
      });
    } catch (logErr) {
      console.warn('[SmsReminder] Could not log SMS record:', logErr);
    }
  }
}

export const smsReminderService = new SmsReminderService();
