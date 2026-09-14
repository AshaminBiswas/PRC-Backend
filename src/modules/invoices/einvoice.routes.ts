import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { adminLimiter } from '../../middleware/rateLimit.middleware';
import * as invoicesService from './invoices.service';
import { sendSuccess } from '../../utils/response';

const router = Router();

router.use(authenticate);
router.use(adminLimiter);

/**
 * Helper to compute an IRN hash: SHA256(SupplierGSTIN + FinYear + DocType + DocNumber)
 */
function computeMockIrn(supplierGstin: string, finYear: string, docNumber: string): string {
  const raw = `${supplierGstin}${finYear}INV${docNumber}`;
  return crypto.createHash('sha256').update(raw).digest('hex').toLowerCase();
}

/**
 * POST /gst/einvoice/:invoiceId/generate
 */
router.post(
  '/:invoiceId/generate',
  authorize('invoices.create', 'finance.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await invoicesService.getInvoiceById(req.params.invoiceId, req.user);
      const supplierGstin = '29AAGCP4582K1Z5';
      const finYear = invoice.financialYear || '2024-25';
      const irn = computeMockIrn(supplierGstin, finYear, invoice.invoiceNumber);
      const ackNo = `1124${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      const ackDate = new Date().toISOString();

      const signedQrCode = `https://einvoice.gst.gov.in/verify?irn=${irn}&ack=${ackNo}&dt=${encodeURIComponent(ackDate)}`;
      const signedInvoice = Buffer.from(
        JSON.stringify({
          Irn: irn,
          AckNo: ackNo,
          AckDt: ackDate,
          DocDtls: { Typ: 'INV', No: invoice.invoiceNumber, Dt: invoice.invoice_date },
          BuyerDtls: { Gstin: invoice.customer_gstin, LglNm: invoice.customer_legal_name, Pos: invoice.place_of_supply },
          ValDtls: { TotInvVal: invoice.grand_total, AssVal: invoice.taxable_amount },
        })
      ).toString('base64');

      const einvoiceRecord = {
        irn,
        ack_no: ackNo,
        ack_date: ackDate,
        status: 'GENERATED',
        signed_qr_code: signedQrCode,
        signed_invoice: signedInvoice,
        generated_at: ackDate,
      };

      const updatedInvoice = {
        ...invoice,
        status: 'APPROVED',
        einvoice: einvoiceRecord,
      };

      sendSuccess(res, updatedInvoice, 'E-Invoice IRN generated successfully', 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /gst/einvoice/:invoiceId/cancel
 */
router.post(
  '/:invoiceId/cancel',
  authorize('invoices.cancel', 'finance.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason_code, reason_remark } = req.body;
      const invoice = await invoicesService.getInvoiceById(req.params.invoiceId, req.user);
      const now = new Date().toISOString();

      const einvoiceRecord = {
        ...(invoice.einvoice || {}),
        status: 'CANCELLED',
        cancelled_at: now,
        cancellation_reason: reason_remark || 'Cancelled by Authorized Signatory',
        cancellation_reason_code: reason_code || '1',
      };

      const updatedInvoice = {
        ...invoice,
        einvoice: einvoiceRecord,
      };

      sendSuccess(res, updatedInvoice, 'E-Invoice IRN cancelled successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /gst/einvoice/:invoiceId/status
 */
router.get(
  '/:invoiceId/status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await invoicesService.getInvoiceById(req.params.invoiceId, req.user);
      sendSuccess(res, invoice);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /gst/einvoice/:invoiceId/irn-json
 */
router.get(
  '/:invoiceId/irn-json',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await invoicesService.getInvoiceById(req.params.invoiceId, req.user);
      const supplierGstin = '29AAGCP4582K1Z5';
      const finYear = invoice.financialYear || '2024-25';
      const irn = invoice.einvoice?.irn || computeMockIrn(supplierGstin, finYear, invoice.invoiceNumber);
      const ackNo = invoice.einvoice?.ack_no || `1124${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      const ackDt = invoice.einvoice?.ack_date || invoice.created_at;

      const irnPayload = {
        Success: 'Y',
        Irn: irn,
        AckNo: ackNo,
        AckDt: ackDt,
        SignedInvoice: invoice.einvoice?.signed_invoice || 'eyJhbGciOiJSUzI1NiJ9.mockSignedInvoice',
        SignedQRCode: invoice.einvoice?.signed_qr_code || `https://einvoice.gst.gov.in/verify?irn=${irn}`,
        Status: invoice.einvoice?.status || 'ACT',
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="IRN_${invoice.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_')}.json"`
      );
      res.json(irnPayload);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
