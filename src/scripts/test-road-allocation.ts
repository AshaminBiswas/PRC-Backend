/**
 * Road Distance Allocation Test (OSRM or Haversine Fallback)
 * Tests PIN 742213 (Kandi, Murshidabad) allocation via ROAD_DISTANCE strategy.
 */
import { allocateByShortestDistance } from '../modules/allocation/allocation.service';

async function main() {
  console.log('🛣️  Road Distance Allocation Test (OSRM Strategy)\n');

  const result = await allocateByShortestDistance({
    pincode: '742213',
    strategy: 'ROAD_DISTANCE',
  });

  console.log('Result:');
  console.log(JSON.stringify(result, null, 2));

  if (result.success) {
    const wh = result.selectedWarehouse;
    console.log(`\n✅ Allocated to   : ${wh.name} (${wh.code})`);
    console.log(`   Road Distance  : ${wh.distance} km`);
    if ('durationMinutes' in wh) {
      console.log(`   Drive Duration : ${wh.durationMinutes} minutes`);
    }
    console.log(`   Source         : ${wh.source}`);
    console.log(`   Strategy       : ${result.meta?.strategy}`);
  } else {
    console.error('❌ Allocation failed');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Test error:', e);
  process.exit(1);
});
