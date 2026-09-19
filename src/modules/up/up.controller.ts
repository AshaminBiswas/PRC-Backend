import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import * as upService from './up.service';
import * as upInventoryService from './up-inventory.service';
import { exportExpensesToExcel } from './up-export.service';

// ─── 1. Access & Allow-List Controllers ───────────────────────────────────────

export const getAccessStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upService.checkAccess(req.user!);
    sendSuccess(res, data, 'UP access status retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const listAccessUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upService.listAccessUsers();
    sendSuccess(res, data, 'UP access allow-list retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const grantAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { adminId } = req.body;
    const data = await upService.grantAccess(req.user!.id, adminId);
    sendSuccess(res, data, data.message);
  } catch (err) {
    next(err);
  }
};

export const revokeAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = req.params.adminId;
    const data = await upService.revokeAccess(req.user!.id, adminId);
    sendSuccess(res, data, data.message);
  } catch (err) {
    next(err);
  }
};

// ─── 2. Dashboard Controller ──────────────────────────────────────────────────

export const getDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const range = (req.query.range as string) || 'month';
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const data = await upService.getDashboard(range, startDate, endDate);
    sendSuccess(res, data, 'UP dashboard metrics retrieved successfully');
  } catch (err) {
    next(err);
  }
};

// ─── 3. Expenses CRUD Controllers ─────────────────────────────────────────────

export const listExpenses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upService.listExpenses(req.query as any);
    sendSuccess(res, data, 'UP expenses retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const getExpenseById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upService.getExpenseById(req.params.id);
    sendSuccess(res, data, 'UP expense retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const createExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upService.createExpense(req.user!.id, req.body);
    sendSuccess(res, data, 'Expense recorded successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const updateExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upService.updateExpense(req.user!.id, req.params.id, req.body);
    sendSuccess(res, data, 'Expense updated successfully');
  } catch (err) {
    next(err);
  }
};

export const deleteExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upService.deleteExpense(req.user!.id, req.params.id);
    sendSuccess(res, data, data.message);
  } catch (err) {
    next(err);
  }
};

export const verifyExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const verified = req.body.verified !== undefined ? Boolean(req.body.verified) : true;
    const data = await upService.verifyExpense(req.user!.id, req.params.id, verified);
    sendSuccess(res, data, verified ? 'Expense verified successfully' : 'Expense marked unverified');
  } catch (err) {
    next(err);
  }
};

export const getExpenseAudit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upService.getExpenseAudit(req.params.id);
    sendSuccess(res, data, 'Expense audit trail retrieved successfully');
  } catch (err) {
    next(err);
  }
};

// ─── 4. Categories Controllers ────────────────────────────────────────────────

export const listCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const data = await upService.listCategories(includeInactive);
    sendSuccess(res, data, 'Categories retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upService.createCategory(req.user!.id, req.body);
    sendSuccess(res, data, 'Category created successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upService.updateCategory(req.user!.id, req.params.id, req.body);
    sendSuccess(res, data, 'Category updated successfully');
  } catch (err) {
    next(err);
  }
};

// ─── 5. Daily Cash Reconciliation Controllers ─────────────────────────────────

export const getCashStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const data = await upService.getCashStatus(dateStr);
    sendSuccess(res, data, 'Daily cash status retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const reconcileCash = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upService.reconcileCash(req.user!.id, req.body);
    sendSuccess(res, data, 'Daily cash reconciled successfully');
  } catch (err) {
    next(err);
  }
};

export const listCashDays = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Number(req.query.limit || 30);
    const data = await upService.listCashDays(limit);
    sendSuccess(res, data, 'Historical cash days retrieved successfully');
  } catch (err) {
    next(err);
  }
};

// ─── 6. Receipts & Export Controllers ─────────────────────────────────────────

export const uploadReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'No receipt file provided' } });
      return;
    }
    const data = await upService.uploadReceipt(req.params.id, req.file);
    sendSuccess(res, data, 'Receipt uploaded successfully');
  } catch (err) {
    next(err);
  }
};

