import cluster from 'cluster';
import os from 'os';
import http from 'http';
import app from './app';
import { env } from './config/env';
import { connectDatabases, disconnectDatabases } from './config/database';

const workerCount = env.scaling.workers > 0 ? env.scaling.workers : os.availableParallelism?.() ?? os.cpus().length;

const startWorker = async () => {
  let server: http.Server | undefined;

  try {
    await connectDatabases();
    console.log(`Database connected on ${env.INSTANCE_ID}`);

    server = app.listen(env.PORT, '0.0.0.0', () => {
      console.log(`PRC Hardware API listening on http://0.0.0.0:${env.PORT}${env.API_PREFIX} (${env.INSTANCE_ID})`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    await disconnectDatabases();
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    console.log(`${signal} received by ${env.INSTANCE_ID}. Shutting down gracefully...`);

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
