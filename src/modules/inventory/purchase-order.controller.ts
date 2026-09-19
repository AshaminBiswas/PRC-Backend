/**
 * purchase-order.controller.ts
 *
 * Controller handling HTTP requests for the Purchase Order module:
 * - Create, update, list, detail
 * - Vector PDF streaming / download
 * - Email dispatch with attached PDF
 * - Goods receipt (partial / full)
 * - Status transitions (Acknowledged, Cancelled)
 */

import { Request, Response, NextFunction } from 'express';
import * as poService from './purchase-order.service';
import { generatePurchaseOrderPdfBuffer } from './purchase-order-pdf.service';
import { sendSuccess } from '../../utils/response';

export const createPurchaseOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || 'admin-system';
    const result = await poService.createPurchaseOrder(userId, req.body);
    sendSuccess(res, result, 'Purchase Order created successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const updatePurchaseOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || 'admin-system';
    const result = await poService.updatePurchaseOrder(req.params.id, userId, req.body);
    sendSuccess(res, result, 'Purchase Order updated successfully');
  } catch (err) {
    next(err);
  }
};

export const getPurchaseOrderById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await poService.getPurchaseOrderById(req.params.id);
    sendSuccess(res, result, 'Purchase Order fetched successfully');
  } catch (err) {
    next(err);
  }
};

export const listPurchaseOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await poService.listPurchaseOrders(req.query as any);
    res.status(200).json({
      success: true,
      message: 'Purchase Orders list fetched successfully',
      data: result.data,
      pagination: result.pagination,
      metrics: result.metrics,
    });
  } catch (err) {
    next(err);
  }
};

export const sendPurchaseOrderEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || 'admin-system';
    const result = await poService.sendPurchaseOrderEmail(req.params.id, userId, req.body);
    sendSuccess(res, result, 'Purchase Order email dispatched successfully');
  } catch (err) {
    next(err);
  }
};

export const recordGoodsReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || 'admin-system';
    const result = await poService.recordGoodsReceipt(req.params.id, userId, req.body);
    sendSuccess(res, result, 'Goods receipt recorded and inventory updated successfully');
  } catch (err) {
    next(err);
  }
};

export const updatePoStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || 'admin-system';
    const { status, note } = req.body;
    const result = await poService.updatePoStatus(req.params.id, userId, status, note);
    sendSuccess(res, result, `Purchase Order status updated to ${status}`);
  } catch (err) {
    next(err);
  }
};

export const downloadPurchaseOrderPdf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const po = await poService.getPurchaseOrderById(req.params.id);
    const buffer = await generatePurchaseOrderPdfBuffer(po as any);
    const fullPoNo = po.revision > 0 ? `${po.poNumber}-R${po.revision}` : po.poNumber;
    const cleanFilename = `${fullPoNo.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${cleanFilename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (err) {
    next(err);
  }
};
