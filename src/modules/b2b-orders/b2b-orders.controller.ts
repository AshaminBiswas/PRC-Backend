import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import * as b2bOrdersService from './b2b-orders.service';

const isSuperAdminRole = (req: Request): boolean => {
  const roleSlug = (req.user?.roleSlug || '').toLowerCase();
  const roles = (req.user?.roles || []).map((r) => r.toLowerCase());
  return (
    ['super-admin', 'super_admin', 'superadmin'].includes(roleSlug) ||
    roles.some((r) => ['super-admin', 'super_admin', 'superadmin'].includes(r))
  );
};

const isAdminOrStaff = (req: Request): boolean => {
  const roleSlug = (req.user?.roleSlug || '').toLowerCase();
  const roles = (req.user?.roles || []).map((r) => r.toLowerCase());
  return (
    ['super-admin', 'super_admin', 'superadmin', 'admin', 'store-manager'].includes(roleSlug) ||
    roles.some((r) => ['super-admin', 'super_admin', 'superadmin', 'admin', 'store-manager'].includes(r))
  );
};

// ─── Customer: Submit B2B Order ───────────────────────────────────────────────

export const submitOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await b2bOrdersService.submitB2bOrder(req.user!, req.body);
    sendSuccess(res, result, 'B2B Order submitted successfully and is pending approval', 201);
  } catch (err) {
    next(err);
  }
};

// ─── Customer: List My B2B Orders ─────────────────────────────────────────────

export const getMyOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await b2bOrdersService.listB2bOrders({
      ...req.query,
      customerId: req.user!.id,
    } as any);
    sendSuccess(res, result, 'My B2B Orders retrieved successfully');
  } catch (err) {
    next(err);
  }
};

// ─── Customer: Cancel Own Pending Order ───────────────────────────────────────

export const customerCancelOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await b2bOrdersService.customerCancelB2bOrder(req.user!, req.params.id);
    sendSuccess(res, result, 'B2B Order cancelled successfully and reserved stock released');
  } catch (err) {
    next(err);
  }
};

// ─── Admin: Create Offline Order ──────────────────────────────────────────────

export const adminCreateOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await b2bOrdersService.adminCreateB2bOrder(req.user!, req.body);
    sendSuccess(res, result, 'Offline B2B Order created and confirmed successfully', 201);
  } catch (err) {
    next(err);
  }
};

// ─── Admin: Approve Pending Order ─────────────────────────────────────────────

export const approveOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await b2bOrdersService.approveB2bOrder(req.user!, req.params.id);
    sendSuccess(res, result, 'B2B Order approved and confirmed successfully');
  } catch (err) {
    next(err);
  }
};

// ─── Admin: Reject Pending Order ──────────────────────────────────────────────

export const rejectOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await b2bOrdersService.rejectB2bOrder(req.user!, req.params.id, req.body.reason);
    sendSuccess(res, result, 'B2B Order rejected and reservations released successfully');
  } catch (err) {
    next(err);
  }
};

// ─── Admin: Cancel Confirmed Order ────────────────────────────────────────────

export const adminCancelOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await b2bOrdersService.adminCancelConfirmedB2bOrder(req.user!, req.params.id, req.body.reason);
    sendSuccess(res, result, 'B2B Order cancelled and physical stock restored to facility');
  } catch (err) {
    next(err);
  }
};

// ─── Admin: Edit Confirmed Order ──────────────────────────────────────────────

export const adminEditOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await b2bOrdersService.adminEditConfirmedB2bOrder(req.user!, req.params.id, req.body);
    sendSuccess(res, result, 'B2B Order items and stock adjustments updated successfully');
  } catch (err) {
    next(err);
  }
};

// ─── Admin: Update Order Status ───────────────────────────────────────────────

export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await b2bOrdersService.updateB2bOrderStatus(req.user!, req.params.id, req.body.status);
    sendSuccess(res, result, 'Order status updated successfully');
  } catch (err) {
    next(err);
  }
};

// ─── Shared: Get Order By ID ──────────────────────────────────────────────────

export const getOrderById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const isAdmin = isAdminOrStaff(req);
    const result = await b2bOrdersService.getB2bOrderById(req.params.id, req.user!, isAdmin);
    sendSuccess(res, result, 'B2B Order retrieved successfully');
  } catch (err) {
    next(err);
  }
};

// ─── Admin: List All B2B Orders ───────────────────────────────────────────────

export const listOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await b2bOrdersService.listB2bOrders(req.query as any);
    sendSuccess(res, result, 'B2B Orders listed successfully');
  } catch (err) {
    next(err);
  }
};

// ─── Shared: Check Product Stock ──────────────────────────────────────────────

export const checkStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const branchId = req.query.branchId as string;
    const rawProducts = req.query.productIds as string;
    const productIds = rawProducts ? rawProducts.split(',').map((s) => s.trim()).filter(Boolean) : [];

    if (!branchId || productIds.length === 0) {
      sendSuccess(res, [], 'No products specified');
      return;
    }

    const result = await b2bOrdersService.checkProductStock(branchId, productIds);
    sendSuccess(res, result, 'Available stock retrieved successfully');
  } catch (err) {
    next(err);
  }
};
