import { Request, Response, NextFunction } from 'express';
import * as venturesService from './ventures.service';
import { sendSuccess, sendPaginated, sendMessage } from '../../../utils/response';

export const listVentures = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await venturesService.listVentures(req.query, req.user!.id, req.user!.roleSlug);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getVentureById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const venture = await venturesService.getVentureById(req.params.id);
    sendSuccess(res, venture);
  } catch (error) {
    next(error);
  }
};

export const createVenture = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const venture = await venturesService.createVenture(req.body, req.user!.id);
    sendSuccess(res, venture, 'Venture created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateVenture = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const venture = await venturesService.updateVenture(req.params.id, req.body);
    sendSuccess(res, venture, 'Venture updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteVenture = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await venturesService.deleteVenture(req.params.id);
    sendMessage(res, 'Venture deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const addUserToVenture = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await venturesService.addUserToVenture(req.params.id, req.body);
    sendSuccess(res, record, 'User added to venture successfully');
  } catch (error) {
    next(error);
  }
};

export const removeUserFromVenture = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await venturesService.removeUserFromVenture(req.params.id, req.params.userId);
    sendMessage(res, 'User removed from venture successfully');
  } catch (error) {
    next(error);
  }
};
