import prisma from '../../../config/database';
import { InvoiceType, Prisma } from '@prisma/client';

export const TYPE_PREFIX_MAP: Record<InvoiceType, string> = {
  TAX_INVOICE: 'INV',
  PROFORMA_INVOICE: 'PRO',
  QUOTATION: 'QTN',
  DELIVERY_CHALLAN: 'DC',
  PACKING_SLIP: 'PS',
  PURCHASE_ORDER: 'PO',
  CREDIT_NOTE: 'CN',
  DEBIT_NOTE: 'DN',
  COMMERCIAL_INVOICE: 'CI',
};

/**
 * Returns current Indian Financial Year string (e.g. "2026-27").
 * Financial Year starts April 1st and ends March 31st.
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
 * Generates next sequential invoice number for specified type, FY, and branch.
 */
export const generateNextInvoiceNumber = async (
  invoiceType: InvoiceType,
  branchCode: string = 'MAIN',
  date: Date = new Date(),
  txClient?: Prisma.TransactionClient
): Promise<{ invoiceNumber: string; financialYear: string }> => {
  const db = txClient || prisma;
  const financialYear = getCurrentFinancialYear(date);
  const prefix = TYPE_PREFIX_MAP[invoiceType] || 'DOC';

  const sequence = await db.invoiceSequence.upsert({
    where: {
      invoiceType_financialYear_branchCode: {
        invoiceType,
        financialYear,
        branchCode,
      },
    },
    update: {
      nextNumber: { increment: 1 },
    },
    create: {
      invoiceType,
      financialYear,
      branchCode,
      nextNumber: 2,
    },
  });

  // Number returned is the one before increment (or 1 for newly created sequence)
  const seqNumber = sequence.nextNumber - 1;
  const paddedSeq = seqNumber.toString().padStart(6, '0');
  const invoiceNumber = `${prefix}/${financialYear}/${branchCode}/${paddedSeq}`;

  return { invoiceNumber, financialYear };
};
