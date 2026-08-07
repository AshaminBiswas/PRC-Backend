/**
 * Official GST e-Way Bill PIN-to-PIN Distance Allocation Test
 * Tests PIN 742213 (Kandi, Murshidabad) allocation via EWAY_BILL strategy.
 */
import { allocateByShortestDistance } from '../modules/allocation/allocation.service';

async function main() {
  console.log('📜 GST e-Way Bill PIN-to-PIN Distance Allocation Test\n');

  const result = await allocateByShortestDistance({
    pincode: '742213',
    strategy: 'EWAY_BILL',
  });

  console.log('Result:');
  console.log(JSON.stringify(result, null, 2));

  if (result.success) {
    const wh = result.selectedWarehouse;
    console.log(`\n✅ Allocated to       : ${wh.name} (${wh.code})`);
    console.log(`   e-Way Bill Distance : ${wh.distance} km (Official NIC e-Way Bill standard)`);
    if ('durationMinutes' in wh) {
      console.log(`   Drive Duration     : ${wh.durationMinutes} minutes`);
    }
    console.log(`   Source             : ${wh.source}`);
    console.log(`   Strategy           : ${result.meta?.strategy}`);
  } else {
    console.error('❌ Allocation failed');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Test error:', e);
  process.exit(1);
});
