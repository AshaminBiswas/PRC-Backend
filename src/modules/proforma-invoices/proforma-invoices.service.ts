import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { getPaginationParams, buildPagination } from '../../utils/response';
import { sendMail } from '../../utils/email.utils';
import { ProformaInvoiceStatus, Prisma } from '@prisma/client';
import { generateNextProformaNumber, getCurrentFinancialYear } from './proforma-invoice-numbering.service';
import {
  generateProformaVerificationBundle,
  computeProformaSignature,
  verifyProformaSignatureRecord,
  ProformaVerificationResult,
} from './proforma-invoice-signature.service';
import { generateProformaPdf } from './proforma-invoice-pdf.service';
import type {
  CreateProformaInvoiceInput,
  UpdateProformaInvoiceInput,
  UpdateProformaInvoiceItemsInput,
  UpdateProformaInvoiceStatusInput,
  SignProformaInvoiceInput,
  ListProformaInvoicesQuery,
  SendProformaInvoiceEmailInput,
  VerifySignatureInput,
  ProformaItemInput,
  ValidateTamperInput,
} from './proforma-invoices.schema';

export interface UserContext {
  id: string;
  email?: string;
  roles?: string[];
  roleSlug?: string;
  permissions?: string[];
}

/**
 * Calculates Indian GST breakdown for line items.
 */
export const calculateProformaGST = (
  items: ProformaItemInput[],
  supplierState: string = 'Delhi',
  placeOfSupply: string = 'Karnataka',
  shippingCost: number = 0,
  advancePercentage: number = 30
) => {
  const isInterstate = supplierState.trim().toLowerCase() !== placeOfSupply.trim().toLowerCase();

  let subtotal = 0;
  let totalDiscount = 0;
  let taxableAmount = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  const processedItems = items.map((item) => {
    const qty = Number(item.quantity) || 1;
    const rate = Number(item.unitRate) || 0;
    const discPct = Number(item.discountPercent) || 0;
    const gstRate = Number(item.gstRate) || 18;

    const baseAmount = qty * rate;
    const discAmount = (baseAmount * discPct) / 100;
    const itemTaxable = Math.max(0, baseAmount - discAmount);

    let cgstRate = 0;
    let cgstAmount = 0;
    let sgstRate = 0;
    let sgstAmount = 0;
    let igstRate = 0;
    let igstAmount = 0;

    if (isInterstate) {
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
    totalDiscount += discAmount;
    taxableAmount += itemTaxable;
    totalCgst += cgstAmount;
    totalSgst += sgstAmount;
    totalIgst += igstAmount;

    return {
      productId: item.productId || null,
      sku: item.sku,
      productName: item.productName,
      description: item.description || null,
      hsnCode: item.hsnCode || '8302',
      unit: item.unit || 'PCS',
      quantity: qty,
      unitRate: rate,
      discountPercent: discPct,
      taxableAmount: itemTaxable,
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      igstRate,
      igstAmount,
      lineTotal,
    };
  });

  const rawGrandTotal = taxableAmount + totalCgst + totalSgst + totalIgst + Number(shippingCost || 0);
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = Math.round((roundedGrandTotal - rawGrandTotal) * 100) / 100;

  const advPct = Math.min(100, Math.max(0, Number(advancePercentage) || 30));
  const advanceAmount = Math.round(((roundedGrandTotal * advPct) / 100) * 100) / 100;
  const balanceDue = Math.round((roundedGrandTotal - advanceAmount) * 100) / 100;

  return {
    items: processedItems,
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(totalDiscount * 100) / 100,
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    cgst: Math.round(totalCgst * 100) / 100,
    sgst: Math.round(totalSgst * 100) / 100,
    igst: Math.round(totalIgst * 100) / 100,
    cess: 0,
    shippingCost: Number(shippingCost || 0),
    roundOff,
    grandTotal: roundedGrandTotal,
    advancePercentage: advPct,
    advanceAmount,
    balanceDue,
  };
};

/**
 * Creates a brand new Proforma Invoice.
 */
export const createProformaInvoice = async (input: CreateProformaInvoiceInput, user?: UserContext) => {
  const branchCode = input.branchCode || 'MAIN';
  const supplierState = input.supplierState || 'Delhi';
  const placeOfSupply = input.placeOfSupply || 'Karnataka';

  const gstCalculations = calculateProformaGST(
    input.items,
    supplierState,
    placeOfSupply,
    input.shippingCost || 0,
    input.advancePercentage ?? 30
  );

  const { piNumber, financialYear, sequenceNo } = await generateNextProformaNumber(branchCode);

  const verification = await generateProformaVerificationBundle(
    piNumber,
    gstCalculations.grandTotal,
    gstCalculations.advanceAmount
  );

  const proforma = await prisma.$transaction(async (tx) => {
    const created = await tx.proformaInvoice.create({
      data: {
        piNumber,
        financialYear,
        sequenceNo,
        status: ProformaInvoiceStatus.DRAFT,
        quoteId: input.quoteId || null,
        quoteNumber: input.quoteNumber || null,
        poId: input.poId || null,
        poNumber: input.poNumber || null,
        customerPoNumber: input.customerPoNumber || null,
        orderId: input.orderId || null,
        customerId: input.customerId || null,
        customerName: input.customerName.trim(),
        companyName: input.companyName?.trim() || null,
        customerEmail: (input.customerEmail || '').trim() || 'billing@pacifichardware.com',
        customerPhone: input.customerPhone?.trim() || null,
        gstin: input.gstin?.trim()?.toUpperCase() || null,
        pan: input.pan?.trim()?.toUpperCase() || null,
        billingAddress: input.billingAddress || null,
        shippingAddress: input.shippingAddress || null,
        placeOfSupply,
        subtotal: gstCalculations.subtotal,
        taxableAmount: gstCalculations.taxableAmount,
        cgst: gstCalculations.cgst,
        sgst: gstCalculations.sgst,
        igst: gstCalculations.igst,
        cess: gstCalculations.cess,
        discount: gstCalculations.discount,
        shippingCost: gstCalculations.shippingCost,
        roundOff: gstCalculations.roundOff,
        grandTotal: gstCalculations.grandTotal,
        advancePercentage: gstCalculations.advancePercentage,
        advanceAmount: gstCalculations.advanceAmount,
        balanceDue: gstCalculations.balanceDue,
        paymentTerms: input.paymentTerms || `${gstCalculations.advancePercentage}% advance payment against Proforma Invoice, balance prior to dispatch.`,
        deliveryTimeline: input.deliveryTimeline || '7-10 working days upon receipt of advance',
        validUntil: input.validUntil ? new Date(input.validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        verificationToken: verification.verificationToken,
        verificationId: verification.verificationId,
        documentHash: verification.documentHash,
        qrCodeDataUrl: verification.qrCodeDataUrl,
        notes: input.notes || null,
        termsAndConditions: input.termsAndConditions || null,
        bankDetails: input.bankDetails || Prisma.DbNull,
        createdBy: user?.id || 'system',
        items: {
          create: gstCalculations.items.map((item) => ({
            productId: item.productId,
            sku: item.sku,
            productName: item.productName,
            description: item.description,
            hsnCode: item.hsnCode,
            unit: item.unit,
            quantity: item.quantity,
            unitRate: item.unitRate,
            discountPercent: item.discountPercent,
            taxableAmount: item.taxableAmount,
            cgstRate: item.cgstRate,
            cgstAmount: item.cgstAmount,
            sgstRate: item.sgstRate,
            sgstAmount: item.sgstAmount,
            igstRate: item.igstRate,
            igstAmount: item.igstAmount,
            lineTotal: item.lineTotal,
          })),
        },
        history: {
          create: {
            action: 'CREATED_DRAFT',
            performedBy: user?.id || 'system',
            details: `Proforma Invoice ${piNumber} generated in DRAFT state for customer ${input.customerName}.`,
            metadata: {
              piNumber,
              grandTotal: gstCalculations.grandTotal,
              advanceAmount: gstCalculations.advanceAmount,
            },
          },
        },
      },
      include: {
        items: true,
        history: true,
      },
    });

    return created;
  });

  return proforma;
};

/**
 * Converts an approved Quotation directly into a Proforma Invoice.
 */
export const createFromQuotation = async (quoteId: string, user?: UserContext) => {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      items: {
        include: { product: true },
      },
      user: true,
    },
  });

  if (!quote) throw new AppError('NOT_FOUND', 'Quotation not found', 404);

  const customerName = [quote.firstName, quote.lastName].filter(Boolean).join(' ') || 'Valued Customer';
  const advancePercentage = quote.advancePercentage ? Number(quote.advancePercentage) : 30;

  const items: ProformaItemInput[] = (quote.items || []).map((item) => ({
    productId: item.productId || null,
    sku: item.product?.sku || item.variantId || 'PRC-HW',
    productName: item.productNameSnapshot || item.product?.name || 'Hardware Fitting',
    description: null,
    hsnCode: '8302',
    unit: item.unit || 'PCS',
    quantity: Number(item.quantity || 1),
    unitRate: Number(item.rate || 0),
    discountPercent: 0,
    gstRate: 18,
  }));

  return createProformaInvoice(
    {
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber || quote.referenceNo || undefined,
      customerId: quote.userId || undefined,
      customerName,
      companyName: quote.companyName || undefined,
      customerEmail: quote.email || 'customer@prchardware.com',
      customerPhone: quote.phone || undefined,
      gstin: quote.gstNo || undefined,
      placeOfSupply: 'Karnataka',
      supplierState: 'Delhi',
      branchCode: 'MAIN',
      shippingCost: 0,
      advancePercentage,
      notes: quote.notes || undefined,
      items,
    },
    user
  );
};

