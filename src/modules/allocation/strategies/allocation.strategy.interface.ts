export interface CandidateWarehouse {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  priority: number;
  isActive: boolean;
  city?: string | null;
  state?: string | null;
}

export interface CalculatedWarehouseDistance {
  id: string;
  name: string;
  code: string;
  /** Road distance in km (OSRM) or straight-line km (Haversine fallback) */
  distance: number;
  /** Driving duration in minutes — only set when OSRM is used */
  durationMinutes?: number;
  priority: number;
  /** Source of distance calculation */
  source?: 'OSRM' | 'EWAY_BILL' | 'CACHE' | 'HAVERSINE_FALLBACK';
}

export interface AllocationStrategyResult {
  selectedWarehouse: CalculatedWarehouseDistance;
  allWarehouses: CalculatedWarehouseDistance[];
}

export interface AllocationStrategy {
  allocate(
    customerCoords: { pincode: string; latitude: number; longitude: number },
    warehouses: CandidateWarehouse[]
  ): Promise<AllocationStrategyResult>;
}
