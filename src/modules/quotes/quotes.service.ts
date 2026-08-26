import crypto from 'crypto';
import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { buildPagination, getPaginationParams } from '../../utils/response';
import { QuoteStatus, Prisma } from '@prisma/client';
import { generateNextQuotationReferenceNo } from './quotation-numbering.service';
import {
  computeQuotationSignature,
  generateQuotationQrCode,
  verifyQuotationSignature,
  VerificationResult,
} from './quotation-signature.service';
import {
  sendQuotationSubmittedEmail,
  sendQuotationApprovedEmail,
  sendQuotationApprovedEmailWithPdf,
} from './quotation-email.service';
import { generateQuotationPdf } from './quotation-pdf.service';
import { env } from '../../config/env';
import type {
  CreateB2BQuoteInput,
  CustomerEditQuoteInput,
  AdminUpdateQuoteStatusInput,
  AdminUpdateQuoteItemsInput,
  SignQuoteInput,
  ListQuotesQuery,
} from './quotes.schema';

interface AdminContext {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  roleSlug?: string;
}

const safeLogActivity = async (data: {
  quoteId: string;
  changedBy?: string | null;
  changeType: string;
  note: string;
  oldValue?: any;
  newValue?: any;
}) => {
  try {
    if ((prisma as any).quoteActivityLog) {
      await (prisma as any).quoteActivityLog.create({
        data: {
          quoteId: data.quoteId,
          changedBy: data.changedBy || null,
          changeType: data.changeType,
          note: data.note,
          oldValue: data.oldValue || undefined,
          newValue: data.newValue || undefined,
        },
      });
    }
  } catch (err) {
    console.warn(`[QuotesService] Non-critical activity log not recorded: ${err}`);
  }
};

const formatQuoteItem = (item: any) => ({
  id: item.id,
  quoteId: item.quoteId,
  slNo: item.slNo,
  productId: item.productId,
  productNameSnapshot: item.productNameSnapshot || item.product?.name || 'Hardware Product',
  variantId: item.variantId,
  unit: item.unit || 'PCS',
  quantity: item.quantity,
  rate: item.rate !== null ? Number(item.rate) : item.product?.price ? Number(item.product.price) : 0,
  amount: item.amount !== null ? Number(item.amount) : 0,
  product: item.product
    ? {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        sku: item.product.sku,
        price: Number(item.product.price),
        salePrice: item.product.salePrice ? Number(item.product.salePrice) : null,
        thumbnail: item.product.thumbnail,
      }
    : undefined,
});

export const formatQuote = (q: any) => {
  if (!q) return null;
  const editCount = q.customerEditCount !== undefined && q.customerEditCount !== null ? Number(q.customerEditCount) : 0;
  const canCustomerEdit = q.status === 'APPROVED' && editCount === 0 && (!q.customerResponse || q.customerResponse === 'pending');

  return {
    id: q.id,
    quoteNumber: q.quoteNumber,
    referenceNo: q.referenceNo || q.quoteNumber,
    financialYear: q.financialYear,
    sequenceNo: q.sequenceNo,
    projectName: q.projectName || 'Commercial Hardware Project',
    firstName: q.firstName || q.user?.firstName || '',
    lastName: q.lastName || q.user?.lastName || '',
    companyName: q.companyName || q.user?.companyName || '',
    gstNo: q.gstNo || q.user?.gstin || '',
    email: q.email || q.user?.email || '',
    phone: q.phone || q.user?.phone || '',
    userId: q.userId,
    status: q.status,
    statusReason: q.statusReason,
    basicPrice: q.basicPrice !== null ? Number(q.basicPrice) : Number(q.subtotal || 0),
    gstAmount: q.gstAmount !== null ? Number(q.gstAmount) : Number(q.taxTotal || 0),
    shippingCost: q.shippingCost !== null ? Number(q.shippingCost) : null,
    subtotal: q.subtotal !== null ? Number(q.subtotal) : Number(q.basicPrice || 0),
    discountTotal: q.discountTotal !== null ? Number(q.discountTotal) : 0,
    taxTotal: q.taxTotal !== null ? Number(q.taxTotal) : Number(q.gstAmount || 0),
    grandTotal: q.grandTotal !== null ? Number(q.grandTotal) : 0,
    advancePercentage: q.advancePercentage !== null && q.advancePercentage !== undefined ? Number(q.advancePercentage) : null,
    customerProposedAdvancePercent:
      q.customerProposedAdvancePercent !== null && q.customerProposedAdvancePercent !== undefined
        ? Number(q.customerProposedAdvancePercent)
        : null,
    customerEditCount: editCount,
    customerEditRemark: q.customerEditRemark || null,
    canCustomerEdit,
    notes: q.notes,
    adminNotes: q.adminNotes,
    termsAccepted: q.termsAccepted,
    customerResponse: q.customerResponse || 'pending',
    customerResponseNotes: q.customerResponseNotes,
    customerResponseAt: q.customerResponseAt,
    accessToken: q.accessToken,
    digitalSignature: q.digitalSignature,
    signedBy: q.signedBy,
    signedAt: q.signedAt,
    qrCodeData: q.qrCodeData,
    validUntil: q.validUntil,
    isDeleted: q.isDeleted,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
    items: q.items ? q.items.map(formatQuoteItem) : [],
    activityLogs: q.activityLogs || [],
    revisions: q.revisions
      ? q.revisions.map((r: any) => ({
          id: r.id,
          quoteId: r.quoteId,
          changedBy: r.changedBy,
          changedById: r.changedById,
          previousValues: r.previousValues,
          newValues: r.newValues,
          remark: r.remark,
          createdAt: r.createdAt,
        }))
      : [],
    user: q.user
      ? {
          id: q.user.id,
          email: q.user.email,
          firstName: q.user.firstName,
          lastName: q.user.lastName,
          phone: q.user.phone,
          companyName: q.user.companyName,
          gstin: q.user.gstin,
        }
      : undefined,
  };
};