/**
 * Converts an inbound Purchase Order (PO) into a Proforma Invoice.
 */
export const createFromPurchaseOrder = async (poId: string, user?: UserContext) => {
  const po = await prisma.poSubmission.findFirst({
    where: { OR: [{ id: poId }, { poSubmissionId: poId }] },
  });

  if (!po) throw new AppError('NOT_FOUND', 'Purchase Order submission not found', 404);

  const poMeta = (po.metadata as Record<string, any>) || {};
  const metaItems = Array.isArray(poMeta.items) ? poMeta.items : [];

  const items: ProformaItemInput[] = metaItems.map((item: any) => ({
    productId: item.productId || null,
    sku: item.sku || 'PRC-HW',
    productName: item.productName || 'Hardware Fitting',
    description: item.specifications || item.description || null,
    hsnCode: item.hsnCode || '8302',
    unit: item.unit || 'PCS',
    quantity: Number(item.quantity || 1),
    unitRate: Number(item.unitPrice || item.targetRate || item.unitRate || 0),
    discountPercent: 0,
    gstRate: 18,
  }));

  if (items.length === 0) {
    items.push({
      productId: null,
      sku: 'PO-LOT',
      productName: `Purchase Order ${po.customerPoNumber || po.poSubmissionId || po.id.slice(0, 8)}`,
      description: po.subject || null,
      hsnCode: '8302',
      unit: 'LOT',
      quantity: 1,
      unitRate: Number(poMeta.totalAmount || 0),
      discountPercent: 0,
      gstRate: 18,
    });
  }

  return createProformaInvoice(
    {
      poId: po.id,
      poNumber: po.poSubmissionId || undefined,
      customerPoNumber: po.customerPoNumber || undefined,
      customerName: po.customerName || 'Valued Customer',
      companyName: po.companyName || undefined,
      customerEmail: po.customerEmail,
      customerPhone: po.customerPhone || undefined,
      gstin: (poMeta.gstin as string) || undefined,
      billingAddress: (poMeta.billingAddress as string) || undefined,
      shippingAddress: (poMeta.shippingAddress as string) || undefined,
      deliveryTimeline: (poMeta.deliveryTimeline as string) || undefined,
      paymentTerms: (poMeta.paymentTerms as string) || undefined,
      placeOfSupply: 'Karnataka',
      supplierState: 'Delhi',
      branchCode: 'MAIN',
      shippingCost: 0,
      advancePercentage: 30,
      items,
    },
    user
  );
};

