/**
 * followup-rule.service.ts
 *
 * Configurable rules management and automated scheduler service.
 * Determines eligible overdue customers and executes reminders while
 * strictly excluding accounts in DECLINED or DISPUTED status.
 */

import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { FollowupRuleInput } from './payment-followup.types';
import { paymentFollowupResendService } from './payment-followup-resend.service';
import { smsReminderService } from './sms-reminder.service';

export class FollowupRuleService {
  /**
   * List all configured follow-up rules.
   */
  public async listRules() {
    const rules = await prisma.paymentFollowupRule.findMany({
      orderBy: { agingThresholdDays: 'asc' },
    });
    return rules;
  }

  /**
   * Seed standard default rules if none exist.
   */
  public async ensureDefaultRules() {
    const count = await prisma.paymentFollowupRule.count();
    if (count > 0) return;

    const defaults: FollowupRuleInput[] = [
      {
        name: 'Courtesy Due Reminder (3 Days Overdue)',
        isEnabled: true,
        agingThresholdDays: 3,
        repeatIntervalDays: 7,
        communicationType: 'SMS_REMINDER',
        maxReminders: 3,
        templateBody:
          'Dear {{customer_name}}, a gentle reminder that an outstanding payment of \u20B9{{outstanding_amount}} is pending with PRC Hardware. Kindly arrange payment. Thank you.',
      },
      {
        name: 'Statement of Account Dispatch (15 Days Overdue)',
        isEnabled: true,
        agingThresholdDays: 15,
        repeatIntervalDays: 10,
        communicationType: 'EMAIL_LEDGER',
        maxReminders: 4,
        templateSubject: 'Outstanding Commercial Statement — {{customer_name}} [₹{{outstanding_amount}}]',
        templateBody:
          'Dear {{customer_name}},\n\nPlease find attached the official Statement of Account for your pending balance of \u20B9{{outstanding_amount}} with Pacific Products & Solutions.\n\nKindly arrange the remittance at the earliest and share the bank UTR reference.\n\nRegards,\nCommercial Accounts Desk\nPacific Products & Solutions',
      },
      {
        name: 'Critical Overdue Escalation (30 Days Overdue)',
        isEnabled: true,
        agingThresholdDays: 30,
        repeatIntervalDays: 7,
        communicationType: 'EMAIL_LEDGER',
        maxReminders: 5,
        templateSubject: 'URGENT: Commercial Payment Overdue Escalation Notice — {{customer_name}}',
        templateBody:
          'Dear {{customer_name}},\n\nYour account has reached 30+ days overdue with a total pending balance of \u20B9{{outstanding_amount}}.\n\nTo prevent interruption in trade credit and dispatches, please settle this outstanding immediately. Official Statement of Account is attached.\n\nCommercial Accounts Operations Desk\nPacific Products & Solutions',
      },
    ];

    for (const r of defaults) {
      await prisma.paymentFollowupRule.create({ data: r });
    }
    console.log('[FollowupRule] Default follow-up rules seeded.');
  }

  /**
   * Create or update a rule.
   */
  public async upsertRule(input: FollowupRuleInput) {
    if (!input.name || !input.templateBody) {
      throw new AppError('BAD_REQUEST', 'Rule name and template body are required', 400);
    }

    if (input.id) {
      return prisma.paymentFollowupRule.update({
        where: { id: input.id },
        data: {
          name: input.name,
          isEnabled: input.isEnabled,
          agingThresholdDays: Number(input.agingThresholdDays),
          repeatIntervalDays: Number(input.repeatIntervalDays),
          communicationType: input.communicationType,
          maxReminders: Number(input.maxReminders || 5),
          templateSubject: input.templateSubject || null,
          templateBody: input.templateBody,
        },
      });
    }

    return prisma.paymentFollowupRule.create({
      data: {
        name: input.name,
        isEnabled: input.isEnabled,
        agingThresholdDays: Number(input.agingThresholdDays),
        repeatIntervalDays: Number(input.repeatIntervalDays),
        communicationType: input.communicationType,
        maxReminders: Number(input.maxReminders || 5),
        templateSubject: input.templateSubject || null,
        templateBody: input.templateBody,
      },
    });
  }

  /**
   * Delete a rule.
   */
  public async deleteRule(id: string) {
    return prisma.paymentFollowupRule.delete({ where: { id } });
  }

