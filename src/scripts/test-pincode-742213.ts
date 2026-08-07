import { allocateByShortestDistance } from '../modules/allocation/allocation.service';

async function main() {
  console.log('🧪 Testing Haversine Shortest Distance Allocation for PIN 742213...\n');

  const result = await allocateByShortestDistance({
    pincode: '742213',
    strategy: 'HAVERSINE',
  });

  console.log('Result:');
  console.log(JSON.stringify(result, null, 2));

  if (result.success && result.selectedWarehouse.name.includes('Kolkata')) {
    console.log('\n✅ TEST PASSED: PIN 742213 successfully resolved and allocated to Kolkata Warehouse!');
  } else {
    console.error('\n❌ TEST FAILED: Allocation did not return Kolkata Warehouse.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
