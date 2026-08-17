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
  sendQuotationUnderReviewEmail,
  sendQuotationPendingEmail,
  sendQuotationApprovedEmail,
  sendQuotationRejectedEmail,
  sendQuotationCustomerResponseNotification,
} from './quotation-email.service';
import { env } from '../../config/env';
import type {
  CreateB2BQuoteInput,
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

  // 2. Atomically generate Indian FY Reference Number (PRC-QT-2026-27/001)
  const { referenceNo, financialYear, sequenceNo } = await generateNextQuotationReferenceNo();
  const accessToken = crypto.randomBytes(24).toString('hex');

  // 3. Server-side recalculate line items, basic price, GST (18%)
  let calculatedBasicPrice = 0;
  const itemsToCreate = input.items.map((item, idx) => {
    const product = productMap.get(item.productId);
    const unitPrice = item.rate !== undefined && item.rate >= 0
      ? item.rate
      : product?.salePrice
      ? Number(product.salePrice)
      : product?.price
      ? Number(product.price)
      : 0;

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
      activityLogs: {
        create: {
          changeType: 'status_change',
          note: `Quotation ${referenceNo} submitted by B2B customer ${input.firstName} ${input.lastName} (${input.companyName})`,
          newValue: { status: 'PENDING', referenceNo, basicPrice: basicPriceDecimal, grandTotal: grandTotalDecimal },
        },
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

  // 5. Send Confirmation Email
  sendQuotationSubmittedEmail({
    to: input.email,
    customerName: `${input.firstName} ${input.lastName}`,
    companyName: input.companyName,
    referenceNo,
    projectName: input.projectName,
  });

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
    },
  });

  // Notify admin
  sendQuotationCustomerResponseNotification({
    to: '',
    customerName: `${quote.firstName || ''} ${quote.lastName || ''}`.trim(),
    companyName: quote.companyName || 'B2B Client',
    referenceNo: quote.referenceNo || quote.quoteNumber,
    projectName: quote.projectName || 'Project',
    customerResponse: response,
    customerResponseNotes: notes || undefined,
  });

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
  const quote = await prisma.quote.findUnique({
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
      user: true,
    },
  });

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

  const updatedQuote = await prisma.quote.update({
    where: { id },
    data: {
      status: targetStatus,
      statusReason: input.statusReason || null,
      activityLogs: {
        create: {
          changedBy: admin.id,
          changeType: 'status_change',
          note: `Status changed from ${quote.status} to ${targetStatus} by ${adminName}${input.statusReason ? ` (Reason: ${input.statusReason})` : ''}`,
          oldValue: { status: quote.status, reason: quote.statusReason },
          newValue: { status: targetStatus, reason: input.statusReason },
        },
      },
    },
    include: {
      items: { include: { product: true } },
      activityLogs: true,
    },
  });

  const emailContext = {
    to: quote.email || '',
    customerName: `${quote.firstName || ''} ${quote.lastName || ''}`.trim(),
    companyName: quote.companyName || 'B2B Customer',
    referenceNo: quote.referenceNo || quote.quoteNumber,
    projectName: quote.projectName || 'Hardware Project',
    grandTotal: Number(quote.grandTotal || 0),
    statusReason: input.statusReason || undefined,
    accessToken: quote.accessToken || undefined,
  };

  // Dispatch lifecycle notifications
  if (targetStatus === QuoteStatus.UNDER_REVIEW) {
    sendQuotationUnderReviewEmail(emailContext);
  } else if (targetStatus === QuoteStatus.PENDING) {
    sendQuotationPendingEmail(emailContext);
  } else if (targetStatus === QuoteStatus.REJECTED) {
    sendQuotationRejectedEmail(emailContext);
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
  const updatedQuote = await prisma.$transaction(async (tx) => {
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
        notes: input.notes !== undefined ? input.notes : quote.notes,
        adminNotes: input.adminNotes !== undefined ? input.adminNotes : quote.adminNotes,
        validUntil: input.validUntil ? new Date(input.validUntil) : quote.validUntil,
        // Invalidate previous signature if amount changed
        digitalSignature: null,
        signedBy: null,
        signedAt: null,
        qrCodeData: null,
        activityLogs: {
          create: {
            changedBy: admin.id,
            changeType: 'item_edit',
            note: `Line items and pricing updated by ${adminName}. New Basic: ₹${basicPriceDecimal}, Shipping: ${shippingCostDecimal !== null ? `₹${shippingCostDecimal}` : 'At actual'}, Grand Total: ₹${grandTotalDecimal}`,
            oldValue: { basicPrice: quote.basicPrice, grandTotal: quote.grandTotal, shippingCost: quote.shippingCost },
            newValue: { basicPrice: basicPriceDecimal, grandTotal: grandTotalDecimal, shippingCost: shippingCostDecimal },
          },
        },
      },
      include: {
        items: { include: { product: true } },
        activityLogs: true,
      },
    });

    return q;
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
      accessToken,
      digitalSignature,
      signedBy: adminName,
      signedAt,
      qrCodeData,
      adminNotes: input.adminNotes !== undefined ? input.adminNotes : quote.adminNotes,
      activityLogs: {
        create: {
          changedBy: admin.id,
          changeType: 'signed',
          note: `Quotation digitally signed and approved by ${adminName}. Grand Total: ₹${grandTotal.toLocaleString('en-IN')}`,
          newValue: { digitalSignature, signedBy: adminName, signedAt, grandTotal },
        },
      },
    },
    include: {
      items: { include: { product: true } },
      activityLogs: true,
    },
  });

  // 4. Send Approval Email with secure token link & digital seal
  sendQuotationApprovedEmail({
    to: quote.email || '',
    customerName: `${quote.firstName || ''} ${quote.lastName || ''}`.trim(),
    companyName: quote.companyName || 'B2B Client',
    referenceNo,
    projectName: quote.projectName || 'Hardware Project',
    grandTotal,
    accessToken,
  });

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
      message: `No quotation found matching reference number "${referenceNo}" in Pacific Products & Solutions central registry.`,
    };
  }

  return verifyQuotationSignature(quote);
};

/**
 * 11. Admin: Soft Delete Quotation
 */
export const softDeleteQuote = async (id: string, admin: AdminContext) => {
  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) {
    throw new AppError('NOT_FOUND', 'Quotation not found', 404);
  }

  const adminName = [admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.email || 'Admin';

  const deletedQuote = await prisma.quote.update({
    where: { id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      activityLogs: {
        create: {
          changedBy: admin.id,
          changeType: 'deleted',
          note: `Quotation marked as deleted by ${adminName}`,
          oldValue: { isDeleted: false },
          newValue: { isDeleted: true, deletedAt: new Date() },
        },
      },
    },
  });

  return { success: true, message: `Quotation ${quote.referenceNo || quote.quoteNumber} soft-deleted successfully.` };
};
