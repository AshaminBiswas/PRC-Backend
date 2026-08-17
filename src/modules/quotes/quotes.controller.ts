import { Request, Response, NextFunction } from 'express';
import * as quotesService from './quotes.service';
import { sendSuccess, sendPaginated } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';

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

/**
 * Admin: Update Status with Mandatory Notes for Pending/Rejected
 */
export const updateQuoteStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const data = await quotesService.updateQuoteStatusByAdmin(req.params.id, req.body, req.user);
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
    const data = await quotesService.updateQuoteItemsAndPricing(req.params.id, req.body, req.user);
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
    const data = await quotesService.digitallySignAndApproveQuote(req.params.id, req.body, req.user);
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
    sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
};
