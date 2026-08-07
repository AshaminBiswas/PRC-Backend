import { Request, Response, NextFunction } from 'express';
import * as barcodeService from './barcode.service';
import { sendSuccess } from '../../../utils/response';

export const generateBarcode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await barcodeService.generateBarcode(req.params.productId || req.body.productId);
    if (req.query.format === 'png') {
      res.setHeader('Content-Type', 'image/png');
      res.send(result.imageBuffer);
      return;
    }
    sendSuccess(res, { productId: result.productId, sku: result.sku, barcode: result.barcode, productName: result.productName });
  } catch (error) {
    next(error);
  }
};

export const downloadBarcode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await barcodeService.generateBarcode(req.params.productId);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="barcode-${result.sku}.png"`);
    res.send(result.imageBuffer);
  } catch (error) {
    next(error);
  }
};

export const generateQR = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await barcodeService.generateQR(req.params.productId || req.body.productId);
    sendSuccess(res, { productId: result.productId, sku: result.sku, qrCode: result.qrCode, productName: result.productName, dataUrl: result.dataUrl });
  } catch (error) {
    next(error);
  }
};

export const downloadQR = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await barcodeService.generateQR(req.params.productId);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="qr-${result.sku}.png"`);
    res.send(result.imageBuffer);
  } catch (error) {
    next(error);
  }
};
