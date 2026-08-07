/**
 * OSRM Routing Engine Health Check Script
 * Tests connectivity to the self-hosted OSRM server.
 */
import { pingOsrm, getRouteCacheStats } from '../utils/osrm.client';
import { env } from '../config/env';

async function main() {
  console.log('🛣️  OSRM Routing Engine Health Check\n');
  console.log(`   Base URL        : ${env.osrm.baseUrl}`);
  console.log(`   Default Strategy: ${env.osrm.defaultStrategy}`);
  console.log(`   Haversine Fallback: ${env.osrm.fallbackToHaversine}\n`);

  const health = await pingOsrm();
  const cache = getRouteCacheStats();

  if (health.healthy) {
    console.log(`✅ OSRM Status     : HEALTHY`);
    console.log(`   Response Time  : ${health.responseTimeMs}ms`);
  } else {
    console.log(`❌ OSRM Status     : UNREACHABLE`);
    console.log(`   Error          : ${health.error}`);
    console.log(`   Response Time  : ${health.responseTimeMs}ms`);
    if (env.osrm.fallbackToHaversine) {
      console.log(`\n⚠️  Haversine fallback is ENABLED — allocation will still work using straight-line distance.`);
    } else {
      console.log(`\n🚫 Haversine fallback is DISABLED — allocation will fail if OSRM is unavailable.`);
    }
  }

  console.log(`\n📦 Route Cache: ${cache.size}/${cache.maxEntries} entries`);
}

main().catch((e) => {
  console.error('Health check error:', e);
  process.exit(1);
});
