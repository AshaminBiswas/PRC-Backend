import { testHaversineUtils } from '../utils/__tests__/haversine.test';
import { testAllocationLogic } from '../modules/allocation/__tests__/allocation.test';
import { testInvoiceSystem } from '../modules/invoices/__tests__/invoices.test';

async function runTests() {
  console.log('\n🧪 Running Enterprise Backend Complete Test Suite...\n');

  console.log('1. Haversine Distance & Coordinates Tests:');
  testHaversineUtils();
  console.log('  ✓ All Haversine & Geohash tests passed.');

  console.log('\n2. Warehouse Allocation Engine Logic Tests:');
  testAllocationLogic();
  console.log('  ✓ All Allocation Engine logic & inventory tests passed.');

  console.log('\n3. Enterprise Invoice Management System Tests:');
  testInvoiceSystem();
  console.log('  ✓ All Invoice Management System tests passed.');

  console.log('\n✅ All tests passed successfully!\n');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
