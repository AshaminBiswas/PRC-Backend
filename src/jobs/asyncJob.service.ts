import { AsyncJob, Prisma } from '@prisma/client';
import prisma from '../config/database';
import { env } from '../config/env';

export type JobPayload = Prisma.InputJsonValue;

export const enqueueJob = async (
  type: string,
  payload: JobPayload,
  options: { queue?: string; runAt?: Date; maxAttempts?: number } = {}
): Promise<AsyncJob | null> => {
  if (!env.asyncJobs.enabled) return null;

  return prisma.asyncJob.create({
    data: {
      type,
      payload,
      queue: options.queue || 'default',
      runAt: options.runAt || new Date(),
      maxAttempts: options.maxAttempts || env.asyncJobs.maxAttempts,
    },
  });
};

export const claimJobs = async (
  workerId: string,
  queue = 'default',
  limit = env.asyncJobs.batchSize
): Promise<AsyncJob[]> => {
  const staleBefore = new Date(Date.now() - env.asyncJobs.lockSeconds * 1000);

  return prisma.$transaction(async (tx) => {
    const jobs = await tx.$queryRaw<AsyncJob[]>`
      SELECT *
      FROM "async_jobs"
      WHERE "queue" = ${queue}
        AND "runAt" <= NOW()
        AND (
          "status" = 'PENDING'
          OR ("status" = 'PROCESSING' AND "lockedAt" < ${staleBefore})
        )
        AND "attempts" < "maxAttempts"
      ORDER BY "runAt" ASC, "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;

    if (jobs.length === 0) return [];

    const ids = jobs.map((job) => job.id);
    await tx.asyncJob.updateMany({
      where: { id: { in: ids } },
      data: {
        status: 'PROCESSING',
        lockedAt: new Date(),
        lockedBy: workerId,
        attempts: { increment: 1 },
      },
    });

    return tx.asyncJob.findMany({ where: { id: { in: ids } } });
  });
};

export const completeJob = async (jobId: string): Promise<void> => {
  await prisma.asyncJob.update({
    where: { id: jobId },
    data: {
      status: 'COMPLETED',
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    },
  });
};

export const failJob = async (job: AsyncJob, error: unknown): Promise<void> => {
  const message = error instanceof Error ? error.message : String(error);
  const exhausted = job.attempts >= job.maxAttempts;

  await prisma.asyncJob.update({
    where: { id: job.id },
    data: {
      status: exhausted ? 'FAILED' : 'PENDING',
      lockedAt: null,
      lockedBy: null,
      lastError: message.slice(0, 2000),
      runAt: new Date(Date.now() + Math.min(60000, 1000 * 2 ** Math.max(0, job.attempts))),
    },
  });
};