/**
 * 1. Public / B2B Submission of an RFQ Quotation
 */
export const createB2BQuote = async (input: CreateB2BQuoteInput, userId?: string) => {
  // 1. Validate line items products against database
  const productIds = input.items.map((i) => i.productId);
  const existingProducts = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      status: 'ACTIVE',
      isVisible: true,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      price: true,
      salePrice: true,
      offerPrice: true,
      sku: true,
    },
  });

  if (existingProducts.length === 0) {
    throw new AppError('BAD_REQUEST', 'No valid active products were found in your quotation request', 400);
  }

  const productMap = new Map(existingProducts.map((p) => [p.id, p]));

  let b2bPriceMap = new Map<string, number>();
  if (userId) {
    const userB2BPrices = await prisma.b2BCustomerPrice.findMany({
      where: { userId },
    });
    b2bPriceMap = new Map(userB2BPrices.map((cp) => [cp.productId, Number(cp.price)]));
  }

  // 2. Atomically generate Indian FY Reference Number (PRC-QT-2026-27/001)
  const { referenceNo, financialYear, sequenceNo } = await generateNextQuotationReferenceNo();
  const accessToken = crypto.randomBytes(24).toString('hex');

  // 3. Server-side recalculate line items, basic price, GST (18%)
  let calculatedBasicPrice = 0;
  const itemsToCreate = input.items.map((item, idx) => {
    const product = productMap.get(item.productId);
    const customB2B = b2bPriceMap.get(item.productId);
    const standardPrice = product?.salePrice
      ? Number(product.salePrice)
      : product?.price
      ? Number(product.price)
      : 0;

    const unitPrice = item.rate !== undefined && item.rate >= 0
      ? item.rate
      : (customB2B !== undefined && customB2B > 0 ? customB2B : standardPrice);

    const lineAmount = Math.round(unitPrice * item.quantity * 100) / 100;
    calculatedBasicPrice += lineAmount;

    return {
      slNo: idx + 1,
      productId: item.productId,
      variantId: item.variantId || null,
      productNameSnapshot: product?.name || item.productNameSnapshot || 'Hardware Item',
      unit: item.unit || 'PCS',
      quantity: item.quantity,
      rate: new Prisma.Decimal(unitPrice),
      amount: new Prisma.Decimal(lineAmount),
      requestedPrice: new Prisma.Decimal(unitPrice),
      offeredPrice: new Prisma.Decimal(unitPrice),
      total: new Prisma.Decimal(lineAmount),
    };
  });

  const basicPriceDecimal = Math.round(calculatedBasicPrice * 100) / 100;
  const gstAmountDecimal = Math.round(basicPriceDecimal * 0.18 * 100) / 100;
  const grandTotalDecimal = Math.round((basicPriceDecimal + gstAmountDecimal) * 100) / 100;

  // 4. Create Quote Record
  const createdQuote = await prisma.quote.create({
    data: {
      quoteNumber: referenceNo,
      referenceNo,
      financialYear,
      sequenceNo,
      projectName: input.projectName,
      firstName: input.firstName,
      lastName: input.lastName,
      companyName: input.companyName,
      gstNo: input.gstNo.toUpperCase(),
      email: input.email.toLowerCase(),
      phone: input.phone,
      userId: userId || null,
      status: QuoteStatus.PENDING,
      basicPrice: new Prisma.Decimal(basicPriceDecimal),
      gstAmount: new Prisma.Decimal(gstAmountDecimal),
      subtotal: new Prisma.Decimal(basicPriceDecimal),
      taxTotal: new Prisma.Decimal(gstAmountDecimal),
      grandTotal: new Prisma.Decimal(grandTotalDecimal),
      notes: input.notes || null,
      termsAccepted: true,
      customerResponse: 'pending',
      accessToken,
      items: {
        create: itemsToCreate,
      },
    },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  // Log activity safely in background
  safeLogActivity({
    quoteId: createdQuote.id,
    changedBy: userId || null,
    changeType: 'status_change',
    note: `Quotation ${referenceNo} submitted by B2B customer ${input.firstName} ${input.lastName} (${input.companyName})`,
    newValue: { status: 'PENDING', referenceNo, basicPrice: basicPriceDecimal, grandTotal: grandTotalDecimal },
  });

  // 5. Send Confirmation Email to Customer (Email 1 of 2 in lifecycle)
  sendQuotationSubmittedEmail({
    to: input.email,
    customerName: `${input.firstName} ${input.lastName}`,
    companyName: input.companyName,
    referenceNo,
    projectName: input.projectName,
    grandTotal: grandTotalDecimal,
    accessToken,
  }).catch((err) => console.warn('[QuotesService] Confirmation email warning:', err));

  return formatQuote(createdQuote);
};

/**
 * 2. Universal Tracking System: Lookup by Email, GSTIN, Phone, or Quotation Ref No
 */
export const trackQuotation = async (rawQuery: string) => {
  const query = rawQuery.trim();
  if (!query) {
    throw new AppError('BAD_REQUEST', 'Tracking identifier is required', 400);
  }

  const quotes = await prisma.quote.findMany({
    where: {
      isDeleted: false,
      OR: [
        { referenceNo: { equals: query, mode: 'insensitive' } },
        { quoteNumber: { equals: query, mode: 'insensitive' } },
        { email: { equals: query, mode: 'insensitive' } },
        { gstNo: { equals: query.toUpperCase() } },
        { phone: { contains: query } },
      ],
    },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, sku: true, thumbnail: true },
          },
        },
      },
      activityLogs: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return quotes.map((q) => ({
    id: q.id,
    referenceNo: q.referenceNo || q.quoteNumber,
    financialYear: q.financialYear,
    projectName: q.projectName,
    companyName: q.companyName,
    clientName: `${q.firstName || ''} ${q.lastName || ''}`.trim(),
    emailMasked: q.email ? q.email.replace(/^(.)(.*)(@.*)$/, (_m, a, b, c) => a + '*'.repeat(Math.max(b.length, 3)) + c) : '',
    phoneMasked: q.phone ? q.phone.replace(/(\d{2})\d+(\d{2})/, '$1******$2') : '',
    gstNo: q.gstNo,
    status: q.status,
    statusReason: q.statusReason,
    basicPrice: q.basicPrice !== null ? Number(q.basicPrice) : Number(q.subtotal || 0),
    gstAmount: q.gstAmount !== null ? Number(q.gstAmount) : Number(q.taxTotal || 0),
    shippingCost: q.shippingCost !== null ? Number(q.shippingCost) : null,
    grandTotal: q.grandTotal !== null ? Number(q.grandTotal) : 0,
    customerResponse: q.customerResponse,
    hasDigitalSignature: !!q.digitalSignature,
    accessToken: q.status === 'APPROVED' ? q.accessToken : undefined,
    itemCount: q.items.length,
    items: q.items.map(formatQuoteItem),
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
    activityTimeline: q.activityLogs.map((log) => ({
      changeType: log.changeType,
      note: log.note,
      createdAt: log.createdAt,
    })),
  }));
};

