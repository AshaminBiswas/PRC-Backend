/**
 * purchase-order.service.ts
 *
 * Core service managing the end-to-end Purchase Order (PO) lifecycle:
 * - Sequential PO number generation matching PI convention (PO-<FY>/<seq>)
 * - Indian GST tax engine (CGST/SGST vs IGST)
 * - Pure Black & White PDF generation
 * - Email dispatch engine with attached vector PDF
 * - Partial and full goods receipt synchronization with branch inventory
 * - Immutable revision history on update after dispatch (-R1, -R2)
 */

import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { sendMail } from '../../utils/email.utils';
import { generatePurchaseOrderPdfBuffer, COMPANY_PROFILES } from './purchase-order-pdf.service';
import type { Prisma } from '@prisma/client';

/**
 * Converts numbers to Indian Currency Words
 */
export function numberToIndianWords(num: number): string {
  if (!num || num === 0) return 'Rupees Zero Only';

  const a = [
    '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ',
    'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n: number): string => {
    let str = '';
    if (n >= 10000000) {
      str += inWords(Math.floor(n / 10000000)) + 'Crore ';
      n %= 10000000;
    }
    if (n >= 100000) {
      str += inWords(Math.floor(n / 100000)) + 'Lakh ';
      n %= 100000;
    }
    if (n >= 1000) {
      str += inWords(Math.floor(n / 1000)) + 'Thousand ';
      n %= 1000;
    }
    if (n >= 100) {
      str += inWords(Math.floor(n / 100)) + 'Hundred ';
      n %= 100;
    }
    if (n > 0) {
      if (str !== '') str += 'and ';
      if (n < 20) {
        str += a[n];
      } else {
        str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : ' ');
      }
    }
    return str;
  };

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  let result = 'Rupees ' + inWords(rupees).trim();
  if (paise > 0) {
    result += ' and ' + inWords(paise).trim() + 'Paise';
  }
  return result + ' Only';
}

/**
 * Returns current Indian Financial Year (April 1 to March 31). e.g. "2026-27"
 */
export const getCurrentFinancialYear = (date: Date = new Date()): string => {
  const month = date.getMonth(); // 0 = Jan, 3 = April
  const year = date.getFullYear();

  if (month >= 3) {
    const nextYrShort = (year + 1).toString().slice(-2);
    return `${year}-${nextYrShort}`;
  } else {
    const prevYr = year - 1;
    const currYrShort = year.toString().slice(-2);
    return `${prevYr}-${currYrShort}`;
  }
};

/**
 * Atomically generates next sequential PO number: PO-<FY>/<seq> (e.g. PO-2026-27/0001)
 */
export const generateNextPoNumber = async (
  companyEntity: string = 'PACIFIC_PRODUCTS',
  date: Date = new Date(),
  txClient?: Prisma.TransactionClient
): Promise<{ poNumber: string; financialYear: string; sequenceNo: number }> => {
  const db = txClient || prisma;
  const financialYear = getCurrentFinancialYear(date);
  const cleanEntity = (companyEntity || 'PACIFIC_PRODUCTS').toUpperCase();

  const sequence = await db.purchaseOrderSequence.upsert({
    where: {
      financialYear_companyEntity: {
        financialYear,
        companyEntity: cleanEntity,
      },
    },
    update: {
      nextNumber: { increment: 1 },
      updatedAt: new Date(),
    },
    create: {
      financialYear,
      companyEntity: cleanEntity,
      nextNumber: 2,
    },
  });

  const sequenceNo = sequence.nextNumber - 1;
  const padded = sequenceNo.toString().padStart(4, '0');
  const poNumber = `PO-${financialYear}/${padded}`;

  return { poNumber, financialYear, sequenceNo };
};

export interface PoItemInput {
  productId?: string | null;
  itemSku: string;
  itemName: string;
  description?: string | null;
  hsnCode?: string | null;
  quantity: number;
  unit?: string;
  unitRate: number;
  discountPercent?: number;
  gstRate?: number;
}

/**
 * Indian GST calculation engine for PO items
 */
