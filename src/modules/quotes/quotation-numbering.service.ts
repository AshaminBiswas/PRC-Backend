import prisma from '../../config/database';
import { Prisma } from '@prisma/client';

/**
 * Returns current Indian Financial Year string (e.g. "2026-27").
 * Indian Financial Year starts April 1st and ends March 31st.
 */
export const getCurrentFinancialYear = (date: Date = new Date()): string => {
  const month = date.getMonth(); // 0-indexed (0 = Jan, 3 = April)
  const year = date.getFullYear();

  if (month >= 3) {
    // April to December
    const nextYrShort = (year + 1).toString().slice(-2);
    return `${year}-${nextYrShort}`;
  } else {
    // January to March
    const prevYr = year - 1;
    const currYrShort = year.toString().slice(-2);
    return `${prevYr}-${currYrShort}`;
  }
};

/**
 * Atomically generates the next sequential reference number for a quotation.
 * Format: PRC-QT-2026-27/001 (rolls to 4+ digits past 999)
 */
export const generateNextQuotationReferenceNo = async (
  date: Date = new Date(),
  txClient?: Prisma.TransactionClient
): Promise<{ referenceNo: string; financialYear: string; sequenceNo: number }> => {
  const db = txClient || prisma;
  const financialYear = getCurrentFinancialYear(date);

  const sequence = await db.quoteSequence.upsert({
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

  // The allocated number is before increment
  const sequenceNo = sequence.nextNumber - 1;
  const paddedSeq = sequenceNo < 1000 ? sequenceNo.toString().padStart(3, '0') : sequenceNo.toString();
  const referenceNo = `PRC-QT-${financialYear}/${paddedSeq}`;

  return { referenceNo, financialYear, sequenceNo };
};