/**
 * 3. Public Customer Token View
 */
export const getQuoteByAccessToken = async (token: string) => {
  const quote = await prisma.quote.findFirst({
    where: {
      accessToken: token,
      isDeleted: false,
    },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, sku: true, thumbnail: true, price: true, salePrice: true },
          },
        },
      },
      activityLogs: {
        orderBy: { createdAt: 'desc' },
      },
      revisions: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!quote) {
    throw new AppError('NOT_FOUND', 'Quotation document not found or link has expired', 404);
  }

  return formatQuote(quote);
};

/**
 * 4. Customer Respond: Accept or Decline
 */
export const respondToQuoteByCustomer = async (
  token: string,
  response: 'accepted' | 'declined',
  notes?: string | null
) => {
  const quote = await prisma.quote.findFirst({
    where: { accessToken: token, isDeleted: false },
    include: { items: true },
  });

  if (!quote) {
    throw new AppError('NOT_FOUND', 'Quotation not found', 404);
  }

  if (quote.status !== QuoteStatus.APPROVED) {
    throw new AppError('BAD_REQUEST', 'Only approved quotations can be accepted or declined', 400);
  }

  if (quote.customerResponse && quote.customerResponse !== 'pending') {
    throw new AppError(
      'BAD_REQUEST',
      `You have already ${quote.customerResponse} this quotation on ${quote.customerResponseAt?.toLocaleDateString()}. Please contact support to request changes.`,
      400
    );
  }

  const updatedQuote = await prisma.quote.update({
    where: { id: quote.id },
    data: {
      customerResponse: response,
      customerResponseNotes: notes || null,
      customerResponseAt: new Date(),
      activityLogs: {
        create: {
          changeType: 'customer_response',
          note: `Customer recorded decision: ${response.toUpperCase()}${notes ? ` (Notes: ${notes})` : ''}`,
          newValue: { customerResponse: response, notes },
        },
      },
    },
    include: {
      items: {
        include: { product: true },
      },
      activityLogs: true,
      revisions: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return formatQuote(updatedQuote);
};

/**
 * 4a. Customer One-Time Edit / Advance Percentage Negotiation
 */
export const customerEditQuote = async (
  identifier: { token?: string; id?: string },
  input: CustomerEditQuoteInput,
  userId?: string
) => {
  const { advancePercentage, remark, notes } = input;

  // 1. Locate quote by access token or ID
  const quote = await prisma.quote.findFirst({
    where: {
      ...(identifier.token ? { accessToken: identifier.token } : { id: identifier.id }),
      isDeleted: false,
    },
    include: {
      items: true,
      revisions: true,
    },
  });

  if (!quote) {
    throw new AppError('NOT_FOUND', 'Quotation not found or link has expired', 404);
  }

  // 2. Validate status is APPROVED
  if (quote.status !== QuoteStatus.APPROVED) {
    throw new AppError(
      'BAD_REQUEST',
      `Only approved quotations can be revised. Current quotation status is ${quote.status}.`,
      400
    );
  }

  // 3. Strict One-time customer edit check (atomic enforcement)
  if (quote.customerEditCount && quote.customerEditCount >= 1) {
    throw new AppError(
      'BAD_REQUEST',
      'You have already used your one-time revision for this quotation. For further modifications, please contact support or adjust details at the time of PO submission.',
      400
    );
  }

  // 4. Validate customer response is still pending
  if (quote.customerResponse && quote.customerResponse !== 'pending') {
    throw new AppError(
      'BAD_REQUEST',
      `This quotation has already been ${quote.customerResponse}. Revisions cannot be submitted after a formal response.`,
      400
    );
  }

  const prevAdvance = quote.advancePercentage ? Number(quote.advancePercentage) : null;
  const previousValues = {
    status: quote.status,
    advancePercentage: prevAdvance,
    customerProposedAdvancePercent: quote.customerProposedAdvancePercent ? Number(quote.customerProposedAdvancePercent) : null,
    notes: quote.notes,
    digitalSignature: quote.digitalSignature,
  };

  const newValues = {
    status: QuoteStatus.UNDER_REVIEW,
    advancePercentage: prevAdvance,
    customerProposedAdvancePercent: advancePercentage,
    customerEditRemark: remark.trim(),
    notes: notes !== undefined && notes !== null ? notes.trim() : quote.notes,
  };

  // 5. Execute atomic database update with extended transaction timeout
  const updatedQuote = await prisma.$transaction(
    async (tx) => {
      // Create QuotationRevision log if model available
      try {
        await tx.quotationRevision.create({
          data: {
            quoteId: quote.id,
            changedBy: 'CUSTOMER',
            changedById: userId || quote.userId || null,
            previousValues,
            newValues,
            remark: remark.trim(),
          },
        });
      } catch (revErr) {
        console.warn('[QuotesService] Non-fatal revision create warning:', revErr);
      }

      // Update Quote atomically (increment customerEditCount, update status to UNDER_REVIEW, invalidate signature)
      const q = await tx.quote.update({
        where: { id: quote.id },
        data: {
          customerProposedAdvancePercent: new Prisma.Decimal(advancePercentage),
          customerEditCount: { increment: 1 },
          customerEditRemark: remark.trim(),
          status: QuoteStatus.UNDER_REVIEW,
          statusReason: `Customer requested revision: Proposed Advance ${advancePercentage}%. Reason: ${remark.trim()}`,
          notes: notes !== undefined && notes !== null ? notes.trim() : quote.notes,
          digitalSignature: null,
          signedBy: null,
          signedAt: null,
          qrCodeData: null,
          activityLogs: {
            create: {
              changedBy: userId || quote.userId || null,
              changeType: 'customer_edit',
              note: `Customer requested terms revision: Proposed Advance ${advancePercentage}% (Previous: ${prevAdvance !== null ? `${prevAdvance}%` : '30%'}). Reason: "${remark.trim()}"`,
              oldValue: previousValues,
              newValue: newValues,
            },
          },
        },
        include: {
          items: {
            include: { product: true },
          },
          activityLogs: {
            orderBy: { createdAt: 'desc' },
          },
          revisions: {
            orderBy: { createdAt: 'desc' },
          },
          user: true,
        },
      });

      return q;
    },
    {
      maxWait: 15000,
      timeout: 45000,
    }
  );

  return formatQuote(updatedQuote);
};

/**
 * 5. Admin: List All Quotes with Filters & Metrics
 */
export const listAdminQuotes = async (query: ListQuotesQuery) => {
  const { skip, limit, page } = getPaginationParams(query as any);
  const where: Prisma.QuoteWhereInput = {};

  if (query.includeDeleted !== 'true') {
    where.isDeleted = false;
  }

  if (query.status && query.status !== 'ALL') {
    const statusMap: Record<string, QuoteStatus> = {
      SUBMITTED: QuoteStatus.PENDING,
      PENDING: QuoteStatus.PENDING,
      UNDER_REVIEW: QuoteStatus.UNDER_REVIEW,
      APPROVED: QuoteStatus.APPROVED,
      REJECTED: QuoteStatus.REJECTED,
      CONVERTED: QuoteStatus.CONVERTED,
      EXPIRED: QuoteStatus.EXPIRED,
    };
    const targetStatus = statusMap[query.status.toUpperCase()] || (query.status as QuoteStatus);
    where.status = targetStatus;
  }

  if (query.search) {
    const s = query.search.trim();
    where.OR = [
      { referenceNo: { contains: s, mode: 'insensitive' } },
      { quoteNumber: { contains: s, mode: 'insensitive' } },
      { companyName: { contains: s, mode: 'insensitive' } },
      { projectName: { contains: s, mode: 'insensitive' } },
      { email: { contains: s, mode: 'insensitive' } },
      { gstNo: { contains: s, mode: 'insensitive' } },
      { firstName: { contains: s, mode: 'insensitive' } },
      { lastName: { contains: s, mode: 'insensitive' } },
      { phone: { contains: s } },
    ];
  }

  if (query.fromDate || query.toDate) {
    where.createdAt = {};
    if (query.fromDate) where.createdAt.gte = new Date(query.fromDate);
    if (query.toDate) where.createdAt.lte = new Date(query.toDate);
  }

  const [quotes, total, countPending, countUnderReview, countApproved, countRejected, countSigned] =
    await Promise.all([
      prisma.quote.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, thumbnail: true },
              },
            },
          },
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, companyName: true, gstin: true },
          },
        },
      }),
      prisma.quote.count({ where }),
      prisma.quote.count({ where: { status: QuoteStatus.PENDING, isDeleted: false } }),
      prisma.quote.count({ where: { status: QuoteStatus.UNDER_REVIEW, isDeleted: false } }),
      prisma.quote.count({ where: { status: QuoteStatus.APPROVED, isDeleted: false } }),
      prisma.quote.count({ where: { status: QuoteStatus.REJECTED, isDeleted: false } }),
      prisma.quote.count({ where: { digitalSignature: { not: null }, isDeleted: false } }),
    ]);

  return {
    data: quotes.map(formatQuote),
    pagination: buildPagination(page, limit, total),
    metrics: {
      total,
      pending: countPending,
      underReview: countUnderReview,
      approved: countApproved,
      rejected: countRejected,
      digitallySigned: countSigned,
    },
  };
};