/**
 * List Proforma Invoices with pagination, filters, and executive financial KPI metrics.
 */
export const listProformaInvoices = async (query: ListProformaInvoicesQuery, _user?: UserContext) => {
  const { page, limit, skip } = getPaginationParams(query);

  const where: Prisma.ProformaInvoiceWhereInput = {
    deletedAt: null,
  };

  if (query.status) {
    where.status = query.status as ProformaInvoiceStatus;
  }
  if (query.financialYear) {
    where.financialYear = query.financialYear;
  }
  if (query.customerId) {
    where.customerId = query.customerId;
  }
  if (query.startDate || query.endDate) {
    where.createdAt = {
      ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
      ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
    };
  }

  if (query.search) {
    const s = query.search.trim();
    where.OR = [
      { piNumber: { contains: s, mode: 'insensitive' } },
      { customerName: { contains: s, mode: 'insensitive' } },
      { companyName: { contains: s, mode: 'insensitive' } },
      { customerEmail: { contains: s, mode: 'insensitive' } },
      { customerPhone: { contains: s, mode: 'insensitive' } },
      { gstin: { contains: s, mode: 'insensitive' } },
      { quoteNumber: { contains: s, mode: 'insensitive' } },
      { poNumber: { contains: s, mode: 'insensitive' } },
      { customerPoNumber: { contains: s, mode: 'insensitive' } },
    ];
  }

  const orderBy: Prisma.ProformaInvoiceOrderByWithRelationInput = {
    [query.sortBy || 'createdAt']: query.sortOrder || 'desc',
  };

  const [items, totalItems, metricsAgg] = await prisma.$transaction([
    prisma.proformaInvoice.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        items: true,
      },
    }),
    prisma.proformaInvoice.count({ where }),
    prisma.proformaInvoice.aggregate({
      where: { deletedAt: null },
      _count: { id: true },
      _sum: {
        grandTotal: true,
        advanceAmount: true,
        balanceDue: true,
      },
    }),
  ]);

  // Group count by status
  const statusCounts = await prisma.proformaInvoice.groupBy({
    by: ['status'],
    where: { deletedAt: null },
    _count: { id: true },
  });

  const statusMap: Record<string, number> = {};
  statusCounts.forEach((sc) => {
    statusMap[sc.status] = sc._count.id;
  });

  const metrics = {
    totalCount: metricsAgg._count.id || 0,
    totalGrandValue: Number(metricsAgg._sum.grandTotal || 0),
    totalAdvanceRequired: Number(metricsAgg._sum.advanceAmount || 0),
    totalBalanceDue: Number(metricsAgg._sum.balanceDue || 0),
    statusCounts: statusMap,
  };

  return {
    data: items,
    pagination: buildPagination(page, limit, totalItems),
    metrics,
  };
};

/**
 * Get Proforma Invoice by ID.
 */
export const getProformaInvoiceById = async (id: string, _user?: UserContext) => {
  const proforma = await prisma.proformaInvoice.findFirst({
    where: {
      OR: [{ id }, { piNumber: id }, { verificationToken: id }],
      deletedAt: null,
    },
    include: {
      items: {
        include: { product: true },
      },
      history: {
        orderBy: { createdAt: 'desc' },
      },
      customer: {
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true, gstin: true },
      },
    },
  });

  if (!proforma) throw new AppError('NOT_FOUND', 'Proforma Invoice not found', 404);
  return proforma;
};

/**
 * Public customer view by secure access / verification token.
 */
export const getProformaInvoiceByToken = async (token: string) => {
  const proforma = await prisma.proformaInvoice.findFirst({
    where: { verificationToken: token, deletedAt: null },
    include: {
      items: true,
    },
  });

  if (!proforma) throw new AppError('NOT_FOUND', 'Proforma Invoice not found or link has expired', 404);
  return proforma;
};

/**
 * Customer Self-Service: Get all Proforma Invoices issued for a customer (by customerId or email).
 */
export const getMyCustomerProformas = async (userId: string, userEmail?: string) => {
  const emailCondition = userEmail && userEmail.trim()
    ? [{ customerEmail: { equals: userEmail.trim(), mode: 'insensitive' as const } }]
    : [];

  const where: Prisma.ProformaInvoiceWhereInput = {
    deletedAt: null,
    OR: [
      { customerId: userId },
      ...emailCondition,
    ],
  };

  const proformas = await prisma.proformaInvoice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      items: true,
      history: {
        orderBy: { createdAt: 'desc' },
        take: 3,
      },
    },
  });

  return proformas;
};

/**
 * Update metadata and payment terms.
 */
