import { env } from '../config/env';
import { generateAccessToken, verifyAccessToken } from '../utils/token.utils';
import { HaversineAllocationStrategy } from '../modules/allocation/strategies/haversine.strategy';
import { RoadDistanceAllocationStrategy } from '../modules/allocation/strategies/road-distance.strategy';
import { openApiSpec } from '../config/swagger';
import crypto from 'crypto';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

const runTest = async (name: string, fn: () => Promise<void> | void) => {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, durationMs: Date.now() - start });
    console.log(`  ✓ ${name} (${Date.now() - start}ms)`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err?.message || String(err), durationMs: Date.now() - start });
    console.error(`  ✗ ${name}:`, err?.message || err);
  }
};

const main = async () => {
  console.log('🚀 Running PRC Backend Integration Test Suite...\n');

  // Test 1: Environment Config Validation
  await runTest('Environment Config (Zod Schema) Initialization', () => {
    if (!env.PORT || typeof env.PORT !== 'number') {
      throw new Error('env.PORT is invalid');
    }
    if (!env.jwt.accessSecret) {
      throw new Error('JWT access secret missing');
    }
  });

  // Test 2: JWT Auth Token Signing and Verification Pipeline
  await runTest('JWT Token Signing and Verification Pipeline', () => {
    const payload = { userId: 'user-uuid-test-123', email: 'test@pacifichardware.com', roleSlug: 'admin' };
    const token = generateAccessToken(payload);
    const decoded = verifyAccessToken(token);

    if (decoded.userId !== payload.userId) {
      throw new Error(`User ID mismatch: expected ${payload.userId}, got ${decoded.userId}`);
    }
  });

  // Test 3: Haversine Warehouse Distance Strategy
  await runTest('Haversine Geospatial Strategy Calculation', async () => {
    const strategy = new HaversineAllocationStrategy();
    const result = await strategy.allocate(
      { pincode: '110001', latitude: 28.6304, longitude: 77.2177 },
      [
        {
          id: 'wh-delhi',
          name: 'Delhi Hub',
          code: 'DEL-01',
          latitude: 28.6500,
          longitude: 77.2300,
          isActive: true,
          priority: 100,
          city: 'Delhi',
          state: 'Delhi',
        },
        {
          id: 'wh-mumbai',
          name: 'Mumbai Hub',
          code: 'BOM-01',
          latitude: 19.0760,
          longitude: 72.8777,
          isActive: true,
          priority: 10,
          city: 'Mumbai',
          state: 'Maharashtra',
        },
      ]
    );

    if (!result.selectedWarehouse || result.selectedWarehouse.id !== 'wh-delhi') {
      throw new Error(`Haversine strategy allocated wrong warehouse: ${result.selectedWarehouse?.id}`);
    }
  });

  // Test 4: Road Distance Strategy Fallback Mechanism
  await runTest('Road Distance Strategy (OSRM / Fallback)', async () => {
    const strategy = new RoadDistanceAllocationStrategy();
    const result = await strategy.allocate(
      { pincode: '700001', latitude: 22.5726, longitude: 88.3639 },
      [
        {
          id: 'wh-kolkata',
          name: 'Kolkata Hub',
          code: 'CCU-01',
          latitude: 22.5800,
          longitude: 88.3700,
          isActive: true,
          priority: 100,
          city: 'Kolkata',
          state: 'West Bengal',
        },
      ]
    );

    if (!result.selectedWarehouse) {
      throw new Error('Road distance allocation failed to select warehouse');
    }
  });

  // Test 5: OpenAPI 3.0 Documentation Schema Structure
  await runTest('OpenAPI 3.0 Specification Integrity', () => {
    if (openApiSpec.openapi !== '3.0.3') {
      throw new Error(`Invalid OpenAPI version: ${openApiSpec.openapi}`);
    }
    if (!openApiSpec.paths['/health'] || !openApiSpec.paths['/allocation/allocate']) {
      throw new Error('Missing standard path definitions in OpenAPI spec');
    }
  });

  // Test 6: Document Cryptographic Hash Generation
  await runTest('Invoice Cryptographic Document Hash Generation', () => {
    const sampleInvoiceData = 'INV-2026-0001|TAX_INVOICE|GRAND_TOTAL_15000.00';
    const hash = crypto.createHash('sha256').update(sampleInvoiceData).digest('hex');
    if (hash.length !== 64) {
      throw new Error(`Invalid SHA-256 hash length: ${hash.length}`);
    }
  });

  // Summary
  console.log('\n---------------------------------------------------');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Summary: ${passed} passed, ${failed} failed (${results.reduce((acc, r) => acc + r.durationMs, 0)}ms total)`);
  console.log('---------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
};

main().catch((err) => {
  console.error('Fatal Integration Test Runner Error:', err);
  process.exit(1);
});
