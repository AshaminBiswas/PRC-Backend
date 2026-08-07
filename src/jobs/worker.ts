import { env } from '../config/env';
import { connectDatabases, disconnectDatabases } from '../config/database';
import { claimJobs, completeJob, failJob } from './asyncJob.service';
import { handleJob } from './jobHandlers';

const workerId = `${env.INSTANCE_ID}-worker-${process.pid}`;
let shuttingDown = false;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const runBatch = async () => {
  const jobs = await claimJobs(workerId);

  for (const job of jobs) {
    try {
      await handleJob(job);
      await completeJob(job.id);
      if (env.isDev) console.log(`[Worker:${workerId}] completed ${job.type} ${job.id}`);
    } catch (error) {
      await failJob(job, error);
      console.error(`[Worker:${workerId}] failed ${job.type} ${job.id}`, error);
    }
  }

  return jobs.length;
};

const start = async () => {
  await connectDatabases();
  console.log(`[Worker:${workerId}] started`);

  while (!shuttingDown) {
    const count = await runBatch();
    if (count === 0) {
      await sleep(env.asyncJobs.pollIntervalMs);
    }
  }

  await disconnectDatabases();
  console.log(`[Worker:${workerId}] stopped`);
};

const shutdown = () => {
  shuttingDown = true;
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start().catch(async (error) => {
  console.error(`[Worker:${workerId}] fatal`, error);
  await disconnectDatabases();
  process.exit(1);
});
