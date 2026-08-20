/**
 * po-submissions.service.ts
 *
 * Core business logic for Dual-mode Purchase Order Intake (Form & Native PDF).
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Prisma, PoSourceType, PoSubmissionStatus, LineItemSource, PoSubmissionAction } from '@prisma/client';
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

function generateDefaultPoNumber(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PO-${yyyy}${mm}${dd}-${rand}`;
}

export class PoSubmissionsService {
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
      : generateDefaultPoNumber();

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
      : generateDefaultPoNumber();

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

      await tx.poSubmissionLog.create({
        data: {
          submissionId,
          actorId: adminUser.id,
          action: PoSubmissionAction.APPROVED,
          fromStatus: po.status,
          toStatus: PoSubmissionStatus.APPROVED,
          comment: `PO Approved by ${adminUser.firstName || adminUser.email}.${input.confirmMismatch ? ' [Variance explicitly confirmed by admin]' : ''}`,
          metadata: {
            mappedTotal: mapped,
            statedTotal: stated,
            varianceConfirmed: !!input.confirmMismatch,
          },
          ipAddress: ipAddress || null,
        },
      });

      return res;
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

    if (po.status !== PoSubmissionStatus.APPROVED) {
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

      await tx.poSubmissionLog.create({
        data: {
          submissionId: po.id,
          actorId: adminUser.id,
          action: PoSubmissionAction.ACKNOWLEDGED,
          fromStatus: PoSubmissionStatus.APPROVED,
          toStatus: PoSubmissionStatus.ACKNOWLEDGED,
          comment: `Formal Acknowledgement ${ackNumber} issued & dispatched to customer. Total: ₹${grandTotal.toFixed(2)}`,
          metadata: { ackNumber, grandTotal },
          ipAddress: ipAddress || null,
        },
      });

      return { ack, po: updatedPo };
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
