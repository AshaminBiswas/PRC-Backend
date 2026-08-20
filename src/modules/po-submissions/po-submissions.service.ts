/**
 * po-submissions.service.ts
 *
 * Core business logic for Dual-mode Purchase Order Intake (Form & Native PDF).
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Prisma, PoSourceType, PoSubmissionStatus, LineItemSource, PoSubmissionAction, B2BPoStatus } from '@prisma/client';
import prisma from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';
import {
  CreateFormPoInput,
  CreatePdfPoInput,
  AdminUpsertLineItemsInput,
  AdminApproveInput,
  AdminQueueQuery,
  CustomerListQuery,
} from './po-submissions.schema';
import { generatePoAcknowledgementPdfBuffer } from './po-submissions-pdf.service';
import { generateNextPoNumber } from '../purchase-orders/po-numbering.service';
import {
  sendSubmissionReceivedEmail,
  sendChangesRequestedEmail,
  sendPoApprovedEmail,
  sendPoRejectedEmail,
  sendAcknowledgementIssuedEmail,
} from './po-submissions-email.service';

// ── Directory Setup for Submissions & Acknowledgements ────────────────────────
const UPLOADS_BASE = path.join(process.cwd(), 'uploads');
const PO_SUBMISSIONS_DIR = path.join(UPLOADS_BASE, 'po-submissions');
const ATTACHMENTS_DIR = path.join(PO_SUBMISSIONS_DIR, 'attachments');
const ACKS_DIR = path.join(PO_SUBMISSIONS_DIR, 'acknowledgements');

[UPLOADS_BASE, PO_SUBMISSIONS_DIR, ATTACHMENTS_DIR, ACKS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function getFinancialYearString(date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = Jan, 3 = Apr
  const startYear = month >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}${String(endYear).slice(-2)}`;
}

function calculateSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function validatePdfMagicBytes(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 4) return false;
  return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46; // %PDF
}

export class PoSubmissionsService {
  /**
   * Returns the next sequential Purchase Order Number (e.g. PRC-PO-2026-27/001)
   */
  async getNextSequentialPoNumber(): Promise<{ poNumber: string; financialYear: string; sequenceNo: number }> {
    return await generateNextPoNumber();
  }

  /**
   * Generates next sequential reference number, e.g. POS-2425-0001 or ACK-2425-0001
   */
  private async getNextSequenceNumber(prefix: 'POS' | 'ACK'): Promise<string> {
    const fy = getFinancialYearString();

    const sequence = await prisma.poSubmissionSequence.upsert({
      where: {
        prefix_financialYear: {
          prefix,
          financialYear: fy,
        },
      },
      update: {
        nextNumber: { increment: 1 },
      },
      create: {
        prefix,
        financialYear: fy,
        nextNumber: 1,
      },
    });

    return `${prefix}-${fy}-${String(sequence.nextNumber).padStart(4, '0')}`;
  }

  // ─── Customer: Option A (Structured Form PO Submission) ──────────────────────
  async createFormPo(userId: string, input: CreateFormPoInput, ipAddress?: string) {
    const customer = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true, companyName: true },
    });

    if (!customer) {
      throw new AppError('USER_NOT_FOUND', 'Customer account not found', 404);
    }

    const effectivePoNumber = (input.customerPoNumber && input.customerPoNumber.trim())
      ? input.customerPoNumber.trim()
      : (await generateNextPoNumber()).poNumber;

    // Duplicate PO check (non-blocking warning flag)
    const existingDuplicate = await prisma.poSubmission.findFirst({
      where: {
        customerId: userId,
        customerPoNumber: { equals: effectivePoNumber, mode: 'insensitive' },
        status: { notIn: ['REJECTED', 'DRAFT'] },
      },
      select: { id: true, submissionNumber: true, status: true },
    });

    // Calculate line totals
    let totalTaxable = 0;
    let totalTax = 0;

    const formattedItems = input.lineItems.map((item, index) => {
      const qty = Number(item.quantity);
      const price = Number(item.unitPrice);
      const taxRate = Number(item.taxRate || 0);
      const amount = qty * price;
      const taxAmount = (amount * taxRate) / 100;
      const lineTotal = amount + taxAmount;

      totalTaxable += amount;
      totalTax += taxAmount;

      return {
        slNo: index + 1,
        description: item.description.trim(),
        sku: item.sku?.trim() || null,
        productId: item.productId || null,
        variantId: item.variantId || null,
        unit: item.unit || 'PCS',
        quantity: qty,
        unitPrice: new Prisma.Decimal(price),
        taxRate: taxRate ? new Prisma.Decimal(taxRate) : null,
        taxAmount: taxAmount ? new Prisma.Decimal(taxAmount) : null,
        lineTotal: new Prisma.Decimal(lineTotal),
        source: LineItemSource.CUSTOMER_ENTERED,
        sortOrder: index,
      };
    });

    const grandTotal = totalTaxable + totalTax;
    const submissionNumber = await this.getNextSequenceNumber('POS');

    const submission = await prisma.$transaction(async (tx) => {
      const created = await tx.poSubmission.create({
        data: {
          submissionNumber,
          customerId: userId,
          sourceType: PoSourceType.FORM,
          status: PoSubmissionStatus.SUBMITTED,
          customerPoNumber: effectivePoNumber,
          customerPoDate: input.customerPoDate ? new Date(input.customerPoDate) : null,
          statedTotal: new Prisma.Decimal(grandTotal),
          mappedTotal: new Prisma.Decimal(grandTotal),
          currency: input.currency || 'INR',
          expectedDeliveryDate: input.expectedDeliveryDate ? new Date(input.expectedDeliveryDate) : null,
          paymentTerms: input.paymentTerms || null,
          customerNote: input.customerNote || null,
          billToAddress: input.billToAddress as any,
          shipToAddress: input.shipToAddress as any,
          submittedAt: new Date(),
          lineItems: {
            create: formattedItems,
          },
        },
        include: {
          lineItems: true,
          customer: {
            select: { id: true, email: true, firstName: true, lastName: true, companyName: true },
          },
        },
      });

      // Audit Log
      await tx.poSubmissionLog.create({
        data: {
          submissionId: created.id,
          actorId: userId,
          action: PoSubmissionAction.SUBMITTED,
          fromStatus: null,
          toStatus: PoSubmissionStatus.SUBMITTED,
          comment: `Form PO submitted with ${formattedItems.length} line items. Stated total: ₹${grandTotal.toFixed(2)}`,
          ipAddress: ipAddress || null,
        },
      });

      return created;
    });

    // Fire confirmation email asynchronously
    sendSubmissionReceivedEmail({
      to: customer.email,
      customerName: `${customer.firstName} ${customer.lastName}`.trim(),
      submissionNumber: submission.submissionNumber,
      customerPoNumber: submission.customerPoNumber,
      sourceType: submission.sourceType,
      statedTotal: grandTotal,
      currency: submission.currency,
    }).catch(() => {});

    return {
      submission,
      duplicateWarning: !!existingDuplicate,
      duplicateExistingSubmission: existingDuplicate || null,
    };
  }

  // ─── Customer: Option B (Native PDF PO Upload) ──────────────────────────────
  async createPdfPo(
    userId: string,
    file: Express.Multer.File,
    input: CreatePdfPoInput,
    ipAddress?: string
  ) {
    if (!file || !file.buffer) {
      throw new AppError('FILE_REQUIRED', 'Please select a PDF document to upload', 400);
    }

    // 10 MB strict limit
    const MAX_PDF_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_PDF_SIZE) {
      throw new AppError('FILE_TOO_LARGE', 'Uploaded PDF exceeds maximum allowed size of 10 MB', 400);
    }

    if (!validatePdfMagicBytes(file.buffer)) {
      throw new AppError('INVALID_PDF', 'Corrupt or invalid PDF file header detected', 400);
    }

    const customer = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true, companyName: true },
    });

    if (!customer) {
      throw new AppError('USER_NOT_FOUND', 'Customer account not found', 404);
    }

    const effectivePoNumber = (input.customerPoNumber && input.customerPoNumber.trim())
      ? input.customerPoNumber.trim()
      : (await generateNextPoNumber()).poNumber;

    // Duplicate PO check
    const existingDuplicate = await prisma.poSubmission.findFirst({
      where: {
        customerId: userId,
        customerPoNumber: { equals: effectivePoNumber, mode: 'insensitive' },
        status: { notIn: ['REJECTED', 'DRAFT'] },
      },
      select: { id: true, submissionNumber: true, status: true },
    });

    const checksum = calculateSha256(file.buffer);
    const submissionNumber = await this.getNextSequenceNumber('POS');
    const fileId = crypto.randomUUID();
    const safeOriginalName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageFileName = `${submissionNumber}_${fileId}_${safeOriginalName}`;
    const storageFilePath = path.join(ATTACHMENTS_DIR, storageFileName);

    // Save PDF to persistent storage
    fs.writeFileSync(storageFilePath, file.buffer);

    const statedVal = input.statedTotal ? Number(input.statedTotal) : null;

    const submission = await prisma.$transaction(async (tx) => {
      const created = await tx.poSubmission.create({
        data: {
          submissionNumber,
          customerId: userId,
          sourceType: PoSourceType.PDF_UPLOAD,
          status: PoSubmissionStatus.SUBMITTED,
          customerPoNumber: effectivePoNumber,
          customerPoDate: input.customerPoDate ? new Date(input.customerPoDate) : null,
          statedTotal: statedVal ? new Prisma.Decimal(statedVal) : null,
          mappedTotal: null,
          currency: input.currency || 'INR',
          expectedDeliveryDate: input.expectedDeliveryDate ? new Date(input.expectedDeliveryDate) : null,
          customerNote: input.customerNote || null,
          submittedAt: new Date(),
          attachments: {
            create: {
              fileStorageKey: storageFileName,
              originalFileName: file.originalname,
              fileSizeBytes: file.size,
              mimeType: file.mimetype || 'application/pdf',
              checksum,
              uploadedBy: userId,
            },
          },
        },
        include: {
          attachments: true,
          customer: {
            select: { id: true, email: true, firstName: true, lastName: true, companyName: true },
          },
        },
      });

      // Audit Log
      await tx.poSubmissionLog.create({
        data: {
          submissionId: created.id,
          actorId: userId,
          action: PoSubmissionAction.SUBMITTED,
          fromStatus: null,
          toStatus: PoSubmissionStatus.SUBMITTED,
          comment: `Native PDF PO uploaded: "${file.originalname}" (${(file.size / 1024).toFixed(1)} KB). Stated total: ${statedVal ? `₹${statedVal.toFixed(2)}` : 'Not specified'}`,
          ipAddress: ipAddress || null,
        },
      });

      return created;
    });

    // Fire confirmation email
    sendSubmissionReceivedEmail({
      to: customer.email,
      customerName: `${customer.firstName} ${customer.lastName}`.trim(),
      submissionNumber: submission.submissionNumber,
      customerPoNumber: submission.customerPoNumber,
      sourceType: submission.sourceType,
      statedTotal: statedVal,
      currency: submission.currency,
    }).catch(() => {});

    return {
      submission,
      duplicateWarning: !!existingDuplicate,
      duplicateExistingSubmission: existingDuplicate || null,
    };
  }

  // ─── Customer: List & Detail ────────────────────────────────────────────────
  async getMySubmissions(userId: string, query: CustomerListQuery) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 15;
    const skip = (page - 1) * limit;

    const where: Prisma.PoSubmissionWhereInput = {
      customerId: userId,
    };

    if (query.status && query.status !== 'ALL') {
      where.status = query.status as PoSubmissionStatus;
    }

    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { customerPoNumber: { contains: q, mode: 'insensitive' } },
        { submissionNumber: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.poSubmission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submittedAt: 'desc' },
        include: {
          attachments: { select: { id: true, originalFileName: true, fileSizeBytes: true, uploadedAt: true } },
          acknowledgement: { select: { id: true, ackNumber: true, issuedAt: true } },
          lineItems: { select: { id: true, description: true, quantity: true, unitPrice: true, lineTotal: true } },
        },
      }),
      prisma.poSubmission.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async getSubmissionById(userId: string, submissionId: string, isAdmin = false) {
    const submission = await prisma.poSubmission.findUnique({
      where: { id: submissionId },
      include: {
        customer: {
          select: { id: true, email: true, firstName: true, lastName: true, companyName: true, phone: true, gstin: true },
        },
        reviewer: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        assignee: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        approver: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        lineItems: {
          orderBy: { sortOrder: 'asc' },
        },
        attachments: true,
        acknowledgement: true,
        b2bPurchaseOrder: {
          include: {
            receipts: { where: { isDeleted: false }, orderBy: { createdAt: 'desc' } },
            packingList: true,
            dispatch: true,
            invoice: true,
          },
        },
        logs: {
          orderBy: { timestamp: 'asc' },
          include: {
            actor: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
      },
    });

    if (!submission) {
      throw new AppError('NOT_FOUND', 'Purchase Order submission not found', 404);
    }

    if (!isAdmin && submission.customerId !== userId) {
      throw new AppError('FORBIDDEN', 'You do not have permission to view this submission', 403);
    }

    // Filter out internal notes for non-admin users
    if (!isAdmin) {
      submission.logs = submission.logs.filter((log) => !log.isInternal);
    }

    return submission;
  }

  // ─── Admin: Unified Queue & Metrics ─────────────────────────────────────────
  async adminGetQueue(query: AdminQueueQuery) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 15;
    const skip = (page - 1) * limit;

    const where: Prisma.PoSubmissionWhereInput = {};

    if (query.status && query.status !== 'ALL') {
      where.status = query.status as PoSubmissionStatus;
    }

    if (query.sourceType && query.sourceType !== 'ALL') {
      where.sourceType = query.sourceType as PoSourceType;
    }

    if (query.customerId) {
      where.customerId = query.customerId;
    }

    if (query.assignedTo) {
      where.assignedTo = query.assignedTo;
    }

    if (query.fromDate || query.toDate) {
      where.submittedAt = {};
      if (query.fromDate) where.submittedAt.gte = new Date(query.fromDate);
      if (query.toDate) where.submittedAt.lte = new Date(query.toDate);
    }

    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { customerPoNumber: { contains: q, mode: 'insensitive' } },
        { submissionNumber: { contains: q, mode: 'insensitive' } },
        { customer: { email: { contains: q, mode: 'insensitive' } } },
        { customer: { firstName: { contains: q, mode: 'insensitive' } } },
        { customer: { lastName: { contains: q, mode: 'insensitive' } } },
        { customer: { companyName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [items, total, countsByStatus] = await Promise.all([
      prisma.poSubmission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submittedAt: 'desc' },
        include: {
          customer: {
            select: { id: true, email: true, firstName: true, lastName: true, companyName: true },
          },
          assignee: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          reviewer: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          attachments: {
            select: { id: true, originalFileName: true, fileSizeBytes: true },
          },
          acknowledgement: {
            select: { id: true, ackNumber: true, issuedAt: true },
          },
          b2bPurchaseOrder: {
            select: {
              id: true,
              poNumber: true,
              status: true,
              advanceAmount: true,
              balanceAmount: true,
            },
          },
          lineItems: {
            select: { id: true, productId: true },
          },
        },
      }),
      prisma.poSubmission.count({ where }),
      prisma.poSubmission.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    // Format metrics dictionary
    const metrics: Record<string, number> = {
      ALL: 0,
      SUBMITTED: 0,
      UNDER_REVIEW: 0,
      CHANGES_REQUESTED: 0,
      APPROVED: 0,
      ACKNOWLEDGED: 0,
      REJECTED: 0,
      FULFILLMENT: 0,
    };

    countsByStatus.forEach((c) => {
      metrics[c.status] = c._count.id;
      metrics.ALL += c._count.id;
    });

    // Annotate items with `hasPendingMapping` flag
    const mappedItems = items.map((po) => {
      const isPdf = po.sourceType === PoSourceType.PDF_UPLOAD;
      const unmapped = isPdf && (po.lineItems.length === 0 || po.lineItems.some((li) => !li.productId));
      return {
        ...po,
        hasPendingMapping: unmapped,
      };
    });

    return {
      items: mappedItems,
      metrics,
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  // ─── Admin Action: Start Review ─────────────────────────────────────────────
  async adminStartReview(adminUser: any, submissionId: string, ipAddress?: string) {
    const po = await prisma.poSubmission.findUnique({ where: { id: submissionId } });
    if (!po) throw new AppError('NOT_FOUND', 'Submission not found', 404);

    if (po.status !== PoSubmissionStatus.SUBMITTED && po.status !== PoSubmissionStatus.CHANGES_REQUESTED) {
      throw new AppError('INVALID_STATE', `Cannot start review on a PO with status ${po.status}`, 400);
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.poSubmission.update({
        where: { id: submissionId },
        data: {
          status: PoSubmissionStatus.UNDER_REVIEW,
          reviewedBy: adminUser.id,
        },
      });

      await tx.poSubmissionLog.create({
        data: {
          submissionId,
          actorId: adminUser.id,
          action: PoSubmissionAction.UNDER_REVIEW,
          fromStatus: po.status,
          toStatus: PoSubmissionStatus.UNDER_REVIEW,
          comment: `Admin ${adminUser.firstName || adminUser.email} opened submission for active review.`,
          ipAddress: ipAddress || null,
        },
      });

      return updated;
    });
  }

  // ─── Admin Action: Map Catalog Line Items (for PDF POs) ──────────────────────
  async adminUpsertLineItems(
    adminUser: any,
    submissionId: string,
    input: AdminUpsertLineItemsInput,
    ipAddress?: string
  ) {
    const po = await prisma.poSubmission.findUnique({
      where: { id: submissionId },
      include: { lineItems: true },
    });

    if (!po) throw new AppError('NOT_FOUND', 'Submission not found', 404);

    if (po.status !== PoSubmissionStatus.UNDER_REVIEW && po.status !== PoSubmissionStatus.CHANGES_REQUESTED) {
      throw new AppError(
        'INVALID_STATE',
        'Line items can only be mapped when the PO is UNDER_REVIEW or in CHANGES_REQUESTED',
        400
      );
    }

    let calculatedTotal = 0;
    const newItems = input.items.map((item, idx) => {
      const qty = Number(item.quantity);
      const price = Number(item.unitPrice);
      const taxRate = Number(item.taxRate || 0);
      const amount = qty * price;
      const taxAmount = (amount * taxRate) / 100;
      const lineTotal = amount + taxAmount;

      calculatedTotal += lineTotal;

      return {
        submissionId,
        slNo: idx + 1,
        productId: item.productId || null,
        variantId: item.variantId || null,
        description: item.description.trim(),
        sku: item.sku?.trim() || null,
        unit: item.unit || 'PCS',
        quantity: qty,
        unitPrice: new Prisma.Decimal(price),
        taxRate: taxRate ? new Prisma.Decimal(taxRate) : null,
        taxAmount: taxAmount ? new Prisma.Decimal(taxAmount) : null,
        lineTotal: new Prisma.Decimal(lineTotal),
        source: LineItemSource.ADMIN_MAPPED,
        sortOrder: idx,
      };
    });

    return await prisma.$transaction(async (tx) => {
      // Clear old line items
      await tx.poSubmissionLineItem.deleteMany({
        where: { submissionId },
      });

      // Insert fresh mapped items
      await tx.poSubmissionLineItem.createMany({
        data: newItems,
      });

      // Update mapped total
      const updatedPo = await tx.poSubmission.update({
        where: { id: submissionId },
        data: {
          mappedTotal: new Prisma.Decimal(calculatedTotal),
        },
        include: {
          lineItems: { orderBy: { sortOrder: 'asc' } },
        },
      });

      // Audit Log
      await tx.poSubmissionLog.create({
        data: {
          submissionId,
          actorId: adminUser.id,
          action: PoSubmissionAction.MAPPED_LINE_ITEM,
          fromStatus: po.status,
          toStatus: po.status,
          comment: `Admin mapped ${newItems.length} line items to catalog. Mapped total: ₹${calculatedTotal.toFixed(2)}`,
          metadata: {
            itemsCount: newItems.length,
            mappedTotal: calculatedTotal,
            statedTotal: po.statedTotal ? Number(po.statedTotal) : null,
          },
          ipAddress: ipAddress || null,
        },
      });

      return updatedPo;
    });
  }

  // ─── Admin Action: Approve PO ───────────────────────────────────────────────
  async adminApprove(
    adminUser: any,
    submissionId: string,
    input: AdminApproveInput,
    ipAddress?: string
  ) {
    const po = await prisma.poSubmission.findUnique({
      where: { id: submissionId },
      include: {
        lineItems: true,
        customer: true,
      },
    });

    if (!po) throw new AppError('NOT_FOUND', 'Submission not found', 404);

    if (po.status !== PoSubmissionStatus.UNDER_REVIEW) {
      throw new AppError('INVALID_STATE', `Only submissions UNDER_REVIEW can be approved (current: ${po.status})`, 400);
    }

    if (po.lineItems.length === 0) {
      throw new AppError('MAPPING_REQUIRED', 'Cannot approve PO without line items. Please map order lines first.', 400);
    }

    // PDF Intake Guard: Check if any item remains unmapped
    if (po.sourceType === PoSourceType.PDF_UPLOAD) {
      const hasUnmapped = po.lineItems.some((li) => !li.productId && !li.sku);
      if (hasUnmapped) {
        throw new AppError(
          'PARTIAL_MAPPING_NOT_ALLOWED',
          'All line items in the PDF must be mapped to catalog SKUs/products before approval.',
          400
        );
      }
    }

    // Variance Mismatch Guardrail
    const thresholdPercent = Number(process.env.PO_MISMATCH_THRESHOLD_PERCENT || 2);
    const stated = po.statedTotal ? Number(po.statedTotal) : null;
    const mapped = po.mappedTotal ? Number(po.mappedTotal) : 0;

    if (stated && stated > 0 && !input.confirmMismatch) {
      const diff = Math.abs(mapped - stated);
      const percentDiff = (diff / stated) * 100;

      if (percentDiff > thresholdPercent) {
        throw new AppError(
          'TOTAL_MISMATCH_REQUIRES_CONFIRMATION',
          `Mapped total (₹${mapped.toLocaleString('en-IN')}) differs from stated PO total (₹${stated.toLocaleString('en-IN')}) by ${percentDiff.toFixed(1)}% (exceeds ${thresholdPercent}% limit). Please confirm mismatch explicitly to approve.`,
          422
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.poSubmission.update({
        where: { id: submissionId },
        data: {
          status: PoSubmissionStatus.APPROVED,
          approvedBy: adminUser.id,
          approvedAt: new Date(),
        },
      });

      // Automatically promote/ensure B2BPurchaseOrder in downstream fulfillment pipeline
      const b2bPo = await this.ensureFulfillmentPurchaseOrder(submissionId, tx);

      await tx.poSubmissionLog.create({
        data: {
          submissionId,
          actorId: adminUser.id,
          action: PoSubmissionAction.APPROVED,
          fromStatus: po.status,
          toStatus: PoSubmissionStatus.APPROVED,
          comment: `PO Approved by ${adminUser.firstName || adminUser.email}.${input.confirmMismatch ? ' [Variance explicitly confirmed by admin]' : ''} -> Promoted to fulfillment PO #${b2bPo?.poNumber || ''}`,
          metadata: {
            mappedTotal: mapped,
            statedTotal: stated,
            varianceConfirmed: !!input.confirmMismatch,
            b2bPurchaseOrderId: b2bPo?.id,
            b2bPoNumber: b2bPo?.poNumber,
          },
          ipAddress: ipAddress || null,
        },
      });

      return { ...res, b2bPurchaseOrder: b2bPo };
    });

    // Fire email to customer
    sendPoApprovedEmail({
      to: po.customer.email,
      customerName: `${po.customer.firstName} ${po.customer.lastName}`.trim(),
      submissionNumber: po.submissionNumber,
      customerPoNumber: po.customerPoNumber,
      mappedTotal: mapped,
      currency: po.currency,
    }).catch(() => {});

    return updated;
  }

  // ─── Admin Action: Issue Formal Acknowledgement PDF ─────────────────────────
  async adminIssueAcknowledgement(adminUser: any, submissionId: string, ipAddress?: string) {
    const po = await prisma.poSubmission.findUnique({
      where: { id: submissionId },
      include: {
        customer: true,
        lineItems: { orderBy: { sortOrder: 'asc' } },
        acknowledgement: true,
      },
    });

    if (!po) throw new AppError('NOT_FOUND', 'Submission not found', 404);

    if (po.status !== PoSubmissionStatus.APPROVED && po.status !== PoSubmissionStatus.ACKNOWLEDGED) {
      throw new AppError(
        'INVALID_STATE',
        `Acknowledgement can only be issued for APPROVED purchase orders (current: ${po.status})`,
        400
      );
    }

    if (po.acknowledgement) {
      throw new AppError('ALREADY_ACKNOWLEDGED', `Acknowledgement #${po.acknowledgement.ackNumber} already exists`, 400);
    }

    const ackNumber = await this.getNextSequenceNumber('ACK');
    const issuedAt = new Date();
    const adminName = `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || adminUser.email;

    // Calculate subtotal & taxes
    let subtotal = 0;
    let taxTotal = 0;
    const itemsForPdf = po.lineItems.map((item, idx) => {
      const q = Number(item.quantity);
      const p = Number(item.unitPrice);
      const tax = item.taxAmount ? Number(item.taxAmount) : 0;
      const amt = Number(item.lineTotal);

      subtotal += q * p;
      taxTotal += tax;

      return {
        slNo: idx + 1,
        description: item.description,
        sku: item.sku,
        unit: item.unit,
        quantity: q,
        unitPrice: p,
        lineTotal: amt,
      };
    });

    const grandTotal = subtotal + taxTotal;

    // Generate Acknowledgement PDF Buffer
    const pdfBuffer = await generatePoAcknowledgementPdfBuffer({
      ackNumber,
      submissionNumber: po.submissionNumber,
      customerPoNumber: po.customerPoNumber,
      customerPoDate: po.customerPoDate,
      sourceType: po.sourceType,
      submittedAt: po.submittedAt,
      issuedAt,
      issuedByName: adminName,
      expectedDeliveryDate: po.expectedDeliveryDate,
      paymentTerms: po.paymentTerms,
      customerName: `${po.customer.firstName} ${po.customer.lastName}`.trim(),
      customerCompany: po.customer.companyName,
      customerEmail: po.customer.email,
      customerPhone: po.customer.phone,
      customerGstin: po.customer.gstin,
      billToAddress: po.billToAddress,
      shipToAddress: po.shipToAddress,
      items: itemsForPdf,
      subtotal,
      taxTotal,
      grandTotal,
      currency: po.currency,
    });

    // Save Acknowledgement PDF to disk
    const pdfFileName = `${ackNumber}.pdf`;
    const pdfFilePath = path.join(ACKS_DIR, pdfFileName);
    fs.writeFileSync(pdfFilePath, pdfBuffer);

    const result = await prisma.$transaction(async (tx) => {
      const ack = await tx.poAcknowledgement.create({
        data: {
          submissionId: po.id,
          ackNumber,
          fileStorageKey: pdfFileName,
          issuedBy: adminUser.id,
          issuedByName: adminName,
          issuedAt,
        },
      });

      const updatedPo = await tx.poSubmission.update({
        where: { id: po.id },
        data: {
          status: PoSubmissionStatus.ACKNOWLEDGED,
        },
      });

      // Ensure B2BPurchaseOrder exists
      const b2bPo = await this.ensureFulfillmentPurchaseOrder(po.id, tx);

      await tx.poSubmissionLog.create({
        data: {
          submissionId: po.id,
          actorId: adminUser.id,
          action: PoSubmissionAction.ACKNOWLEDGED,
          fromStatus: PoSubmissionStatus.APPROVED,
          toStatus: PoSubmissionStatus.ACKNOWLEDGED,
          comment: `Formal Acknowledgement ${ackNumber} issued & dispatched to customer. Total: ₹${grandTotal.toFixed(2)} (Fulfillment PO #${b2bPo?.poNumber || ''})`,
          metadata: { ackNumber, grandTotal, b2bPurchaseOrderId: b2bPo?.id, b2bPoNumber: b2bPo?.poNumber },
          ipAddress: ipAddress || null,
        },
      });

      return { ack, po: updatedPo, b2bPurchaseOrder: b2bPo };
    });

    // Send email with PDF attached
    sendAcknowledgementIssuedEmail({
      to: po.customer.email,
      customerName: `${po.customer.firstName} ${po.customer.lastName}`.trim(),
      ackNumber,
      submissionNumber: po.submissionNumber,
      customerPoNumber: po.customerPoNumber,
      grandTotal,
      currency: po.currency,
      pdfBuffer,
    }).catch(() => {});

    return result;
  }

  /**
   * Promotes an approved/acknowledged PoSubmission into the downstream B2BPurchaseOrder fulfillment pipeline.
   * Idempotent: returns existing B2BPurchaseOrder if already linked.
   */
  async ensureFulfillmentPurchaseOrder(submissionId: string, txClient?: Prisma.TransactionClient): Promise<any> {
    const db = txClient || prisma;

    const existingPo = await db.b2BPurchaseOrder.findFirst({
      where: { poSubmissionId: submissionId },
      include: { items: true },
    });
    if (existingPo) return existingPo;

    const submission = await db.poSubmission.findUnique({
      where: { id: submissionId },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        customer: true,
      },
    });
    if (!submission) return null;

    let masterPoNumber = submission.customerPoNumber;
    if (!masterPoNumber || !masterPoNumber.startsWith('PRC-PO-')) {
      const seq = await generateNextPoNumber(new Date(), db);
      masterPoNumber = seq.poNumber;
    }

    let subtotal = 0;
    let taxTotal = 0;
    const itemsSnapshot = submission.lineItems.map((item, idx) => {
      const qty = Number(item.quantity) || 1;
      const rate = Number(item.unitPrice) || 0;
      const amount = Math.round(qty * rate * 100) / 100;
      const taxRate = Number(item.taxRate || 18);
      const taxAmount = Number(item.taxAmount || Math.round(amount * (taxRate / 100) * 100) / 100);
      const total = Number(item.lineTotal || amount + taxAmount);

      subtotal += amount;
      taxTotal += taxAmount;

      return {
        slNo: idx + 1,
        productId: item.productId || 'custom-mapped-item',
        productName: item.description,
        sku: item.sku || undefined,
        variantId: item.variantId || undefined,
        unit: item.unit || 'PCS',
        quantity: qty,
        rate: new Prisma.Decimal(rate),
        amount: new Prisma.Decimal(amount),
        taxRate: new Prisma.Decimal(taxRate),
        taxAmount: new Prisma.Decimal(taxAmount),
        total: new Prisma.Decimal(total),
      };
    });

    const totalAmount = Math.round((subtotal + taxTotal) * 100) / 100;
    const advancePercentage = 30;
    const advanceAmount = Math.round((totalAmount * (advancePercentage / 100)) * 100) / 100;
    const balanceAmount = Math.round((totalAmount - advanceAmount) * 100) / 100;

    const billingAddress = submission.billToAddress || {
      attentionTo: `${submission.customer.firstName} ${submission.customer.lastName}`.trim(),
      companyName: submission.customer.companyName || '',
      addressLine1: 'As per PO intake document',
      city: 'Delhi',
      state: 'Delhi',
      postalCode: '110001',
      country: 'IN',
      phone: submission.customer.phone || '',
      email: submission.customer.email,
    };
    const deliveryAddress = submission.shipToAddress || billingAddress;

    const created = await db.b2BPurchaseOrder.create({
      data: {
        poNumber: masterPoNumber,
        poSubmissionId: submission.id,
        quotationId: null,
        quotationNumber: submission.submissionNumber,
        customerId: submission.customerId,
        status: B2BPoStatus.AWAITING_ADVANCE_PAYMENT,
        customerPoReferenceNumber: submission.customerPoNumber,
        billingAddress: billingAddress as any,
        deliveryAddress: deliveryAddress as any,
        deliveryInstructions: submission.customerNote || null,
        requestedDeliveryDate: submission.expectedDeliveryDate,
        subtotal: new Prisma.Decimal(subtotal),
        taxTotal: new Prisma.Decimal(taxTotal),
        discountTotal: new Prisma.Decimal(0),
        shippingCost: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(totalAmount),
        currency: submission.currency || 'INR',
        advancePercentage: new Prisma.Decimal(advancePercentage),
        advanceAmount: new Prisma.Decimal(advanceAmount),
        balanceAmount: new Prisma.Decimal(balanceAmount),
        submittedAt: submission.submittedAt,
        validatedAt: new Date(),
        createdBy: submission.customerId,
        items: {
          create: itemsSnapshot,
        },
      },
      include: {
        items: true,
      },
    });

    return created;
  }

  /**
   * Returns comprehensive 8-stage live tracking telemetry for a Purchase Order.
   */
  async getPoTracking(submissionId: string, userId: string, isAdmin = false) {
    const submission = await prisma.poSubmission.findUnique({
      where: { id: submissionId },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true, companyName: true, phone: true, gstin: true },
        },
        reviewer: { select: { id: true, firstName: true, lastName: true, email: true } },
        approver: { select: { id: true, firstName: true, lastName: true, email: true } },
        lineItems: { orderBy: { sortOrder: 'asc' } },
        attachments: true,
        acknowledgement: true,
        logs: { orderBy: { timestamp: 'asc' } },
        b2bPurchaseOrder: {
          include: {
            receipts: { where: { isDeleted: false }, orderBy: { createdAt: 'desc' } },
            packingList: true,
            dispatch: true,
            invoice: true,
            auditLogs: { orderBy: { performedAt: 'asc' } },
          },
        },
      },
    });

    if (!submission) {
      throw new AppError('NOT_FOUND', 'Purchase order submission not found', 404);
    }

    if (!isAdmin && submission.customerId !== userId) {
      throw new AppError('FORBIDDEN', 'Access denied', 403);
    }

    const b2bPo = submission.b2bPurchaseOrder;
    const isApproved = submission.status === PoSubmissionStatus.APPROVED || submission.status === PoSubmissionStatus.ACKNOWLEDGED || !!b2bPo;
    const isAck = !!submission.acknowledgement;
    const latestReceipt = b2bPo?.receipts?.[0];
    const isPaymentVerified = latestReceipt?.status === 'VERIFIED' || b2bPo?.status === B2BPoStatus.PAYMENT_VERIFIED || b2bPo?.status === B2BPoStatus.PACKING_LIST_GENERATED || b2bPo?.status === B2BPoStatus.DISPATCHED || b2bPo?.status === B2BPoStatus.INVOICED;
    const isPackingListReady = !!b2bPo?.packingList || b2bPo?.status === B2BPoStatus.PACKING_LIST_GENERATED || b2bPo?.status === B2BPoStatus.DISPATCHED || b2bPo?.status === B2BPoStatus.INVOICED;
    const isDispatched = !!b2bPo?.dispatch || b2bPo?.status === B2BPoStatus.DISPATCHED || b2bPo?.status === B2BPoStatus.INVOICED;
    const isInvoiced = !!b2bPo?.invoice || b2bPo?.status === B2BPoStatus.INVOICED;

    // Determine current active stage index (1 to 8)
    let currentStage = 1;
    if (isInvoiced) currentStage = 8;
    else if (isDispatched) currentStage = 7;
    else if (isPackingListReady) currentStage = 6;
    else if (isPaymentVerified) currentStage = 6;
    else if (latestReceipt) currentStage = 5;
    else if (isAck) currentStage = 5;
    else if (isApproved) currentStage = 4;
    else if (submission.status === PoSubmissionStatus.UNDER_REVIEW) currentStage = 2;
    else if (submission.status === PoSubmissionStatus.CHANGES_REQUESTED) currentStage = 2;

    const stages = [
      // Stage 1: Intake & Document Upload
      {
        stage: 1,
        code: 'INTAKE_SUBMITTED',
        title: 'PO Intake & Document Upload',
        description: submission.sourceType === PoSourceType.PDF_UPLOAD
          ? 'Native ERP Purchase Order PDF uploaded and queued for engineering review.'
          : 'Structured Commercial PO form submitted online.',
        status: 'COMPLETED',
        timestamp: submission.submittedAt,
        actor: `${submission.customer.firstName} ${submission.customer.lastName}`.trim(),
        metadata: {
          sourceType: submission.sourceType,
          statedTotal: submission.statedTotal ? Number(submission.statedTotal) : null,
          customerPoNumber: submission.customerPoNumber,
          submissionNumber: submission.submissionNumber,
        },
        artifacts: submission.attachments.map((att) => ({
          type: 'ORIGINAL_PDF' as const,
          label: att.originalFileName,
          downloadUrl: `${env.API_PREFIX}/po-submissions/attachments/${att.id}`,
          reference: att.checksum || undefined,
        })),
      },

      // Stage 2: Catalog SKU Mapping
      {
        stage: 2,
        code: 'CATALOG_MAPPING',
        title: 'Catalog SKU Mapping & Review',
        description: submission.lineItems.length > 0
          ? `${submission.lineItems.length} line items verified and mapped to internal catalog products.`
          : 'Engineering team reviewing specifications and catalog SKUs.',
        status: (submission.status === PoSubmissionStatus.CHANGES_REQUESTED)
          ? 'ACTION_REQUIRED'
          : (submission.lineItems.length > 0 || isApproved)
          ? 'COMPLETED'
          : (submission.status === PoSubmissionStatus.UNDER_REVIEW)
          ? 'IN_PROGRESS'
          : 'PENDING',
        timestamp: submission.logs.find((l) => l.action === PoSubmissionAction.MAPPED_LINE_ITEM)?.timestamp,
        actor: submission.reviewer ? `${submission.reviewer.firstName} ${submission.reviewer.lastName}`.trim() : undefined,
        metadata: {
          itemsCount: submission.lineItems.length,
          mappedTotal: submission.mappedTotal ? Number(submission.mappedTotal) : null,
          changeRequestReason: submission.changeRequestReason || undefined,
        },
      },

      // Stage 3: Commercial Verification & Approval
      {
        stage: 3,
        code: 'COMMERCIAL_APPROVAL',
        title: 'Commercial Verification & Approval',
        description: isApproved
          ? 'Purchase order specifications, catalog prices, and commercial terms approved.'
          : submission.status === PoSubmissionStatus.REJECTED
          ? `PO rejected: ${submission.rejectionReason || 'Commercial discrepancy'}`
          : 'Awaiting commercial verification and manager approval.',
        status: (submission.status === PoSubmissionStatus.REJECTED)
          ? 'REJECTED'
          : isApproved
          ? 'COMPLETED'
          : 'PENDING',
        timestamp: submission.approvedAt || undefined,
        actor: submission.approver ? `${submission.approver.firstName} ${submission.approver.lastName}`.trim() : undefined,
        metadata: {
          rejectionReason: submission.rejectionReason || undefined,
          mappedTotal: submission.mappedTotal ? Number(submission.mappedTotal) : null,
        },
      },

      // Stage 4: Order Acknowledgement
      {
        stage: 4,
        code: 'ORDER_ACKNOWLEDGEMENT',
        title: 'Formal Order Acknowledgement',
        description: isAck
          ? `Official binding Order Acknowledgement #${submission.acknowledgement?.ackNumber} generated with verification QR code.`
          : 'Pending issuance of official Order Acknowledgement document.',
        status: isAck ? 'COMPLETED' : isApproved ? 'IN_PROGRESS' : 'PENDING',
        timestamp: submission.acknowledgement?.issuedAt,
        actor: submission.acknowledgement?.issuedByName || undefined,
        metadata: {
          ackNumber: submission.acknowledgement?.ackNumber,
        },
        artifacts: isAck
          ? [
              {
                type: 'ACKNOWLEDGEMENT_PDF' as const,
                label: `Acknowledgement (${submission.acknowledgement?.ackNumber})`,
                downloadUrl: `${env.API_PREFIX}/po-submissions/${submission.id}/acknowledgement`,
                reference: submission.acknowledgement?.ackNumber,
              },
            ]
          : [],
      },

      // Stage 5: Advance Payment & Verification
      {
        stage: 5,
        code: 'ADVANCE_PAYMENT',
        title: 'Advance Payment & Verification',
        description: isPaymentVerified
          ? `Bank payment receipt verified. Advance amount ₹${Number(b2bPo?.advanceAmount || 0).toLocaleString('en-IN')} confirmed.`
          : latestReceipt?.status === 'PENDING_REVIEW' || latestReceipt?.status === 'ACKNOWLEDGED'
          ? 'Payment receipt submitted by customer and under verification by accounts team.'
          : 'Awaiting 30% advance payment receipt (NEFT / RTGS / Cheque / Bank Transfer).',
        status: isPaymentVerified
          ? 'COMPLETED'
          : latestReceipt?.status === 'REJECTED'
          ? 'ACTION_REQUIRED'
          : latestReceipt
          ? 'IN_PROGRESS'
          : isApproved
          ? 'ACTION_REQUIRED'
          : 'PENDING',
        timestamp: latestReceipt?.verifiedAt || latestReceipt?.uploadedAt,
        actor: latestReceipt?.verifiedBy || undefined,
        metadata: {
          advancePercentage: Number(b2bPo?.advancePercentage || 30),
          advanceAmount: Number(b2bPo?.advanceAmount || 0),
          balanceAmount: Number(b2bPo?.balanceAmount || 0),
          receiptStatus: latestReceipt?.status,
          rejectionReason: latestReceipt?.rejectionReason || undefined,
        },
        artifacts: latestReceipt
          ? [
              {
                type: 'PAYMENT_RECEIPT' as const,
                label: `Payment Receipt (${latestReceipt.originalFileName})`,
                downloadUrl: b2bPo ? `${env.API_PREFIX}/purchase-orders/${b2bPo.id}/receipts/${latestReceipt.id}/file` : undefined,
                reference: latestReceipt.paymentReference || undefined,
              },
            ]
          : [],
      },

      // Stage 6: Stock Allocation & Packing List
      {
        stage: 6,
        code: 'PACKING_LIST_GENERATED',
        title: 'Stock Allocation & Packing List',
        description: isPackingListReady
          ? `Stock allocated from warehouse. QR-coded Packing List generated with ${b2bPo?.packingList?.totalPackages || 1} packages.`
          : 'Stock allocation and physical packaging in progress at warehouse.',
        status: isPackingListReady ? 'COMPLETED' : isPaymentVerified ? 'IN_PROGRESS' : 'PENDING',
        timestamp: b2bPo?.packingList?.generatedAt,
        metadata: {
          totalPackages: b2bPo?.packingList?.totalPackages || 1,
          totalQuantity: b2bPo?.packingList?.totalQuantity || 0,
        },
        artifacts: b2bPo?.packingList
          ? [
              {
                type: 'PACKING_LIST_PDF' as const,
                label: `Packing List (${b2bPo.poNumber})`,
                downloadUrl: `${env.API_PREFIX}/purchase-orders/${b2bPo.id}/packing-list/download`,
              },
            ]
          : [],
      },

      // Stage 7: E-Way Bill & Dispatch Logistics
      {
        stage: 7,
        code: 'DISPATCH_LOGISTICS',
        title: 'E-Way Bill & Dispatch Logistics',
        description: isDispatched
          ? `Consignment dispatched via ${b2bPo?.dispatch?.carrierName || 'PRC Logistics'}. Tracking: ${b2bPo?.dispatch?.trackingNumber || 'In transit'}.`
          : 'Awaiting transporter assignment, vehicle allocation, and E-Way Bill generation (IRIS).',
        status: isDispatched ? 'COMPLETED' : isPackingListReady ? 'IN_PROGRESS' : 'PENDING',
        timestamp: b2bPo?.dispatch?.dispatchedAt,
        actor: b2bPo?.dispatch?.dispatchedByName || undefined,
        metadata: {
          carrierName: b2bPo?.dispatch?.carrierName,
          trackingNumber: b2bPo?.dispatch?.trackingNumber,
          dispatchNotes: b2bPo?.dispatch?.dispatchNotes,
        },
        artifacts: b2bPo?.dispatch?.trackingNumber
          ? [
              {
                type: 'EWAY_BILL' as const,
                label: `Courier Tracking (${b2bPo.dispatch.carrierName})`,
                reference: b2bPo.dispatch.trackingNumber,
              },
            ]
          : [],
      },

      // Stage 8: Commercial Invoicing & PI
      {
        stage: 8,
        code: 'COMMERCIAL_INVOICE',
        title: 'GST Tax Invoice & Proforma',
        description: isInvoiced
          ? `Official GST Tax Invoice #${b2bPo?.invoice?.invoiceNumber} generated with HSN breakdown and IRIS verification.`
          : 'Final commercial invoice generated upon dispatch delivery.',
        status: isInvoiced ? 'COMPLETED' : isDispatched ? 'IN_PROGRESS' : 'PENDING',
        timestamp: b2bPo?.invoice?.generatedAt,
        metadata: {
          invoiceNumber: b2bPo?.invoice?.invoiceNumber,
          amountInvoiced: Number(b2bPo?.invoice?.amountInvoiced || b2bPo?.totalAmount || 0),
          balanceDue: Number(b2bPo?.invoice?.balanceDue || 0),
          source: b2bPo?.invoice?.source || 'INTERNAL',
        },
        artifacts: b2bPo?.invoice
          ? [
              {
                type: 'INVOICE_PDF' as const,
                label: `GST Tax Invoice (${b2bPo.invoice.invoiceNumber})`,
                downloadUrl: `${env.API_PREFIX}/purchase-orders/${b2bPo.id}/invoice/download`,
                reference: b2bPo.invoice.invoiceNumber,
              },
            ]
          : [],
      },
    ];

    const grandTotal = Number(b2bPo?.totalAmount || submission.mappedTotal || submission.statedTotal || 0);
    const advancePercentage = Number(b2bPo?.advancePercentage || 30);
    const advanceAmount = Number(b2bPo?.advanceAmount || Math.round((grandTotal * (advancePercentage / 100)) * 100) / 100);
    const balanceAmount = Number(b2bPo?.balanceAmount || Math.round((grandTotal - advanceAmount) * 100) / 100);

    return {
      submissionId: submission.id,
      submissionNumber: submission.submissionNumber,
      customerPoNumber: submission.customerPoNumber,
      sourceType: submission.sourceType,
      currentStage,
      overallStatus: submission.status,
      b2bPurchaseOrderId: b2bPo?.id,
      masterPoNumber: b2bPo?.poNumber || submission.customerPoNumber,
      commercials: {
        statedTotal: submission.statedTotal ? Number(submission.statedTotal) : undefined,
        mappedTotal: submission.mappedTotal ? Number(submission.mappedTotal) : undefined,
        grandTotal,
        advancePercentage,
        advanceAmount,
        balanceAmount,
        currency: submission.currency || 'INR',
      },
      stages,
    };
  }

  // ─── Admin Action: Reject PO ────────────────────────────────────────────────
  async adminReject(adminUser: any, submissionId: string, reason: string, ipAddress?: string) {
    const po = await prisma.poSubmission.findUnique({
      where: { id: submissionId },
      include: { customer: true },
    });

    if (!po) throw new AppError('NOT_FOUND', 'Submission not found', 404);

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.poSubmission.update({
        where: { id: submissionId },
        data: {
          status: PoSubmissionStatus.REJECTED,
          rejectionReason: reason.trim(),
        },
      });

      await tx.poSubmissionLog.create({
        data: {
          submissionId,
          actorId: adminUser.id,
          action: PoSubmissionAction.REJECTED,
          fromStatus: po.status,
          toStatus: PoSubmissionStatus.REJECTED,
          comment: `PO Rejected: ${reason.trim()}`,
          ipAddress: ipAddress || null,
        },
      });

      sendPoRejectedEmail({
        to: po.customer.email,
        customerName: `${po.customer.firstName} ${po.customer.lastName}`.trim(),
        submissionNumber: po.submissionNumber,
        customerPoNumber: po.customerPoNumber,
        reason: reason.trim(),
      }).catch(() => {});

      return updated;
    });
  }

  // ─── Admin Action: Request Changes ──────────────────────────────────────────
  async adminRequestChanges(adminUser: any, submissionId: string, reason: string, ipAddress?: string) {
    const po = await prisma.poSubmission.findUnique({
      where: { id: submissionId },
      include: { customer: true },
    });

    if (!po) throw new AppError('NOT_FOUND', 'Submission not found', 404);

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.poSubmission.update({
        where: { id: submissionId },
        data: {
          status: PoSubmissionStatus.CHANGES_REQUESTED,
          changeRequestReason: reason.trim(),
        },
      });

      await tx.poSubmissionLog.create({
        data: {
          submissionId,
          actorId: adminUser.id,
          action: PoSubmissionAction.CHANGES_REQUESTED,
          fromStatus: po.status,
          toStatus: PoSubmissionStatus.CHANGES_REQUESTED,
          comment: `Changes requested by reviewer: ${reason.trim()}`,
          ipAddress: ipAddress || null,
        },
      });

      sendChangesRequestedEmail({
        to: po.customer.email,
        customerName: `${po.customer.firstName} ${po.customer.lastName}`.trim(),
        submissionNumber: po.submissionNumber,
        customerPoNumber: po.customerPoNumber,
        reason: reason.trim(),
      }).catch(() => {});

      return updated;
    });
  }

  // ─── Admin Action: Assign Reviewer ──────────────────────────────────────────
  async adminAssign(adminUser: any, submissionId: string, targetAdminUserId: string, ipAddress?: string) {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetAdminUserId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    if (!targetUser) throw new AppError('USER_NOT_FOUND', 'Target staff member not found', 404);

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.poSubmission.update({
        where: { id: submissionId },
        data: { assignedTo: targetAdminUserId },
      });

      await tx.poSubmissionLog.create({
        data: {
          submissionId,
          actorId: adminUser.id,
          action: PoSubmissionAction.ASSIGNED,
          comment: `Assigned to ${targetUser.firstName || targetUser.email} by ${adminUser.firstName || adminUser.email}`,
          ipAddress: ipAddress || null,
        },
      });

      return updated;
    });
  }

  // ─── Admin Action: Add Internal Note ────────────────────────────────────────
  async adminAddInternalNote(adminUser: any, submissionId: string, note: string, ipAddress?: string) {
    const po = await prisma.poSubmission.findUnique({ where: { id: submissionId } });
    if (!po) throw new AppError('NOT_FOUND', 'Submission not found', 404);

    return await prisma.poSubmissionLog.create({
      data: {
        submissionId,
        actorId: adminUser.id,
        action: PoSubmissionAction.INTERNAL_NOTE,
        isInternal: true,
        comment: note.trim(),
        ipAddress: ipAddress || null,
      },
    });
  }

  // ─── File Stream Handlers ───────────────────────────────────────────────────
  async getAttachmentStream(attachmentId: string, userId: string, isAdmin = false) {
    const attachment = await prisma.poSubmissionAttachment.findUnique({
      where: { id: attachmentId },
      include: { submission: true },
    });

    if (!attachment) throw new AppError('NOT_FOUND', 'Attachment not found', 404);

    if (!isAdmin && attachment.submission.customerId !== userId) {
      throw new AppError('FORBIDDEN', 'Access denied', 403);
    }

    const filePath = path.join(ATTACHMENTS_DIR, attachment.fileStorageKey);
    if (!fs.existsSync(filePath)) {
      throw new AppError('FILE_NOT_FOUND', 'File not found on storage disk', 404);
    }

    return {
      filePath,
      originalFileName: attachment.originalFileName,
      mimeType: attachment.mimeType,
    };
  }

  async getPdfSignedUrl(submissionId: string, adminUser: any) {
    const attachment = await prisma.poSubmissionAttachment.findFirst({
      where: { submissionId },
      orderBy: { uploadedAt: 'desc' },
    });

    if (!attachment) {
      throw new AppError('NOT_FOUND', 'No uploaded PDF attachment found for this submission', 404);
    }

    // Generate a temporary JWT token valid for 30 minutes
    const token = jwt.sign(
      {
        attachmentId: attachment.id,
        submissionId,
        adminId: adminUser.id,
      },
      env.jwt.accessSecret,
      { expiresIn: '30m' }
    );

    const streamUrl = `${env.API_PREFIX}/po-submissions/view-attachment?token=${token}`;
    return {
      url: streamUrl,
      attachmentId: attachment.id,
      fileName: attachment.originalFileName,
      fileSizeBytes: attachment.fileSizeBytes,
      expiresInMinutes: 30,
    };
  }

  async getAcknowledgementStream(submissionId: string, userId: string, isAdmin = false) {
    const po = await prisma.poSubmission.findUnique({
      where: { id: submissionId },
      include: { acknowledgement: true },
    });

    if (!po || !po.acknowledgement) {
      throw new AppError('NOT_FOUND', 'Order Acknowledgement not yet generated for this PO', 404);
    }

    if (!isAdmin && po.customerId !== userId) {
      throw new AppError('FORBIDDEN', 'Access denied', 403);
    }

    const filePath = path.join(ACKS_DIR, po.acknowledgement.fileStorageKey);
    if (!fs.existsSync(filePath)) {
      throw new AppError('FILE_NOT_FOUND', 'Acknowledgement PDF file missing from storage', 404);
    }

    return {
      filePath,
      ackNumber: po.acknowledgement.ackNumber,
    };
  }

  async deleteSubmission(userId: string, submissionId: string) {
    const po = await prisma.poSubmission.findUnique({ where: { id: submissionId } });
    if (!po) throw new AppError('NOT_FOUND', 'Submission not found', 404);
    if (po.customerId !== userId) throw new AppError('FORBIDDEN', 'Access denied', 403);

    if (po.status !== PoSubmissionStatus.DRAFT && po.status !== PoSubmissionStatus.SUBMITTED) {
      throw new AppError('CANNOT_DELETE', 'Only pending submissions can be cancelled/deleted', 400);
    }

    await prisma.poSubmission.delete({ where: { id: submissionId } });
    return { success: true };
  }
}

export const poSubmissionsService = new PoSubmissionsService();
