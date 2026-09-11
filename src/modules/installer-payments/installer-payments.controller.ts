import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../../utils/response';
import * as installerService from './installer-payments.service';
import {
  CreateCubicleModelSchema,
  UpdateCubicleModelSchema,
  CreateCubicleInstallerSchema,
  UpdateCubicleInstallerSchema,
  CreateInstallerBillSchema,
  UpdateInstallerBillSchema,
  RecordPaymentSchema,
  ListInstallerBillsQuerySchema,
  ExportBillsQuerySchema,
} from './installer-payments.schema';

// ─── Cubicle Model Master Handlers (Super Admin Only) ────────────────────────

export const listCubicleModelsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    const models = await installerService.listCubicleModels(activeOnly);
    sendSuccess(res, models, 'Cubicle models retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const createCubicleModelHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreateCubicleModelSchema.parse(req.body);
    const model = await installerService.createCubicleModel(body);
    sendSuccess(res, model, 'Cubicle model created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateCubicleModelHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const body = UpdateCubicleModelSchema.parse(req.body);
    const model = await installerService.updateCubicleModel(id, body);
    sendSuccess(res, model, 'Cubicle model updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deactivateCubicleModelHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const model = await installerService.deactivateCubicleModel(id);
    sendSuccess(res, model, 'Cubicle model deactivated successfully');
  } catch (error) {
    next(error);
  }
};

// ─── Cubicle Installer Master Handlers (Directory) ──────────────────────────

export const listCubicleInstallersHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const installers = await installerService.listCubicleInstallers(includeInactive);
    sendSuccess(res, installers, 'Cubicle installers retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const createCubicleInstallerHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreateCubicleInstallerSchema.parse(req.body);
    const installer = await installerService.createCubicleInstaller(body);
    sendSuccess(res, installer, 'Cubicle installer created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateCubicleInstallerHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const body = UpdateCubicleInstallerSchema.parse(req.body);
    const installer = await installerService.updateCubicleInstaller(id, body);
    sendSuccess(res, installer, 'Cubicle installer updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deactivateCubicleInstallerHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const installer = await installerService.deactivateCubicleInstaller(id);
    sendSuccess(res, installer, 'Cubicle installer deactivated successfully');
  } catch (error) {
    next(error);
  }
};

// ─── Installer Payment Bills Handlers (Admin & Super Admin) ──────────────────

export const listInstallerBillsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = ListInstallerBillsQuerySchema.parse(req.query);
    const result = await installerService.listInstallerBills(query);
    sendSuccess(res, result, 'Installer bills retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getInstallerBillHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const bill = await installerService.getInstallerBillById(id);
    sendSuccess(res, bill, 'Installer bill retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const createInstallerBillHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreateInstallerBillSchema.parse(req.body);
    const createdById = req.user?.id;
    const bill = await installerService.createInstallerBill(body, createdById);
    sendSuccess(res, bill, 'Installer bill created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateInstallerBillHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const body = UpdateInstallerBillSchema.parse(req.body);
    const bill = await installerService.updateInstallerBill(id, body);
    sendSuccess(res, bill, 'Installer bill updated successfully');
  } catch (error) {
    next(error);
  }
};

export const recordBillPaymentHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const billId = req.params.id as string;
    const body = RecordPaymentSchema.parse(req.body);
    const recordedById = req.user?.id;
    const bill = await installerService.recordBillPayment(billId, body, recordedById);
    sendSuccess(res, bill, 'Payment installment recorded successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const downloadBillPdfHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const billId = req.params.id as string;
    const { buffer, billNo } = await installerService.getBillPdfBuffer(billId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${billNo}-Payment-Advice.pdf"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

export const resendBillEmailHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const billId = req.params.id as string;
    const success = await installerService.dispatchClearanceEmailWithPdf(billId);
    if (success) {
      sendSuccess(res, { success: true }, 'Clearance email dispatched successfully');
    } else {
      sendError(res, { code: 'EMAIL_DISPATCH_FAILED', message: 'Failed to dispatch email to installer. Please verify SMTP/Resend credentials.' }, 500);
    }
  } catch (error) {
    next(error);
  }
};

// ─── Super Admin Export Handler ──────────────────────────────────────────────

export const exportInstallerBillsExcelHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = ExportBillsQuerySchema.parse(req.query);
    const buffer = await installerService.getExportExcelBuffer(query);

    const timestamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="PRC-Installer-Payments-${timestamp}.xlsx"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};