export const calculatePoGst = (
  items: PoItemInput[],
  supplierState: string = 'Delhi',
  branchState: string = 'Delhi'
) => {
  const isInterState = supplierState.trim().toLowerCase() !== branchState.trim().toLowerCase();

  let subtotal = 0;
  let discountTotal = 0;
  let taxableAmount = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  const processedItems = items.map((item) => {
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const rate = Math.max(0, Number(item.unitRate) || 0);
    const discPct = Math.min(100, Math.max(0, Number(item.discountPercent) || 0));
    const gstRate = Number(item.gstRate ?? 18);

    const baseAmount = qty * rate;
    const discAmount = Math.round(((baseAmount * discPct) / 100) * 100) / 100;
    const itemTaxable = Math.max(0, baseAmount - discAmount);

    let cgstRate = 0;
    let cgstAmount = 0;
    let sgstRate = 0;
    let sgstAmount = 0;
    let igstRate = 0;
    let igstAmount = 0;

    if (isInterState) {
      igstRate = gstRate;
      igstAmount = Math.round(((itemTaxable * igstRate) / 100) * 100) / 100;
    } else {
      cgstRate = gstRate / 2;
      cgstAmount = Math.round(((itemTaxable * cgstRate) / 100) * 100) / 100;
      sgstRate = gstRate / 2;
      sgstAmount = Math.round(((itemTaxable * sgstRate) / 100) * 100) / 100;
    }

    const lineTotal = itemTaxable + cgstAmount + sgstAmount + igstAmount;

    subtotal += baseAmount;
    discountTotal += discAmount;
    taxableAmount += itemTaxable;
    cgstTotal += cgstAmount;
    sgstTotal += sgstAmount;
    igstTotal += igstAmount;

    return {
      productId: item.productId || null,
      itemSku: (item.itemSku || '').trim().toUpperCase(),
      itemName: (item.itemName || '').trim(),
      description: item.description || null,
      hsnCode: item.hsnCode || '8302',
      quantity: qty,
      quantityReceived: 0,
      unit: item.unit || 'PCS',
      unitRate: rate,
      discountPercent: discPct,
      taxableAmount: itemTaxable,
      gstRate,
      cgstAmount,
      sgstAmount,
      igstAmount,
      lineTotal,
    };
  });

  const rawGrandTotal = taxableAmount + cgstTotal + sgstTotal + igstTotal;
  const grandTotal = Math.round(rawGrandTotal);

  return {
    items: processedItems,
    subtotal: Math.round(subtotal * 100) / 100,
    discountTotal: Math.round(discountTotal * 100) / 100,
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    cgstTotal: Math.round(cgstTotal * 100) / 100,
    sgstTotal: Math.round(sgstTotal * 100) / 100,
    igstTotal: Math.round(igstTotal * 100) / 100,
    grandTotal,
    totalInWords: numberToIndianWords(grandTotal),
    isInterState,
  };
};

/**
 * Creates a new Purchase Order (Draft)
 */
