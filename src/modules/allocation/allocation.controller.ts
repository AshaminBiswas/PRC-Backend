import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import * as allocationService from './allocation.service';
import * as pincodeService from './pincode.service';
import { pingOsrm, getRouteCacheStats, invalidateRouteCache } from '../../utils/osrm.client';
import { env } from '../../config/env';
import {
  allocateOrderSchema,
  allocateByPincodeSchema,
  pincodeLookupSchema,
  createPincodeSchema,
  bulkImportPincodeSchema,
  nearestWarehousesQuerySchema,
  createAdminWarehouseSchema,
  updateAdminWarehouseSchema,
  allocationLogQuerySchema,
} from './allocation.schema';

export const allocateOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = allocateOrderSchema.parse(req.body);
    const result = await allocationService.allocateWarehouseForOrder(input);
    return sendSuccess(res, result, 'Warehouse allocated successfully');
  } catch (error) {
    return next(error);
  }
};

export const allocateByShortestDistance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = allocateByPincodeSchema.parse(req.body);
    const result = await allocationService.allocateByShortestDistance(input);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

export const getPincodeDetails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pincode } = pincodeLookupSchema.parse({ pincode: req.params.pincode });
    const record = await pincodeService.getPincodeByCode(pincode);
    return sendSuccess(res, record, 'PIN code details retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

export const listPincodes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pincodeService.listPincodes(req.query as any);
    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
};

export const createPincode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createPincodeSchema.parse(req.body);
    const record = await pincodeService.createPincode(input);
    return sendSuccess(res, record, 'PIN code created successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const bulkImportPincodes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = bulkImportPincodeSchema.parse(req.body);
    const result = await pincodeService.bulkImportPincodes(input.records);
    return sendSuccess(res, result, 'Bulk PIN code import completed');
  } catch (error) {
    return next(error);
  }
};

export const getNearestWarehouses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = nearestWarehousesQuerySchema.parse(req.query);
    const result = await allocationService.findNearestWarehouses(query);
    return sendSuccess(res, result, 'Nearest warehouses retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

// ─── ADMIN CONTROLLERS ────────────────────────────────────────────────────────

export const createAdminWarehouse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createAdminWarehouseSchema.parse(req.body);
    const warehouse = await allocationService.createAdminWarehouse(input);
    return sendSuccess(res, warehouse, 'Warehouse created successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateAdminWarehouse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateAdminWarehouseSchema.parse(req.body);
    const warehouse = await allocationService.updateAdminWarehouse(req.params.id, input);
    return sendSuccess(res, warehouse, 'Warehouse updated successfully');
  } catch (error) {
    return next(error);
  }
};

export const deleteAdminWarehouse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouse = await allocationService.deleteAdminWarehouse(req.params.id);
    return sendSuccess(res, warehouse, 'Warehouse deleted successfully');
  } catch (error) {
    return next(error);
  }
};

export const listAllocationLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = allocationLogQuerySchema.parse(req.query);
    const result = await allocationService.listAllocationLogs(query);
    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
};

export const exportAllocationLogsCsv = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const csvData = await allocationService.exportAllocationLogsCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="allocation_logs.csv"');
    return res.status(200).send(csvData);
  } catch (error) {
    return next(error);
  }
};

// ─── OSRM HEALTH & CACHE MANAGEMENT CONTROLLERS ──────────────────────────────

export const osrmHealth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const health = await pingOsrm();
    const cacheStats = getRouteCacheStats();

    return res.status(health.healthy ? 200 : 503).json({
      success: health.healthy,
      osrmStatus: health.healthy ? 'healthy' : 'unreachable',
      baseUrl: env.osrm.baseUrl,
      responseTimeMs: health.responseTimeMs,
      fallbackEnabled: env.osrm.fallbackToHaversine,
      defaultStrategy: env.osrm.defaultStrategy,
      cache: cacheStats,
      timestamp: new Date().toISOString(),
      ...(health.error && { error: health.error }),
    });
  } catch (error) {
    return next(error);
  }
};

export const clearOsrmCache = async (req: Request, res: Response, next: NextFunction) => {
  try {
    invalidateRouteCache();
    return sendSuccess(res, { cleared: true, timestamp: new Date().toISOString() }, 'OSRM route cache cleared successfully');
  } catch (error) {
    return next(error);
  }
};

