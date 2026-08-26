import { Request, Response, NextFunction } from 'express';
import * as inventoryService from './inventory.service';
import * as exportService from './inventory-export.service';
import { sendSuccess, sendPaginated } from '../../utils/response';
import { clearResponseCache } from '../../middleware/cache.middleware';
import { logAdminAction } from '../../utils/auditLogger';

// ─── 1. Branches Controllers ──────────────────────────────────────────────────

export const listBranches = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await inventoryService.listBranches(req.query as any);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getBranchById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await inventoryService.getBranchById(req.params.id);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const createBranch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await inventoryService.createBranch(req.body);
    clearResponseCache('cache:*branches*');
    clearResponseCache('cache:*inventory*');

    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'BRANCH_CREATED',
      entity: 'BRANCH',
      entityId: data.id,
      entityName: data.name,
      details: `Created new branch '${data.name}' (Code: ${data.code}) in ${data.city || 'N/A'}.`,
      severity: 'SUCCESS',
      metadata: data,
      req,
    });

    sendSuccess(res, data, 'Branch created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateBranch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await inventoryService.updateBranch(req.params.id, req.body);
    clearResponseCache('cache:*branches*');
    clearResponseCache('cache:*inventory*');

    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'BRANCH_UPDATED',
      entity: 'BRANCH',
      entityId: data.id,
      entityName: data.name,
      details: `Updated branch '${data.name}' (${data.code}).`,
      severity: 'INFO',
      metadata: data,
      req,
    });

    sendSuccess(res, data, 'Branch updated successfully');
  } catch (error) {
    next(error);
  }
};

// ─── 2. Suppliers / Vendors Controllers ───────────────────────────────────────

export const listSuppliers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await inventoryService.listSuppliers(req.query as any);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getSupplierById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await inventoryService.getSupplierById(req.params.id);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const createSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await inventoryService.createSupplier(req.body);
    clearResponseCache('cache:*suppliers*');

    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'SUPPLIER_CREATED',
      entity: 'SUPPLIER',
      entityId: data.id,
      entityName: data.name,
      details: `Registered new vendor/supplier '${data.name}' (GSTIN: ${data.gstNumber || 'N/A'}).`,
      severity: 'SUCCESS',
      metadata: data,
      req,
    });

    sendSuccess(res, data, 'Supplier created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await inventoryService.updateSupplier(req.params.id, req.body);
    clearResponseCache('cache:*suppliers*');

    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'SUPPLIER_UPDATED',
      entity: 'SUPPLIER',
      entityId: data.id,
      entityName: data.name,
      details: `Updated supplier details for '${data.name}'.`,
      severity: 'INFO',
      metadata: data,
      req,
    });

    sendSuccess(res, data, 'Supplier updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await inventoryService.deleteSupplier(req.params.id);
    clearResponseCache('cache:*suppliers*');

    logAdminAction({
      userId: req.user?.id || 'system',
      action: 'SUPPLIER_DELETED',
      entity: 'SUPPLIER',
      entityId: data.id,
      entityName: data.name,
      details: `Deactivated supplier '${data.name}'.`,
      severity: 'WARNING',
      metadata: data,
      req,
    });

    sendSuccess(res, data, 'Supplier deleted successfully');
  } catch (error) {
    next(error);
  }
};

// ─── 3. Inventory Stock Controllers ──────────────────────────────────────────

export const listInventory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await inventoryService.listInventory(req.query as any);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getProductInventory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await inventoryService.getProductInventory(req.params.productId);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

// ─── 4. Purchases (Stock-In) Controllers ─────────────────────────────────────

export const listPurchases = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await inventoryService.listPurchases(req.query as any);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getPurchaseById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await inventoryService.getPurchaseById(req.params.id);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const createPurchase = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id || 'system';
    const data = await inventoryService.createPurchase(req.body, userId);

    clearResponseCache('cache:*inventory*');
    clearResponseCache('cache:*products*');
    clearResponseCache('cache:*purchases*');

    logAdminAction({
      userId,
      action: 'PURCHASE_CREATED',
      entity: 'PURCHASE',
      entityId: data.id,
      entityName: `Inv: ${data.invoiceNumber || 'N/A'}`,
      details: `Recorded purchase of ${data.items.length} items from ${data.supplier.name} into ${data.branch.name} for ₹${data.totalAmount}.`,
      severity: 'SUCCESS',
      metadata: {
        purchaseId: data.id,
        supplier: data.supplier.name,
        branch: data.branch.name,
        totalAmount: data.totalAmount,
        itemCount: data.items.length,
      },
      req,
    });

    sendSuccess(res, data, 'Purchase stock-in recorded successfully', 201);
  } catch (error) {
    next(error);
  }
};

// ─── 5. Stock Transfers Controllers ──────────────────────────────────────────