export const createPurchaseOrder = async (
  userId: string,
  data: {
    companyEntity?: string;
    companyLogo?: string;
    supplierId: string;
    branchId: string;
    issueDate?: string | Date;
    expectedDeliveryDate?: string | Date | null;
    paymentTerms?: string | null;
    deliveryTerms?: string | null;
    termsAndConditions?: string | null;
    notes?: string | null;
    items: PoItemInput[];
  }
) => {
  if (!data.supplierId) throw new AppError('BAD_REQUEST', 'Supplier is required', 400);
  if (!data.branchId) throw new AppError('BAD_REQUEST', 'Destination branch is required', 400);
  if (!data.items || data.items.length === 0) {
    throw new AppError('BAD_REQUEST', 'Purchase order must have at least one line item', 400);
  }

  // 1. Fetch Supplier and Branch
  const supplier = await prisma.supplier.findFirst({ where: { id: data.supplierId, deletedAt: null } });
  if (!supplier) throw new AppError('NOT_FOUND', 'Supplier not found', 404);

  const branch = await prisma.branch.findFirst({ where: { id: data.branchId, deletedAt: null } });
  if (!branch) throw new AppError('NOT_FOUND', 'Destination branch not found', 404);

  // 2. Resolve States for GST
  const supplierState = supplier.address?.toLowerCase().includes('delhi') ? 'Delhi' : 'Other';
  const branchState = branch.state || 'Delhi';

  // 3. Calculate GST & Line items
  const calc = calculatePoGst(data.items, supplierState, branchState);

  // 4. Generate sequential PO number
  const { poNumber, financialYear, sequenceNo } = await generateNextPoNumber(data.companyEntity);

  // 5. Insert PO, Items, and initial Event
  const issueDate = data.issueDate ? new Date(data.issueDate) : new Date();
  const expectedDate = data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null;

  return await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.create({
      data: {
        poNumber,
        revision: 0,
        financialYear,
        sequenceNo,
        companyEntity: (data.companyEntity || 'PACIFIC_PRODUCTS').toUpperCase(),
        companyLogo: data.companyLogo || (data.companyEntity === 'PRC_HARDWARE' ? 'prc' : 'pacific'),
        supplierId: supplier.id,
        branchId: branch.id,
        status: 'DRAFT',
        issueDate,
        expectedDeliveryDate: expectedDate,
        paymentTerms: data.paymentTerms || '30 days from material receipt and tax invoice submission',
        deliveryTerms: data.deliveryTerms || 'Door delivery at destination branch facility',
        termsAndConditions: data.termsAndConditions || null,
        subtotal: calc.subtotal,
        discountTotal: calc.discountTotal,
        taxableAmount: calc.taxableAmount,
        cgstTotal: calc.cgstTotal,
        sgstTotal: calc.sgstTotal,
        igstTotal: calc.igstTotal,
        grandTotal: calc.grandTotal,
        totalInWords: calc.totalInWords,
        isInterState: calc.isInterState,
        notes: data.notes || null,
        createdById: userId,
        items: {
          create: calc.items,
        },
        events: {
          create: {
            status: 'DRAFT',
            note: 'Purchase Order draft created',
            performedById: userId,
            performedByName: 'Admin Desk',
          },
        },
      },
      include: {
        items: true,
        supplier: true,
        branch: true,
        events: true,
      },
    });

    return po;
  });
};

/**
 * Updates a Purchase Order (Draft edit or post-sent revision -R1)
 */
export const updatePurchaseOrder = async (
  id: string,
  userId: string,
  data: {
    companyEntity?: string;
    companyLogo?: string;
    supplierId?: string;
    branchId?: string;
    issueDate?: string | Date;
    expectedDeliveryDate?: string | Date | null;
    paymentTerms?: string | null;
    deliveryTerms?: string | null;
    termsAndConditions?: string | null;
    notes?: string | null;
    items?: PoItemInput[];
  }
) => {
  const existing = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true, supplier: true, branch: true },
  });
  if (!existing) throw new AppError('NOT_FOUND', 'Purchase order not found', 404);

  if (['RECEIVED', 'CANCELLED'].includes(existing.status)) {
    throw new AppError('BAD_REQUEST', `Cannot modify Purchase Order in ${existing.status} status`, 400);
  }

  const supplier = data.supplierId
    ? await prisma.supplier.findFirst({ where: { id: data.supplierId } })
    : existing.supplier;
  const branch = data.branchId
    ? await prisma.branch.findFirst({ where: { id: data.branchId } })
    : existing.branch;

  const supplierState = supplier?.address?.toLowerCase().includes('delhi') ? 'Delhi' : 'Other';
  const branchState = branch?.state || 'Delhi';

  const itemsToProcess = data.items && data.items.length > 0 ? data.items : existing.items.map(it => ({
    productId: it.productId,
    itemSku: it.itemSku,
    itemName: it.itemName,
    description: it.description,
    hsnCode: it.hsnCode,
    quantity: it.quantity,
    unit: it.unit,
    unitRate: Number(it.unitRate),
    discountPercent: Number(it.discountPercent),
    gstRate: Number(it.gstRate),
  }));

  const calc = calculatePoGst(itemsToProcess, supplierState, branchState);

  // If already SENT or beyond, bump revision number (e.g. R1)
  const isPostSent = existing.status !== 'DRAFT';
  const newRevision = isPostSent ? existing.revision + 1 : existing.revision;

  return await prisma.$transaction(async (tx) => {
    // Delete existing items if new items provided
    if (data.items && data.items.length > 0) {
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
    }

    const updated = await tx.purchaseOrder.update({
      where: { id },
      data: {
        revision: newRevision,
        ...(data.companyEntity ? { companyEntity: data.companyEntity.toUpperCase() } : {}),
        ...(data.companyLogo ? { companyLogo: data.companyLogo } : {}),
        ...(data.supplierId ? { supplierId: data.supplierId } : {}),
        ...(data.branchId ? { branchId: data.branchId } : {}),
        ...(data.issueDate ? { issueDate: new Date(data.issueDate) } : {}),
        expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : existing.expectedDeliveryDate,
        paymentTerms: data.paymentTerms !== undefined ? data.paymentTerms : existing.paymentTerms,
        deliveryTerms: data.deliveryTerms !== undefined ? data.deliveryTerms : existing.deliveryTerms,
        termsAndConditions: data.termsAndConditions !== undefined ? data.termsAndConditions : existing.termsAndConditions,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        subtotal: calc.subtotal,
        discountTotal: calc.discountTotal,
        taxableAmount: calc.taxableAmount,
        cgstTotal: calc.cgstTotal,
        sgstTotal: calc.sgstTotal,
        igstTotal: calc.igstTotal,
        grandTotal: calc.grandTotal,
        totalInWords: calc.totalInWords,
        isInterState: calc.isInterState,
        updatedAt: new Date(),
        ...(data.items && data.items.length > 0
          ? {
              items: {
                create: calc.items,
              },
            }
          : {}),
      },
      include: {
        items: true,
        supplier: true,
        branch: true,
        events: { orderBy: { createdAt: 'desc' } },
        dispatches: { orderBy: { createdAt: 'desc' } },
      },
    });

    await tx.purchaseOrderEvent.create({
      data: {
        purchaseOrderId: id,
        status: isPostSent ? `REVISED_R${newRevision}` : 'UPDATED',
        note: isPostSent
          ? `Purchase Order modified after dispatch. Revision R${newRevision} generated.`
          : 'Purchase Order draft updated',
        performedById: userId,
        performedByName: 'Admin Desk',
      },
    });

    return updated;
  });
};

