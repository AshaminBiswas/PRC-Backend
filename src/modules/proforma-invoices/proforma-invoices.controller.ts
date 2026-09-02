import { Request, Response, NextFunction } from 'express';
import * as proformaService from './proforma-invoices.service';
import { sendSuccess, sendPaginated } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';
import { logAdminAction } from '../../utils/auditLogger';

/**
 * Create a new Proforma Invoice from scratch.
 */
export const createProformaInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await proformaService.createProformaInvoice(req.body, req.user);
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'PI_GENERATED',
      entity: 'PROFORMA_INVOICE',
      entityId: data.id,
      entityName: data.piNumber,
      details: `Generated Proforma Invoice ${data.piNumber} for customer ${data.customerName}. Grand Total: ₹${data.grandTotal}.`,
      severity: 'SUCCESS',
      metadata: { piId: data.id, piNumber: data.piNumber, grandTotal: data.grandTotal },
      req,
    });
    sendSuccess(res, data, 'Proforma Invoice generated successfully in DRAFT state', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Convert an approved Quotation to a Proforma Invoice.
 */
export const createFromQuotation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await proformaService.createFromQuotation(req.params.quoteId, req.user);
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'PI_GENERATED_FROM_QUOTATION',
      entity: 'PROFORMA_INVOICE',
      entityId: data.id,
      entityName: data.piNumber,
      details: `Converted Quotation #${req.params.quoteId} into Proforma Invoice ${data.piNumber}.`,
      severity: 'SUCCESS',
      metadata: { piId: data.id, piNumber: data.piNumber, quoteId: req.params.quoteId },
      req,
    });
    sendSuccess(res, data, 'Quotation successfully converted to Proforma Invoice', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Convert a Purchase Order to a Proforma Invoice.
 */
export const createFromPurchaseOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await proformaService.createFromPurchaseOrder(req.params.poId, req.user);
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'PI_GENERATED_FROM_PO',
      entity: 'PROFORMA_INVOICE',
      entityId: data.id,
      entityName: data.piNumber,
      details: `Converted Purchase Order #${req.params.poId} into Proforma Invoice ${data.piNumber}.`,
      severity: 'SUCCESS',
      metadata: { piId: data.id, piNumber: data.piNumber, poId: req.params.poId },
      req,
    });
    sendSuccess(res, data, 'Purchase Order successfully converted to Proforma Invoice', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * List Proforma Invoices with pagination, filters, search, and KPI metrics.
 */
export const listProformaInvoices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await proformaService.listProformaInvoices(req.query as any, req.user);
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      metrics: result.metrics,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Proforma Invoice by ID with line items, history, and relations.
 */
export const getProformaInvoiceById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await proformaService.getProformaInvoiceById(req.params.id, req.user);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

/**
 * Public customer view by secure access / verification token.
 */
export const getProformaInvoiceByToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await proformaService.getProformaInvoiceByToken(req.params.token);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

/**
 * Update metadata and payment terms.
 */
export const updateProformaInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await proformaService.updateProformaInvoice(req.params.id, req.body, req.user);
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'PI_UPDATED',
      entity: 'PROFORMA_INVOICE',
      entityId: data.id,
      entityName: data.piNumber,
      details: `Updated details on Proforma Invoice ${data.piNumber}.`,
      severity: 'INFO',
      metadata: { piId: data.id, piNumber: data.piNumber },
      req,
    });
    sendSuccess(res, data, 'Proforma Invoice updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Update line items and recalculate all taxes, advance amount, and balance due.
 */
export const updateProformaInvoiceItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await proformaService.updateProformaInvoiceItems(req.params.id, req.body, req.user);
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'PI_ITEMS_UPDATED',
      entity: 'PROFORMA_INVOICE',
      entityId: data.id,
      entityName: data.piNumber,
      details: `Updated line items on Proforma Invoice ${data.piNumber}. New Grand Total: ₹${data.grandTotal}.`,
      severity: 'INFO',
      metadata: { piId: data.id, piNumber: data.piNumber, grandTotal: data.grandTotal },
      req,
    });
    sendSuccess(res, data, 'Proforma Invoice line items updated & totals recalculated');
  } catch (error) {
    next(error);
  }
};

/**
 * Update status lifecycle.
 */
export const updateProformaInvoiceStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await proformaService.updateProformaInvoiceStatus(req.params.id, req.body, req.user);
    logAdminAction({
      userId: req.user?.id || 'system',
      action: `PI_STATUS_${req.body.status}`,
      entity: 'PROFORMA_INVOICE',
      entityId: data.id,
      entityName: data.piNumber,
      details: `Transitioned Proforma Invoice ${data.piNumber} status to ${req.body.status}.`,
      severity: req.body.status === 'APPROVED' ? 'SUCCESS' : req.body.status === 'CANCELLED' ? 'WARNING' : 'INFO',
      metadata: { piId: data.id, piNumber: data.piNumber, status: req.body.status },
      req,
    });
    sendSuccess(res, data, `Proforma Invoice status updated to ${req.body.status}`);
  } catch (error) {
    next(error);
  }
};

/**
 * Digitally sign and approve Proforma Invoice with cryptographic HMAC-SHA256 seal.
 */
