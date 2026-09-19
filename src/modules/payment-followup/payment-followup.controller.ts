/**
 * payment-followup.controller.ts
 *
 * Express HTTP request controller for the Payment Follow-up & Dues Recovery module.
 */

import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../../utils/response';
import { paymentFollowupService } from './payment-followup.service';
import { paymentAllocationService } from './payment-allocation.service';
import { followupRuleService } from './followup-rule.service';
import { generateCustomerLedgerPdfBuffer } from './customer-ledger-pdf.service';
import { paymentFollowupResendService } from './payment-followup-resend.service';
import { smsReminderService } from './sms-reminder.service';

export class PaymentFollowupController {
  public getDashboardMetrics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await paymentFollowupService.getDuesDashboardMetrics();
      sendSuccess(res, data, 'Payment follow-up dashboard metrics retrieved successfully');
    } catch (err) {
      next(err);
    }
  };

  public listCustomerDues = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await paymentFollowupService.listCustomerDues({
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 50,
        search: req.query.search as string,
        agingBucket: req.query.agingBucket as string,
        followupStatus: req.query.followupStatus as string,
        missingInfo: req.query.missingInfo as string,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any,
      });
      sendSuccess(res, data, 'Customer dues list retrieved successfully');
    } catch (err) {
      next(err);
    }
  };

  public getCustomerDuesDetail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await paymentFollowupService.getCustomerDuesDetail(req.params.id);
      sendSuccess(res, data, 'Customer dues detail retrieved successfully');
    } catch (err) {
      next(err);
    }
  };

  public checkDuplicateCustomer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const matches = await paymentFollowupService.checkDuplicateCustomer(req.body);
      sendSuccess(res, { matches, hasDuplicates: matches.length > 0 }, 'Duplicate check completed');
    } catch (err) {
      next(err);
    }
  };

  public addOldCustomer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await paymentFollowupService.addOldCustomer(req.user?.id, req.body);
      sendSuccess(res, data, 'Old customer registered with historical opening balance', 201);
    } catch (err) {
      next(err);
    }
  };

  public recordPaymentAllocation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await paymentAllocationService.recordAndAllocatePayment(req.user?.id, req.body);
      sendSuccess(res, data, 'Payment allocated and ledger updated successfully', 201);
    } catch (err) {
      next(err);
    }
  };

  public logFollowupTouchpoint = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await paymentFollowupService.logFollowupTouchpoint(req.params.id, req.user?.id, req.body);
      sendSuccess(res, data, 'Follow-up touchpoint logged successfully', 201);
    } catch (err) {
      next(err);
    }
  };

  public declineOrDispute = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await paymentFollowupService.declineOrDisputeCustomer(req.params.id, req.user?.id, req.body);
      sendSuccess(res, data, `Customer transitioned to ${req.body.status} successfully`);
    } catch (err) {
      next(err);
    }
  };

  public resumeFollowup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await paymentFollowupService.resumeCustomerFollowup(req.params.id, req.user?.id);
      sendSuccess(res, data, 'Customer follow-up resumed and reactivated');
    } catch (err) {
      next(err);
    }
  };

  public addBalanceEntry = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await paymentFollowupService.addBalanceEntry(req.user?.id, req.params.id, req.body);
      sendSuccess(res, data, 'Balance entry recorded successfully', 201);
    } catch (err) {
      next(err);
    }
  };

  public getLedger = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fromDate, toDate } = req.query as { fromDate?: string; toDate?: string };
      const data = await paymentFollowupService.getCustomerLedgerJson(req.params.id, fromDate, toDate);
      sendSuccess(res, data, 'Customer ledger retrieved successfully');
    } catch (err) {
      next(err);
    }
  };

  public downloadLedgerPdf = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fromDate, toDate } = req.query as { fromDate?: string; toDate?: string };
      const duesDetail = await paymentFollowupService.getCustomerDuesDetail(req.params.id);
      const pdfBuffer = await paymentFollowupService.getCustomerLedgerPdf(req.params.id, fromDate, toDate);

      const safeName = duesDetail.customer.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Statement-of-Account-${safeName}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  };

  public sendCommunication = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await paymentFollowupService.sendCustomerCommunication(req.user?.id, req.params.id, req.body);
      sendSuccess(res, data, 'Customer communication processed successfully');
    } catch (err) {
      next(err);
    }
  };

  public sendLedgerEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const duesDetail = await paymentFollowupService.getCustomerDuesDetail(req.params.id);
      const targetEmail = req.body.recipientEmail || duesDetail.customer.email;

      if (!targetEmail) {
        sendError(res, { code: 'BAD_REQUEST', message: 'Customer does not have a registered email address' }, 400);
        return;
      }

      const ledgerPdfInput = paymentFollowupService.buildLedgerPdfInput(duesDetail);

      const result = await paymentFollowupResendService.sendFollowupEmail({
        customerId: req.params.id,
        recipientEmail: targetEmail,
        subjectTemplate:
          req.body.subject || 'Outstanding Commercial Statement — {{customer_name}} [₹{{outstanding_amount}}]',
        bodyTemplate:
          req.body.body ||
          'Dear {{customer_name}},\n\nPlease find attached the official Statement of Account regarding your pending balance of \u20B9{{outstanding_amount}} with Pacific Products & Solutions.\n\nKindly arrange the remittance at the earliest and share the bank UTR reference.\n\nRegards,\nCommercial Accounts Desk\nPacific Products & Solutions',
        outstandingAmount: duesDetail.summary.totalOutstanding,
        templateVariables: {
          customer_name: duesDetail.customer.name,
          company_name: duesDetail.customer.companyName || duesDetail.customer.name,
          outstanding_amount: duesDetail.summary.totalOutstanding.toLocaleString('en-IN'),
          statement_date: new Date().toLocaleDateString('en-IN'),
        },
        attachLedgerPdf: true,
        ledgerInput: ledgerPdfInput,
        dispatchedById: req.user?.id,
      });

      if (!result.success) {
        sendError(res, { code: 'EMAIL_DISPATCH_FAILED', message: result.error || 'Failed to dispatch email' }, 500);
        return;
      }

      await paymentFollowupService.recordReminderTouchpoint(
        req.params.id,
        'EMAIL',
        `Statement of Account emailed to ${targetEmail}.`
      );

      sendSuccess(res, result, 'Statement email dispatched successfully via Resend');
    } catch (err) {
      next(err);
    }
  };

  public sendSmsReminder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const duesDetail = await paymentFollowupService.getCustomerDuesDetail(req.params.id);
      const targetPhone = req.body.phoneNumber || duesDetail.customer.phone;

      if (!targetPhone) {
        sendError(res, { code: 'BAD_REQUEST', message: 'Customer does not have a valid phone number' }, 400);
        return;
      }

      const result = await smsReminderService.sendSmsReminder({
        customerId: req.params.id,
        phoneNumber: targetPhone,
        template:
          req.body.template ||
          'Dear {{customer_name}}, your outstanding payment of \u20B9{{outstanding_amount}} is pending with PRC Hardware. Please arrange payment at the earliest. — Pacific Products & Solutions',
        templateVariables: {
          customer_name: duesDetail.customer.name,
          outstanding_amount: duesDetail.summary.totalOutstanding.toLocaleString('en-IN'),
        },
        outstandingAmount: duesDetail.summary.totalOutstanding,
        templateName: 'MANUAL_REMINDER',
        dispatchedById: req.user?.id,
      });

      if (!result.success) {
        sendError(res, { code: 'SMS_DISPATCH_FAILED', message: result.error || 'Failed to send SMS' }, 500);
        return;
      }

      await paymentFollowupService.recordReminderTouchpoint(
        req.params.id,
        'SMS',
        `Payment reminder SMS dispatched to ${targetPhone}.`
      );

      sendSuccess(res, result, 'SMS reminder dispatched successfully');
    } catch (err) {
      next(err);
    }
  };

  public previewBulk = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { customerIds, actionType } = req.body;
      if (!Array.isArray(customerIds) || customerIds.length === 0) {
        sendError(res, { code: 'BAD_REQUEST', message: 'customerIds array is required' }, 400);
        return;
      }

      const preview = await paymentFollowupService.previewBulkAction(customerIds, actionType);
      sendSuccess(res, preview, 'Bulk action preview generated');
    } catch (err) {
      next(err);
    }
  };

  public executeBulkLedger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { customerIds, templates } = req.body;
      if (!Array.isArray(customerIds) || customerIds.length === 0) {
        sendError(res, { code: 'BAD_REQUEST', message: 'customerIds array is required' }, 400);
        return;
      }

      const result = await paymentFollowupService.executeBulkSendLedger(req.user?.id, customerIds, templates);
      sendSuccess(res, result, 'Bulk ledger email processing finished');
    } catch (err) {
      next(err);
    }
  };

  public executeBulkSms = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { customerIds, template } = req.body;
      if (!Array.isArray(customerIds) || customerIds.length === 0) {
        sendError(res, { code: 'BAD_REQUEST', message: 'customerIds array is required' }, 400);
        return;
      }

      const result = await paymentFollowupService.executeBulkSendSms(req.user?.id, customerIds, template);
      sendSuccess(res, result, 'Bulk SMS reminder processing finished');
    } catch (err) {
      next(err);
    }
  };

  public listRules = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await followupRuleService.ensureDefaultRules();
      const rules = await followupRuleService.listRules();
      sendSuccess(res, rules, 'Follow-up rules retrieved successfully');
    } catch (err) {
      next(err);
    }
  };

  public upsertRule = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rule = await followupRuleService.upsertRule(req.body);
      sendSuccess(res, rule, 'Follow-up rule saved successfully', 201);
    } catch (err) {
      next(err);
    }
  };

  public deleteRule = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await followupRuleService.deleteRule(req.params.id);
      sendSuccess(res, { id: req.params.id }, 'Follow-up rule deleted successfully');
    } catch (err) {
      next(err);
    }
  };

  public runScheduledTrigger = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await followupRuleService.runScheduledFollowups();
      sendSuccess(res, result, 'Scheduled follow-up batch executed successfully');
    } catch (err) {
      next(err);
    }
  };
}

export const paymentFollowupController = new PaymentFollowupController();
