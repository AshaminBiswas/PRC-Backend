import { Router } from 'express';
import { BarcodeController } from './barcode.controller';
import { authenticate } from '../../middleware/auth.middleware';

export const barcodeRouter = Router();

// ─── Visual Barcode & QR Streaming ───────────────────────────────────────────
// Accessible publicly to allow direct embedding in <img> tags and printing
barcodeRouter.get('/:sku/image', BarcodeController.getBarcodeImage);
barcodeRouter.get('/image/:sku', BarcodeController.getBarcodeImage);

barcodeRouter.get('/:sku/qr', BarcodeController.getQrImage);
barcodeRouter.get('/qr/:sku', BarcodeController.getQrImage);

// ─── Thermal Label PDF Generation ─────────────────────────────────────────────
barcodeRouter.get('/:sku/label', BarcodeController.getLabelPdf);
barcodeRouter.get('/label/:sku', BarcodeController.getLabelPdf);

// ─── Camera & Handheld Scanner Resolution ────────────────────────────────────
barcodeRouter.get('/scan/:code', BarcodeController.scanLookup);
barcodeRouter.get('/scan', BarcodeController.scanLookup);

// ─── Order Dispatch & Verification ───────────────────────────────────────────
barcodeRouter.post('/dispatch', authenticate, BarcodeController.dispatchScan);

// ─── 2-Stage Fulfillment Lifecycle Scan (Packing vs Received) ─────────────────
barcodeRouter.post('/stage-scan', authenticate, BarcodeController.executeStageScan);

export default barcodeRouter;
