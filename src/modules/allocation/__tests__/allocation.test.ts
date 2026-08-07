import { calculateDistance } from '../../../utils/haversine.utils';
import { HaversineAllocationStrategy } from '../strategies/haversine.strategy';
import { AllocationStrategyFactory } from '../strategies/strategy.factory';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export const testAllocationLogic = async () => {
  const customerDelhi = { lat: 28.6139, lon: 77.209 };

  const delhiWh = { code: 'DELHI-WH', lat: 28.6139, lon: 77.209 };
  const kolkataWh = { code: 'KOLKATA-WH', lat: 22.5726, lon: 88.3639 };
  const mumbaiWh = { code: 'MUMBAI-WH', lat: 18.9388, lon: 72.8353 };

  const distDelhi = calculateDistance(customerDelhi.lat, customerDelhi.lon, delhiWh.lat, delhiWh.lon);
  const distKolkata = calculateDistance(customerDelhi.lat, customerDelhi.lon, kolkataWh.lat, kolkataWh.lon);
  const distMumbai = calculateDistance(customerDelhi.lat, customerDelhi.lon, mumbaiWh.lat, mumbaiWh.lon);

  assert(distDelhi === 0, 'Delhi WH distance is 0 km');
  assert(distMumbai < distKolkata, 'Mumbai WH is closer than Kolkata WH');

  // 1. Haversine Strategy Direct Unit Test (Customer PIN 700091 Kolkata)
  const haversineStrategy = new HaversineAllocationStrategy();
  const customerKolkata = { pincode: '700091', latitude: 22.5855, longitude: 88.4304 };
  const candidates = [
    {
      id: 'wh-delhi-id',
      name: 'Delhi Warehouse',
      code: 'DELHI-WH-01',
      latitude: 28.6139,
      longitude: 77.209,
      priority: 10,
      isActive: true,
    },
    {
      id: 'wh-kolkata-id',
      name: 'Kolkata Warehouse',
      code: 'KOLKATA-WH-01',
      latitude: 22.5726,
      longitude: 88.3639,
      priority: 5,
      isActive: true,
    },
  ];

  const result = await haversineStrategy.allocate(customerKolkata, candidates);

  assert(result.selectedWarehouse.code === 'KOLKATA-WH-01', 'Kolkata WH selected for PIN 700091');
  assert(result.selectedWarehouse.distance > 0 && result.selectedWarehouse.distance < 20, `Kolkata distance is ~6.98 km (Actual: ${result.selectedWarehouse.distance})`);
  assert(result.allWarehouses[1].code === 'DELHI-WH-01', 'Delhi WH is second');
  assert(result.allWarehouses[1].distance > 1200, `Delhi distance is ~1305 km (Actual: ${result.allWarehouses[1].distance})`);

  // 2. Strategy Factory Resolution Test
  const factoryStrategy = AllocationStrategyFactory.getStrategy('HAVERSINE');
  assert(factoryStrategy instanceof HaversineAllocationStrategy, 'Factory resolves HaversineAllocationStrategy');

  // 3. Priority Tie-Breaker Test
  const equalDistanceCandidates = [
    {
      id: 'wh-1',
      name: 'WH Low Priority',
      code: 'WH-LOW',
      latitude: 28.6139,
      longitude: 77.209,
      priority: 5,
      isActive: true,
    },
    {
      id: 'wh-2',
      name: 'WH High Priority',
      code: 'WH-HIGH',
      latitude: 28.6139,
      longitude: 77.209,
      priority: 10,
      isActive: true,
    },
  ];
  const tieBreakResult = await haversineStrategy.allocate({ pincode: '110001', latitude: 28.6139, longitude: 77.209 }, equalDistanceCandidates);
  assert(tieBreakResult.selectedWarehouse.code === 'WH-HIGH', 'Higher priority warehouse selected when distances are equal');

  console.log('  ✓ Haversine Shortest Distance & Strategy Pattern tests passed.');
};

if (require.main === module) {
  testAllocationLogic();
  console.log('Allocation logic integration tests passed.');
}
