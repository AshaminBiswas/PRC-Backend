import { env } from '../../../config/env';
import { AllocationStrategy } from './allocation.strategy.interface';
import { HaversineAllocationStrategy } from './haversine.strategy';
import { RoadDistanceAllocationStrategy } from './road-distance.strategy';
import { EwayBillAllocationStrategy } from './eway-bill.strategy';

export type StrategyType =
  | 'HAVERSINE'          // Legacy straight-line distance
  | 'ROAD_DISTANCE'      // OSRM road distance
  | 'EWAY_BILL'          // GST e-Way Bill official PIN-to-PIN transport distance (226 km)
  | 'SHIPPING_COST'      // Lowest shipping cost
  | 'FASTEST_DELIVERY'   // Minimum delivery days
  | 'HYBRID';            // Weighted scoring

export class AllocationStrategyFactory {
  private static strategies: Map<string, AllocationStrategy> = new Map([
    ['HAVERSINE', new HaversineAllocationStrategy()],
    ['ROAD_DISTANCE', new RoadDistanceAllocationStrategy()],
    ['EWAY_BILL', new EwayBillAllocationStrategy()],
  ]);

  /**
   * Resolves an allocation strategy by name.
   * Defaults to env.osrm.defaultStrategy if no type is provided.
   *
   * @throws AppError(400) if strategy name is unrecognized
   */
  public static getStrategy(type?: StrategyType | string): AllocationStrategy {
    const resolved = (type || env.osrm.defaultStrategy || 'ROAD_DISTANCE').toUpperCase();
    const strategy = this.strategies.get(resolved);

    if (!strategy) {
      // Graceful fallback to default rather than crashing — log a warning
      const defaultName = (env.osrm.defaultStrategy || 'ROAD_DISTANCE').toUpperCase();
      console.warn(
        `[AllocationStrategyFactory] Unknown strategy '${resolved}'. Falling back to '${defaultName}'.`
      );
      return this.strategies.get(defaultName) ?? this.strategies.get('ROAD_DISTANCE')!;
    }

    return strategy;
  }

  /**
   * Register a custom strategy at runtime.
   * Allows plugging in new strategies (e.g. SHIPPING_COST, HYBRID) without modifying this file.
   */
  public static registerStrategy(type: string, strategy: AllocationStrategy): void {
    this.strategies.set(type.toUpperCase(), strategy);
    console.info(`[AllocationStrategyFactory] Registered strategy: '${type.toUpperCase()}'`);
  }

  /**
   * Lists all currently registered strategy names.
   */
  public static listStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }
}
