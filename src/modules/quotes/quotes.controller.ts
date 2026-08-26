import { Request, Response, NextFunction } from 'express';
import * as quotesService from './quotes.service';
import { sendSuccess, sendPaginated } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';
import { generateQuotationPdf } from './quotation-pdf.service';

/**
 * Public/B2B Submit Quotation Request (RFQ)
 */
export const createQuote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const data = await quotesService.createB2BQuote(req.body, userId);
    sendSuccess(res, data, 'Quotation request submitted successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Universal Tracking: Look up quotes by Email, GSTIN, Phone, or Reference No
 */
export const trackQuotes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = (req.query.query as string) || '';
    const results = await quotesService.trackQuotation(query);
    sendSuccess(res, results, `Found ${results.length} quotation(s)`);
  } catch (error) {
    next(error);
  }
};

/**
 * Public Customer View by Secure Access Token
 */
export const getQuoteByToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await quotesService.getQuoteByAccessToken(req.params.token);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

/**
 * Public Customer Respond (Accept or Decline)
 */
export const respondToQuote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { response, notes } = req.body;
    const data = await quotesService.respondToQuoteByCustomer(req.params.token, response, notes);
    sendSuccess(res, data, `Quotation ${response} successfully`);
  } catch (error) {
    next(error);
  }
};

/**
 * Public/B2B Customer One-Time Edit (Negotiate Advance % & Terms)
 */
export const customerEditQuote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.params.token;
    const id = req.params.id;
    const userId = req.user?.id;
    const data = await quotesService.customerEditQuote({ token, id }, req.body, userId);
    sendSuccess(res, data, 'Your quotation revision has been submitted for admin review successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Public/Admin Signature & QR Verification
 */
export const verifySignature = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { referenceNo, digitalSignature } = req.body;
    const result = await quotesService.verifySignatureRecord(referenceNo, digitalSignature);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Paginated List of Quotes with Search, Filter & Stats
 */
export const listQuotes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await quotesService.listAdminQuotes(req.query as any);
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
 * Admin: Get Detailed Quote with Revisions and Audit Log
 */
export const getQuoteById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await quotesService.getAdminQuoteById(req.params.id);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

import { logAdminAction } from '../../utils/auditLogger';

/**
 * Admin: Update Status with Mandatory Notes for Pending/Rejected
 */
export const updateQuoteStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const data: any = await quotesService.updateQuoteStatusByAdmin(req.params.id, req.body, req.user);
    const actionName = req.body.status === 'APPROVED' ? 'QUOTATION_APPROVED' : req.body.status === 'REJECTED' ? 'QUOTATION_REJECTED' : 'QUOTATION_STATUS_UPDATED';
    if (data) {
      logAdminAction({
        userId: req.user.id,
        action: actionName,
        entity: 'QUOTATION',
        entityId: data.id,
        entityName: data.quoteNumber || data.referenceNo || `Quote #${data.id}`,
        details: `Updated quotation ${data.quoteNumber || data.referenceNo} status to ${req.body.status}. Note: ${req.body.notes || 'None'}.`,
        severity: req.body.status === 'APPROVED' ? 'SUCCESS' : req.body.status === 'REJECTED' ? 'WARNING' : 'INFO',
        metadata: { quoteId: data.id, quoteNumber: data.quoteNumber, newStatus: req.body.status, notes: req.body.notes },
        req,
      });
    }
    sendSuccess(res, data, 'Quotation status updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Edit Line Items, Quantities, Rates, and Shipping
 */
export const updateQuoteItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const data: any = await quotesService.updateQuoteItemsAndPricing(req.params.id, req.body, req.user);
    if (data) {
      logAdminAction({
        userId: req.user.id,
        action: 'QUOTATION_ITEMS_UPDATED',
        entity: 'QUOTATION',
        entityId: data.id,
        entityName: data.quoteNumber || data.referenceNo || `Quote #${data.id}`,
        details: `Modified line items, custom unit prices, or discount rates on quotation ${data.quoteNumber || data.referenceNo}. Total: ₹${data.totalEstimatedValue || data.totalAmount || data.grandTotal || 0}.`,
        severity: 'INFO',
        metadata: { quoteId: data.id, quoteNumber: data.quoteNumber, totalAmount: data.totalEstimatedValue || data.totalAmount || data.grandTotal },
        req,
      });
    }
    sendSuccess(res, data, 'Quotation line items and pricing updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Digitally Sign, Generate QR Code, and Approve
 */
export const digitallySignQuote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const data: any = await quotesService.digitallySignAndApproveQuote(req.params.id, req.body, req.user);
    if (data) {
      logAdminAction({
        userId: req.user.id,
        action: 'QUOTATION_APPROVED',
        entity: 'QUOTATION',
        entityId: data.id,
        entityName: data.quoteNumber || data.referenceNo || `Quote #${data.id}`,
        details: `Digitally signed, generated cryptographic seal & approved quotation ${data.quoteNumber || data.referenceNo}.`,
        severity: 'SUCCESS',
        metadata: { quoteId: data.id, quoteNumber: data.quoteNumber, signerName: req.body.signerName },
        req,
      });
    }
    sendSuccess(res, data, 'Quotation digitally signed and approved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Soft Delete Quote
 */
export const deleteQuote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const result = await quotesService.softDeleteQuote(req.params.id, req.user);
    logAdminAction({
      userId: req.user.id,
      action: 'QUOTATION_DELETED',
      entity: 'QUOTATION',
      entityId: req.params.id,
      details: `Deleted quotation #${req.params.id}.`,
      severity: 'CRITICAL',
      metadata: { quoteId: req.params.id },
      req,
    });
    sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Download Quotation as PDF
 * Generates the PDF on-the-fly and streams it as a downloadable file.
 */
export const downloadQuotePdf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    // Fetch the full quote with all items
    const quote = await quotesService.getAdminQuoteById(req.params.id);

    if (!quote) {
      throw new AppError('NOT_FOUND', 'Quotation not found', 404);
    }

    // Generate PDF buffer
    const pdfBuffer = await generateQuotationPdf(quote as any);

    const referenceNo = quote.referenceNo || quote.quoteNumber || quote.id.slice(0, 8);
    const safeRef = String(referenceNo).replace(/[\/\\]/g, '-');
    const filename = `Quotation-${safeRef}.pdf`;

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
 * Public: Customer Download Quotation as PDF via Secure Access Token
 * RESTRICTION: Quotation PDF can only be downloaded AFTER official approval by administration.
 */
export const downloadQuotePdfByToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quote = await quotesService.getQuoteByAccessToken(req.params.token);

    if (!quote) {
      throw new AppError('NOT_FOUND', 'Quotation not found or link has expired', 404);
    }

    if (quote.status !== 'APPROVED') {
      throw new AppError(
        'FORBIDDEN',
        'Official quotation PDF can only be downloaded after the quotation is approved by administration.',
        403
      );
    }

    const pdfBuffer = await generateQuotationPdf(quote as any);

    const referenceNo = quote.referenceNo || quote.quoteNumber || quote.id.slice(0, 8);
    const safeRef = String(referenceNo).replace(/[\/\\]/g, '-');
    const filename = `Quotation-${safeRef}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-store');
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

