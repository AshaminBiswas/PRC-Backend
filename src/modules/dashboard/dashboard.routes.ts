import { Router } from 'express';
import * as controller from './dashboard.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { adminLimiter } from '../../middleware/rateLimit.middleware';
import {
  DashboardOverviewQuerySchema,
  SalesChartQuerySchema,
  RecentOrdersQuerySchema,
  DashboardInventoryQuerySchema,
} from './dashboard.schema';

const router = Router();
router.use(authenticate, authorize('dashboard.read'), adminLimiter);

router.get('/overview', validate(DashboardOverviewQuerySchema, 'query'), controller.getOverview);
router.get('/sales-chart', validate(SalesChartQuerySchema, 'query'), controller.getSalesChart);
router.get('/recent-orders', validate(RecentOrdersQuerySchema, 'query'), controller.getRecentOrders);
router.get('/inventory', validate(DashboardInventoryQuerySchema, 'query'), controller.getInventory);

// Backwards compatibility / auxiliary routes
router.get('/revenue', validate(SalesChartQuerySchema, 'query'), controller.getRevenueTrend);
router.get('/orders', validate(DashboardOverviewQuerySchema, 'query'), controller.getOrderStats);
router.get('/products', controller.getProductStats);
router.get('/customers', validate(DashboardOverviewQuerySchema, 'query'), controller.getCustomerStats);
router.get('/analytics', validate(DashboardOverviewQuerySchema, 'query'), controller.getAnalytics);

export default router;
