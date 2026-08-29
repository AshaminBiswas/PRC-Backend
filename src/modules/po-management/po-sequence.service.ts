import prisma from '../../config/database';
import { logger } from '../../config/logger';

/**
 * Generate an atomic, human-readable internal PO Submission ID in format:
 * PRC-PO-YYYY-XXXXXX (e.g. PRC-PO-2026-000001).
 *
 * Sequence resets every calendar year. Concurrency is guaranteed via
 * Prisma transaction upsert / locking on the po_sequences table.
 */
export async function generatePoSubmissionId(customYear?: number): Promise<string> {
  const year = customYear || new Date().getFullYear();

  return await prisma.$transaction(async (tx) => {
    // 1. Atomically upsert and increment the yearly sequence
    const sequence = await tx.poSequence.upsert({
      where: { year },
      create: {
        year,
        lastNumber: 1,
      },
      update: {
        lastNumber: { increment: 1 },
      },
    });

    const paddedNumber = String(sequence.lastNumber).padStart(6, '0');
    const poSubmissionId = `PRC-PO-${year}-${paddedNumber}`;

    logger.info(`[PO Sequence] Generated new internal PO ID: ${poSubmissionId}`);
    return poSubmissionId;
  });
}