export const updateProformaInvoice = async (id: string, input: UpdateProformaInvoiceInput, user?: UserContext) => {
  const existing = await prisma.proformaInvoice.findUnique({ where: { id, deletedAt: null } });
  if (!existing) throw new AppError('NOT_FOUND', 'Proforma Invoice not found', 404);

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.proformaInvoice.update({
      where: { id },
      data: {
        customerName: input.customerName?.trim() ?? undefined,
        companyName: input.companyName !== undefined ? input.companyName?.trim() || null : undefined,
        customerEmail: input.customerEmail?.trim() ?? undefined,
        customerPhone: input.customerPhone !== undefined ? input.customerPhone?.trim() || null : undefined,
        gstin: input.gstin !== undefined ? input.gstin?.trim()?.toUpperCase() || null : undefined,
        pan: input.pan !== undefined ? input.pan?.trim()?.toUpperCase() || null : undefined,
        billingAddress: input.billingAddress !== undefined ? input.billingAddress || null : undefined,
        shippingAddress: input.shippingAddress !== undefined ? input.shippingAddress || null : undefined,
        placeOfSupply: input.placeOfSupply ?? undefined,
        advancePercentage: input.advancePercentage !== undefined ? input.advancePercentage : undefined,
        paymentTerms: input.paymentTerms !== undefined ? input.paymentTerms || null : undefined,
        deliveryTimeline: input.deliveryTimeline !== undefined ? input.deliveryTimeline || null : undefined,
        validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
        shippingCost: input.shippingCost !== undefined ? input.shippingCost : undefined,
        notes: input.notes !== undefined ? input.notes || null : undefined,
        termsAndConditions: input.termsAndConditions !== undefined ? input.termsAndConditions || null : undefined,
        bankDetails: input.bankDetails !== undefined ? (input.bankDetails || Prisma.DbNull) : undefined,
        updatedBy: user?.id || 'system',
      },
      include: { items: true, history: true },
    });

    await tx.proformaInvoiceHistory.create({
      data: {
        proformaInvoiceId: id,
        action: 'DETAILS_UPDATED',
        performedBy: user?.id || 'system',
        details: `Proforma Invoice ${existing.piNumber} metadata updated.`,
      },
    });

    return res;
  });

  return updated;
};

/**
 * Update line items and automatically recalculate all taxes, advance amount, and balance due.
 */
export const updateProformaInvoiceItems = async (
  id: string,
  input: UpdateProformaInvoiceItemsInput,
  user?: UserContext
) => {
  const existing = await prisma.proformaInvoice.findUnique({ where: { id, deletedAt: null } });
  if (!existing) throw new AppError('NOT_FOUND', 'Proforma Invoice not found', 404);

  const placeOfSupply = input.placeOfSupply || existing.placeOfSupply || 'Karnataka';
  const supplierState = input.supplierState || 'Delhi';
  const advancePercentage = input.advancePercentage !== undefined ? input.advancePercentage : Number(existing.advancePercentage);
  const shippingCost = input.shippingCost !== undefined ? input.shippingCost : Number(existing.shippingCost || 0);

  const gstCalculations = calculateProformaGST(
    input.items,
    supplierState,
    placeOfSupply,
    shippingCost,
    advancePercentage
  );

  const updated = await prisma.$transaction(async (tx) => {
    // Delete existing items
    await tx.proformaInvoiceItem.deleteMany({ where: { proformaInvoiceId: id } });

    // Update Proforma Header
    const pi = await tx.proformaInvoice.update({
      where: { id },
      data: {
        placeOfSupply,
        subtotal: gstCalculations.subtotal,
        taxableAmount: gstCalculations.taxableAmount,
        cgst: gstCalculations.cgst,
        sgst: gstCalculations.sgst,
        igst: gstCalculations.igst,
        cess: gstCalculations.cess,
        discount: gstCalculations.discount,
        shippingCost: gstCalculations.shippingCost,
        roundOff: gstCalculations.roundOff,
        grandTotal: gstCalculations.grandTotal,
        advancePercentage: gstCalculations.advancePercentage,
        advanceAmount: gstCalculations.advanceAmount,
        balanceDue: gstCalculations.balanceDue,
        updatedBy: user?.id || 'system',
        items: {
          create: gstCalculations.items.map((item) => ({
            productId: item.productId,
            sku: item.sku,
            productName: item.productName,
            description: item.description,
            hsnCode: item.hsnCode,
            unit: item.unit,
            quantity: item.quantity,
            unitRate: item.unitRate,
            discountPercent: item.discountPercent,
            taxableAmount: item.taxableAmount,
            cgstRate: item.cgstRate,
            cgstAmount: item.cgstAmount,
            sgstRate: item.sgstRate,
            sgstAmount: item.sgstAmount,
            igstRate: item.igstRate,
            igstAmount: item.igstAmount,
            lineTotal: item.lineTotal,
          })),
        },
      },
      include: { items: true, history: true },
    });

    await tx.proformaInvoiceHistory.create({
      data: {
        proformaInvoiceId: id,
        action: 'LINE_ITEMS_UPDATED',
        performedBy: user?.id || 'system',
        details: `Line items modified on PI ${existing.piNumber}. New Grand Total: ₹${gstCalculations.grandTotal}.`,
        metadata: {
          itemsCount: gstCalculations.items.length,
          grandTotal: gstCalculations.grandTotal,
          advanceAmount: gstCalculations.advanceAmount,
        },
      },
    });

    return pi;
  });

  return updated;
};

/**
 * Update Status Lifecycle.
 */