/**
 * 6. Admin: Get Quote Detail by ID with Full Audit Trail
 */
export const getAdminQuoteById = async (id: string) => {
  let quote: any;
  try {
    quote = await prisma.quote.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
          orderBy: { slNo: 'asc' },
        },
        activityLogs: {
          include: {
            adminUser: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        revisions: {
          orderBy: { createdAt: 'desc' },
        },
        user: true,
      },
    });
  } catch {
    quote = await prisma.quote.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
          orderBy: { slNo: 'asc' },
        },
        user: true,
      },
    });
  }

  if (!quote) {
    throw new AppError('NOT_FOUND', 'Quotation not found', 404);
  }

  return formatQuote(quote);
};

/**
 * 7. Admin: Update Status with Required Reason for Pending/Rejected
 */
export const updateQuoteStatusByAdmin = async (
  id: string,
  input: AdminUpdateQuoteStatusInput,
  admin: AdminContext
) => {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!quote) {
    throw new AppError('NOT_FOUND', 'Quotation not found', 404);
  }

  const targetStatus = input.status as QuoteStatus;

  // Enforce mandatory reason for Pending or Rejected
  if (
    (targetStatus === QuoteStatus.PENDING || targetStatus === QuoteStatus.REJECTED) &&
    (!input.statusReason || !input.statusReason.trim())
  ) {
    throw new AppError(
      'BAD_REQUEST',
      `Please provide a mandatory explanatory note/reason when moving quotation to ${targetStatus}`,
      400
    );
  }

  const adminName = [admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.email || 'Admin';

  const accessToken = quote.accessToken || crypto.randomBytes(24).toString('hex');
  let digitalSignature = quote.digitalSignature;
  let qrCodeData = quote.qrCodeData;
  const signedAt = quote.signedAt || new Date();
  const signedBy = quote.signedBy || adminName;

  if (targetStatus === QuoteStatus.APPROVED && !digitalSignature) {
    const basicPrice = Number(quote.basicPrice || quote.subtotal || 0);
    const gstAmount = Math.round(basicPrice * 0.18 * 100) / 100;
    const shippingCost = quote.shippingCost !== null ? Number(quote.shippingCost) : 0;
    const grandTotal = Math.round((basicPrice + gstAmount + shippingCost) * 100) / 100;

    digitalSignature = computeQuotationSignature({
      referenceNo: quote.referenceNo || quote.quoteNumber,
      financialYear: quote.financialYear || '2026-27',
      projectName: quote.projectName || 'Project',
      companyName: quote.companyName || 'Client',
      gstNo: quote.gstNo || 'GSTIN',
      grandTotal,
      signedBy,
      signedAt,
    });

    const verificationUrl = `${env.frontend.url}/quote/${accessToken}`;
    qrCodeData = await generateQuotationQrCode(verificationUrl);
  }

  const updatedQuote = await prisma.quote.update({
    where: { id },
    data: {
      status: targetStatus,
      statusReason: input.statusReason || null,
      accessToken,
      digitalSignature: targetStatus === QuoteStatus.APPROVED ? digitalSignature : quote.digitalSignature,
      signedBy: targetStatus === QuoteStatus.APPROVED ? signedBy : quote.signedBy,
      signedAt: targetStatus === QuoteStatus.APPROVED ? signedAt : quote.signedAt,
      qrCodeData: targetStatus === QuoteStatus.APPROVED ? qrCodeData : quote.qrCodeData,
    },
    include: {
      items: { include: { product: true } },
      activityLogs: { orderBy: { createdAt: 'desc' } },
      revisions: { orderBy: { createdAt: 'desc' } },
      user: true,
    },
  });

  safeLogActivity({
    quoteId: id,
    changedBy: admin.id,
    changeType: 'status_change',
    note: `Status changed from ${quote.status} to ${targetStatus} by ${adminName}${input.statusReason ? ` (Reason: ${input.statusReason})` : ''}`,
    oldValue: { status: quote.status, reason: quote.statusReason },
    newValue: { status: targetStatus, reason: input.statusReason },
  });

  const emailContext = {
    to: quote.email || '',
    customerName: `${quote.firstName || ''} ${quote.lastName || ''}`.trim(),
    companyName: quote.companyName || 'B2B Customer',
    referenceNo: quote.referenceNo || quote.quoteNumber,
    projectName: quote.projectName || 'Hardware Project',
    grandTotal: Number(updatedQuote.grandTotal || quote.grandTotal || 0),
    advancePercentage: quote.advancePercentage ? Number(quote.advancePercentage) : 30,
    statusReason: input.statusReason || undefined,
    accessToken,
  };

  // Dispatch lifecycle notifications: Only Email 2 (Approved Quotation with PDF) is sent
  if (targetStatus === QuoteStatus.APPROVED) {
    (async () => {
      try {
        const formattedQuote = formatQuote(updatedQuote);
        const pdfBuffer = await generateQuotationPdf(formattedQuote as any);
        await sendQuotationApprovedEmailWithPdf(emailContext, pdfBuffer);
        console.log(`[QuotesService] Approval PDF emailed for quotation ${quote.referenceNo}`);
      } catch (pdfErr: any) {
        console.warn(`[QuotesService] PDF generation failed for ${quote.referenceNo}, sending HTML approval email:`, pdfErr?.message);
        sendQuotationApprovedEmail(emailContext).catch(() => {});
      }
    })();
  }

  return formatQuote(updatedQuote);
};