export const digitallySignProformaInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await proformaService.digitallySignProformaInvoice(req.params.id, req.body, req.user);
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'PI_DIGITALLY_SIGNED',
      entity: 'PROFORMA_INVOICE',
      entityId: data.id,
      entityName: data.piNumber,
      details: `Digitally signed, generated QR verification seal & approved Proforma Invoice ${data.piNumber}.`,
      severity: 'SUCCESS',
      metadata: { piId: data.id, piNumber: data.piNumber, signedBy: data.signedBy },
      req,
    });
    sendSuccess(res, data, 'Proforma Invoice digitally signed and approved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Stream binary PDF for download (Admin).
 */
export const downloadProformaPdf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pi = await proformaService.getProformaInvoiceById(req.params.id, req.user);
    const pdfBuffer = await proformaService.generateProformaPdfBuffer(req.params.id, req.user);

    const safeNumber = (pi.piNumber || 'Proforma').replace(/[\/\\]/g, '-');
    const filename = `Proforma-Invoice-${safeNumber}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-store');
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * Public customer download Proforma Invoice as PDF via secure token.
 */
export const downloadProformaPdfByToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pi = await proformaService.getProformaInvoiceByToken(req.params.token);
    const pdfBuffer = await proformaService.generateProformaPdfBuffer(pi.id);

    const safeNumber = (pi.piNumber || 'Proforma').replace(/[\/\\]/g, '-');
    const filename = `Proforma-Invoice-${safeNumber}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-store');
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * Customer Self-Service: Retrieve all issued Proforma Invoices for logged-in B2B customer.
 */
export const getMyCustomerProformas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    if (!userId) {
      throw new AppError('UNAUTHORIZED', 'Authentication required to view customer proforma invoices', 401);
    }
    const data = await proformaService.getMyCustomerProformas(userId, userEmail);
    sendSuccess(res, data, 'Customer Proforma Invoices retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Email Proforma Invoice PDF to customer.
 */
export const emailProformaInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await proformaService.emailProformaInvoice(req.params.id, req.body, req.user);
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'PI_EMAILED',
      entity: 'PROFORMA_INVOICE',
      entityId: req.params.id,
      details: `Emailed Proforma Invoice to ${req.body.email || 'customer'}.`,
      severity: 'INFO',
      metadata: { piId: req.params.id, email: req.body.email },
      req,
    });
    sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * Convert Proforma Invoice to final GST Tax Invoice.
 */
export const convertToTaxInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await proformaService.convertToTaxInvoice(req.params.id, req.user);
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'PI_CONVERTED_TO_INVOICE',
      entity: 'PROFORMA_INVOICE',
      entityId: data.id,
      entityName: data.piNumber,
      details: `Converted Proforma Invoice ${data.piNumber} into GST Tax Invoice.`,
      severity: 'SUCCESS',
      metadata: { piId: data.id, piNumber: data.piNumber },
      req,
    });
    sendSuccess(res, data, 'Proforma Invoice converted to GST Tax Invoice successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Public QR Code Scan Verification Resolver.
 */
export const verifyTokenPublic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await proformaService.verifyProformaInvoiceToken(req.params.token);
    sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * Cryptographic Signature & Tamper Verification.
 */
export const verifySignaturePublic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await proformaService.verifyProformaInvoiceSignature(req.body);
    sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * Soft delete / void Proforma Invoice.
 */
export const deleteProformaInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await proformaService.deleteProformaInvoice(req.params.id, req.user);
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'PI_DELETED',
      entity: 'PROFORMA_INVOICE',
      entityId: req.params.id,
      details: `Deleted / voided Proforma Invoice #${req.params.id}.`,
      severity: 'CRITICAL',
      metadata: { piId: req.params.id },
      req,
    });
    sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * Public: Customer Submits Feedback / Acceptance / Advance Payment Reference.
 */
export const submitCustomerFeedback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await proformaService.submitCustomerFeedback(req.params.token, req.body);
    sendSuccess(res, result.data, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin Panel & Verification: Comprehensive Document Tamper Validation.
 */
export const validateDocumentTamper = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await proformaService.validateDocumentTamper(req.body, req.user);
    sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * Public: Customer Uploads Payment Screenshot or PDF Receipt for a Proforma Invoice.
 */
export const uploadPaymentReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new AppError('BAD_REQUEST', 'No payment receipt or screenshot file provided', 400);
    }
    const receiptUrl = await proformaService.uploadProformaPaymentReceipt(req.params.token, {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      buffer: req.file.buffer,
      size: req.file.size,
    });
    sendSuccess(res, { receiptUrl }, 'Payment receipt uploaded successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Record / Confirm Advance Payment.
 */
export const recordPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await proformaService.recordProformaPayment(req.params.id, req.body, req.user);
    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'PI_PAYMENT_RECORDED',
      entity: 'PROFORMA_INVOICE',
      entityId: req.params.id,
      details: `Recorded payment of ₹${req.body.amountPaid} via ${req.body.paymentMode} for PI #${req.params.id}.`,
      severity: 'SUCCESS',
      metadata: req.body,
      req,
    });
    sendSuccess(res, result.data, result.message, 200);
  } catch (error) {
    next(error);
  }
};
