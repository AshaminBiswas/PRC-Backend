import { Router } from 'express';
import * as controller from './inventory.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { cacheResponse } from '../../middleware/cache.middleware';
import {
  ListBranchesQuerySchema,
  CreateBranchSchema,
  UpdateBranchSchema,
  ListSuppliersQuerySchema,
  CreateSupplierSchema,
  UpdateSupplierSchema,
  ListInventoryQuerySchema,
  CreatePurchaseSchema,
  ListPurchasesQuerySchema,
  CreateStockTransferSchema,
  ListStockTransfersQuerySchema,
  TransferActionSchema,
  CreateStockAdjustmentSchema,
  ListStockMovementsQuerySchema,
  InventoryReportQuerySchema,
  CreateSaleSchema,
  QuickStockSchema,
} from './inventory.schema';

// ─── 1. Branches Router ──────────────────────────────────────────────────────
export const branchesRouter = Router();

branchesRouter.get(
  '/',
  authenticate,
  authorize('inventory.stock.read', 'inventory.view', 'branches.read'),
  cacheResponse(60),
  validate(ListBranchesQuerySchema, 'query'),
  controller.listBranches
);

branchesRouter.get(
  '/:id',
  authenticate,
  authorize('inventory.stock.read', 'inventory.view', 'branches.read'),
  controller.getBranchById
);

branchesRouter.post(
  '/',
  authenticate,
  authorize('inventory.warehouses.create', 'branches.create', 'settings.manage'),
  validate(CreateBranchSchema),
  controller.createBranch
);

branchesRouter.patch(
  '/:id',
  authenticate,
  authorize('inventory.warehouses.update', 'branches.update', 'settings.manage'),
  validate(UpdateBranchSchema),
  controller.updateBranch
);

branchesRouter.delete(
  '/:id',
  authenticate,
  authorize('inventory.warehouses.delete', 'branches.delete', 'settings.manage'),
  controller.deleteBranch
);

// ─── 2. Suppliers Router ────────────────────────────────────────────────────
export const suppliersRouter = Router();

suppliersRouter.get(
  '/',
  authenticate,
  authorize('inventory.suppliers.read', 'suppliers.manage', 'purchases.view'),
  cacheResponse(60),
  validate(ListSuppliersQuerySchema, 'query'),
  controller.listSuppliers
);

suppliersRouter.get(
  '/:id',
  authenticate,
  authorize('inventory.suppliers.read', 'suppliers.manage'),
  controller.getSupplierById
);

suppliersRouter.post(
  '/',
  authenticate,
  authorize('inventory.suppliers.create', 'suppliers.manage'),
  validate(CreateSupplierSchema),
  controller.createSupplier
);

suppliersRouter.patch(
  '/:id',
  authenticate,
  authorize('inventory.suppliers.update', 'suppliers.manage'),
  validate(UpdateSupplierSchema),
  controller.updateSupplier
);

suppliersRouter.delete(
  '/:id',
  authenticate,
  authorize('inventory.suppliers.delete', 'suppliers.manage'),
  controller.deleteSupplier
);

// ─── 3. Inventory Stock Router ───────────────────────────────────────────────
export const inventoryRouter = Router();

inventoryRouter.get(
  '/',
  authenticate,
  authorize('inventory.stock.read', 'inventory.view', 'products.read'),
  validate(ListInventoryQuerySchema, 'query'),
  controller.listInventory
);

inventoryRouter.get(
  '/product/:productId',
  authenticate,
  authorize('inventory.stock.read', 'inventory.view', 'products.read'),
  controller.getProductInventory
);

inventoryRouter.get(
  '/product/:productId/dossier',
  authenticate,
  authorize('inventory.stock.read', 'inventory.view', 'products.read'),
  controller.getProductDossier
);

inventoryRouter.get(
  '/export/excel',
  authenticate,
  authorize('inventory.reports.read', 'reports.export', 'inventory.stock.read', 'inventory.view'),
  controller.exportStockReport
);

inventoryRouter.get(
  '/export/pdf',
  authenticate,
  authorize('inventory.reports.read', 'reports.export', 'inventory.stock.read', 'inventory.view'),
  controller.exportStockReport
);

inventoryRouter.get(
  '/product/:productId/dossier/export/excel',
  authenticate,
  authorize('inventory.reports.read', 'reports.export', 'inventory.stock.read'),
  controller.exportProductDossierExcel
);

inventoryRouter.get(
  '/product/:productId/dossier/export/pdf',
  authenticate,
  authorize('inventory.reports.read', 'reports.export', 'inventory.stock.read'),
  controller.exportProductDossierPdf
);

inventoryRouter.post(
  '/sales',
  authenticate,
  authorize('inventory.stock.write', 'orders.create', 'sales.create', 'orders.manage'),
  validate(CreateSaleSchema),
  controller.recordSale
);

inventoryRouter.post(
  '/quick-stock',
  authenticate,
  authorize('inventory.stock.write', 'inventory.stock.adjust', 'purchases.create', 'products.create'),
  validate(QuickStockSchema),
  controller.quickStock
);

inventoryRouter.patch(
  '/:id',
  authenticate,
  authorize('inventory.stock.write', 'inventory.adjust', 'products.write', 'inventory.warehouses.update'),
  controller.updateInventoryItem
);

inventoryRouter.delete(
  '/:id',
  authenticate,
  authorize('inventory.stock.write', 'inventory.adjust', 'products.delete', 'inventory.warehouses.delete'),
  controller.deleteInventoryItem
);