  /**
   * Daily scheduler run: finds eligible overdue customers and dispatches reminders.
   * STRICT SAFETY RULE: Excludes customers in DECLINED or DISPUTED status.
   */
  public async runScheduledFollowups(): Promise<{
    processedRules: number;
    remindersSent: number;
    skippedCount: number;
  }> {
    const activeRules = await prisma.paymentFollowupRule.findMany({
      where: { isEnabled: true },
      orderBy: { agingThresholdDays: 'desc' },
    });

    if (activeRules.length === 0) {
      return { processedRules: 0, remindersSent: 0, skippedCount: 0 };
    }

    // Lazy import payment-followup.service to avoid circular deps
    const { paymentFollowupService } = await import('./payment-followup.service');
    const allCustomers = await paymentFollowupService.listCustomerDues({ limit: 1000 });

    let remindersSent = 0;
    let skippedCount = 0;
    const now = new Date();

    for (const cust of allCustomers.items) {
      // 1. Skip customers without outstanding balance
      if (cust.totalOutstanding <= 0) continue;

      // 2. SAFETY CHECK: Never auto-contact DECLINED or DISPUTED accounts
      if (cust.followupStatus === 'DECLINED' || cust.followupStatus === 'DISPUTED') {
        skippedCount++;
        continue;
      }

      // 3. Find highest applicable rule based on days overdue
      const matchingRule = activeRules.find((r) => cust.maxDaysOverdue >= r.agingThresholdDays);
      if (!matchingRule) continue;

      // 4. Check repeat interval
      if (cust.lastFollowupDate) {
        const daysSinceLast = Math.floor((now.getTime() - new Date(cust.lastFollowupDate).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceLast < matchingRule.repeatIntervalDays) {
          skippedCount++;
          continue;
        }
      }

      // 5. Check max reminders threshold
      if (cust.totalRemindersSent >= matchingRule.maxReminders) {
        skippedCount++;
        continue;
      }

      // 6. Execute reminder based on communication channel
      try {
        if (matchingRule.communicationType === 'EMAIL_LEDGER') {
          if (!cust.email) {
            skippedCount++;
            continue;
          }

          const duesDetail = await paymentFollowupService.getCustomerDuesDetail(cust.customerId);
          const ledgerPdfInput = paymentFollowupService.buildLedgerPdfInput(duesDetail);

          const res = await paymentFollowupResendService.sendFollowupEmail({
            customerId: cust.customerId,
            recipientEmail: cust.email,
            subjectTemplate: matchingRule.templateSubject || 'Outstanding Payment Statement — {{customer_name}}',
            bodyTemplate: matchingRule.templateBody,
            outstandingAmount: cust.totalOutstanding,
            templateVariables: {
              customer_name: cust.customerName,
              company_name: cust.companyName || cust.customerName,
              outstanding_amount: cust.totalOutstanding.toLocaleString('en-IN'),
              statement_date: new Date().toLocaleDateString('en-IN'),
              payment_due_date: cust.oldestDueDate ? new Date(cust.oldestDueDate).toLocaleDateString('en-IN') : 'Immediate',
            },
            attachLedgerPdf: true,
            ledgerInput: ledgerPdfInput,
            dispatchedById: 'automated-scheduler',
          });

          if (res.success) {
            remindersSent++;
            await paymentFollowupService.recordReminderTouchpoint(cust.customerId, 'EMAIL', `Auto-Reminder sent: ${matchingRule.name}`);
          }
        } else if (matchingRule.communicationType === 'SMS_REMINDER') {
          if (!cust.phone) {
            skippedCount++;
            continue;
          }

          const res = await smsReminderService.sendSmsReminder({
            customerId: cust.customerId,
            phoneNumber: cust.phone,
            template: matchingRule.templateBody,
            templateVariables: {
              customer_name: cust.customerName,
              outstanding_amount: cust.totalOutstanding.toLocaleString('en-IN'),
              due_date: cust.oldestDueDate ? new Date(cust.oldestDueDate).toLocaleDateString('en-IN') : 'Immediate',
            },
            outstandingAmount: cust.totalOutstanding,
            templateName: matchingRule.name,
            dispatchedById: 'automated-scheduler',
          });

          if (res.success) {
            remindersSent++;
            await paymentFollowupService.recordReminderTouchpoint(cust.customerId, 'SMS', `Auto-SMS sent: ${matchingRule.name}`);
          }
        }
      } catch (custErr) {
        console.warn(`[FollowupRule] Failed auto-reminder for customer ${cust.customerName}:`, custErr);
        skippedCount++;
      }
    }

    return {
      processedRules: activeRules.length,
      remindersSent,
      skippedCount,
    };
  }
}

export const followupRuleService = new FollowupRuleService();
