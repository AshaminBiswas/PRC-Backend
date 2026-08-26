import { Router } from 'express';
import * as controller from './reports.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { adminLimiter } from '../../middleware/rateLimit.middleware';
import {
  SalesReportQuerySchema,
  InventoryReportQuerySchema,
  CustomerReportQuerySchema,
  ProductReportQuerySchema,
} from './reports.schema';

import * as inventoryController from '../inventory/inventory.controller';

const router = Router();
router.use(authenticate, authorize('reports.read'), adminLimiter);

router.get('/sales', validate(SalesReportQuerySchema, 'query'), controller.getSalesReport);
router.get('/inventory', validate(InventoryReportQuerySchema, 'query'), controller.getInventoryReport);
router.get('/customers', validate(CustomerReportQuerySchema, 'query'), controller.getCustomerReport);
router.get('/products', validate(ProductReportQuerySchema, 'query'), controller.getProductReport);

// Inventory & Warehouse Export Handlers
router.get('/stock', inventoryController.exportStockReport);
router.get('/purchases', inventoryController.exportPurchasesReport);
router.get('/movements', inventoryController.exportMovementsReport);

export default router;
