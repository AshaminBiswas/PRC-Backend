import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import { purchaseOrdersService } from './purchase-orders.service';
import {
  CreatePurchaseOrderSchema,
  AcknowledgeReceiptSchema,
  VerifyReceiptSchema,
  RejectReceiptSchema,
  ReopenReceiptSchema,
  RejectPurchaseOrderSchema,
  AdminUpdatePurchaseOrderSchema,
  AdvancePaymentSettingSchema,
  BankAccountSettingSchema,
  SavedAddressSchema,
  RecordDispatchSchema,
} from './purchase-orders.schema';
import { sendSuccess, sendPaginated } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';

export class PurchaseOrdersController {
  // ─── Customer Endpoints ─────────────────────────────────────────────────────

  /**
   * GET /api/v1/purchase-orders/eligible-quotations
   */
  async getEligibleQuotations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);

      const quotes = await purchaseOrdersService.getEligibleQuotations(userId);
      sendSuccess(res, quotes, 'Eligible approved quotations retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/purchase-orders/quotation/:id
   */
  async getQuotationForPo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);

      const data = await purchaseOrdersService.getQuotationForPo(req.params.id, userId);
      sendSuccess(res, data, 'Quotation data for PO retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/purchase-orders
   */
  async createPurchaseOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);

      const validated = CreatePurchaseOrderSchema.parse(req.body);
      const ip = req.ip || (req.headers['x-forwarded-for'] as string);

      const po = await purchaseOrdersService.createPurchaseOrder(userId, validated, ip);
      sendSuccess(res, po, 'Purchase Order created and submitted successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/purchase-orders
   */
  async getPurchaseOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user?.id) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);

      const roles = user.roles || (user.roleSlug ? [user.roleSlug] : ['customer']);
      const result = await purchaseOrdersService.getPurchaseOrders(user.id, roles, {
        status: req.query.status as string,
        search: req.query.search as string,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
      });

      sendPaginated(res, result.items, {
        page: result.pagination.page,
        limit: result.pagination.limit,
        totalItems: result.pagination.total,
        totalPages: result.pagination.totalPages,
        hasNextPage: result.pagination.page < result.pagination.totalPages,
        hasPrevPage: result.pagination.page > 1,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/purchase-orders/:id
   */
  async getPurchaseOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user?.id) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);

      const roles = user.roles || (user.roleSlug ? [user.roleSlug] : ['customer']);
      const po = await purchaseOrdersService.getPurchaseOrderById(req.params.id, {
        id: user.id,
        roles,
      });

      sendSuccess(res, po, 'Purchase order retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST or PUT /api/v1/purchase-orders/:id/payment-receipt
   */
  async uploadPaymentReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user?.id) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);

      const file = req.file;
      if (!file) throw new AppError('BAD_REQUEST', 'No file uploaded', 400);

      const roles = user.roles || (user.roleSlug ? [user.roleSlug] : ['customer']);
      const ip = req.ip || (req.headers['x-forwarded-for'] as string);

      const receipt = await purchaseOrdersService.uploadPaymentReceipt(
        req.params.id,
        file,
        { id: user.id, roles },
        ip
      );

      sendSuccess(res, receipt, 'Payment receipt uploaded successfully. Status: Awaiting Admin Review');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/purchase-orders/:id/payment-receipt/download or /view
   */
  async downloadPaymentReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user?.id) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);

      const roles = user.roles || (user.roleSlug ? [user.roleSlug] : ['customer']);
      const { filePath, fileName, mimeType } = await purchaseOrdersService.getPaymentReceiptFile(
        req.params.id,
        { id: user.id, roles }
      );

      res.setHeader('Content-Type', mimeType);
      const isInline = req.query.inline === 'true' || req.path.endsWith('/view');
      res.setHeader(
        'Content-Disposition',
        `${isInline ? 'inline' : 'attachment'}; filename="${fileName}"`
      );

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/purchase-orders/:id/download or /view
   */
  async downloadPurchaseOrderPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user?.id) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);

      const roles = user.roles || (user.roleSlug ? [user.roleSlug] : ['customer']);
      const { filePath, fileName } = await purchaseOrdersService.getPurchaseOrderPdf(req.params.id, {
        id: user.id,
        roles,
      });

      const fileBuffer = await fs.promises.readFile(filePath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', fileBuffer.length);
      const isInline = req.query.inline === 'true' || req.path.endsWith('/view');
      res.setHeader(
        'Content-Disposition',
        `${isInline ? 'inline' : 'attachment'}; filename="${fileName}"`
      );

      res.status(200).send(fileBuffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/purchase-orders/:id/packing-list
   */
  async downloadPackingList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user?.id) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);

      const roles = user.roles || (user.roleSlug ? [user.roleSlug] : ['customer']);
      const { filePath, fileName } = await purchaseOrdersService.getPackingListPdf(req.params.id, {
        id: user.id,
        roles,
      });

      const fileBuffer = await fs.promises.readFile(filePath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', fileBuffer.length);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      res.status(200).send(fileBuffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/purchase-orders/addresses
   */
  async getSavedAddresses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);

      const list = await purchaseOrdersService.getSavedAddresses(userId);
      sendSuccess(res, list, 'Saved addresses retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/purchase-orders/addresses
   */
  async createSavedAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);

      const validated = SavedAddressSchema.parse(req.body);
      const created = await purchaseOrdersService.saveAddressToBook(userId, validated, validated.label);
      sendSuccess(res, created, 'Address saved to address book', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/purchase-orders/addresses/:id
   */
  async deleteSavedAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);

      await purchaseOrdersService.deleteSavedAddress(userId, req.params.id);
      sendSuccess(res, null, 'Saved address removed successfully');
    } catch (error) {
      next(error);
    }
  }

  // ─── Admin Endpoints ────────────────────────────────────────────────────────

  /**
   * POST /api/v1/admin/purchase-orders/:id/payment-receipt/acknowledge
   */
  async adminAcknowledgeReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminUser = (req as any).user;
      const validated = AcknowledgeReceiptSchema.parse(req.body);
      const ip = req.ip || (req.headers['x-forwarded-for'] as string);

      const updated = await purchaseOrdersService.acknowledgePaymentReceipt(
        req.params.id,
        { id: adminUser.id, email: adminUser.email },
        validated,
        ip
      );

      sendSuccess(res, updated, 'Payment acknowledged and customer notified successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/purchase-orders/:id/payment-receipt/verify
   */
  async adminVerifyReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminUser = (req as any).user;
      const validated = VerifyReceiptSchema.parse(req.body);
      const ip = req.ip || (req.headers['x-forwarded-for'] as string);

      const result = await purchaseOrdersService.verifyPaymentReceipt(
        req.params.id,
        { id: adminUser.id, email: adminUser.email },
        validated,
        ip
      );

      sendSuccess(res, result, 'Payment receipt digitally verified. Packing list generation initiated.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/purchase-orders/:id/payment-receipt/reject
   */
  async adminRejectReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminUser = (req as any).user;
      const validated = RejectReceiptSchema.parse(req.body);
      const ip = req.ip || (req.headers['x-forwarded-for'] as string);

      const updated = await purchaseOrdersService.rejectPaymentReceipt(
        req.params.id,
        { id: adminUser.id, email: adminUser.email },
        validated,
        ip
      );

      sendSuccess(res, updated, 'Payment receipt rejected. Customer requested to re-upload.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/purchase-orders/:id/payment-receipt/reopen
   */
  async adminReopenReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminUser = (req as any).user;
      const validated = ReopenReceiptSchema.parse(req.body);
      const ip = req.ip || (req.headers['x-forwarded-for'] as string);

      const updated = await purchaseOrdersService.reopenPaymentReceipt(
        req.params.id,
        { id: adminUser.id, email: adminUser.email },
        validated.reason,
        ip
      );

      sendSuccess(res, updated, 'Payment receipt reopened for updates.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/admin/purchase-orders/:id/reject
   */
  async adminRejectPurchaseOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminUser = (req as any).user;
      const validated = RejectPurchaseOrderSchema.parse(req.body);
      const ip = req.ip || (req.headers['x-forwarded-for'] as string);

      const updated = await purchaseOrdersService.rejectPurchaseOrder(
        req.params.id,
        { id: adminUser.id, email: adminUser.email },
        validated.rejectionReason,
        ip
      );

      sendSuccess(res, updated, 'Purchase Order rejected successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH or PUT /api/v1/admin/purchase-orders/:id
   */
  async adminUpdatePurchaseOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminUser = (req as any).user;
      const validated = AdminUpdatePurchaseOrderSchema.parse(req.body);

      const updated = await purchaseOrdersService.updatePurchaseOrderByAdmin(
        req.params.id,
        validated,
        { id: adminUser.id, email: adminUser.email }
      );

      sendSuccess(res, updated, 'Purchase Order details updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/purchase-orders/settings/advance-payment
   */
  async getAdvancePaymentSetting(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const setting = await purchaseOrdersService.getAdvancePaymentSetting();
      sendSuccess(res, setting, 'Advance payment settings retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/admin/purchase-orders/settings/advance-payment
   */
  async updateAdvancePaymentSetting(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = (req as any).user?.id;
      const validated = AdvancePaymentSettingSchema.parse(req.body);
      const setting = await purchaseOrdersService.updateAdvancePaymentSetting(validated, adminId);
      sendSuccess(res, setting, 'Advance payment settings updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/purchase-orders/settings/bank-account
   */
  async getBankAccountSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await purchaseOrdersService.getBankAccountSettings();
      sendSuccess(res, settings, 'Bank account settings retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/admin/purchase-orders/settings/bank-account
   */
  async updateBankAccountSetting(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = (req as any).user?.id;
      const validated = BankAccountSettingSchema.parse(req.body);
      const setting = await purchaseOrdersService.updateBankAccountSetting(validated, adminId);
      sendSuccess(res, setting, 'Bank account settings updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // ─── Dispatch & Invoice Endpoints ───────────────────────────────────────────

  /**
   * POST /api/v1/admin/purchase-orders/:id/dispatch
   */
  async adminRecordDispatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminUser = (req as any).user;
      const validated = RecordDispatchSchema.parse(req.body);
      const ip = req.ip || (req.headers['x-forwarded-for'] as string);

      const result = await purchaseOrdersService.recordDispatch(
        req.params.id,
        { id: adminUser.id, email: adminUser.email, name: `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() },
        validated,
        ip
      );

      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/purchase-orders/:id/invoice
   */
  async getPoInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user?.id) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);

      const roles = user.roles || (user.roleSlug ? [user.roleSlug] : ['customer']);
      const invoiceData = await purchaseOrdersService.getPoInvoice(req.params.id, {
        id: user.id,
        roles,
      });

      sendSuccess(res, invoiceData, 'Purchase Order Invoice retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/purchase-orders/:id/invoice/download
   */
  async downloadPoInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user?.id) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);

      const roles = user.roles || (user.roleSlug ? [user.roleSlug] : ['customer']);
      const { filePath, fileName } = await purchaseOrdersService.getInvoicePdf(req.params.id, {
        id: user.id,
        roles,
      });

      const fileBuffer = await fs.promises.readFile(filePath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', fileBuffer.length);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      res.status(200).send(fileBuffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/purchase-orders/:id/invoice/regenerate
   */
  async adminRegenerateInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminUser = (req as any).user;
      const ip = req.ip || (req.headers['x-forwarded-for'] as string);

      const result = await purchaseOrdersService.regenerateInvoice(
        req.params.id,
        { id: adminUser.id, email: adminUser.email, name: `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() },
        ip
      );

      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/invoices
   */
  async adminListInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await purchaseOrdersService.listAllInvoices({
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
        search: req.query.search as string,
        status: req.query.status as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      });

      sendPaginated(res, result.items, {
        page: result.pagination.page,
        limit: result.pagination.limit,
        totalItems: result.pagination.total,
        totalPages: result.pagination.totalPages,
        hasNextPage: result.pagination.page < result.pagination.totalPages,
        hasPrevPage: result.pagination.page > 1,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/purchase-orders/:id or DELETE /api/v1/admin/purchase-orders/:id
   */
  async deletePurchaseOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user?.id) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);

      const roles = user.roles || (user.roleSlug ? [user.roleSlug] : ['customer']);
      const result = await purchaseOrdersService.deletePurchaseOrder(req.params.id, {
        id: user.id,
        email: user.email || '',
        roles,
      });

      sendSuccess(res, result, 'Purchase Order deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const purchaseOrdersController = new PurchaseOrdersController();


