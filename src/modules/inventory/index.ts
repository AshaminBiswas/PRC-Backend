import { Router } from 'express';
import dashboardRoutes from './dashboard/dashboard.routes';
import productsRoutes from './products/products.routes';
import stockRoutes from './stock/stock.routes';
import warehousesRoutes from './warehouses/warehouses.routes';
import transfersRoutes from './transfers/transfers.routes';
import suppliersRoutes from './suppliers/suppliers.routes';
import purchasesRoutes from './purchases/purchases.routes';
import dispatchesRoutes from './dispatches/dispatches.routes';
import posRoutes from './pos/pos.routes';
import barcodeRoutes from './barcode/barcode.routes';
import reportsRoutes from './reports/reports.routes';
import analyticsRoutes from './analytics/analytics.routes';
import searchRoutes from './search/search.routes';
import auditRoutes from './audit/audit.routes';

const router = Router();

router.use('/dashboard', dashboardRoutes);
router.use('/products', productsRoutes);
router.use('/stock', stockRoutes);
router.use('/warehouses', warehousesRoutes);
router.use('/transfers', transfersRoutes);
router.use('/suppliers', suppliersRoutes);
router.use('/purchases', purchasesRoutes);
router.use('/dispatches', dispatchesRoutes);
router.use('/pos', posRoutes);
router.use('/reports', reportsRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/search', searchRoutes);
router.use('/audit', auditRoutes);
router.use('/', barcodeRoutes); // /barcodes & /qr

export default router;