export const updateProformaInvoiceStatus = async (
  id: string,
  input: UpdateProformaInvoiceStatusInput,
  user?: UserContext
) => {
  const existing = await prisma.proformaInvoice.findUnique({ where: { id, deletedAt: null } });
  if (!existing) throw new AppError('NOT_FOUND', 'Proforma Invoice not found', 404);

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.proformaInvoice.update({
      where: { id },
      data: {
        status: input.status,
        approvedAt: input.status === 'APPROVED' ? new Date() : undefined,
        approvedBy: input.status === 'APPROVED' ? user?.id || 'system' : undefined,
        sentAt: input.status === 'SENT' ? new Date() : undefined,
        cancelledAt: input.status === 'CANCELLED' ? new Date() : undefined,
        cancelledReason: input.status === 'CANCELLED' ? input.reason || input.notes || 'Cancelled by admin' : undefined,
        updatedBy: user?.id || 'system',
      },
      include: { items: true, history: true },
    });

    await tx.proformaInvoiceHistory.create({
      data: {
        proformaInvoiceId: id,
        action: `STATUS_${input.status}`,
        performedBy: user?.id || 'system',
        details: `Status transitioned from ${existing.status} to ${input.status}. Reason: ${input.reason || input.notes || 'N/A'}.`,
        metadata: { previousStatus: existing.status, newStatus: input.status },
      },
    });

    return res;
  });

  return updated;
};

/**
 * Digitally Sign, Authenticate with HMAC-SHA256, and generate QR verification seal.
 */
export const digitallySignProformaInvoice = async (
  id: string,
  input: SignProformaInvoiceInput,
  user?: UserContext
) => {
  const pi = await prisma.proformaInvoice.findUnique({
    where: { id, deletedAt: null },
    include: { items: true },
  });

  if (!pi) throw new AppError('NOT_FOUND', 'Proforma Invoice not found', 404);

  const signedAt = new Date();
  const signedBy = input.signerName || 'Authorized Signatory, PRC Hardware';

  const signature = computeProformaSignature({
    piNumber: pi.piNumber,
    financialYear: pi.financialYear,
    customerName: pi.customerName,
    companyName: pi.companyName,
    gstin: pi.gstin,
    grandTotal: Number(pi.grandTotal),
    advanceAmount: Number(pi.advanceAmount),
    signedBy,
    signedAt,
  });

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.proformaInvoice.update({
      where: { id },
      data: {
        digitalSignature: signature,
        signedBy,
        signedAt,
        status: ProformaInvoiceStatus.APPROVED,
        approvedBy: user?.id || 'system',
        approvedAt: signedAt,
      },
      include: { items: true, history: true },
    });

    await tx.proformaInvoiceHistory.create({
      data: {
        proformaInvoiceId: id,
        action: 'DIGITALLY_SIGNED_AND_APPROVED',
        performedBy: user?.id || 'system',
        details: `Cryptographically signed and approved by ${signedBy}.`,
        metadata: { signature: signature.slice(0, 20) + '...', signedBy, signedAt: signedAt.toISOString() },
      },
    });

    return res;
  });

  return updated;
};

/**
 * Generate on-the-fly binary PDF Buffer for download.
 */
export const generateProformaPdfBuffer = async (id: string, _user?: UserContext): Promise<Buffer> => {
  const pi = await prisma.proformaInvoice.findFirst({
    where: {
      OR: [{ id }, { piNumber: id }, { verificationToken: id }],
      deletedAt: null,
    },
    include: { items: true },
  });

  if (!pi) throw new AppError('NOT_FOUND', 'Proforma Invoice not found', 404);

  return generateProformaPdf(pi as any);
};

/**
 * Email Proforma Invoice PDF to customer.
 */