// ─── 4. Purchases (Stock-In) Router ──────────────────────────────────────────
export const purchasesRouter = Router();

purchasesRouter.get(
  '/export/excel',
  authenticate,
  authorize('inventory.purchases.read', 'purchases.view', 'reports.export'),
  controller.exportPurchasesReport
);

purchasesRouter.get(
  '/',
  authenticate,
  authorize('inventory.purchases.read', 'purchases.view'),
  validate(ListPurchasesQuerySchema, 'query'),
  controller.listPurchases
);

purchasesRouter.get(
  '/:id',
  authenticate,
  authorize('inventory.purchases.read', 'purchases.view'),
  controller.getPurchaseById
);

purchasesRouter.post(
  '/',
  authenticate,
  authorize('inventory.purchases.create', 'purchases.create'),
  validate(CreatePurchaseSchema),
  controller.createPurchase
);

purchasesRouter.patch(
  '/:id',
  authenticate,
  authorize('inventory.purchases.update', 'purchases.edit', 'purchases.create'),
  controller.updatePurchase
);

purchasesRouter.delete(
  '/:id',
  authenticate,
  authorize('inventory.purchases.delete', 'purchases.delete', 'purchases.create'),
  controller.deletePurchase
);

// ─── 5. Stock Transfers Router ──────────────────────────────────────────────
export const transfersRouter = Router();

transfersRouter.get(
  '/',
  authenticate,
  authorize('inventory.transfers.read', 'transfers.view'),
  validate(ListStockTransfersQuerySchema, 'query'),
  controller.listStockTransfers
);

transfersRouter.get(
  '/:id',
  authenticate,
  authorize('inventory.transfers.read', 'transfers.view'),
  controller.getStockTransferById
);

transfersRouter.post(
  '/',
  authenticate,
  authorize('inventory.transfers.create', 'transfers.create'),
  validate(CreateStockTransferSchema),
  controller.createStockTransfer
);

transfersRouter.patch(
  '/:id',
  authenticate,
  authorize('inventory.transfers.edit', 'transfers.create'),
  controller.updateStockTransfer
);

transfersRouter.patch(
  '/:id/dispatch',
  authenticate,
  authorize('inventory.transfers.approve', 'transfers.approve'),
  validate(TransferActionSchema),
  controller.dispatchStockTransfer
);

transfersRouter.patch(
  '/:id/receive',
  authenticate,
  authorize('inventory.transfers.approve', 'transfers.receive'),
  validate(TransferActionSchema),
  controller.receiveStockTransfer
);

transfersRouter.patch(
  '/:id/cancel',
  authenticate,
  authorize('inventory.transfers.cancel', 'transfers.create'),
  validate(TransferActionSchema),
  controller.cancelStockTransfer
);

transfersRouter.delete(
  '/:id',
  authenticate,
  authorize('inventory.transfers.delete', 'transfers.cancel', 'transfers.create'),
  controller.deleteStockTransfer
);

// ─── 6. Stock Adjustments Router ────────────────────────────────────────────
export const stockAdjustmentsRouter = Router();

stockAdjustmentsRouter.post(
  '/',
  authenticate,
  authorize('inventory.stock.adjust', 'inventory.adjust'),
  validate(CreateStockAdjustmentSchema),
  controller.adjustStock
);

// ─── 7. Stock Movements Ledger Router ───────────────────────────────────────
export const stockMovementsRouter = Router();

stockMovementsRouter.get(
  '/export/excel',
  authenticate,
  authorize('inventory.stock.read', 'inventory.audit.read', 'reports.export'),
  controller.exportMovementsReport
);

stockMovementsRouter.get(
  '/',
  authenticate,
  authorize('inventory.stock.read', 'inventory.audit.read', 'audit.view'),
  validate(ListStockMovementsQuerySchema, 'query'),
  controller.listStockMovements
);

stockMovementsRouter.patch(
  '/:id',
  authenticate,
  authorize('inventory.stock.write', 'inventory.audit.manage', 'inventory.adjust'),
  controller.updateStockMovement
);

stockMovementsRouter.post(
  '/:id/reverse',
  authenticate,
  authorize('inventory.stock.write', 'inventory.stock.adjust', 'inventory.adjust'),
  controller.reverseStockMovement
);

// ─── 8. Reports Router ──────────────────────────────────────────────────────
export const inventoryReportsRouter = Router();

inventoryReportsRouter.get(
  '/stock',
  authenticate,
  authorize('inventory.reports.read', 'reports.export', 'reports.read'),
  validate(InventoryReportQuerySchema, 'query'),
  controller.exportStockReport
);

inventoryReportsRouter.get(
  '/purchases',
  authenticate,
  authorize('inventory.reports.read', 'reports.export', 'reports.read'),
  validate(InventoryReportQuerySchema, 'query'),
  controller.exportPurchasesReport
);

inventoryReportsRouter.get(
  '/movements',
  authenticate,
  authorize('inventory.reports.read', 'reports.export', 'reports.read'),
  validate(InventoryReportQuerySchema, 'query'),
  controller.exportMovementsReport
);

inventoryReportsRouter.get(
  '/low-stock',
  authenticate,
  authorize('inventory.reports.read', 'reports.export', 'reports.read'),
  validate(InventoryReportQuerySchema, 'query'),
  (req, res, next) => {
    (req.query as any).lowStock = 'true';
    return controller.exportStockReport(req, res, next);
  }
);
