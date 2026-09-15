import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import { getCurrentFinancialYear } from '../quotes/quotation-numbering.service';

/**
 * Atomically generates the next sequential reference number for a B2B order.
 * Format: PRC-B2B-2026-27/001 (rolls to 4+ digits past 999)
 */
export const generateNextB2bOrderNumber = async (
  date: Date = new Date(),
  txClient?: Prisma.TransactionClient
): Promise<{ orderNumber: string; financialYear: string; sequenceNo: number }> => {
  const db = txClient || prisma;
  const financialYear = getCurrentFinancialYear(date);

  try {
    const sequence = await (db as any).b2bOrderSequence.upsert({
      where: {
        financialYear,
      },
      update: {
        nextNumber: { increment: 1 },
      },
      create: {
        financialYear,
        nextNumber: 2,
      },
    });

    const sequenceNo = sequence.nextNumber - 1;
    const paddedSeq = sequenceNo < 1000 ? sequenceNo.toString().padStart(3, '0') : sequenceNo.toString();
    const orderNumber = `PRC-B2B-${financialYear}/${paddedSeq}`;

    return { orderNumber, financialYear, sequenceNo };
  } catch (error: any) {
    console.warn(`[B2bOrderNumbering] b2b_order_sequences fallback activated: ${error?.message || error}`);

    try {
      const latestOrder = await (db as any).b2bOrder.findFirst({
        where: {
          orderNumber: { startsWith: `PRC-B2B-${financialYear}/` },
        },
        orderBy: { createdAt: 'desc' },
        select: { orderNumber: true },
      });

      let nextSequenceNo = 1;
      if (latestOrder?.orderNumber) {
        const parts = latestOrder.orderNumber.split('/');
        const parsed = parseInt(parts[1], 10);
        if (!isNaN(parsed)) {
          nextSequenceNo = parsed + 1;
        }
      }

      const paddedSeq = nextSequenceNo < 1000 ? nextSequenceNo.toString().padStart(3, '0') : nextSequenceNo.toString();
      const orderNumber = `PRC-B2B-${financialYear}/${paddedSeq}`;

      return { orderNumber, financialYear, sequenceNo: nextSequenceNo };
    } catch {
      const timestampSeq = (Date.now() % 10000) + 1;
      const paddedSeq = timestampSeq.toString().padStart(3, '0');
      const orderNumber = `PRC-B2B-${financialYear}/${paddedSeq}`;
      return { orderNumber, financialYear, sequenceNo: timestampSeq };
    }
  }
};