export const emailProformaInvoice = async (
  id: string,
  input: SendProformaInvoiceEmailInput,
  user?: UserContext
) => {
  const pi = await prisma.proformaInvoice.findUnique({
    where: { id, deletedAt: null },
    include: { items: true },
  });

  if (!pi) throw new AppError('NOT_FOUND', 'Proforma Invoice not found', 404);

  const targetEmail = input.email || pi.customerEmail;
  const pdfBuffer = await generateProformaPdf(pi as any);

  const subject = `Commercial Proforma Invoice #${pi.piNumber} - PRC Hardware`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="background: #0f172a; padding: 24px; color: #ffffff;">
        <h1 style="margin: 0; font-size: 20px; color: #f59e0b;">PRC Hardware</h1>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">Commercial Proforma Invoice & Order Confirmation</p>
      </div>
      <div style="padding: 24px; background: #ffffff;">
        <p style="font-size: 14px;">Dear <strong>${pi.customerName}</strong>,</p>
        <p style="font-size: 13px; color: #334155; line-height: 1.5;">
          Please find attached your official Commercial Proforma Invoice <strong>${pi.piNumber}</strong>.
        </p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; font-size: 13px;">
            <tr><td><strong>PI Number:</strong></td><td style="text-align: right; color: #d97706; font-weight: bold;">${pi.piNumber}</td></tr>
            <tr><td><strong>Grand Total:</strong></td><td style="text-align: right; font-weight: bold;">₹${Number(pi.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
            <tr><td><strong>Advance Payable (${Number(pi.advancePercentage)}%):</strong></td><td style="text-align: right; color: #047857; font-weight: bold;">₹${Number(pi.advanceAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
            <tr><td><strong>Balance Due at Dispatch:</strong></td><td style="text-align: right; color: #475569;">₹${Number(pi.balanceDue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
          </table>
        </div>
        ${input.message ? `<p style="font-size: 13px; color: #334155; background: #fffbeb; padding: 12px; border-left: 4px solid #f59e0b;">${input.message}</p>` : ''}
        <p style="font-size: 12px; color: #64748b;">
          Bank remittance and RTGS/NEFT transfer details are included on page 1 of the attached PDF. Kindly share the payment receipt once initiated.
        </p>
      </div>
      <div style="background: #f8fafc; padding: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center;">
        Pacific Products and Solutions | H-3, J.R. Complex, Gate No 4, Mela Ram Farm, Mandoli, Delhi - 110093
      </div>
    </div>
  `;

  await sendMail({
    to: targetEmail,
    cc: input.cc,
    subject,
    html,
    attachments: [
      {
        filename: `Proforma-Invoice-${pi.piNumber.replace(/[\/\\]/g, '-')}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  await prisma.proformaInvoiceHistory.create({
    data: {
      proformaInvoiceId: id,
      action: 'EMAILED_TO_CUSTOMER',
      performedBy: user?.id || 'system',
      details: `Proforma Invoice PDF successfully emailed to ${targetEmail}.`,
      metadata: { targetEmail, subject },
    },
  });

  await prisma.proformaInvoice.update({
    where: { id },
    data: { sentAt: new Date(), status: ProformaInvoiceStatus.SENT },
  });

  return { success: true, message: `Proforma Invoice emailed successfully to ${targetEmail}` };
};

/**
 * Converts approved/paid PI into a final GST Tax Invoice.
 */
export const convertToTaxInvoice = async (id: string, user?: UserContext) => {
  const pi = await prisma.proformaInvoice.findUnique({
    where: { id, deletedAt: null },
    include: { items: true },
  });

  if (!pi) throw new AppError('NOT_FOUND', 'Proforma Invoice not found', 404);

  // Mark as converted
  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.proformaInvoice.update({
      where: { id },
      data: {
        status: ProformaInvoiceStatus.CONVERTED_TO_INVOICE,
        convertedAt: new Date(),
        updatedBy: user?.id || 'system',
      },
    });

    await tx.proformaInvoiceHistory.create({
      data: {
        proformaInvoiceId: id,
        action: 'CONVERTED_TO_TAX_INVOICE',
        performedBy: user?.id || 'system',
        details: `Converted Proforma Invoice ${pi.piNumber} to GST Tax Invoice.`,
      },
    });

    return res;
  });

  return updated;
};

/**
 * Public QR Code Scan Verification Resolver.
 * Resolves by verificationToken, verificationId, piNumber, documentHash, or full URL containing a token.
 */
export const verifyProformaInvoiceToken = async (rawInput: string): Promise<ProformaVerificationResult> => {
  let q = (rawInput || '').trim();

  // Extract token from full URL if pasted
  const urlMatch = q.match(/\/verify\/pi\/([a-zA-Z0-9_-]+)/i) || q.match(/\/proforma\/([a-zA-Z0-9_-]+)/i);
  if (urlMatch && urlMatch[1]) {
    q = urlMatch[1];
  }

  const pi = await prisma.proformaInvoice.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { verificationToken: q },
        { verificationId: { equals: q, mode: 'insensitive' } },
        { piNumber: { equals: q, mode: 'insensitive' } },
        { documentHash: { equals: q, mode: 'insensitive' } },
        { id: q },
      ],
    },
    include: { items: true },
  });

  if (!pi) {
    throw new AppError('NOT_FOUND', 'No official Proforma Invoice found matching this verification token or identifier.', 404);
  }

  return verifyProformaSignatureRecord(pi);
};

/**
 * Cryptographic Signature Verification.
 */
export const verifyProformaInvoiceSignature = async (input: VerifySignatureInput): Promise<ProformaVerificationResult> => {
  const pi = await prisma.proformaInvoice.findFirst({
    where: { piNumber: input.piNumber.trim(), deletedAt: null },
    include: { items: true },
  });

  if (!pi) {
    throw new AppError('NOT_FOUND', `Proforma Invoice ${input.piNumber} not found in official ledger.`, 404);
  }

  return verifyProformaSignatureRecord({
    ...pi,
    digitalSignature: input.digitalSignature || input.signature || pi.digitalSignature || '',
  });
};

/**
 * Comprehensive Document Tamper Analysis Engine for Admin Panel.
 * Validates whether a printed or scanned document has been manipulated by comparing
 * claimed physical/PDF attributes against the immutable database record & cryptographic signature.
 */
