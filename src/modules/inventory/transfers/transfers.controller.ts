import { Request, Response, NextFunction } from 'express';
import * as transfersService from './transfers.service';
import { sendSuccess, sendPaginated } from '../../../utils/response';
import { TransferStatus } from '@prisma/client';

export const listTransfers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await transfersService.listTransfers(req.ventureId!, req.query);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getTransferById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transfer = await transfersService.getTransferById(req.params.id);
    sendSuccess(res, transfer);
  } catch (error) {
    next(error);
  }
};

export const createTransfer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transfer = await transfersService.createTransfer(req.ventureId!, req.body, req.user!.id);
    sendSuccess(res, transfer, 'Transfer request created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateTransfer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transfer = await transfersService.updateTransferStatus(req.params.id, req.body.status, req.user!.id, req.body.notes);
    sendSuccess(res, transfer, 'Transfer status updated');
  } catch (error) {
    next(error);
  }
};

export const approveTransfer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transfer = await transfersService.updateTransferStatus(req.params.id, TransferStatus.IN_TRANSIT, req.user!.id);
    sendSuccess(res, transfer, 'Transfer approved & marked in transit');
  } catch (error) {
    next(error);
  }
};