/**
 * Gets a Purchase Order by ID
 */
export const getPurchaseOrderById = async (id: string) => {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      items: { orderBy: { createdAt: 'asc' } },
      supplier: true,
      branch: true,
      events: { orderBy: { createdAt: 'desc' } },
      dispatches: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!po) throw new AppError('NOT_FOUND', 'Purchase order not found', 404);
  return po;
};

/**
 * Lists Purchase Orders with filtering and pagination
 */
export const listPurchaseOrders = async (query: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  supplierId?: string;
  companyEntity?: string;
  branchId?: string;
}) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  const skip = (page - 1) * limit;

  const where: Prisma.PurchaseOrderWhereInput = {};

  if (query.status && query.status !== 'ALL') {
    where.status = query.status;
  }

  if (query.supplierId && query.supplierId !== 'ALL') {
    where.supplierId = query.supplierId;
  }

  if (query.companyEntity && query.companyEntity !== 'ALL') {
    where.companyEntity = query.companyEntity.toUpperCase();
  }

  if (query.branchId && query.branchId !== 'ALL') {
    where.branchId = query.branchId;
  }

  if (query.search && query.search.trim()) {
    const s = query.search.trim();
    where.OR = [
      { poNumber: { contains: s, mode: 'insensitive' } },
      { supplier: { name: { contains: s, mode: 'insensitive' } } },
      { items: { some: { itemSku: { contains: s, mode: 'insensitive' } } } },
      { items: { some: { itemName: { contains: s, mode: 'insensitive' } } } },
    ];
  }

  const [total, items, counts] = await Promise.all([
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        supplier: true,
        branch: true,
        dispatches: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    }),
    prisma.purchaseOrder.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
  ]);

  const metrics = {
    total: 0,
    draft: 0,
    sent: 0,
    acknowledged: 0,
    partiallyReceived: 0,
    received: 0,
    cancelled: 0,
  };

  counts.forEach((c) => {
    const cnt = c._count.id;
    metrics.total += cnt;
    if (c.status === 'DRAFT') metrics.draft += cnt;
    if (c.status === 'SENT') metrics.sent += cnt;
    if (c.status === 'ACKNOWLEDGED') metrics.acknowledged += cnt;
    if (c.status === 'PARTIALLY_RECEIVED') metrics.partiallyReceived += cnt;
    if (c.status === 'RECEIVED') metrics.received += cnt;
    if (c.status === 'CANCELLED') metrics.cancelled += cnt;
  });

  return {
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
    metrics,
  };
};

