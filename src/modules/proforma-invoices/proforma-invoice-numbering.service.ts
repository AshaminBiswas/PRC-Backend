import prisma from '../../config/database';
import { Prisma } from '@prisma/client';

/**
 * Returns current Indian Financial Year string (e.g. "2026-27").
 * Financial Year runs April 1st to March 31st.
 */
export const getCurrentFinancialYear = (date: Date = new Date()): string => {
  const month = date.getMonth(); // 0 = Jan, 3 = April
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
 * Atomically generates the next sequential Proforma Invoice Number.
 * Format: PRC/PI/2026-27/0001 (or PRC/PI/2026-27/DEL/0001 if custom branch)
 */
export const generateNextProformaNumber = async (
  branchCode: string = 'MAIN',
  date: Date = new Date(),
  txClient?: Prisma.TransactionClient
): Promise<{ piNumber: string; financialYear: string; sequenceNo: number }> => {
  const db = txClient || prisma;
  const financialYear = getCurrentFinancialYear(date);
  const cleanBranch = branchCode.trim().toUpperCase() || 'MAIN';

  const sequence = await db.proformaInvoiceSequence.upsert({
    where: {
      financialYear_branchCode: {
        financialYear,
        branchCode: cleanBranch,
      },
    },
    update: {
      nextNumber: { increment: 1 },
    },
    create: {
      financialYear,
      branchCode: cleanBranch,
      nextNumber: 2,
    },
  });

  const sequenceNo = sequence.nextNumber - 1;
  const padded = sequenceNo.toString().padStart(4, '0');
  
  const piNumber = cleanBranch === 'MAIN'
    ? `PRC/PI/${financialYear}/${padded}`
    : `PRC/PI/${financialYear}/${cleanBranch}/${padded}`;

  return { piNumber, financialYear, sequenceNo };
};