export const getReceiptSignedUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upService.getReceiptSignedUrl(req.params.id);
    sendSuccess(res, data, 'Receipt signed URL generated');
  } catch (err) {
    next(err);
  }
};

export const deleteReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upService.deleteReceipt(req.user!.id, req.params.id);
    sendSuccess(res, data, data.message);
  } catch (err) {
    next(err);
  }
};

export const exportExpenses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await exportExpensesToExcel(req.query as any, res);
  } catch (err) {
    next(err);
  }
};

// ─── 7. Factory Floor Inventory Controllers ───────────────────────────────────

export const getInventoryDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = req.query.branchId as string;
    const data = await upInventoryService.getInventoryDashboard(branchId);
    sendSuccess(res, data, 'Factory inventory dashboard metrics retrieved');
  } catch (err) {
    next(err);
  }
};

export const searchInventorySKU = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string) || '';
    const branchId = req.query.branchId as string;
    const data = await upInventoryService.searchSKU(q, branchId);
    sendSuccess(res, data, 'SKU search completed');
  } catch (err) {
    next(err);
  }
};

export const listInventoryStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upInventoryService.getStockList(req.query as any);
    sendSuccess(res, data, 'Stock list retrieved');
  } catch (err) {
    next(err);
  }
};

export const receiveMaterial = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upInventoryService.receiveMaterial(req.user!.id, req.body);
    sendSuccess(res, data, 'Material received successfully onto factory floor');
  } catch (err) {
    next(err);
  }
};

export const issueMaterial = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upInventoryService.issueMaterial(req.user!.id, req.body);
    sendSuccess(res, data, 'Material issued to production successfully');
  } catch (err) {
    next(err);
  }
};

export const transferStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upInventoryService.transferStock(req.user!.id, req.body);
    sendSuccess(res, data, 'Stock transferred successfully between facilities');
  } catch (err) {
    next(err);
  }
};

export const recordDamage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upInventoryService.recordDamage(req.user!.id, req.body);
    sendSuccess(res, data, 'Damaged stock recorded and written off');
  } catch (err) {
    next(err);
  }
};

export const recordScrap = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upInventoryService.recordScrap(req.user!.id, req.body);
    sendSuccess(res, data, 'Industrial scrap logged successfully');
  } catch (err) {
    next(err);
  }
};

export const listBoms = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upInventoryService.listBoms();
    sendSuccess(res, data, 'Bills of Materials retrieved');
  } catch (err) {
    next(err);
  }
};

export const getBomById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upInventoryService.getBomById(req.params.id);
    sendSuccess(res, data, 'BOM details retrieved');
  } catch (err) {
    next(err);
  }
};

export const createBom = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upInventoryService.createBom(req.user!.id, req.body);
    sendSuccess(res, data, 'Bill of Materials created successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const listProductionOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upInventoryService.listProductionOrders(req.query as any);
    sendSuccess(res, data, 'Production work orders retrieved');
  } catch (err) {
    next(err);
  }
};

export const createProductionOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upInventoryService.createProductionOrder(req.user!.id, req.body);
    sendSuccess(res, data, 'Production work order created successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const startProductionOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upInventoryService.startProductionOrder(req.params.id, req.user!.id);
    sendSuccess(res, data, 'Production order started');
  } catch (err) {
    next(err);
  }
};

export const completeProductionOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upInventoryService.completeProductionOrder(req.params.id, req.user!.id, req.body);
    sendSuccess(res, data, 'Production order completed and stock updated');
  } catch (err) {
    next(err);
  }
};

export const listPhysicalCounts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = req.query.branchId as string;
    const data = await upInventoryService.listPhysicalCounts(branchId);
    sendSuccess(res, data, 'Physical count audits retrieved');
  } catch (err) {
    next(err);
  }
};

export const createPhysicalCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upInventoryService.createPhysicalCount(req.user!.id, req.body);
    sendSuccess(res, data, 'Physical count audit reconciled successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const getInventoryReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upInventoryService.getInventoryReports(req.query as any);
    sendSuccess(res, data, 'Inventory reports aggregated successfully');
  } catch (err) {
    next(err);
  }
};

