import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { requireUPAccess, requireUPSuperAdmin } from './up.middleware';
import * as controller from './up.controller';
import {
  CreateUpExpenseSchema,
  UpdateUpExpenseSchema,
  ListUpExpensesQuerySchema,
  CreateUpCategorySchema,
  UpdateUpCategorySchema,
  GrantUpAccessSchema,
  ReconcileCashSchema,
} from './up.schema';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB maximum
});

const router = Router();

// Every UP endpoint unconditionally requires valid authentication token
router.use(authenticate);

// ─── 1. Access Status & Allow-List Management ─────────────────────────────────
// Check current user's access (Used by Sidebar navigation & Frontend route guard)
router.get('/access', controller.getAccessStatus);

// Allow-list administration strictly restricted to Super Admin
router.get('/access/users', requireUPSuperAdmin, controller.listAccessUsers);
router.post('/access', requireUPSuperAdmin, validate(GrantUpAccessSchema), controller.grantAccess);
router.delete('/access/:adminId', requireUPSuperAdmin, controller.revokeAccess);

// ─── 2. Dashboard Analytics & Summary (Layer 4 Authorization) ─────────────────
router.get('/dashboard', requireUPAccess, controller.getDashboard);

// ─── 3. Categories Management ─────────────────────────────────────────────────
router.get('/categories', requireUPAccess, controller.listCategories);
router.post('/categories', requireUPSuperAdmin, validate(CreateUpCategorySchema), controller.createCategory);
router.patch('/categories/:id', requireUPSuperAdmin, validate(UpdateUpCategorySchema), controller.updateCategory);

// ─── 4. Daily Petty Cash Reconciliation ───────────────────────────────────────
router.get('/cash/today', requireUPAccess, controller.getCashStatus);
router.get('/cash/status', requireUPAccess, controller.getCashStatus);
router.get('/cash', requireUPAccess, controller.listCashDays);
router.post('/cash/reconcile', requireUPAccess, validate(ReconcileCashSchema), controller.reconcileCash);

// ─── 5. Reports & Excel Export ────────────────────────────────────────────────
router.get('/reports', requireUPAccess, validate(ListUpExpensesQuerySchema, 'query'), controller.listExpenses);
router.get('/reports/export', requireUPAccess, validate(ListUpExpensesQuerySchema, 'query'), controller.exportExpenses);

// ─── 6. Expenses CRUD ─────────────────────────────────────────────────────────
router.get('/expenses', requireUPAccess, validate(ListUpExpensesQuerySchema, 'query'), controller.listExpenses);
router.post('/expenses', requireUPAccess, validate(CreateUpExpenseSchema), controller.createExpense);
router.get('/expenses/:id', requireUPAccess, controller.getExpenseById);
router.patch('/expenses/:id', requireUPAccess, validate(UpdateUpExpenseSchema), controller.updateExpense);
router.delete('/expenses/:id', requireUPAccess, controller.deleteExpense);

// ─── 7. Verification Actions (Super Admin Only) ───────────────────────────────
router.post('/expenses/:id/verify', requireUPSuperAdmin, controller.verifyExpense);
router.post('/expenses/:id/unverify', requireUPSuperAdmin, controller.verifyExpense);

// ─── 8. Immutable Audit Trail ─────────────────────────────────────────────────
router.get('/expenses/:id/audit', requireUPAccess, controller.getExpenseAudit);

// ─── 9. Receipt Storage & Signed URLs ─────────────────────────────────────────
router.post('/expenses/:id/receipt', requireUPAccess, upload.single('receipt'), controller.uploadReceipt);
router.get('/expenses/:id/receipt-url', requireUPAccess, controller.getReceiptSignedUrl);
router.delete('/expenses/:id/receipt', requireUPAccess, controller.deleteReceipt);

export default router;
