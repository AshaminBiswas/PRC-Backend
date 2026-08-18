import { Router } from 'express';
import multer from 'multer';
import { purchaseOrdersController } from './purchase-orders.controller';
import { authenticate } from '../../middleware/auth.middleware';

// ─── Multer Setup for Receipt Uploads (Max 2MB in memory) ────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB strict limit
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG and PDF files are allowed'));
    }
  },
});

// ─── Router Setup ─────────────────────────────────────────────────────────────

const router = Router();

// All PO routes require authentication
router.use(authenticate);

// ─── 1. Customer PO Routes ────────────────────────────────────────────────────

// Eligible approved quotations for creating a PO
router.get('/eligible-quotations', (req, res, next) =>
  purchaseOrdersController.getEligibleQuotations(req, res, next)
);

// Fetch quotation details for PO form pre-fill
router.get('/quotation/:id', (req, res, next) =>
  purchaseOrdersController.getQuotationForPo(req, res, next)
);

// Create & submit Purchase Order
router.post('/', (req, res, next) =>
  purchaseOrdersController.createPurchaseOrder(req, res, next)
);

// List Purchase Orders (customer gets own; admins get all)
router.get('/', (req, res, next) =>
  purchaseOrdersController.getPurchaseOrders(req, res, next)
);

// Address Book routes (must be before /:id)
router.get('/addresses/all', (req, res, next) =>
  purchaseOrdersController.getSavedAddresses(req, res, next)
);

router.post('/addresses/save', (req, res, next) =>
  purchaseOrdersController.createSavedAddress(req, res, next)
);

router.delete('/addresses/:id', (req, res, next) =>
  purchaseOrdersController.deleteSavedAddress(req, res, next)
);

// Get single Purchase Order details
router.get('/:id', (req, res, next) =>
  purchaseOrdersController.getPurchaseOrderById(req, res, next)
);

// Upload / Update Payment Receipt (2MB, PDF/PNG/JPEG)
router.post('/:id/payment-receipt', upload.single('receipt'), (req, res, next) =>
  purchaseOrdersController.uploadPaymentReceipt(req, res, next)
);

router.put('/:id/payment-receipt', upload.single('receipt'), (req, res, next) =>
  purchaseOrdersController.uploadPaymentReceipt(req, res, next)
);

// View / Download Payment Receipt
router.get('/:id/payment-receipt/download', (req, res, next) =>
  purchaseOrdersController.downloadPaymentReceipt(req, res, next)
);

router.get('/:id/payment-receipt/view', (req, res, next) =>
  purchaseOrdersController.downloadPaymentReceipt(req, res, next)
);

// Download Packing List PDF
router.get('/:id/packing-list', (req, res, next) =>
  purchaseOrdersController.downloadPackingList(req, res, next)
);

// Get Invoice metadata & download
router.get('/:id/invoice', (req, res, next) =>
  purchaseOrdersController.getPoInvoice(req, res, next)
);

router.get('/:id/invoice/download', (req, res, next) =>
  purchaseOrdersController.downloadPoInvoice(req, res, next)
);

// ─── 2. Admin PO Management Routes ───────────────────────────────────────────

export const adminPurchaseOrdersRouter = Router();
adminPurchaseOrdersRouter.use(authenticate);

// List all POs across customers
adminPurchaseOrdersRouter.get('/', (req, res, next) =>
  purchaseOrdersController.getPurchaseOrders(req, res, next)
);

// List all Invoices across POs
adminPurchaseOrdersRouter.get('/invoices/all', (req, res, next) =>
  purchaseOrdersController.adminListInvoices(req, res, next)
);

// Get single PO by ID
adminPurchaseOrdersRouter.get('/:id', (req, res, next) =>
  purchaseOrdersController.getPurchaseOrderById(req, res, next)
);

// Update PO by Admin (shipping address, delivery date, notes, advance %)
adminPurchaseOrdersRouter.patch('/:id', (req, res, next) =>
  purchaseOrdersController.adminUpdatePurchaseOrder(req, res, next)
);

adminPurchaseOrdersRouter.put('/:id', (req, res, next) =>
  purchaseOrdersController.adminUpdatePurchaseOrder(req, res, next)
);

// Reject PO at validation stage
adminPurchaseOrdersRouter.put('/:id/reject', (req, res, next) =>
  purchaseOrdersController.adminRejectPurchaseOrder(req, res, next)
);

// View / Download Payment Receipt (Admin)
adminPurchaseOrdersRouter.get('/:id/payment-receipt/download', (req, res, next) =>
  purchaseOrdersController.downloadPaymentReceipt(req, res, next)
);

adminPurchaseOrdersRouter.get('/:id/payment-receipt/view', (req, res, next) =>
  purchaseOrdersController.downloadPaymentReceipt(req, res, next)
);

// Acknowledge payment receipt and dispatch confirmation email
adminPurchaseOrdersRouter.post('/:id/payment-receipt/acknowledge', (req, res, next) =>
  purchaseOrdersController.adminAcknowledgeReceipt(req, res, next)
);

// Digitally verify receipt (audit-logged SHA-256 hash + auto packing list generation)
adminPurchaseOrdersRouter.post('/:id/payment-receipt/verify', (req, res, next) =>
  purchaseOrdersController.adminVerifyReceipt(req, res, next)
);

// Reject invalid receipt
adminPurchaseOrdersRouter.post('/:id/payment-receipt/reject', (req, res, next) =>
  purchaseOrdersController.adminRejectReceipt(req, res, next)
);

// Reopen verified receipt
adminPurchaseOrdersRouter.post('/:id/payment-receipt/reopen', (req, res, next) =>
  purchaseOrdersController.adminReopenReceipt(req, res, next)
);

// Download Packing List PDF (Admin)
adminPurchaseOrdersRouter.get('/:id/packing-list', (req, res, next) =>
  purchaseOrdersController.downloadPackingList(req, res, next)
);

// Record PO Dispatch (triggers automatic invoice generation background job)
adminPurchaseOrdersRouter.post('/:id/dispatch', (req, res, next) =>
  purchaseOrdersController.adminRecordDispatch(req, res, next)
);

// Get PO Invoice metadata (Admin)
adminPurchaseOrdersRouter.get('/:id/invoice', (req, res, next) =>
  purchaseOrdersController.getPoInvoice(req, res, next)
);

// Download PO Invoice PDF (Admin)
adminPurchaseOrdersRouter.get('/:id/invoice/download', (req, res, next) =>
  purchaseOrdersController.downloadPoInvoice(req, res, next)
);

// Re-generate Invoice manually if job failed
adminPurchaseOrdersRouter.post('/:id/invoice/regenerate', (req, res, next) =>
  purchaseOrdersController.adminRegenerateInvoice(req, res, next)
);

// Advance Payment Settings
adminPurchaseOrdersRouter.get('/settings/advance-payment', (req, res, next) =>
  purchaseOrdersController.getAdvancePaymentSetting(req, res, next)
);

adminPurchaseOrdersRouter.put('/settings/advance-payment', (req, res, next) =>
  purchaseOrdersController.updateAdvancePaymentSetting(req, res, next)
);

// Bank Account Settings
adminPurchaseOrdersRouter.get('/settings/bank-account', (req, res, next) =>
  purchaseOrdersController.getBankAccountSettings(req, res, next)
);

adminPurchaseOrdersRouter.put('/settings/bank-account', (req, res, next) =>
  purchaseOrdersController.updateBankAccountSetting(req, res, next)
);

export default router;
