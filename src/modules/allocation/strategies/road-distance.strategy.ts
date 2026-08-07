/**
 * Road Distance Allocation Strategy (OSRM-Powered)
 *
 * Replaces Haversine straight-line distance with actual driving road distance
 * calculated via a self-hosted OSRM (Open Source Routing Machine) server
 * using OpenStreetMap India data.
 *
 * Selection criteria:
 *  1. Minimum road distance (km) — PRIMARY
 *  2. Minimum driving duration (minutes) — TIEBREAKER 1
 *  3. Maximum priority rating — TIEBREAKER 2
 *
 * Falls back to Haversine if OSRM is unavailable AND env.osrm.fallbackToHaversine = true.
 * Throws AppError(503) if OSRM is down and fallback is disabled.
 */

import { getParallelRoutes } from '../../../utils/osrm.client';
import { calculateDistance } from '../../../utils/haversine.utils';
import { AppError } from '../../../middleware/error.middleware';
import { env } from '../../../config/env';
import type {
  AllocationStrategy,
  AllocationStrategyResult,
  CandidateWarehouse,
  CalculatedWarehouseDistance,
} from './allocation.strategy.interface';

export class RoadDistanceAllocationStrategy implements AllocationStrategy {
  async allocate(
    customerCoords: { pincode: string; latitude: number; longitude: number },
    warehouses: CandidateWarehouse[]
  ): Promise<AllocationStrategyResult> {
    if (!warehouses || warehouses.length === 0) {
      throw new AppError('WAREHOUSE_UNAVAILABLE', 'No active warehouses available for allocation', 503);
    }

    // ── Step 1: Fire parallel OSRM requests for all warehouses ──────────────
    const destinations = warehouses.map((wh) => ({
      id: wh.id,
      latitude: wh.latitude,
      longitude: wh.longitude,
    }));

    const routeResults = await getParallelRoutes(
      customerCoords.latitude,
      customerCoords.longitude,
      destinations
    );

    // ── Step 2: Map OSRM results to CalculatedWarehouseDistance ─────────────
    const calculated: CalculatedWarehouseDistance[] = [];
    const failedWarehouses: string[] = [];

    for (const wh of warehouses) {
      const route = routeResults.find((r) => r.warehouseId === wh.id);

      if (!route || route.error || !isFinite(route.distanceKm)) {
        failedWarehouses.push(wh.code);

        // If OSRM failed for this warehouse, use fallback or skip
        if (env.osrm.fallbackToHaversine) {
          const straightLineKm = Number(
            calculateDistance(
              customerCoords.latitude,
              customerCoords.longitude,
              wh.latitude,
              wh.longitude
            ).toFixed(2)
          );

          console.warn(
            `[RoadDistanceStrategy] OSRM failed for ${wh.code} — falling back to Haversine (${straightLineKm} km)`
          );

          calculated.push({
            id: wh.id,
            name: wh.name,
            code: wh.code,
            distance: straightLineKm,
            durationMinutes: undefined,
            priority: wh.priority,
            source: 'HAVERSINE_FALLBACK',
          });
        }
        // If no fallback, skip this warehouse entirely
        continue;
      }

      calculated.push({
        id: wh.id,
        name: wh.name,
        code: wh.code,
        distance: route.distanceKm,
        durationMinutes: route.durationMinutes,
        priority: wh.priority,
        source: route.source,
      });
    }

    // ── Step 3: If ALL warehouses failed and no fallback, throw 503 ──────────
    if (calculated.length === 0) {
      throw new AppError(
        'ROUTING_ENGINE_UNAVAILABLE',
        `OSRM routing engine is unavailable and fallback is disabled. Failed warehouses: ${failedWarehouses.join(', ')}`,
        503
      );
    }

    if (failedWarehouses.length > 0 && !env.osrm.fallbackToHaversine) {
      console.warn(
        `[RoadDistanceStrategy] ${failedWarehouses.length} warehouse(s) excluded due to OSRM failure: ${failedWarehouses.join(', ')}`
      );
    }

    // ── Step 4: Sort — road distance ASC, duration ASC, priority DESC ────────
    calculated.sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;

      const durA = a.durationMinutes ?? Infinity;
      const durB = b.durationMinutes ?? Infinity;
      if (durA !== durB) return durA - durB;

      return b.priority - a.priority;
    });

    const selectedWarehouse = calculated[0];

    console.info(
      `[RoadDistanceStrategy] PIN ${customerCoords.pincode} → ${selectedWarehouse.name} ` +
      `(${selectedWarehouse.distance} km road, ${selectedWarehouse.durationMinutes ?? 'N/A'} min)`
    );

    return {
      selectedWarehouse,
      allWarehouses: calculated,
    };
  }
}