/**
 * 8. Admin: Revisions on Line Items & Shipping Cost
 */
export const updateQuoteItemsAndPricing = async (
  id: string,
  input: AdminUpdateQuoteItemsInput,
  admin: AdminContext
) => {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!quote) {
    throw new AppError('NOT_FOUND', 'Quotation not found', 404);
  }

  // 1. Recalculate line items server-side
  let calculatedBasicPrice = 0;
  const newItemsData = input.items.map((item, idx) => {
    const lineAmount = Math.round(item.rate * item.quantity * 100) / 100;
    calculatedBasicPrice += lineAmount;

    return {
      slNo: idx + 1,
      productId: item.productId,
      variantId: item.variantId || null,
      productNameSnapshot: item.productNameSnapshot || 'Hardware Item',
      unit: item.unit || 'PCS',
      quantity: item.quantity,
      rate: new Prisma.Decimal(item.rate),
      amount: new Prisma.Decimal(lineAmount),
      requestedPrice: new Prisma.Decimal(item.rate),
      offeredPrice: new Prisma.Decimal(item.rate),
      total: new Prisma.Decimal(lineAmount),
    };
  });

  const basicPriceDecimal = Math.round(calculatedBasicPrice * 100) / 100;
  const gstAmountDecimal = Math.round(basicPriceDecimal * 0.18 * 100) / 100;
  const shippingCostDecimal =
    input.shippingCost !== undefined && input.shippingCost !== null
      ? Math.round(input.shippingCost * 100) / 100
      : quote.shippingCost !== null
      ? Number(quote.shippingCost)
      : null;

  const grandTotalDecimal = Math.round((basicPriceDecimal + gstAmountDecimal + (shippingCostDecimal || 0)) * 100) / 100;

  const adminName = [admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.email || 'Admin';

  // 2. Perform Transaction: Replace items and update totals
  const updatedQuote = await prisma.$transaction(
    async (tx) => {
      // Delete existing items
      await tx.quoteItem.deleteMany({
        where: { quoteId: id },
      });

      // Create new updated items
      await tx.quoteItem.createMany({
        data: newItemsData.map((it) => ({ ...it, quoteId: id })),
      });

      // Update quote record
      const q = await tx.quote.update({
        where: { id },
        data: {
          basicPrice: new Prisma.Decimal(basicPriceDecimal),
          gstAmount: new Prisma.Decimal(gstAmountDecimal),
          shippingCost: shippingCostDecimal !== null ? new Prisma.Decimal(shippingCostDecimal) : null,
          subtotal: new Prisma.Decimal(basicPriceDecimal),
          taxTotal: new Prisma.Decimal(gstAmountDecimal),
          grandTotal: new Prisma.Decimal(grandTotalDecimal),
          advancePercentage:
            input.advancePercentage !== undefined && input.advancePercentage !== null
              ? new Prisma.Decimal(input.advancePercentage)
              : quote.advancePercentage,
          notes: input.notes !== undefined ? input.notes : quote.notes,
          adminNotes: input.adminNotes !== undefined ? input.adminNotes : quote.adminNotes,
          validUntil: input.validUntil ? new Date(input.validUntil) : quote.validUntil,
          // Invalidate previous signature if amount changed
          digitalSignature: null,
          signedBy: null,
          signedAt: null,
          qrCodeData: null,
        },
        include: {
          items: { include: { product: true } },
        },
      });

      return q;
    },
    {
      maxWait: 15000,
      timeout: 45000,
    }
  );

  safeLogActivity({
    quoteId: id,
    changedBy: admin.id,
    changeType: 'item_edit',
    note: `Line items and pricing updated by ${adminName}. New Basic: ₹${basicPriceDecimal}, Shipping: ${shippingCostDecimal !== null ? `₹${shippingCostDecimal}` : 'At actual'}, Grand Total: ₹${grandTotalDecimal}`,
    oldValue: { basicPrice: quote.basicPrice, grandTotal: quote.grandTotal, shippingCost: quote.shippingCost },
    newValue: { basicPrice: basicPriceDecimal, grandTotal: grandTotalDecimal, shippingCost: shippingCostDecimal },
  });

  return formatQuote(updatedQuote);
};

