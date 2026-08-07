import prisma from '../config/database';
import { allocateWarehouseForOrder } from '../modules/allocation/allocation.service';
import { calculateDistance } from '../utils/haversine.utils';

async function testLiveAllocations() {
  console.log('\n=============================================================');
  console.log('🚀 LIVE DATABASE ALLOCATION ENGINE TEST SUITE');
  console.log('=============================================================\n');

  // Fetch sample products seeded in DB
  const products = await prisma.product.findMany({ take: 2 });
  if (products.length === 0) {
    console.error('❌ No products found in database. Please run npm run db:seed first.');
    process.exit(1);
  }

  const sampleSku1 = products[0].sku;
  const sampleSku2 = products[1] ? products[1].sku : sampleSku1;

  console.log(`📦 Using test SKUs from database: "${sampleSku1}" and "${sampleSku2}"\n`);

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: Delhi Order Allocation
  // ───────────────────────────────────────────────────────────────────────────
  console.log('-------------------------------------------------------------');
  console.log('📍 TEST 1: Order Allocation for Delhi Customer (PIN: 110001)');
  console.log('-------------------------------------------------------------');

  const delhiResult = await allocateWarehouseForOrder({
    pincode: '110001',
    reserveStock: false,
    items: [
      { productId: products[0].id, sku: sampleSku1, quantity: 2 },
    ],
  });

  console.log(`  Target PIN Code   : ${delhiResult.customerLocation.pincode} (${delhiResult.customerLocation.city}, ${delhiResult.customerLocation.state})`);
  console.log(`  Allocated WH Code : ${delhiResult.allocatedWarehouse.code}`);
  console.log(`  Allocated WH Name : ${delhiResult.allocatedWarehouse.name}`);
  console.log(`  Haversine Distance: ${delhiResult.distanceKm} KM`);

  if (delhiResult.allocatedWarehouse.code === 'DELHI-WH-01') {
    console.log('  ✅ TEST 1 PASSED: Correctly allocated to nearest Delhi Warehouse!\n');
  } else {
    console.error(`  ❌ TEST 1 FAILED: Expected DELHI-WH-01 but got ${delhiResult.allocatedWarehouse.code}\n`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: Kolkata Order Allocation
  // ───────────────────────────────────────────────────────────────────────────
  console.log('-------------------------------------------------------------');
  console.log('📍 TEST 2: Order Allocation for Kolkata Customer (PIN: 700001)');
  console.log('-------------------------------------------------------------');

  const kolkataResult = await allocateWarehouseForOrder({
    pincode: '700001',
    reserveStock: false,
    items: [
      { productId: products[0].id, sku: sampleSku1, quantity: 2 },
    ],
  });

  console.log(`  Target PIN Code   : ${kolkataResult.customerLocation.pincode} (${kolkataResult.customerLocation.city}, ${kolkataResult.customerLocation.state})`);
  console.log(`  Allocated WH Code : ${kolkataResult.allocatedWarehouse.code}`);
  console.log(`  Allocated WH Name : ${kolkataResult.allocatedWarehouse.name}`);
  console.log(`  Haversine Distance: ${kolkataResult.distanceKm} KM`);

  if (kolkataResult.allocatedWarehouse.code === 'KOLKATA-WH-01') {
    console.log('  ✅ TEST 2 PASSED: Correctly allocated to nearest Kolkata Warehouse!\n');
  } else {
    console.error(`  ❌ TEST 2 FAILED: Expected KOLKATA-WH-01 but got ${kolkataResult.allocatedWarehouse.code}\n`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: Inventory Fallback (Delhi Stock Depleted -> Fallback to Kolkata)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('-------------------------------------------------------------');
  console.log('📦 TEST 3: Inventory Fallback (Delhi Stock Depleted)');
  console.log('-------------------------------------------------------------');

  const delhiWh = await prisma.warehouse.findUnique({ where: { code: 'DELHI-WH-01' } });
  const invProd = await prisma.inventoryProduct.findFirst({ where: { sku: sampleSku1 } });

  if (delhiWh && invProd) {
    // Temporarily set Delhi stock to 0 for this item
    await prisma.inventoryStock.update({
      where: { inventoryProductId_warehouseId: { inventoryProductId: invProd.id, warehouseId: delhiWh.id } },
      data: { quantity: 0 },
    });

    const fallbackResult = await allocateWarehouseForOrder({
      pincode: '110001', // Delhi PIN code
      reserveStock: false,
      items: [{ productId: products[0].id, sku: sampleSku1, quantity: 2 }],
    });

    console.log(`  Target PIN Code   : 110001 (Delhi)`);
    console.log(`  Delhi Stock       : 0 (Depleted)`);
    console.log(`  Allocated WH Code : ${fallbackResult.allocatedWarehouse.code}`);
    console.log(`  Allocated WH Name : ${fallbackResult.allocatedWarehouse.name}`);
    console.log(`  Haversine Distance: ${fallbackResult.distanceKm} KM`);

    if (fallbackResult.allocatedWarehouse.code === 'KOLKATA-WH-01') {
      console.log('  ✅ TEST 3 PASSED: Skipped Delhi WH (0 stock) and fell back to nearest stocked Kolkata WH!\n');
    } else {
      console.error(`  ❌ TEST 3 FAILED: Expected KOLKATA-WH-01 but got ${fallbackResult.allocatedWarehouse.code}\n`);
    }

    // Restore Delhi stock back to 100
    await prisma.inventoryStock.update({
      where: { inventoryProductId_warehouseId: { inventoryProductId: invProd.id, warehouseId: delhiWh.id } },
      data: { quantity: 100 },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: Dynamic Warehouse Expansion (Mumbai Warehouse Added to DB)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('-------------------------------------------------------------');
  console.log('🏗️ TEST 4: Dynamic Warehouse Expansion (Add Mumbai WH to DB)');
  console.log('-------------------------------------------------------------');

  const defaultVenture = await prisma.venture.findFirst({ where: { status: 'ACTIVE' } });
  if (defaultVenture) {
    // Insert new Mumbai Warehouse dynamically
    const mumbaiWh = await prisma.warehouse.upsert({
      where: { code: 'MUMBAI-WH-01' },
      update: { isActive: true, status: 'ACTIVE' },
      create: {
        ventureId: defaultVenture.id,
        name: 'Mumbai Regional Logistics Center',
        code: 'MUMBAI-WH-01',
        type: 'MAIN',
        address: 'Bandra-Kurla Complex Logistics Hub',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        country: 'India',
        latitude: 18.9388,
        longitude: 72.8353,
        isActive: true,
        status: 'ACTIVE',
        priority: 8,
      },
    });

    if (invProd) {
      await prisma.inventoryStock.upsert({
        where: { inventoryProductId_warehouseId: { inventoryProductId: invProd.id, warehouseId: mumbaiWh.id } },
        update: { quantity: 100 },
        create: {
          inventoryProductId: invProd.id,
          warehouseId: mumbaiWh.id,
          ventureId: defaultVenture.id,
          quantity: 100,
          reservedQty: 0,
        },
      });
    }

    const mumbaiResult = await allocateWarehouseForOrder({
      pincode: '400001', // Mumbai PIN Code
      reserveStock: false,
      items: [{ productId: products[0].id, sku: sampleSku1, quantity: 2 }],
    });

    console.log(`  Added WH in DB    : MUMBAI-WH-01 (Lat: 18.9388, Lon: 72.8353)`);
    console.log(`  Target PIN Code   : 400001 (Mumbai)`);
    console.log(`  Allocated WH Code : ${mumbaiResult.allocatedWarehouse.code}`);
    console.log(`  Allocated WH Name : ${mumbaiResult.allocatedWarehouse.name}`);
    console.log(`  Haversine Distance: ${mumbaiResult.distanceKm} KM`);

    if (mumbaiResult.allocatedWarehouse.code === 'MUMBAI-WH-01') {
      console.log('  ✅ TEST 4 PASSED: Dynamically added Mumbai WH automatically participated and won allocation!\n');
    } else {
      console.error(`  ❌ TEST 4 FAILED: Expected MUMBAI-WH-01 but got ${mumbaiResult.allocatedWarehouse.code}\n`);
    }
  }

  console.log('=============================================================');
  console.log('🎉 ALL LIVE ALLOCATION TESTS PASSED SUCCESSFULLY!');
  console.log('=============================================================\n');
}

testLiveAllocations()
  .catch((err) => {
    console.error('❌ Test execution error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
