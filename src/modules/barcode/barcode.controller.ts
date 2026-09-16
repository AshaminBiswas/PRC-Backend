import { Request, Response, NextFunction } from 'express';
import { BarcodeService } from './barcode.service';

export class BarcodeController {
  /**
   * GET /api/v1/barcode/:sku/image
   * Streams a Code-128 barcode PNG
   */
  static async getBarcodeImage(req: Request, res: Response, next: NextFunction) {
    try {
      const { sku } = req.params;
      const pngBuffer = await BarcodeService.generateBarcodePng(sku);

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.send(pngBuffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/barcode/:sku/qr
   * Streams a high-density QR Code PNG
   */
  static async getQrImage(req: Request, res: Response, next: NextFunction) {
    try {
      const { sku } = req.params;
      const target = (req.query.url as string) || `https://pacificrestroomcubicles.com/product/${encodeURIComponent(sku)}`;
      const pngBuffer = await BarcodeService.generateQrPng(target);

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.send(pngBuffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/barcode/:sku/label
   * Downloads or previews a thermal sticker PDF (58mm x 40mm)
   */
  static async getLabelPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const { sku } = req.params;
      const size = (req.query.size as '58x40' | '80x40') || '58x40';
      const companyName = (req.query.company as string) || 'PACIFIC HARDWARE (PRC)';

      const pdfBuffer = await BarcodeService.generateLabelPdf(sku, { size, companyName });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="label-${sku}.pdf"`);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/barcode/scan/:code
   * Camera or laser scanner lookup endpoint
   */
  static async scanLookup(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code || (req.query.code as string);
      const result = await BarcodeService.lookupScan(code);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/barcode/dispatch
   * Verifies scanned SKU and marks order dispatch with physical inventory deduction
   */
  static async dispatchScan(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId, orderItemId, sku, quantity, branchId, notes } = req.body;
      const staffUserId = (req as any).user?.id;

      const result = await BarcodeService.verifyAndDispatchOrder({
        orderId,
        orderItemId,
        sku,
        quantity: Number(quantity) || 1,
        branchId,
        staffUserId,
        notes,
      });

      res.json({
        success: true,
        data: result,
        message: `Order verified and ${quantity || 1} units of SKU ${sku} marked as dispatched.`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/barcode/stage-scan
   * Executes 2-Stage Fulfillment Scan (PACKING or RECEIVED) with Single-Device Anti-Double-Scan protection
   */
  static async executeStageScan(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        sku,
        stage,
        trackingCode,
        orderId,
        orderItemId,
        branchId,
        deviceId,
        deviceName,
        notes,
      } = req.body;

      const user = (req as any).user;
      const userId = user?.id;
      const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name;

      const result = await BarcodeService.executeStageScan({
        sku,
        stage,
        trackingCode,
        orderId,
        orderItemId,
        branchId,
        deviceId,
        deviceName,
        userId,
        userName,
        notes,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}