/**
 * Dispatches Purchase Order via Email with attached vector PDF
 */
export const sendPurchaseOrderEmail = async (
  id: string,
  userId: string,
  input: {
    recipientEmail?: string;
    cc?: string;
    subject?: string;
    customMessage?: string;
  }
) => {
  const po = await getPurchaseOrderById(id);

  if (!po.items || po.items.length === 0) {
    throw new AppError('BAD_REQUEST', 'Cannot send a Purchase Order with zero line items', 400);
  }

  const targetEmail = (input.recipientEmail || po.supplier.email || '').trim();
  if (!targetEmail) {
    throw new AppError('BAD_REQUEST', 'Supplier registered email is missing. Please provide a recipient email address.', 400);
  }

  const entityKey = (po.companyEntity || 'PACIFIC_PRODUCTS').toUpperCase();
  const profile = COMPANY_PROFILES[entityKey] || COMPANY_PROFILES.PACIFIC_PRODUCTS;

  // 1. Generate Vector PDF Buffer
  const pdfBuffer = await generatePurchaseOrderPdfBuffer(po as any);

  // 2. Prepare Subject and Body
  const fullPoNo = po.revision > 0 ? `${po.poNumber}-R${po.revision}` : po.poNumber;
  const subject = input.subject || `Purchase Order ${fullPoNo} — ${profile.name}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <!-- Header -->
      <div style="background: #09090b; padding: 24px; color: #ffffff;">
        <h1 style="margin: 0; font-size: 20px; color: #f4f4f5; font-weight: 700; letter-spacing: -0.3px;">${profile.name}</h1>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #a1a1aa;">Procurement & Materials Management Desk</p>
      </div>

      <!-- Content -->
      <div style="padding: 24px; background: #ffffff;">
        <div style="display: inline-block; padding: 3px 10px; background: #f4f4f5; color: #18181b; border: 1px solid #e4e4e7; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 16px;">
          Official Purchase Order
        </div>

        <p style="font-size: 14px; margin-top: 0; color: #09090b;">Dear <strong>${po.supplier.contactPerson || po.supplier.name}</strong>,</p>
        
        <p style="font-size: 13px; color: #3f3f46; line-height: 1.6;">
          Please find attached our official Purchase Order <strong>#${fullPoNo}</strong> for the supply of hardware and components to our <strong>${po.branch.name} Depot</strong>.
        </p>

        ${input.customMessage ? `
          <div style="background: #fafafa; border-left: 3px solid #18181b; padding: 12px 14px; margin: 18px 0; border-radius: 0 6px 6px 0;">
            <p style="margin: 0; font-size: 12px; color: #71717a; font-weight: 600; text-transform: uppercase;">Message from Procurement Team:</p>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #09090b; white-space: pre-wrap;">${input.customMessage}</p>
          </div>
        ` : ''}

        <!-- PO Summary Card -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
            Order Overview
          </h3>
          <table style="width: 100%; font-size: 12.5px; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 0; color: #64748b;">PO Number:</td>
              <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #0f172a; font-family: monospace;">${fullPoNo}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Order Date:</td>
              <td style="padding: 4px 0; text-align: right; color: #0f172a;">${new Date(po.issueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Total Line Items:</td>
              <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #0f172a;">${po.items.length}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Delivery Depot:</td>
              <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #0f172a;">${po.branch.name} (${po.branch.city || 'Delhi'})</td>
            </tr>
            <tr style="border-top: 1px solid #cbd5e1;">
              <td style="padding: 8px 0 2px 0; font-size: 13px; font-weight: 700; color: #0f172a;">Total Order Value:</td>
              <td style="padding: 8px 0 2px 0; text-align: right; font-size: 14px; font-weight: 800; color: #0f172a;">₹${Number(po.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 12px; color: #52525b; line-height: 1.5;">
          The itemized specifications, HSN classifications, and delivery terms are set out in the attached PDF document.<br />
          Kindly confirm receipt and dispatch schedule by replying to this email.
        </p>
      </div>

      <!-- Footer -->
      <div style="background: #f4f4f5; padding: 14px 24px; border-top: 1px solid #e4e4e7; font-size: 11px; color: #71717a; text-align: center;">
        ${profile.title} | ${profile.address}<br />
        GSTIN: ${profile.gstin} | Phone: ${profile.phone}
      </div>
    </div>
  `;

  // 3. Send Email
  try {
    await sendMail({
      to: targetEmail,
      cc: input.cc ? input.cc.split(',').map(c => c.trim()).filter(Boolean) : profile.email,
      subject,
      html,
      attachments: [
        {
          filename: `${fullPoNo}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    // 4. Update Status and Log Dispatch
    await prisma.$transaction([
      prisma.purchaseOrder.update({
        where: { id },
        data: {
          status: po.status === 'DRAFT' ? 'SENT' : po.status,
          sentAt: new Date(),
          sentById: userId,
          sentToEmail: targetEmail,
          sentCc: input.cc || profile.email,
          updatedAt: new Date(),
        },
      }),
      prisma.purchaseOrderDispatch.create({
        data: {
          purchaseOrderId: id,
          recipientEmail: targetEmail,
          cc: input.cc || profile.email,
          subject,
          body: input.customMessage || null,
          status: 'SENT',
          dispatchedById: userId,
          dispatchedByName: 'Procurement Desk',
        },
      }),
      prisma.purchaseOrderEvent.create({
        data: {
          purchaseOrderId: id,
          status: 'SENT',
          note: `PO emailed to ${targetEmail}${input.cc ? ` (CC: ${input.cc})` : ''}`,
          performedById: userId,
          performedByName: 'Procurement Desk',
        },
      }),
    ]);

    return { success: true, message: `Purchase order emailed successfully to ${targetEmail}` };
  } catch (err: any) {
    // Log failure
    await prisma.purchaseOrderDispatch.create({
      data: {
        purchaseOrderId: id,
        recipientEmail: targetEmail,
        cc: input.cc || null,
        subject,
        body: input.customMessage || null,
        status: 'FAILED',
        errorMessage: err?.message || 'Failed to dispatch email',
        dispatchedById: userId,
        dispatchedByName: 'Procurement Desk',
      },
    });

    throw new AppError('INTERNAL_ERROR', `Email dispatch failed: ${err?.message}`, 500);
  }
};

/**
 * Records physical receipt of goods against a PO (Partial or Full)
 */
export const recordGoodsReceipt = async (
  id: string,
  userId: string,
  data: {
    items: Array<{
      itemId: string;
      quantityReceivedNow: number;
    }>;
    notes?: string;
    invoiceNumber?: string;
  }
) => {
  const po = await getPurchaseOrderById(id);

  if (['DRAFT', 'CANCELLED'].includes(po.status)) {
    throw new AppError('BAD_REQUEST', `Cannot receive goods against a PO in ${po.status} status`, 400);
  }

  if (!data.items || data.items.length === 0) {
    throw new AppError('BAD_REQUEST', 'Please specify received quantities for at least one item', 400);
  }

  return await prisma.$transaction(async (tx) => {
    let totalItemsReceivedCount = 0;
    let anyRemaining = false;
    let totalReceivedAmount = 0;
    const purchaseItemsToCreate: any[] = [];

    for (const line of po.items) {
      const receiptInput = data.items.find(i => i.itemId === line.id);
      const qtyNow = receiptInput ? Math.max(0, Math.floor(Number(receiptInput.quantityReceivedNow) || 0)) : 0;
      const updatedQtyReceived = line.quantityReceived + qtyNow;

      if (updatedQtyReceived > line.quantity) {
        throw new AppError(
          'BAD_REQUEST',
          `Received quantity (${updatedQtyReceived}) cannot exceed ordered quantity (${line.quantity}) for item ${line.itemSku}`,
          400
        );
      }

      if (qtyNow > 0) {
        totalItemsReceivedCount += qtyNow;
        const lineTotalRec = qtyNow * Number(line.unitRate);
        totalReceivedAmount += lineTotalRec;

        // 1. Update line item received quantity
        await tx.purchaseOrderItem.update({
          where: { id: line.id },
          data: { quantityReceived: updatedQtyReceived },
        });

        // 2. Increment branch inventory
        if (line.productId) {
          const inv = await tx.inventory.findUnique({
            where: {
              productId_branchId: {
                productId: line.productId,
                branchId: po.branchId,
              },
            },
          });

          const prevQty = inv?.quantity || 0;
          const newQty = prevQty + qtyNow;

          await tx.inventory.upsert({
            where: {
              productId_branchId: {
                productId: line.productId,
                branchId: po.branchId,
              },
            },
            update: {
              quantity: { increment: qtyNow },
              updatedAt: new Date(),
            },
            create: {
              productId: line.productId,
              branchId: po.branchId,
              quantity: qtyNow,
              reorderLevel: 10,
            },
          });

          // Also increment product master stock
          await tx.product.update({
            where: { id: line.productId },
            data: { stock: { increment: qtyNow } },
          });

          // 3. Log Stock Movement
          await tx.stockMovement.create({
            data: {
              productId: line.productId,
              branchId: po.branchId,
              type: 'PURCHASE_IN',
              quantity: qtyNow,
              previousQty: prevQty,
              newQty,
              referenceType: 'PURCHASE_ORDER',
              referenceId: po.id,
              notes: `Received via PO #${po.poNumber}${data.invoiceNumber ? ` (Inv: ${data.invoiceNumber})` : ''}`,
              performedById: userId,
            },
          });

          purchaseItemsToCreate.push({
            productId: line.productId,
            quantity: qtyNow,
            unitPurchasePrice: line.unitRate,
            totalPrice: lineTotalRec,
          });
        }
      }

      if (updatedQtyReceived < line.quantity) {
        anyRemaining = true;
      }
    }

    if (totalItemsReceivedCount === 0) {
      throw new AppError('BAD_REQUEST', 'Total received quantity must be greater than zero', 400);
    }

    // Determine new status: RECEIVED (if all fulfilled) or PARTIALLY_RECEIVED
    const newStatus = anyRemaining ? 'PARTIALLY_RECEIVED' : 'RECEIVED';

    // 4. Update PO Status
    const updatedPo = await tx.purchaseOrder.update({
      where: { id },
      data: {
        status: newStatus,
        updatedAt: new Date(),
      },
      include: {
        items: true,
        supplier: true,
        branch: true,
        events: { orderBy: { createdAt: 'desc' } },
      },
    });

    // 5. Create Purchase record in purchases table for procurement audit
    if (purchaseItemsToCreate.length > 0) {
      await tx.purchase.create({
        data: {
          branchId: po.branchId,
          supplierId: po.supplierId,
          invoiceNumber: data.invoiceNumber || `PO-REC-${po.poNumber}`,
          purchaseDate: new Date(),
          totalAmount: totalReceivedAmount,
          notes: `Goods received against PO #${po.poNumber}. ${data.notes || ''}`,
          createdById: userId,
          items: {
            create: purchaseItemsToCreate,
          },
        },
      });
    }

    // 6. Log Event
    await tx.purchaseOrderEvent.create({
      data: {
        purchaseOrderId: id,
        status: newStatus,
        note: `Received ${totalItemsReceivedCount} units. Order is now ${newStatus}. ${data.notes ? `Note: ${data.notes}` : ''}`,
        performedById: userId,
        performedByName: 'Store Depot Receiving',
      },
    });

    return updatedPo;
  });
};

/**
 * Updates PO status manually (e.g. ACKNOWLEDGED, CANCELLED)
 */
export const updatePoStatus = async (
  id: string,
  userId: string,
  newStatus: string,
  note?: string
) => {
  const allowed = ['DRAFT', 'SENT', 'ACKNOWLEDGED', 'CANCELLED'];
  if (!allowed.includes(newStatus)) {
    throw new AppError('BAD_REQUEST', `Invalid status transition to ${newStatus}`, 400);
  }

  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) throw new AppError('NOT_FOUND', 'Purchase order not found', 404);

  if (po.status === 'RECEIVED') {
    throw new AppError('BAD_REQUEST', 'Cannot change status of a fully received Purchase Order', 400);
  }

  return await prisma.$transaction([
    prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: newStatus,
        updatedAt: new Date(),
      },
    }),
    prisma.purchaseOrderEvent.create({
      data: {
        purchaseOrderId: id,
        status: newStatus,
        note: note || `Status updated to ${newStatus}`,
        performedById: userId,
        performedByName: 'Admin Desk',
      },
    }),
  ]);
};
