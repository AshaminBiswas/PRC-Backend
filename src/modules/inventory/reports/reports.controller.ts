import { Request, Response, NextFunction } from 'express';
import * as reportsService from './reports.service';
import { sendSuccess } from '../../../utils/response';
import { sendCsvResponse, sendExcelResponse } from '../shared/inventory.helpers';

export const getCurrentStockReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportsService.getCurrentStockReport(req.ventureId!, req.query);
    if (req.query.format === 'csv') {
      sendCsvResponse(res, 'current-stock-report', ['warehouseName', 'sku', 'productName', 'quantity', 'availableQty'], data);
      return;
    }
    if (req.query.format === 'xlsx') {
      await sendExcelResponse(
        res,
        'current-stock-report',
        'Current Stock',
        [
          { header: 'Warehouse Name', key: 'warehouseName' },
          { header: 'SKU', key: 'sku' },
          { header: 'Product Name', key: 'productName' },
          { header: 'Total Quantity', key: 'quantity' },
          { header: 'Available Qty', key: 'availableQty' },
        ],
        data
      );
      return;
    }
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const getLowStockReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportsService.getLowStockReport(req.ventureId!);
    if (req.query.format === 'csv') {
      sendCsvResponse(res, 'low-stock-report', ['sku', 'productName', 'currentStock', 'reorderLevel', 'deficit'], data);
      return;
    }
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const getDeadStockReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportsService.getDeadStockReport(req.ventureId!, Number(req.query.days || 90));
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const getValuationReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportsService.getValuationReport(req.ventureId!);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const getMovementReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportsService.getMovementReport(req.ventureId!, req.query);
    if (req.query.format === 'csv') {
      sendCsvResponse(res, 'movement-report', ['movementId', 'timestamp', 'type', 'sku', 'productName', 'qtyChanged'], data);
      return;
    }
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};
