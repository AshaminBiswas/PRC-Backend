import { Router } from 'express';
import * as allocationController from './allocation.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { adminLimiter } from '../../middleware/rateLimit.middleware';

const router = Router();

// ─── Public / Customer Allocation Endpoints ────────────────────────────────────

/**
 * POST /api/v1/allocation/allocate
 * POST /api/warehouse/allocate
 * Primary Haversine Shortest Distance Warehouse Allocation Endpoint
 */
router.post('/allocate', allocationController.allocateByShortestDistance);
router.post('/order-allocate', allocationController.allocateOrder);

// PIN Code & Nearest Warehouse Lookup
router.get('/pincodes', allocationController.listPincodes);
router.get('/pincodes/:pincode', allocationController.getPincodeDetails);
router.get('/warehouses/nearest', allocationController.getNearestWarehouses);

// ─── Admin Warehouse & Log Management Endpoints ────────────────────────────────
router.use('/admin', authenticate, adminLimiter);

router.post(
  '/pincodes',
  authenticate,
  authorize('allocation.manage'),
  allocationController.createPincode
);

router.post(
  '/pincodes/import',
  authenticate,
  authorize('allocation.manage'),
  allocationController.bulkImportPincodes
);

router.post(
  '/admin/warehouses',
  authenticate,
  authorize('allocation.manage'),
  allocationController.createAdminWarehouse
);

router.put(
  '/admin/warehouses/:id',
  authenticate,
  authorize('allocation.manage'),
  allocationController.updateAdminWarehouse
);

router.delete(
  '/admin/warehouses/:id',
  authenticate,
  authorize('allocation.manage'),
  allocationController.deleteAdminWarehouse
);

router.get(
  '/admin/logs',
  authenticate,
  authorize('allocation.manage'),
  allocationController.listAllocationLogs
);

router.get(
  '/admin/logs/export',
  authenticate,
  authorize('allocation.manage'),
  allocationController.exportAllocationLogsCsv
);

// ─── OSRM Routing Engine Health & Cache Management ──────────────────────────
router.get('/admin/osrm/health', allocationController.osrmHealth);

router.post(
  '/admin/osrm/cache/clear',
  authenticate,
  authorize('allocation.manage'),
  allocationController.clearOsrmCache
);

export default router;
