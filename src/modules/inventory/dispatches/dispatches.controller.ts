import { Request, Response, NextFunction } from 'express';
import * as dispatchesService from './dispatches.service';
import { sendSuccess, sendPaginated } from '../../../utils/response';
import { DispatchStatus } from '@prisma/client';

export const listDispatches = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await dispatchesService.listDispatches(req.ventureId!, req.query);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getDispatchById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dispatch = await dispatchesService.getDispatchById(req.params.id);
    sendSuccess(res, dispatch);
  } catch (error) {
    next(error);
  }
};

export const createDispatch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dispatch = await dispatchesService.createDispatch(req.ventureId!, req.body, req.user!.id);
    sendSuccess(res, dispatch, 'Dispatch order created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateDispatchStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dispatch = await dispatchesService.updateDispatchStatus(req.params.id, req.body);
    sendSuccess(res, dispatch, 'Dispatch status updated');
  } catch (error) {
    next(error);
  }
};

export const markPacked = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dispatch = await dispatchesService.updateDispatchStatus(req.params.id, { status: DispatchStatus.PACKED, ...req.body });
    sendSuccess(res, dispatch, 'Dispatch marked as PACKED');
  } catch (error) {
    next(error);
  }
};

export const markShipped = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dispatch = await dispatchesService.updateDispatchStatus(req.params.id, { status: DispatchStatus.SHIPPED, ...req.body });
    sendSuccess(res, dispatch, 'Dispatch marked as SHIPPED');
  } catch (error) {
    next(error);
  }
};

export const markDelivered = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dispatch = await dispatchesService.updateDispatchStatus(req.params.id, { status: DispatchStatus.DELIVERED, ...req.body });
    sendSuccess(res, dispatch, 'Dispatch marked as DELIVERED');
  } catch (error) {
    next(error);
  }
};

export const getDispatchTimeline = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const timeline = await dispatchesService.getDispatchTimeline(req.params.id);
    sendSuccess(res, timeline);
  } catch (error) {
    next(error);
  }
};
