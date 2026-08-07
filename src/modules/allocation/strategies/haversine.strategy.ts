import { calculateDistance } from '../../../utils/haversine.utils';
import { AppError } from '../../../middleware/error.middleware';
import type {
  AllocationStrategy,
  AllocationStrategyResult,
  CandidateWarehouse,
  CalculatedWarehouseDistance,
} from './allocation.strategy.interface';

export class HaversineAllocationStrategy implements AllocationStrategy {
  async allocate(
    customerCoords: { pincode: string; latitude: number; longitude: number },
    warehouses: CandidateWarehouse[]
  ): Promise<AllocationStrategyResult> {
    if (!warehouses || warehouses.length === 0) {
      throw new AppError('WAREHOUSE_UNAVAILABLE', 'No active warehouses available for allocation', 503);
    }

    const calculated: CalculatedWarehouseDistance[] = warehouses.map((wh) => {
      const dist = calculateDistance(
        customerCoords.latitude,
        customerCoords.longitude,
        wh.latitude,
        wh.longitude
      );
      const roundedDistance = Number(dist.toFixed(2));
      return {
        id: wh.id,
        name: wh.name,
        code: wh.code,
        distance: roundedDistance,
        priority: wh.priority,
      };
    });

    // Sort by ascending distance. If distance is equal, sort by highest priority DESC.
    calculated.sort((a, b) => {
      if (a.distance !== b.distance) {
        return a.distance - b.distance;
      }
      return b.priority - a.priority;
    });

    const selectedWarehouse = calculated[0];

    return {
      selectedWarehouse,
      allWarehouses: calculated,
    };
  }
}
