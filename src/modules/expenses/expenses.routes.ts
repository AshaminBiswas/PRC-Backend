import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { ExpensesController } from './expenses.controller';

const router = Router();

// All expense endpoints require authentication
router.use(authenticate);

// ─── Live Balance & Multi-Branch Summaries ───────────────────────────────────
router.get(
  '/live-balance/:branchId',
  authorize('expenses.read', 'super_admin', 'admin', 'manager', 'cashier', 'staff'),
  ExpensesController.getLiveBalance
);

router.get(
  '/summary/multi-branch',
  authorize('expenses.read', 'super_admin', 'admin'),
  ExpensesController.getMultiBranchSummary
);

// ─── Category Master CRUD ───────────────────────────────────────────────────
router.get(
  '/categories',
  authorize('expenses.read', 'super_admin', 'admin', 'manager', 'cashier', 'staff'),
  ExpensesController.getCategories
);

router.post(
  '/categories',
  authorize('expenses.categories', 'super_admin', 'admin'),
  ExpensesController.createCategory
);

router.patch(
  '/categories/:id',
  authorize('expenses.categories', 'super_admin', 'admin'),
  ExpensesController.updateCategory
);

router.delete(
  '/categories/:id',
  authorize('expenses.categories', 'super_admin', 'admin'),
  ExpensesController.deleteCategory
);

// ─── Daily Closing Reconciliation & Float Top-Up ────────────────────────────
router.post(
  '/ledger/reconcile',
  authorize('expenses.reconcile', 'super_admin', 'admin', 'accountant'),
  ExpensesController.reconcileDaily
);

router.post(
  '/ledger/float-topup',
  authorize('expenses.float', 'super_admin', 'admin', 'accountant'),
  ExpensesController.addFloatTopUp
);

// ─── Reporting & BI Exports ─────────────────────────────────────────────────
router.get(
  '/reports/analytics',
  authorize('expenses.reports', 'super_admin', 'admin', 'manager'),
  ExpensesController.getAnalytics
);

router.get(
  '/reports/export',
  authorize('expenses.export', 'super_admin', 'admin', 'manager'),
  ExpensesController.exportExcel
);

// ─── Organization & Branch Settings ─────────────────────────────────────────
router.get(
  '/settings',
  authorize('expenses.settings', 'super_admin', 'admin'),
  ExpensesController.getSettings
);

router.patch(
  '/settings',
  authorize('expenses.settings', 'super_admin', 'admin'),
  ExpensesController.updateSettings
);

// ─── Core Expense Entries ───────────────────────────────────────────────────
router.post(
  '/batch-sync',
  authorize('expenses.create', 'super_admin', 'admin', 'manager', 'cashier', 'staff'),
  ExpensesController.batchSync
);

router.post(
  '/',
  authorize('expenses.create', 'super_admin', 'admin', 'manager', 'cashier', 'staff'),
  ExpensesController.createExpense
);

router.get(
  '/',
  authorize('expenses.read', 'super_admin', 'admin', 'manager', 'cashier', 'staff'),
  ExpensesController.getExpenses
);

router.get(
  '/:id',
  authorize('expenses.read', 'super_admin', 'admin', 'manager', 'cashier', 'staff'),
  ExpensesController.getExpenseById
);

router.post(
  '/:id/approve',
  authorize('expenses.approve', 'super_admin', 'admin', 'accountant'),
  ExpensesController.approveExpense
);

router.post(
  '/:id/reject',
  authorize('expenses.approve', 'super_admin', 'admin', 'accountant'),
  ExpensesController.rejectExpense
);

router.post(
  '/:id/void',
  authorize('expenses.void', 'super_admin', 'admin'),
  ExpensesController.voidExpense
);

export default router;
