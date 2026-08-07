import { Request, Response, NextFunction } from 'express';
import * as shippingService from './shipping.service';
import { sendSuccess, sendMessage } from '../../utils/response';

export const listZones = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await shippingService.listZones();
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const createZone = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await shippingService.createZone(req.body);
    sendSuccess(res, data, 'Shipping zone created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateZone = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await shippingService.updateZone(req.params.id, req.body);
    sendSuccess(res, data, 'Shipping zone updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteZone = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await shippingService.deleteZone(req.params.id);
    sendMessage(res, 'Shipping zone deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const getZoneRates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await shippingService.getZoneRates(req.params.id);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const createZoneRate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await shippingService.createZoneRate(req.params.id, req.body);
    sendSuccess(res, data, 'Shipping rate added successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateRate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await shippingService.updateRate(req.params.id, req.body);
    sendSuccess(res, data, 'Shipping rate updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteRate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await shippingService.deleteRate(req.params.id);
    sendMessage(res, 'Shipping rate deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const calculateShipping = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await shippingService.calculateShipping(req.body);
    sendSuccess(res, data, 'Shipping cost calculated');
  } catch (error) {
    next(error);
  }
};