/**
 * 9. Admin: Digitally Sign, Generate QR Code, and Approve Quotation
 */
export const digitallySignAndApproveQuote = async (
  id: string,
  input: SignQuoteInput,
  admin: AdminContext
) => {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { items: { include: { product: true } } },
  });

  if (!quote) {
    throw new AppError('NOT_FOUND', 'Quotation not found', 404);
  }

  if (quote.items.length === 0) {
    throw new AppError('BAD_REQUEST', 'Cannot approve an empty quotation without line items', 400);
  }

  const adminName = [admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.email || 'Authorised Signatory';
  const signedAt = new Date();

  // Update shipping if provided
  let shippingCostDecimal = quote.shippingCost !== null ? Number(quote.shippingCost) : 0;
  if (input.shippingCost !== undefined && input.shippingCost !== null) {
    shippingCostDecimal = Math.round(input.shippingCost * 100) / 100;
  }

  const basicPrice = Number(quote.basicPrice || quote.subtotal || 0);
  const gstAmount = Math.round(basicPrice * 0.18 * 100) / 100;
  const grandTotal = Math.round((basicPrice + gstAmount + shippingCostDecimal) * 100) / 100;

  const accessToken = quote.accessToken || crypto.randomBytes(24).toString('hex');
  const referenceNo = quote.referenceNo || quote.quoteNumber;

  // 1. Generate Cryptographic HMAC-SHA256 Digital Signature
  const digitalSignature = computeQuotationSignature({
    referenceNo,
    financialYear: quote.financialYear || '2026-27',
    projectName: quote.projectName || 'Project',
    companyName: quote.companyName || 'Client',
    gstNo: quote.gstNo || 'GSTIN',
    grandTotal,
    signedBy: adminName,
    signedAt,
  });

  // 2. Generate Verification QR Code
  const verificationUrl = `${env.frontend.url}/quote/${accessToken}`;
  const qrCodeData = await generateQuotationQrCode(verificationUrl);

  const finalAdvancePercent =
    input.advancePercentage !== undefined && input.advancePercentage !== null
      ? input.advancePercentage
      : quote.advancePercentage
      ? Number(quote.advancePercentage)
      : 30;

  // 3. Update Quote to APPROVED with signature and QR code
  const updatedQuote = await prisma.quote.update({
    where: { id },
    data: {
      status: QuoteStatus.APPROVED,
      statusReason: null,
      shippingCost: new Prisma.Decimal(shippingCostDecimal),
      basicPrice: new Prisma.Decimal(basicPrice),
      gstAmount: new Prisma.Decimal(gstAmount),
      subtotal: new Prisma.Decimal(basicPrice),
      taxTotal: new Prisma.Decimal(gstAmount),
      grandTotal: new Prisma.Decimal(grandTotal),
      advancePercentage: new Prisma.Decimal(finalAdvancePercent),
      accessToken,
      digitalSignature,
      signedBy: adminName,
      signedAt,
      qrCodeData,
      adminNotes: input.adminNotes !== undefined ? input.adminNotes : quote.adminNotes,
    },
    include: {
      items: { include: { product: true } },
      activityLogs: { orderBy: { createdAt: 'desc' } },
      revisions: { orderBy: { createdAt: 'desc' } },
      user: true,
    },
  });

  // If customer had submitted a proposed advance %, log the admin acceptance in revisions
  if (quote.customerProposedAdvancePercent !== null && quote.customerProposedAdvancePercent !== undefined) {
    try {
      await prisma.quotationRevision.create({
        data: {
          quoteId: id,
          changedBy: 'ADMIN',
          changedById: admin.id,
          previousValues: {
            status: quote.status,
            advancePercentage: quote.advancePercentage ? Number(quote.advancePercentage) : null,
            customerProposedAdvancePercent: Number(quote.customerProposedAdvancePercent),
            customerEditRemark: quote.customerEditRemark,
          },
          newValues: {
            status: QuoteStatus.APPROVED,
            advancePercentage: finalAdvancePercent,
            grandTotal,
            signedBy: adminName,
            signedAt,
          },
          remark: `Quotation approved and digitally signed with ${finalAdvancePercent}% advance payment terms by ${adminName}.`,
        },
      });
    } catch (revErr) {
      console.warn('[QuotesService] Non-critical approval revision log not saved:', revErr);
    }
  }

  safeLogActivity({
    quoteId: id,
    changedBy: admin.id,
    changeType: 'signed',
    note: `Quotation digitally signed and approved by ${adminName}. Advance Terms: ${finalAdvancePercent}%, Grand Total: ₹${grandTotal.toLocaleString('en-IN')}`,
    newValue: { digitalSignature, signedBy: adminName, signedAt, grandTotal, advancePercentage: finalAdvancePercent },
  });

  // 4. Generate PDF and send approval email with PDF attachment (non-blocking)
  const emailCtx = {
    to: quote.email || '',
    customerName: `${quote.firstName || ''} ${quote.lastName || ''}`.trim(),
    companyName: quote.companyName || 'B2B Client',
    referenceNo,
    quoteNumber: updatedQuote.quoteNumber || undefined,
    projectName: quote.projectName || 'Hardware Project',
    grandTotal,
    accessToken,
  };

  // Fire-and-forget: generate PDF then email it; fall back to plain email on any error
  (async () => {
    try {
      const formattedQuote = formatQuote(updatedQuote);
      const pdfBuffer = await generateQuotationPdf(formattedQuote as any);
      await sendQuotationApprovedEmailWithPdf(emailCtx, pdfBuffer);
      console.log(`[QuotesService] PDF generated and emailed for quote ${referenceNo}`);
    } catch (pdfErr: any) {
      console.warn(`[QuotesService] PDF generation failed for ${referenceNo}, sending text-only email:`, pdfErr?.message);
      sendQuotationApprovedEmail(emailCtx).catch(() => {});
    }
  })();

  return formatQuote(updatedQuote);
};

