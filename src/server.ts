import cluster from 'cluster';
import os from 'os';
import http from 'http';
import app from './app';
import { env } from './config/env';
import { connectDatabases, disconnectDatabases } from './config/database';
import { stopKeepAlive } from './jobs/keepAlive';
import { startPoAutoSync, stopPoAutoSync } from './modules/po-management/po-sync.service';

const workerCount = env.scaling.workers > 0 ? env.scaling.workers : os.availableParallelism?.() ?? os.cpus().length;

const startWorker = async () => {
  let server: http.Server | undefined;

  try {
    const port = Number(process.env.PORT) || env.PORT || 3000;

    server = app.listen(port, '0.0.0.0', () => {
      console.log(`PRC Hardware API listening on http://0.0.0.0:${port}${env.API_PREFIX} (${env.INSTANCE_ID})`);
    });

    // Configure Node.js HTTP Keep-Alive timeouts for ALB / Reverse Proxy compatibility
    server.keepAliveTimeout = 65000; // 65 seconds (exceeds AWS ALB 60s idle timeout)
    server.headersTimeout = 66000;   // 66 seconds (must exceed keepAliveTimeout)

    await connectDatabases();
    console.log(`Database connected and schema auto-healed on ${env.INSTANCE_ID}`);

    // Start background PO email auto-sync service
    startPoAutoSync(60000);
  } catch (error) {
    console.error('Failed to start server:', error);
    await disconnectDatabases();
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    console.log(`${signal} received by ${env.INSTANCE_ID}. Shutting down gracefully...`);
    stopKeepAlive();
    stopPoAutoSync();

    const forceExit = setTimeout(() => {
      console.error(`Graceful shutdown timed out for ${env.INSTANCE_ID}`);
      process.exit(1);
    }, env.scaling.shutdownGraceMs);

    server?.close(async () => {
      clearTimeout(forceExit);
      await disconnectDatabases();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

if (env.scaling.clusterMode && cluster.isPrimary) {
  console.log(`Primary ${process.pid} starting ${workerCount} workers`);

  for (let i = 0; i < workerCount; i += 1) {
    cluster.fork({ INSTANCE_ID: `${env.INSTANCE_ID}-${i + 1}` });
  }

  cluster.on('exit', (worker, code, signal) => {
    console.error(`Worker ${worker.process.pid} exited (${code ?? signal}). Starting replacement.`);
    cluster.fork({ INSTANCE_ID: `${env.INSTANCE_ID}-replacement-${Date.now()}` });
  });
} else {
  startWorker();
}
