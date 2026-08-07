import { Request, Response, NextFunction } from 'express';
import * as suppliersService from './suppliers.service';
import { sendSuccess, sendPaginated, sendMessage } from '../../../utils/response';

export const listSuppliers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await suppliersService.listSuppliers(req.ventureId!, req.query);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getSupplierById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supplier = await suppliersService.getSupplierById(req.params.id);
    sendSuccess(res, supplier);
  } catch (error) {
    next(error);
  }
};

export const createSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supplier = await suppliersService.createSupplier(req.ventureId!, req.body);
    sendSuccess(res, supplier, 'Supplier created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supplier = await suppliersService.updateSupplier(req.params.id, req.body);
    sendSuccess(res, supplier, 'Supplier updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await suppliersService.deleteSupplier(req.params.id);
    sendMessage(res, 'Supplier deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const getSupplierLedger = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await suppliersService.getSupplierLedger(req.params.id, req.query);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getSupplierPurchaseHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await suppliersService.getSupplierPurchaseHistory(req.params.id, req.query);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getSupplierPaymentHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await suppliersService.getSupplierPaymentHistory(req.params.id, req.query);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getSupplierOutstanding = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await suppliersService.getSupplierOutstanding(req.params.id);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
