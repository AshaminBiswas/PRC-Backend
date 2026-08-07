import { Router } from 'express';
import * as controller from './reports.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  SalesReportQuerySchema,
  InventoryReportQuerySchema,
  CustomerReportQuerySchema,
  ProductReportQuerySchema,
} from './reports.schema';

const router = Router();
router.use(authenticate, authorize('reports.read'));

router.get('/sales', validate(SalesReportQuerySchema, 'query'), controller.getSalesReport);
router.get('/inventory', validate(InventoryReportQuerySchema, 'query'), controller.getInventoryReport);
router.get('/customers', validate(CustomerReportQuerySchema, 'query'), controller.getCustomerReport);
router.get('/products', validate(ProductReportQuerySchema, 'query'), controller.getProductReport);

export default router;
