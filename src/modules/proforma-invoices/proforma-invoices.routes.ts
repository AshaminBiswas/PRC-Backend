import { Router } from 'express';
import multer from 'multer';
import * as controller from './proforma-invoices.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { publicTrackingLimiter, adminLimiter } from '../../middleware/rateLimit.middleware';
import {
  createProformaInvoiceSchema,
  updateProformaInvoiceSchema,
  updateProformaInvoiceItemsSchema,
  updateProformaInvoiceStatusSchema,
  signProformaInvoiceSchema,
  listProformaInvoicesQuerySchema,
  sendProformaInvoiceEmailSchema,
  verifySignatureSchema,
  customerFeedbackSchema,
  validateTamperSchema,
  recordProformaPaymentSchema,
} from './proforma-invoices.schema';

const storage = multer.memoryStorage();
const uploadReceipt = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WEBP) and PDF documents are allowed for payment receipts'));
    }
  },
});

const router = Router();

// ─── Public Endpoints (No Authentication Required) ────────────────────────────

// Public Customer Upload Payment Screenshot / Receipt PDF
router.post(
  '/public/:token/upload-receipt',
  publicTrackingLimiter,
  uploadReceipt.single('file'),
  controller.uploadPaymentReceipt
);

// QR Code Scan Verification Resolver (Supports token, verification ID, PI number, document hash, or full URL)
router.get('/verify/:token', publicTrackingLimiter, controller.verifyTokenPublic);

// Comprehensive Document Tamper Validation (Used by Admin QR Scanner & Public Verifier)
router.post(
  '/validate-tamper',
  publicTrackingLimiter,
  validate(validateTamperSchema),
  controller.validateDocumentTamper
);

// Cryptographic Signature Tamper Verification
router.post(
  '/verify-signature',
  publicTrackingLimiter,
  validate(verifySignatureSchema),
  controller.verifySignaturePublic
);

// Public Customer View by Token
router.get('/public/:token', publicTrackingLimiter, controller.getProformaInvoiceByToken);

// Public Customer PDF Download by Token
router.get('/public/:token/pdf', publicTrackingLimiter, controller.downloadProformaPdfByToken);

// Public Customer Feedback / Acceptance / Advance Payment Submission
router.post(
  '/public/:token/feedback',
  publicTrackingLimiter,
  validate(customerFeedbackSchema),
  controller.submitCustomerFeedback
);

// ─── Authenticated Endpoints ──────────────────────────────────────────────
router.use(authenticate);

// Customer Self-Service Route: Get all PIs issued for the authenticated B2B customer profile
router.get('/customer/my-proformas', controller.getMyCustomerProformas);

// ─── Administrative Restricted Endpoints ─────────────────────────────────────
router.use(adminLimiter);

// List Proforma Invoices with pagination, filters & KPIs
router.get(
  '/',
  authorize('invoices.read', 'orders.read', 'quotes.read'),
  validate(listProformaInvoicesQuerySchema, 'query'),
  controller.listProformaInvoices
);

// Create Proforma Invoice from scratch
router.post(
  '/',
  authorize('invoices.create', 'orders.create', 'quotes.create'),
  validate(createProformaInvoiceSchema),
  controller.createProformaInvoice
);

// Convert Quotation to Proforma Invoice
router.post(
  '/from-quote/:quoteId',
  authorize('invoices.create', 'quotes.create'),
  controller.createFromQuotation
);

// Convert Purchase Order to Proforma Invoice
router.post(
  '/from-po/:poId',
  authorize('invoices.create', 'orders.create'),
  controller.createFromPurchaseOrder
);

// Get Proforma Invoice by ID
router.get(
  '/:id',
  authorize('invoices.read', 'orders.read', 'quotes.read'),
  controller.getProformaInvoiceById
);

// Update Proforma Invoice metadata & terms
router.patch(
  '/:id',
  authorize('invoices.edit', 'orders.edit', 'quotes.edit'),
  validate(updateProformaInvoiceSchema),
  controller.updateProformaInvoice
);

// Update Proforma Invoice line items & recalculate financials
router.put(
  '/:id/items',
  authorize('invoices.edit', 'orders.edit', 'quotes.edit'),
  validate(updateProformaInvoiceItemsSchema),
  controller.updateProformaInvoiceItems
);

// Update Proforma Invoice status lifecycle
router.patch(
  '/:id/status',
  authorize('invoices.edit', 'invoices.approve', 'finance.manage'),
  validate(updateProformaInvoiceStatusSchema),
  controller.updateProformaInvoiceStatus
);

// Record / Confirm Advance Payment & Update Lifecycle
router.post(
  '/:id/record-payment',
  authorize('invoices.edit', 'invoices.approve', 'finance.manage'),
  validate(recordProformaPaymentSchema),
  controller.recordPayment
);

// Digitally sign and approve Proforma Invoice with cryptographic seal
router.post(
  '/:id/sign',
  authorize('invoices.sign', 'invoices.approve', 'finance.manage'),
  validate(signProformaInvoiceSchema),
  controller.digitallySignProformaInvoice
);

// Download PDF (Stream binary)
router.get(
  '/:id/pdf',
  authorize('invoices.read', 'orders.read', 'quotes.read'),
  controller.downloadProformaPdf
);

router.post(
  '/:id/download',
  authorize('invoices.read', 'orders.read', 'quotes.read'),
  controller.downloadProformaPdf
);

// Email Proforma Invoice PDF to customer
router.post(
  '/:id/email',
  authorize('invoices.create', 'invoices.edit', 'finance.manage'),
  validate(sendProformaInvoiceEmailSchema),
  controller.emailProformaInvoice
);

// Convert Proforma Invoice to GST Tax Invoice
router.post(
  '/:id/convert-to-invoice',
  authorize('invoices.create', 'finance.manage'),
  controller.convertToTaxInvoice
);

// Delete / Void Proforma Invoice
router.delete(
  '/:id',
  authorize('invoices.delete', 'finance.manage'),
  controller.deleteProformaInvoice
);

export default router;
