import prisma from '../../config/database';
import { resolveShippingZone } from './zone.service';
import { calculateCourierRate } from './rate.service';
import { calculateDistance } from '../../utils/haversine.utils';

export interface WarehouseShippingOption {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  city: string | null;
  state: string | null;
  priority: number;
  dailyCapacity: number;
  currentLoad: number;
  distanceKm: number;
  zoneId: string;
  zoneName: string;
  courierId: string;
  courierName: string;
  courierCode: string;
  shippingCost: number;
  deliveryDays: number;
}

/**
 * Calculates shipping options and costs across all active warehouses for a customer PIN code.
 */
export const calculateShippingForWarehouses = async (
  pincode: string,
  weight: number,
  orderAmount: number = 0,
  isCod: boolean = false
): Promise<WarehouseShippingOption[]> => {
  const pincodeRecord = await prisma.pinCode.findUnique({
    where: { pincode },
  });

  const custLat = pincodeRecord?.latitude || 28.6139;
  const custLon = pincodeRecord?.longitude || 77.2090;

  const warehouses = await prisma.warehouse.findMany({
    where: {
      isActive: true,
      status: 'ACTIVE',
      deletedAt: null,
    },
  });

  const options: WarehouseShippingOption[] = [];

  for (const wh of warehouses) {
    try {
      // 1. Resolve Shipping Zone for Warehouse & Customer PIN
      const zoneResult = await resolveShippingZone(wh.id, pincode);

      // 2. Calculate Courier Rates for Zone
      const rates = await calculateCourierRate({
        zoneId: zoneResult.zone.id,
        weight,
        courierId: zoneResult.courier?.id,
        orderAmount,
        isCod,
      });

      const cheapestRate = rates[0];

      const whLat = wh.latitude || 0;
      const whLon = wh.longitude || 0;
      const distanceKm = whLat && whLon ? calculateDistance(custLat, custLon, whLat, whLon) : 0;

      options.push({
        warehouseId: wh.id,
        warehouseCode: wh.code,
        warehouseName: wh.name,
        city: wh.city,
        state: wh.state,
        priority: wh.priority,
        dailyCapacity: wh.dailyCapacity,
        currentLoad: wh.currentLoad,
        distanceKm,
        zoneId: zoneResult.zone.id,
        zoneName: zoneResult.zone.name,
        courierId: cheapestRate.courierId,
        courierName: cheapestRate.courierName,
        courierCode: cheapestRate.courierCode,
        shippingCost: cheapestRate.totalShippingCost,
        deliveryDays: cheapestRate.estimatedDeliveryDays,
      });
    } catch (err) {
      // Fallback if zone or rate calculation fails for a specific warehouse
      const distanceKm = wh.latitude && wh.longitude ? calculateDistance(custLat, custLon, wh.latitude, wh.longitude) : 100;
      options.push({
        warehouseId: wh.id,
        warehouseCode: wh.code,
        warehouseName: wh.name,
        city: wh.city,
        state: wh.state,
        priority: wh.priority,
        dailyCapacity: wh.dailyCapacity,
        currentLoad: wh.currentLoad,
        distanceKm,
        zoneId: 'default-zone',
        zoneName: 'Standard Pan-India Zone',
        courierId: 'default-courier',
        courierName: 'Standard Courier',
        courierCode: 'STD_COURIER',
        shippingCost: 100 + Math.round(distanceKm * 0.05), // Fallback estimated shipping cost
        deliveryDays: Math.min(7, Math.max(1, Math.ceil(distanceKm / 400))),
      });
    }
  }

  // Sort lowest shipping cost first
  options.sort((a, b) => a.shippingCost - b.shippingCost);

  return options;
};