/**
 * 10. Digital Signature Verification Engine
 */
export const verifySignatureRecord = async (referenceNo: string, _providedSignature?: string): Promise<VerificationResult> => {
  const quote = await prisma.quote.findFirst({
    where: {
      OR: [
        { referenceNo: { equals: referenceNo.trim(), mode: 'insensitive' } },
        { quoteNumber: { equals: referenceNo.trim(), mode: 'insensitive' } },
      ],
      isDeleted: false,
    },
  });

  if (!quote) {
    return {
      isValid: false,
      tamperDetected: false,
      referenceNo,
      companyName: 'Not Found',
      gstNo: 'Not Found',
      projectName: 'Not Found',
      grandTotal: 0,
      signedBy: 'None',
      signedAt: 'N/A',
      digitalSignature: '',
      message: `No quotation found matching reference number "${referenceNo}" in PRC Hardware central registry.`,
    };
  }

  return verifyQuotationSignature(quote);
};

/**
 * 11. Admin: Permanent Delete Quotation from Database
 */
export const softDeleteQuote = async (id: string, admin: AdminContext) => {
  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) {
    throw new AppError('NOT_FOUND', 'Quotation not found', 404);
  }

  await prisma.$transaction(async (tx) => {
    // 2. Delete Quote Activity Logs
    await tx.quoteActivityLog.deleteMany({ where: { quoteId: id } });
    // 3. Delete Quote Items
    await tx.quoteItem.deleteMany({ where: { quoteId: id } });
    // 4. Permanently Delete the Quote from Database
    await tx.quote.delete({ where: { id } });
  });

  return { success: true, message: `Quotation ${quote.referenceNo || quote.quoteNumber} deleted permanently from database.` };
};

