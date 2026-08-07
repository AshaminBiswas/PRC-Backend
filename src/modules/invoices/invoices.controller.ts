import { Request, Response, NextFunction } from 'express';
import * as invoicesService from './invoices.service';
import { sendSuccess, sendPaginated } from '../../utils/response';
import { generateInvoiceHtml } from './services/pdf.service';

export const createInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await invoicesService.createInvoice(req.body, req.user);
    sendSuccess(res, data, 'Invoice created successfully as DRAFT', 201);
  } catch (error) {
    next(error);
  }
};

export const listInvoices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await invoicesService.listInvoices(req.query as any, req.user);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getInvoiceById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await invoicesService.getInvoiceById(req.params.id, req.user);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const approveInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await invoicesService.approveInvoice(req.params.id, req.user);
    sendSuccess(res, data, 'Invoice approved successfully');
  } catch (error) {
    next(error);
  }
};

export const cancelInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    const data = await invoicesService.cancelInvoice(req.params.id, reason, req.user);
    sendSuccess(res, data, 'Invoice cancelled successfully');
  } catch (error) {
    next(error);
  }
};

export const signInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await invoicesService.signInvoice(req.params.id, req.body, req.user);
    sendSuccess(res, data, 'Invoice signed successfully');
  } catch (error) {
    next(error);
  }
};

export const emailInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    const data = await invoicesService.emailInvoice(req.params.id, email, req.user);
    sendSuccess(res, data, 'Invoice emailed successfully');
  } catch (error) {
    next(error);
  }
};

export const getInvoiceHtmlPrint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await invoicesService.getInvoiceById(req.params.id, req.user);
    const html = await generateInvoiceHtml(invoice as any);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    next(error);
  }
};

export const downloadInvoicePdf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await invoicesService.getInvoiceById(req.params.id, req.user);
    const html = await generateInvoiceHtml(invoice as any);
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber.replace(/\//g, '-')}.html"`);
    res.send(html);
  } catch (error) {
    next(error);
  }
};

export const getInvoiceHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await invoicesService.getInvoiceById(req.params.id, req.user);
    sendSuccess(res, invoice.history, 'Invoice audit history retrieved');
  } catch (error) {
    next(error);
  }
};

export const verifyInvoiceTokenPublic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await invoicesService.verifyInvoiceToken(req.params.token);
    sendSuccess(res, data, 'Invoice verification details retrieved');
  } catch (error) {
    next(error);
  }
};

export const createProformaInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId, notes } = req.body;
    const data = await invoicesService.generateProformaInvoice(orderId, req.user, notes);
    sendSuccess(res, data, 'Proforma Invoice generated successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const createDeliveryChallan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId, notes } = req.body;
    const data = await invoicesService.generateDeliveryChallan(orderId, req.user, notes);
    sendSuccess(res, data, 'Delivery Challan generated successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const createPackingSlip = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId, notes } = req.body;
    const data = await invoicesService.generatePackingSlip(orderId, req.user, notes);
    sendSuccess(res, data, 'Packing Slip generated successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const createCommercialInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId, notes } = req.body;
    const data = await invoicesService.generateCommercialInvoice(orderId, req.user, notes);
    sendSuccess(res, data, 'Commercial Invoice generated successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const createCreditNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { originalInvoiceId, reason, items, notes } = req.body;
    const data = await invoicesService.generateCreditNote(originalInvoiceId, reason, items, req.user, notes);
    sendSuccess(res, data, 'Credit Note generated successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const createDebitNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { originalInvoiceId, reason, items, notes } = req.body;
    const data = await invoicesService.generateDebitNote(originalInvoiceId, reason, items, req.user, notes);
    sendSuccess(res, data, 'Debit Note generated successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const createPurchaseOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await invoicesService.generatePurchaseOrder(req.body, req.user);
    sendSuccess(res, data, 'Purchase Order generated successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const createQuotation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await invoicesService.generateQuotation(req.body, req.user);
    sendSuccess(res, data, 'Quotation generated successfully', 201);
  } catch (error) {
    next(error);
  }
};