export const validateDocumentTamper = async (input: ValidateTamperInput, user?: UserContext) => {
  let q = (input.query || '').trim();

  const urlMatch = q.match(/\/verify\/pi\/([a-zA-Z0-9_-]+)/i) || q.match(/\/proforma\/([a-zA-Z0-9_-]+)/i);
  if (urlMatch && urlMatch[1]) {
    q = urlMatch[1];
  }

  const pi = await prisma.proformaInvoice.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { verificationToken: q },
        { verificationId: { equals: q, mode: 'insensitive' } },
        { piNumber: { equals: q, mode: 'insensitive' } },
        { documentHash: { equals: q, mode: 'insensitive' } },
        { id: q },
      ],
    },
    include: {
      items: true,
      customer: {
        select: { id: true, firstName: true, lastName: true, companyName: true, email: true, phone: true, gstin: true },
      },
    },
  });

  if (!pi) {
    return {
      success: false,
      verdict: 'DOCUMENT_NOT_FOUND',
      isTampered: true,
      message: 'Unknown document. No record with this token, verification ID, hash, or invoice number exists in PRC Hardware registry.',
      discrepancies: [
        {
          field: 'DOCUMENT_RECORD',
          originalValue: 'EXISTS',
          claimedValue: 'NOT_FOUND',
          status: 'MISMATCH',
          message: 'This document was not issued by Pacific Products and Solutions or may be completely forged.',
        },
      ],
    };
  }

  const cryptoResult = verifyProformaSignatureRecord(pi);
  const discrepancies: Array<{
    field: string;
    originalValue: any;
    claimedValue: any;
    status: 'MATCH' | 'MISMATCH';
    message: string;
  }> = [];

  // Check 1: Grand Total
  if (input.claimedTotal !== undefined && input.claimedTotal !== null) {
    const origTotal = Number(pi.grandTotal || 0);
    const claimedTotal = Number(input.claimedTotal);
    if (Math.abs(origTotal - claimedTotal) > 0.01) {
      discrepancies.push({
        field: 'GRAND_TOTAL',
        originalValue: `₹${origTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        claimedValue: `₹${claimedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        status: 'MISMATCH',
        message: `Grand Total discrepancy: Original is ₹${origTotal.toFixed(2)}, but document claims ₹${claimedTotal.toFixed(2)}.`,
      });
    } else {
      discrepancies.push({
        field: 'GRAND_TOTAL',
        originalValue: `₹${origTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        claimedValue: `₹${claimedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        status: 'MATCH',
        message: 'Grand Total matches official ledger.',
      });
    }
  }

  // Check 2: Advance Amount
  if (input.claimedAdvance !== undefined && input.claimedAdvance !== null) {
    const origAdv = Number(pi.advanceAmount || 0);
    const claimedAdv = Number(input.claimedAdvance);
    if (Math.abs(origAdv - claimedAdv) > 0.01) {
      discrepancies.push({
        field: 'ADVANCE_AMOUNT',
        originalValue: `₹${origAdv.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        claimedValue: `₹${claimedAdv.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        status: 'MISMATCH',
        message: `Advance Amount discrepancy: Original is ₹${origAdv.toFixed(2)}, but document claims ₹${claimedAdv.toFixed(2)}.`,
      });
    } else {
      discrepancies.push({
        field: 'ADVANCE_AMOUNT',
        originalValue: `₹${origAdv.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        claimedValue: `₹${claimedAdv.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        status: 'MATCH',
        message: 'Advance Amount matches official ledger.',
      });
    }
  }

  // Check 3: GSTIN
  if (input.claimedGstin) {
    const origGstin = (pi.gstin || '').trim().toUpperCase();
    const claimedGstin = input.claimedGstin.trim().toUpperCase();
    if (origGstin && origGstin !== claimedGstin) {
      discrepancies.push({
        field: 'GSTIN',
        originalValue: origGstin || 'None',
        claimedValue: claimedGstin,
        status: 'MISMATCH',
        message: `Customer GSTIN mismatch: Original registered GSTIN is ${origGstin}, claimed is ${claimedGstin}.`,
      });
    } else if (origGstin) {
      discrepancies.push({
        field: 'GSTIN',
        originalValue: origGstin,
        claimedValue: claimedGstin,
        status: 'MATCH',
        message: 'Customer GSTIN matches official ledger.',
      });
    }
  }

  // Check 4: Customer / Company Name
  if (input.claimedCustomer) {
    const origCustomer = (pi.customerName || pi.companyName || '').trim().toLowerCase();
    const claimedCustomer = input.claimedCustomer.trim().toLowerCase();
    if (!origCustomer.includes(claimedCustomer) && !claimedCustomer.includes(origCustomer)) {
      discrepancies.push({
        field: 'CUSTOMER_NAME',
        originalValue: pi.customerName || pi.companyName || 'N/A',
        claimedValue: input.claimedCustomer,
        status: 'MISMATCH',
        message: `Buyer entity mismatch: Issued to '${pi.customerName}', claimed is '${input.claimedCustomer}'.`,
      });
    } else {
      discrepancies.push({
        field: 'CUSTOMER_NAME',
        originalValue: pi.customerName || pi.companyName || 'N/A',
        claimedValue: input.claimedCustomer,
        status: 'MATCH',
        message: 'Buyer entity name matches.',
      });
    }
  }

  // Check 5: Items Count
  if (input.claimedItemsCount !== undefined && input.claimedItemsCount !== null) {
    const origCount = pi.items.length;
    const claimedCount = Number(input.claimedItemsCount);
    if (origCount !== claimedCount) {
      discrepancies.push({
        field: 'ITEMS_COUNT',
        originalValue: `${origCount} line items`,
        claimedValue: `${claimedCount} line items`,
        status: 'MISMATCH',
        message: `Line items count mismatch: Original invoice has ${origCount} items, document claims ${claimedCount}.`,
      });
    } else {
      discrepancies.push({
        field: 'ITEMS_COUNT',
        originalValue: `${origCount} line items`,
        claimedValue: `${claimedCount} line items`,
        status: 'MATCH',
        message: 'Line items count matches.',
      });
    }
  }

  const hasFieldMismatch = discrepancies.some((d) => d.status === 'MISMATCH');
  const isTampered = cryptoResult.tamperDetected || hasFieldMismatch;

  let verdict: 'AUTHENTIC' | 'MANIPULATED' | 'UNSIGNED_DRAFT' = 'AUTHENTIC';
  if (isTampered) {
    verdict = 'MANIPULATED';
  } else if (!cryptoResult.isValid) {
    verdict = 'UNSIGNED_DRAFT';
  }

  // Audit this scan
  await prisma.proformaInvoiceHistory.create({
    data: {
      proformaInvoiceId: pi.id,
      action: 'ADMIN_QR_VALIDATED',
      performedBy: user?.id || 'admin-scan',
      details: `Admin QR Scanner executed tamper check. Verdict: ${verdict}. Tamper Detected: ${isTampered}.`,
      metadata: {
        verdict,
        isTampered,
        scannedBy: user?.email || user?.id || 'system',
        discrepanciesCount: discrepancies.filter((d) => d.status === 'MISMATCH').length,
      },
    },
  });

  return {
    success: true,
    verdict,
    isTampered,
    cryptoResult,
    discrepancies,
    document: {
      id: pi.id,
      piNumber: pi.piNumber,
      financialYear: pi.financialYear,
      status: pi.status,
      customerName: pi.customerName,
      companyName: pi.companyName,
      customerEmail: pi.customerEmail,
      customerPhone: pi.customerPhone,
      gstin: pi.gstin,
      billingAddress: pi.billingAddress,
      shippingAddress: pi.shippingAddress,
      placeOfSupply: pi.placeOfSupply,
      subtotal: Number(pi.subtotal || 0),
      taxableAmount: Number(pi.taxableAmount || 0),
      cgst: Number(pi.cgst || 0),
      sgst: Number(pi.sgst || 0),
      igst: Number(pi.igst || 0),
      grandTotal: Number(pi.grandTotal || 0),
      advancePercentage: Number(pi.advancePercentage || 30),
      advanceAmount: Number(pi.advanceAmount || 0),
      balanceDue: Number(pi.balanceDue || 0),
      verificationId: pi.verificationId,
      verificationToken: pi.verificationToken,
      documentHash: pi.documentHash,
      digitalSignature: pi.digitalSignature,
      signedBy: pi.signedBy,
      signedAt: pi.signedAt ? pi.signedAt.toISOString() : null,
      qrCodeDataUrl: pi.qrCodeDataUrl,
      createdAt: pi.createdAt.toISOString(),
      validUntil: pi.validUntil ? pi.validUntil.toISOString() : null,
      items: pi.items.map((it) => ({
        id: it.id,
        sku: it.sku,
        productName: it.productName,
        quantity: Number(it.quantity),
        unit: it.unit,
        unitRate: Number(it.unitRate),
        lineTotal: Number(it.lineTotal),
      })),
    },
    message: isTampered
      ? '🚨 TAMPER DETECTED! Discrepancies found between document claims and official cryptographic ledger.'
      : verdict === 'UNSIGNED_DRAFT'
      ? '⚠️ Document is a valid draft record in database but has not yet been digitally signed.'
      : '✅ AUTHENTIC DOCUMENT. Cryptographically verified against official PRC Hardware digital trust database.',
  };
};

/**
 * Soft Delete / Void Proforma Invoice.
 */
export const deleteProformaInvoice = async (id: string, user?: UserContext) => {
  const pi = await prisma.proformaInvoice.findUnique({ where: { id, deletedAt: null } });
  if (!pi) throw new AppError('NOT_FOUND', 'Proforma Invoice not found', 404);

  await prisma.$transaction(async (tx) => {
    await tx.proformaInvoice.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: ProformaInvoiceStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledReason: 'Deleted by administrator',
        updatedBy: user?.id || 'system',
      },
    });

    await tx.proformaInvoiceHistory.create({
      data: {
        proformaInvoiceId: id,
        action: 'DELETED',
        performedBy: user?.id || 'system',
        details: `Proforma Invoice ${pi.piNumber} voided and soft deleted.`,
      },
    });
  });

  return { success: true, message: `Proforma Invoice ${pi.piNumber} deleted successfully.` };
};

