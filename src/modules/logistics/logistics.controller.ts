import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import * as shippingCostService from './shipping-cost.service';
import * as zoneService from './zone.service';
import * as rateService from './rate.service';
import { allocateWarehouseForOrder } from '../allocation/allocation.service';

export const calculateShipping = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pincode, weight, orderAmount, isCod, items } = req.body;

    // If items array is provided, run full allocation evaluation across active warehouses
    if (items && Array.isArray(items) && items.length > 0) {
      const allocation = await allocateWarehouseForOrder({
        pincode,
        items,
        reserveStock: false,
      });

      sendSuccess(res, {
        pincode,
        weight: weight || 1.0,
        selectedWarehouse: allocation.allocatedWarehouse,
        selectedCourier: allocation.allocatedCourier,
        selectedZone: allocation.allocatedZone,
        shippingCost: allocation.shippingCost,
        deliveryDays: allocation.deliveryDays,
        allocationScore: allocation.allocationScore,
        allocationReason: allocation.allocationReason,
        options: allocation.evaluatedWarehouses,
      }, 'Logistics shipping calculation completed');
      return;
    }

    // Default weight-based shipping calculation across warehouses
    const options = await shippingCostService.calculateShippingForWarehouses(
      pincode,
      weight || 1.0,
      orderAmount || 0,
      isCod || false
    );

    const bestOption = options[0];

    sendSuccess(res, {
      pincode,
      weight: weight || 1.0,
      bestOption,
      warehouseOptions: options,
    }, 'Logistics shipping options calculated');
  } catch (error) {
    next(error);
  }
};

export const listZones = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const zones = await zoneService.listShippingZones();
    sendSuccess(res, zones, 'Shipping zones fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const listRates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rates = await rateService.listCourierRates();
    sendSuccess(res, rates, 'Courier rates fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const createShippingRate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rate = await rateService.createCourierRate(req.body);
    sendSuccess(res, rate, 'Courier rate created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const createWarehouseZoneMapping = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mapping = await zoneService.createWarehouseZoneMapping(req.body);
    sendSuccess(res, mapping, 'Warehouse zone mapping created successfully', 201);
  } catch (error) {
    next(error);
  }
};
