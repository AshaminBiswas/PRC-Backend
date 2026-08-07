import { Request, Response, NextFunction } from 'express';
import * as posService from './pos.service';
import { sendSuccess, sendPaginated } from '../../../utils/response';

// Stores
export const listPosStores = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await posService.listPosStores(req.ventureId!, req.query);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const createPosStore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const store = await posService.createPosStore(req.ventureId!, req.body);
    sendSuccess(res, store, 'POS Store created successfully', 201);
  } catch (error) {
    next(error);
  }
};

// Terminals
export const listPosTerminals = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const terminals = await posService.listPosTerminals(req.ventureId!, req.query.storeId as string);
    sendSuccess(res, terminals);
  } catch (error) {
    next(error);
  }
};

export const createPosTerminal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const terminal = await posService.createPosTerminal(req.ventureId!, req.body);
    sendSuccess(res, terminal, 'POS Terminal created successfully', 201);
  } catch (error) {
    next(error);
  }
};

// Sessions
export const openPosSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await posService.openPosSession(req.ventureId!, req.body, req.user!.id);
    sendSuccess(res, session, 'POS Shift/Session opened successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const closePosSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await posService.closePosSession(req.params.id, req.body);
    sendSuccess(res, session, 'POS Shift/Session closed successfully');
  } catch (error) {
    next(error);
  }
};

// Sales
export const createPosSale = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sale = await posService.createPosSale(req.ventureId!, req.body, req.user!.id);
    sendSuccess(res, sale, 'POS Sale completed successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const listPosSales = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await posService.listPosSales(req.ventureId!, req.query);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getPosSaleReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const receipt = await posService.getPosSaleReceipt(req.params.id);
    sendSuccess(res, receipt);
  } catch (error) {
    next(error);
  }
};

// Returns
export const createPosReturn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const posReturn = await posService.createPosReturn(req.ventureId!, req.body, req.user!.id);
    sendSuccess(res, posReturn, 'POS Return processed successfully', 201);
  } catch (error) {
    next(error);
  }
};