/**
 * Public: Customer Submits Feedback / Acceptance / Advance Payment Reference for an Issued PI.
 * (Customers cannot generate or create a PI from storefront; they can only view, download, and respond to an issued PI).
 */
export const submitCustomerFeedback = async (
  token: string,
  input: {
    action: 'ACCEPT' | 'REQUEST_CHANGE' | 'QUERY' | 'PAYMENT_SUBMITTED';
    feedbackComments: string;
    advancePaymentRef?: string | null;
    paymentReceiptUrl?: string | null;
    contactPhone?: string | null;
    customerName?: string | null;
  }
) => {
  const pi = await prisma.proformaInvoice.findFirst({
    where: { verificationToken: token, deletedAt: null },
    include: { items: true },
  });

  if (!pi) {
    throw new AppError('NOT_FOUND', 'Proforma Invoice not found or link has expired.', 404);
  }

  // Determine updated status
  let newStatus: ProformaInvoiceStatus = pi.status;
  if (input.action === 'ACCEPT') {
    newStatus = ProformaInvoiceStatus.ACCEPTED;
  } else if (input.action === 'PAYMENT_SUBMITTED' || (input.advancePaymentRef && input.advancePaymentRef.trim())) {
    newStatus = ProformaInvoiceStatus.ADVANCE_RECEIVED;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.proformaInvoice.update({
      where: { id: pi.id },
      data: {
        status: newStatus,
        customerPhone: input.contactPhone || pi.customerPhone,
        notes: pi.notes
          ? `${pi.notes}\n[Customer Feedback - ${new Date().toLocaleDateString('en-IN')}]: ${input.feedbackComments}${input.advancePaymentRef ? ` (Advance Ref: ${input.advancePaymentRef})` : ''}`
          : `[Customer Feedback - ${new Date().toLocaleDateString('en-IN')}]: ${input.feedbackComments}${input.advancePaymentRef ? ` (Advance Ref: ${input.advancePaymentRef})` : ''}`,
      },
      include: { items: true, history: true },
    });

    await tx.proformaInvoiceHistory.create({
      data: {
        proformaInvoiceId: pi.id,
        action: `CUSTOMER_${input.action}`,
        performedBy: input.customerName || pi.customerName || 'Customer',
        details: `Customer submitted feedback for PI ${pi.piNumber}. Action: ${input.action}. Comments: ${input.feedbackComments}.${input.advancePaymentRef ? ` Advance Payment UTR: ${input.advancePaymentRef}.` : ''}`,
        metadata: {
          action: input.action,
          feedbackComments: input.feedbackComments,
          advancePaymentRef: input.advancePaymentRef || null,
          paymentReceiptUrl: input.paymentReceiptUrl || null,
          previousStatus: pi.status,
          newStatus,
        },
      },
    });

    return res;
  });

  let message = 'Thank you! Your feedback has been submitted successfully to PRC Hardware.';
  if (input.action === 'ACCEPT') {
    message = 'Proforma Invoice accepted successfully. Our commercial team has been notified.';
  } else if (input.action === 'PAYMENT_SUBMITTED' || input.advancePaymentRef) {
    message = `Advance payment reference (${input.advancePaymentRef}) submitted successfully. Our accounts desk will verify the remittance.`;
  }

  return {
    success: true,
    data: updated,
    message,
  };
};

