/**
 * payment-followup.routes.ts
 *
 * Express Router for Payment Follow-up & Dues Recovery module.
 */

import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { paymentFollowupController } from './payment-followup.controller';

export const paymentFollowupRouter = Router();

// All routes require authentication
paymentFollowupRouter.use(authenticate);

// ─── 1. Dashboard Metrics ───────────────────────────────────────────────────
paymentFollowupRouter.get(
  '/metrics',
  authorize('payment_followup.view', 'invoices.read'),
  paymentFollowupController.getDashboardMetrics
);

// ─── 2. Customer Dues List & Details ────────────────────────────────────────
paymentFollowupRouter.get(
  '/customers',
  authorize('payment_followup.view', 'invoices.read'),
  paymentFollowupController.listCustomerDues
);

paymentFollowupRouter.get(
  '/customers/:id',
  authorize('payment_followup.view', 'invoices.read'),
  paymentFollowupController.getCustomerDuesDetail
);

// ─── 3. Add Old Customer & Duplicate Pre-flight Check ────────────────────────
paymentFollowupRouter.post(
  '/check-duplicate',
  authorize('payment_followup.manage', 'users.create'),
  paymentFollowupController.checkDuplicateCustomer
);

paymentFollowupRouter.post(
  '/customers/old',
  authorize('payment_followup.manage', 'users.create'),
  paymentFollowupController.addOldCustomer
);

// ─── 4. Payment Allocation (Invoice-Specific vs Oldest-Due-First) ────────────
paymentFollowupRouter.post(
  '/payments/allocate',
  authorize('payment_followup.manage', 'invoices.update'),
  paymentFollowupController.recordPaymentAllocation
);

paymentFollowupRouter.post(
  '/customers/:id/touchpoint',
  authorize('payment_followup.manage', 'payment_followup.view_history'),
  paymentFollowupController.logFollowupTouchpoint
);
paymentFollowupRouter.post(
  '/customers/:id/touchpoints',
  authorize('payment_followup.manage', 'payment_followup.view_history'),
  paymentFollowupController.logFollowupTouchpoint
);

// ─── 5b. Add Historical Balance Entry (Debit / Credit) ─────────────────────
paymentFollowupRouter.post(
  '/customers/:id/balance-entry',
  authorize('payment_followup.manage'),
  paymentFollowupController.addBalanceEntry
);

// ─── 6. Decline / Dispute & Resume ──────────────────────────────────────────
paymentFollowupRouter.post(
  '/customers/:id/decline-dispute',
  authorize('payment_followup.manage'),
  paymentFollowupController.declineOrDispute
);

paymentFollowupRouter.post(
  '/customers/:id/resume',
  authorize('payment_followup.manage'),
  paymentFollowupController.resumeFollowup
);

// ─── 7. Statement of Account & Multi-Channel Communications ─────────────────
paymentFollowupRouter.get(
  '/customers/:id/ledger',
  authorize('payment_followup.view', 'invoices.read'),
  paymentFollowupController.getLedger
);

paymentFollowupRouter.get(
  '/customers/:id/ledger-pdf',
  authorize('payment_followup.view', 'invoices.read'),
  paymentFollowupController.downloadLedgerPdf
);

paymentFollowupRouter.post(
  '/customers/:id/send-communication',
  authorize('payment_followup.send'),
  paymentFollowupController.sendCommunication
);

paymentFollowupRouter.post(
  '/customers/:id/send-ledger',
  authorize('payment_followup.send'),
  paymentFollowupController.sendLedgerEmail
);

paymentFollowupRouter.post(
  '/customers/:id/send-sms',
  authorize('payment_followup.send'),
  paymentFollowupController.sendSmsReminder
);

// ─── 8. Bulk Operations (Preview, Ledger & SMS) ──────────────────────────────
paymentFollowupRouter.post(
  '/bulk/preview',
  authorize('payment_followup.send'),
  paymentFollowupController.previewBulk
);

paymentFollowupRouter.post(
  '/bulk/send-ledger',
  authorize('payment_followup.send'),
  paymentFollowupController.executeBulkLedger
);

paymentFollowupRouter.post(
  '/bulk/send-sms',
  authorize('payment_followup.send'),
  paymentFollowupController.executeBulkSms
);

// ─── 9. Automation & Follow-up Rules ─────────────────────────────────────────
paymentFollowupRouter.get(
  '/rules',
  authorize('payment_followup.manage_rules', 'payment_followup.view'),
  paymentFollowupController.listRules
);

paymentFollowupRouter.post(
  '/rules',
  authorize('payment_followup.manage_rules'),
  paymentFollowupController.upsertRule
);

paymentFollowupRouter.delete(
  '/rules/:id',
  authorize('payment_followup.manage_rules'),
  paymentFollowupController.deleteRule
);

paymentFollowupRouter.post(
  '/rules/run-now',
  authorize('payment_followup.manage_rules'),
  paymentFollowupController.runScheduledTrigger
);