export const listStockTransfers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await inventoryService.listStockTransfers(req.query as any);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getStockTransferById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await inventoryService.getStockTransferById(req.params.id);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const createStockTransfer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id || 'system';
    const data = await inventoryService.createStockTransfer(req.body, userId);

    clearResponseCache('cache:*inventory*');
    clearResponseCache('cache:*transfers*');

    logAdminAction({
      userId,
      action: 'TRANSFER_REQUESTED',
      entity: 'STOCK_TRANSFER',
      entityId: data.id,
      entityName: `${data.fromBranch.code} → ${data.toBranch.code}`,
      details: `Initiated stock transfer of ${data.items.length} items from ${data.fromBranch.name} to ${data.toBranch.name}.`,
      severity: 'INFO',
      metadata: data,
      req,
    });

    sendSuccess(res, data, 'Stock transfer requested successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const dispatchStockTransfer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id || 'system';
    const data = await inventoryService.dispatchStockTransfer(req.params.id, userId, req.body.notes);

    clearResponseCache('cache:*inventory*');
    clearResponseCache('cache:*transfers*');
    clearResponseCache('cache:*products*');

    logAdminAction({
      userId,
      action: 'TRANSFER_DISPATCHED',
      entity: 'STOCK_TRANSFER',
      entityId: data.id,
      entityName: `${data.fromBranch.code} → ${data.toBranch.code}`,
      details: `Dispatched stock transfer from ${data.fromBranch.name} to ${data.toBranch.name}.`,
      severity: 'SUCCESS',
      metadata: data,
      req,
    });

    sendSuccess(res, data, 'Stock transfer dispatched (In Transit)');
  } catch (error) {
    next(error);
  }
};

export const receiveStockTransfer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id || 'system';
    const data = await inventoryService.receiveStockTransfer(req.params.id, userId, req.body.notes);

    clearResponseCache('cache:*inventory*');
    clearResponseCache('cache:*transfers*');
    clearResponseCache('cache:*products*');

    logAdminAction({
      userId,
      action: 'TRANSFER_RECEIVED',
      entity: 'STOCK_TRANSFER',
      entityId: data.id,
      entityName: `${data.fromBranch.code} → ${data.toBranch.code}`,
      details: `Received stock transfer at ${data.toBranch.name} from ${data.fromBranch.name}.`,
      severity: 'SUCCESS',
      metadata: data,
      req,
    });

    sendSuccess(res, data, 'Stock transfer received successfully');
  } catch (error) {
    next(error);
  }
};

export const cancelStockTransfer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id || 'system';
    const data = await inventoryService.cancelStockTransfer(req.params.id, userId, req.body.notes);

    clearResponseCache('cache:*inventory*');
    clearResponseCache('cache:*transfers*');

    logAdminAction({
      userId,
      action: 'TRANSFER_CANCELLED',
      entity: 'STOCK_TRANSFER',
      entityId: data.id,
      entityName: `Transfer ${data.id}`,
      details: `Cancelled pending stock transfer.`,
      severity: 'WARNING',
      metadata: data,
      req,
    });

    sendSuccess(res, data, 'Stock transfer cancelled');
  } catch (error) {
    next(error);
  }
};

// ─── 6. Stock Adjustments Controllers ────────────────────────────────────────

export const adjustStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id || 'system';
    const data = await inventoryService.adjustStock(req.body, userId);

    clearResponseCache('cache:*inventory*');
    clearResponseCache('cache:*products*');

    logAdminAction({
      userId,
      action: 'STOCK_ADJUSTED',
      entity: 'INVENTORY',
      entityId: data.id,
      entityName: `${data.product.sku} @ ${data.branch.code}`,
      details: `Adjusted stock for '${data.product.name}' at ${data.branch.name} (${data.type}: ${data.quantity} units, New Qty: ${data.newQty}). Reason: ${req.body.reason}`,
      severity: 'INFO',
      metadata: data,
      req,
    });

    sendSuccess(res, data, 'Stock adjusted successfully', 201);
  } catch (error) {
    next(error);
  }
};

// ─── 7. Stock Movement Ledger Controllers ────────────────────────────────────

export const listStockMovements = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await inventoryService.listStockMovements(req.query as any);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

// ─── 8. Reports & Exports Controllers ────────────────────────────────────────

export const exportStockReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branchId, lowStock, format = 'xlsx' } = req.query as any;
    const isLowStock = lowStock === 'true' || lowStock === true;
    const data = await inventoryService.getStockReportData(branchId, isLowStock);

    let branchName = 'All Branches';
    if (branchId) {
      const b = await inventoryService.getBranchById(branchId);
      if (b) branchName = b.name;
    }

    if (format === 'pdf') {
      const buffer = await exportService.generateStockPdf(data, branchName);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Stock-Report-${Date.now()}.pdf`);
      res.send(buffer);
      return;
    }

    const buffer = await exportService.generateStockExcel(data, branchName);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Stock-Report-${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

export const exportPurchasesReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branchId, supplierId, from, to } = req.query as any;
    const purchases = await inventoryService.getPurchasesReportData(branchId, supplierId, from, to);

    const buffer = await exportService.generatePurchasesExcel(purchases);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Purchases-Ledger-${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

export const exportMovementsReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branchId, productId, from, to } = req.query as any;
    const movements = await inventoryService.getMovementsReportData(branchId, productId, from, to);

    const buffer = await exportService.generateMovementsExcel(movements);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Stock-Movements-Ledger-${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

// ─── 9. Record Direct / Manual Sale Controller ────────────────────────────────

export const recordSale = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id || 'system';
    const { items, referenceId, referenceType, notes } = req.body;

    const data = await inventoryService.recordSale(
      items,
      {
        referenceId,
        referenceType: referenceType || 'MANUAL_SALE',
        notes,
        userId,
      }
    );

    clearResponseCache('cache:*inventory*');
    clearResponseCache('cache:*products*');

    logAdminAction({
      userId,
      action: 'SALE_RECORDED',
      entity: 'INVENTORY',
      entityId: referenceId,
      entityName: `Sale ${referenceId}`,
      details: `Recorded direct sale of ${items.length} items with reference #${referenceId}.`,
      severity: 'INFO',
      metadata: { items, referenceId, referenceType },
      req,
    });

    sendSuccess(res, data, 'Sale recorded and inventory decremented successfully', 201);
  } catch (error) {
    next(error);
  }
};

