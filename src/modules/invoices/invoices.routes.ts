import { Router } from 'express';
import * as controller from './invoices.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { publicTrackingLimiter, adminLimiter } from '../../middleware/rateLimit.middleware';
import {
  createInvoiceSchema,
  listInvoicesQuerySchema,
  cancelInvoiceSchema,
  signInvoiceSchema,
  creditDebitNoteSchema,
  orderDocumentSchema,
} from './invoices.schema';

const router = Router();

// PUBLIC Verification Endpoint (No Auth Required)
router.get('/verify/:token', publicTrackingLimiter, controller.verifyInvoiceTokenPublic);

// Authenticated Routes
router.use(authenticate);
router.use(adminLimiter);

router.post(
  '/',
  authorize('invoices.create', 'orders.create'),
  validate(createInvoiceSchema),
  controller.createInvoice
);

router.post(
  '/proforma',
  authorize('invoices.create', 'orders.create'),
  validate(orderDocumentSchema),
  controller.createProformaInvoice
);

router.post(
  '/proforma/send-email',
  controller.sendProformaInvoiceEmail
);

router.post(
  '/quotation',
  authorize('invoices.create', 'quotes.create'),
  validate(createInvoiceSchema),
  controller.createQuotation
);

router.post(
  '/delivery-challan',
  authorize('invoices.create', 'inventory.manage'),
  validate(orderDocumentSchema),
  controller.createDeliveryChallan
);

router.post(
  '/packing-slip',
  authorize('invoices.create', 'inventory.manage'),
  validate(orderDocumentSchema),
  controller.createPackingSlip
);

router.post(
  '/purchase-order',
  authorize('invoices.create', 'inventory.manage'),
  validate(createInvoiceSchema),
  controller.createPurchaseOrder
);

router.post(
  '/credit-note',
  authorize('invoices.create', 'finance.manage'),
  validate(creditDebitNoteSchema),
  controller.createCreditNote
);

router.post(
  '/debit-note',
  authorize('invoices.create', 'finance.manage'),
  validate(creditDebitNoteSchema),
  controller.createDebitNote
);

router.post(
  '/commercial',
  authorize('invoices.create', 'orders.create'),
  validate(orderDocumentSchema),
  controller.createCommercialInvoice
);

router.get(
  '/',
  validate(listInvoicesQuerySchema, 'query'),
  controller.listInvoices
);

router.get('/:id', controller.getInvoiceById);

router.post(
  '/:id/approve',
  authorize('invoices.approve', 'finance.manage'),
  controller.approveInvoice
);

router.post(
  '/:id/cancel',
  authorize('invoices.cancel', 'finance.manage'),
  validate(cancelInvoiceSchema),
  controller.cancelInvoice
);

router.post(
  '/:id/sign',
  authorize('invoices.sign', 'finance.manage'),
  validate(signInvoiceSchema),
  controller.signInvoice
);

router.post('/:id/email', controller.emailInvoice);
router.post('/:id/print', controller.getInvoiceHtmlPrint);
router.post('/:id/pdf', controller.downloadInvoicePdf);
router.get('/:id/download', controller.downloadInvoicePdf);
router.get('/:id/history', controller.getInvoiceHistory);
router.get('/:id/audit', controller.getInvoiceHistory);
router.get('/:id/verification', controller.getInvoiceById);

export default router;
