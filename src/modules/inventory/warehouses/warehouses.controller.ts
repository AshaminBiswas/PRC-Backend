import { Request, Response, NextFunction } from 'express';
import * as warehousesService from './warehouses.service';
import { sendSuccess, sendPaginated, sendMessage } from '../../../utils/response';

export const listWarehouses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await warehousesService.listWarehouses(req.ventureId!, req.query);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getWarehouseById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouse = await warehousesService.getWarehouseById(req.params.id);
    sendSuccess(res, warehouse);
  } catch (error) {
    next(error);
  }
};

export const createWarehouse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouse = await warehousesService.createWarehouse(req.ventureId!, req.body);
    sendSuccess(res, warehouse, 'Warehouse created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateWarehouse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouse = await warehousesService.updateWarehouse(req.params.id, req.body);
    sendSuccess(res, warehouse, 'Warehouse updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteWarehouse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await warehousesService.deleteWarehouse(req.params.id);
    sendMessage(res, 'Warehouse deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const getWarehouseProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await warehousesService.getWarehouseProducts(req.params.id, req.query);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};
