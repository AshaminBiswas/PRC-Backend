import { listPoSubmissions, getPoMetrics } from '../modules/po-management/po-management.service';

async function testList() {
  console.log('🧪 Testing listPoSubmissions and getPoMetrics query execution...');
  try {
    const listRes = await listPoSubmissions({ page: 1, limit: 15 });
    console.log('✅ listPoSubmissions success! Total items:', listRes.pagination.totalItems);

    const metricsRes = await getPoMetrics();
    console.log('✅ getPoMetrics success! Metrics:', metricsRes);

    console.log('🎉 Database query execution is 100% fixed!');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Failed:', err.message || err);
    process.exit(1);
  }
}

testList();
