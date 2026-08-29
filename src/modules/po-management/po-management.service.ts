import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { logger } from '../../config/logger';
import { eventBus } from '../../events/eventBus';
import {
  PoClassification,
  PoPriority,
  PoSource,
  PoStatus,
  EmailDirection,
  PoListFilters,
  PoManagementMetrics,
} from './po.types';
import { generatePoSubmissionId } from './po-sequence.service';

/**
 * List PO Submissions with filtering, search, sorting and pagination
 */
export async function listPoSubmissions(filters: PoListFilters) {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 15));
  const skip = (page - 1) * limit;

  const where: any = {};

  // 1. Classification / Tab Filter
  if (filters.tab && filters.tab !== 'ALL') {
    where.classification = filters.tab as PoClassification;
  } else if (filters.classification) {
    where.classification = filters.classification;
  }

  // 2. Status & Priority
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.source) where.source = filters.source;

  // 3. Staff & Department Assignment
  if (filters.assignedUserId) where.assignedUserId = filters.assignedUserId;
  if (filters.assignedDepartment) where.assignedDepartment = filters.assignedDepartment;

  // 4. Date Range
  if (filters.fromDate || filters.toDate) {
    where.receivedAt = {};
    if (filters.fromDate) where.receivedAt.gte = new Date(filters.fromDate);
    if (filters.toDate) {
      const to = new Date(filters.toDate);
      to.setHours(23, 59, 59, 999);
      where.receivedAt.lte = to;
    }
  }

  // 5. Powerful Multi-Field Search
  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { poSubmissionId: { contains: q, mode: 'insensitive' } },
      { customerPoNumber: { contains: q, mode: 'insensitive' } },
      { customerName: { contains: q, mode: 'insensitive' } },
      { companyName: { contains: q, mode: 'insensitive' } },
      { customerEmail: { contains: q, mode: 'insensitive' } },
      { subject: { contains: q, mode: 'insensitive' } },
    ];
  }

  // 6. Sorting (Newest activity / newest received first)
  const sortBy = filters.sortBy || 'lastActivityAt';
  const sortOrder = filters.sortOrder || 'desc';
  const orderBy: any = [{ [sortBy]: sortOrder }, { receivedAt: 'desc' }];

  const [items, totalItems] = await Promise.all([
    prisma.poSubmission.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        assignedUser: {
          select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
        },
        _count: {
          select: {
            emails: true,
            attachments: true,
            internalNotes: true,
          },
        },
      },
    }),
    prisma.poSubmission.count({ where }),
  ]);

  const totalPages = Math.ceil(totalItems / limit) || 1;

  return {
    items,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

/**
 * Retrieve high-level aggregate metrics for the PO Management dashboard
 */
export async function getPoMetrics(): Promise<PoManagementMetrics> {
  const [
    totalReceived,
    poDetectedCount,
    possiblePoCount,
    generalEmailCount,
    newCount,
    inReviewCount,
    processingCount,
    completedCount,
    urgentCount,
  ] = await Promise.all([
    prisma.poSubmission.count(),
    prisma.poSubmission.count({ where: { classification: PoClassification.PO_DETECTED } }),
    prisma.poSubmission.count({ where: { classification: PoClassification.POSSIBLE_PO } }),
    prisma.poSubmission.count({ where: { classification: PoClassification.GENERAL_EMAIL } }),
    prisma.poSubmission.count({ where: { status: PoStatus.NEW } }),
    prisma.poSubmission.count({ where: { status: PoStatus.UNDER_REVIEW } }),
    prisma.poSubmission.count({ where: { status: PoStatus.PROCESSING } }),
    prisma.poSubmission.count({ where: { status: PoStatus.COMPLETED } }),
    prisma.poSubmission.count({ where: { priority: PoPriority.URGENT } }),
  ]);

  return {
    totalReceived,
    poDetectedCount,
    possiblePoCount,
    generalEmailCount,
    newCount,
    inReviewCount,
    processingCount,
    completedCount,
    urgentCount,
  };
}

/**
 * Get comprehensive PO Dossier with nested emails, attachments, timeline and internal notes
 */
export async function getPoSubmissionById(id: string) {
  const submission = await prisma.poSubmission.findFirst({
    where: {
      OR: [{ id }, { poSubmissionId: id }],
    },
    include: {
      assignedUser: {
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true },
      },
      emails: {
        orderBy: { receivedAt: 'asc' },
        include: { attachments: true },
      },
      attachments: {
        orderBy: { createdAt: 'desc' },
      },
      internalNotes: {
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
          },
        },
      },
      activityLogs: {
        orderBy: { createdAt: 'desc' },
        include: {
          performedByUser: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
    },
  });

  if (!submission) {
    throw new AppError('NOT_FOUND', 'Purchase Order submission not found', 404);
  }

  return submission;
}

/**
 * Update PO Status with audit logging
 */
export async function updatePoStatus(
  id: string,
  newStatus: PoStatus,
  performedByUserId?: string,
  comment?: string
) {
  const po = await prisma.poSubmission.findUnique({ where: { id } });
  if (!po) throw new AppError('NOT_FOUND', 'Purchase Order submission not found', 404);

  const previousStatus = po.status;
  if (previousStatus === newStatus) return po;

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.poSubmission.update({
      where: { id },
      data: {
        status: newStatus,
        lastActivityAt: new Date(),
      },
    });

    await tx.poActivityLog.create({
      data: {
        poSubmissionId: id,
        activityType: 'STATUS_CHANGED',
        title: 'Status Updated',
        description: `Status changed from ${previousStatus} to ${newStatus}${comment ? `. Note: ${comment}` : ''}`,
        previousValue: previousStatus,
        newValue: newStatus,
        performedByUserId: performedByUserId || null,
      },
    });

    return res;
  });

  eventBus.emitEvent('po.updated', {
    id: po.id,
    poSubmissionId: po.poSubmissionId,
    status: newStatus,
    action: 'STATUS_CHANGED',
  });

  return updated;
}

/**
 * Update PO Priority
 */
export async function updatePoPriority(
  id: string,
  newPriority: PoPriority,
  performedByUserId?: string
) {
  const po = await prisma.poSubmission.findUnique({ where: { id } });
  if (!po) throw new AppError('NOT_FOUND', 'Purchase Order submission not found', 404);

  const previousPriority = po.priority;
  if (previousPriority === newPriority) return po;

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.poSubmission.update({
      where: { id },
      data: {
        priority: newPriority,
        lastActivityAt: new Date(),
      },
    });

    await tx.poActivityLog.create({
      data: {
        poSubmissionId: id,
        activityType: 'PRIORITY_CHANGED',
        title: 'Priority Updated',
        description: `Priority changed from ${previousPriority} to ${newPriority}`,
        previousValue: previousPriority,
        newValue: newPriority,
        performedByUserId: performedByUserId || null,
      },
    });

    return res;
  });

  return updated;
}

/**
 * Assign PO to an employee or department
 */
export async function assignPoSubmission(
  id: string,
  assignedUserId?: string | null,
  assignedDepartment?: string | null,
  performedByUserId?: string
) {
  const po = await prisma.poSubmission.findUnique({ where: { id } });
  if (!po) throw new AppError('NOT_FOUND', 'Purchase Order submission not found', 404);

  let assignedUserName = 'Unassigned';
  if (assignedUserId) {
    const user = await prisma.user.findUnique({
      where: { id: assignedUserId },
      select: { firstName: true, lastName: true, email: true },
    });
    if (user) assignedUserName = `${user.firstName} ${user.lastName}`.trim() || user.email;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.poSubmission.update({
      where: { id },
      data: {
        assignedUserId: assignedUserId || null,
        assignedDepartment: assignedDepartment || null,
        lastActivityAt: new Date(),
      },
    });

    await tx.poActivityLog.create({
      data: {
        poSubmissionId: id,
        activityType: 'ASSIGNED',
        title: 'Assignment Updated',
        description: `Assigned to ${assignedUserName}${assignedDepartment ? ` (${assignedDepartment})` : ''}`,
        newValue: assignedUserId || assignedDepartment || 'Unassigned',
        performedByUserId: performedByUserId || null,
      },
    });

    return res;
  });

  return updated;
}

/**
 * Manually override PO Classification (Promote/Demote)
 */
export async function updatePoClassification(
  id: string,
  newClassification: PoClassification,
  performedByUserId?: string
) {
  const po = await prisma.poSubmission.findUnique({ where: { id } });
  if (!po) throw new AppError('NOT_FOUND', 'Purchase Order submission not found', 404);

  const previousClassification = po.classification;
  if (previousClassification === newClassification) return po;

  // If newly classified as PO or Possible PO and doesn't have an ID yet, generate one
  let newPoId = po.poSubmissionId;
  if (
    !newPoId &&
    (newClassification === PoClassification.PO_DETECTED ||
      newClassification === PoClassification.POSSIBLE_PO)
  ) {
    newPoId = await generatePoSubmissionId();
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.poSubmission.update({
      where: { id },
      data: {
        classification: newClassification,
        poSubmissionId: newPoId,
        lastActivityAt: new Date(),
      },
    });

    await tx.poActivityLog.create({
      data: {
        poSubmissionId: id,
        activityType: 'RECLASSIFIED',
        title: 'Classification Manually Overridden',
        description: `Classification changed from ${previousClassification} to ${newClassification}${
          newPoId ? ` (Assigned ID: ${newPoId})` : ''
        }`,
        previousValue: previousClassification,
        newValue: newClassification,
        performedByUserId: performedByUserId || null,
      },
    });

    return res;
  });

  return updated;
}

/**
 * Update Customer's own PO Number reference
 */
export async function updateCustomerPoNumber(
  id: string,
  customerPoNumber: string,
  performedByUserId?: string
) {
  const po = await prisma.poSubmission.findUnique({ where: { id } });
  if (!po) throw new AppError('NOT_FOUND', 'Purchase Order submission not found', 404);

  const previousPoNo = po.customerPoNumber;
  const cleanPoNo = customerPoNumber ? customerPoNumber.trim() : null;

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.poSubmission.update({
      where: { id },
      data: {
        customerPoNumber: cleanPoNo,
        lastActivityAt: new Date(),
      },
    });

    await tx.poActivityLog.create({
      data: {
        poSubmissionId: id,
        activityType: 'CUSTOMER_PO_NUMBER_UPDATED',
        title: 'Customer PO Number Updated',
        description: `Customer PO Number set to "${cleanPoNo || 'None'}" (was "${previousPoNo || 'None'}")`,
        previousValue: previousPoNo || '',
        newValue: cleanPoNo || '',
        performedByUserId: performedByUserId || null,
      },
    });

    return res;
  });

  return updated;
}

/**
 * Add an Internal Note to a PO Submission
 */
export async function addInternalNote(
  poSubmissionId: string,
  userId: string,
  note: string
) {
  const po = await prisma.poSubmission.findUnique({ where: { id: poSubmissionId } });
  if (!po) throw new AppError('NOT_FOUND', 'Purchase Order submission not found', 404);

  const cleanNote = (note || '').trim();
  if (!cleanNote) throw new AppError('BAD_REQUEST', 'Note content cannot be empty', 400);

  const createdNote = await prisma.$transaction(async (tx) => {
    const newNote = await tx.poInternalNote.create({
      data: {
        poSubmissionId,
        userId,
        note: cleanNote,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
        },
      },
    });

    await tx.poSubmission.update({
      where: { id: poSubmissionId },
      data: { lastActivityAt: new Date() },
    });

    await tx.poActivityLog.create({
      data: {
        poSubmissionId,
        activityType: 'INTERNAL_NOTE',
        title: 'Internal Note Added',
        description: cleanNote.length > 80 ? `${cleanNote.slice(0, 80)}...` : cleanNote,
        performedByUserId: userId,
      },
    });

    return newNote;
  });

  return createdNote;
}

/**
 * Delete a PO Submission and all associated emails/attachments/notes
 */
export async function deletePoSubmission(id: string, performedByUserId?: string) {
  const po = await prisma.poSubmission.findUnique({
    where: { id },
    select: { id: true, poSubmissionId: true, customerEmail: true, subject: true },
  });

  if (!po) {
    throw new AppError('NOT_FOUND', 'Purchase Order submission not found', 404);
  }

  await prisma.poSubmission.delete({
    where: { id },
  });

  eventBus.emitEvent('po.deleted', {
    id: po.id,
    poSubmissionId: po.poSubmissionId,
    reason: 'MANUAL_DELETION',
  });

  logger.info(
    `[PO Management] Deleted PO Submission: ${po.poSubmissionId || po.id} (${po.subject}) by user ${performedByUserId || 'system'}`
  );

  return { success: true, id: po.id };
}

/**
 * Bulk delete multiple PO Submissions in one atomic operation
 */
export async function bulkDeletePoSubmissions(ids: string[], performedByUserId?: string) {
  if (!ids || ids.length === 0) {
    throw new AppError('BAD_REQUEST', 'No PO Submission IDs provided', 400);
  }

  const existing = await prisma.poSubmission.findMany({
    where: { id: { in: ids } },
    select: { id: true, poSubmissionId: true, subject: true },
  });

  if (existing.length === 0) {
    return { success: true, deletedCount: 0, ids: [] };
  }

  await prisma.poSubmission.deleteMany({
    where: { id: { in: existing.map((e) => e.id) } },
  });

  // Emit po.deleted for each deleted item so all SSE connected clients remove them
  for (const item of existing) {
    eventBus.emitEvent('po.deleted', {
      id: item.id,
      poSubmissionId: item.poSubmissionId,
      reason: 'BULK_DELETION',
    });
  }

  logger.info(
    `[PO Management] Bulk deleted ${existing.length} PO Submissions by user ${performedByUserId || 'system'}`
  );

  return {
    success: true,
    deletedCount: existing.length,
    ids: existing.map((e) => e.id),
  };
}

/**
 * Reply to a customer's PO/Email with optional attachments and status advance
 */
export async function replyToPoSubmission(
  poId: string,
  replyData: {
    to?: string;
    subject: string;
    message: string;
    cc?: string | string[];
    bcc?: string | string[];
    newStatus?: PoStatus;
  },
  files: Express.Multer.File[] = [],
  currentUserId?: string
) {
  const { uploadAttachmentFile } = await import('../upload/upload.service');
  const { sendMail } = await import('../../utils/email.utils');
  const { env } = await import('../../config/env');
  const { v4: uuidv4 } = await import('uuid');

  const po = await prisma.poSubmission.findUnique({
    where: { id: poId },
    include: {
      emails: {
        orderBy: { receivedAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!po) {
    throw new AppError('NOT_FOUND', 'PO Submission not found', 404);
  }

  const recipientEmail = (replyData.to || po.customerEmail || '').trim();
  if (!recipientEmail) {
    throw new AppError('BAD_REQUEST', 'Recipient email address is required', 400);
  }

  const latestEmail = po.emails[0];
  const inReplyTo = latestEmail?.messageId;
  const references = latestEmail ? [...(latestEmail.references || []), latestEmail.messageId] : [];

  // Parse CC and BCC
  const parseList = (val?: string | string[]): string[] | undefined => {
    if (!val) return undefined;
    if (Array.isArray(val)) return val.map((s) => s.trim()).filter(Boolean);
    return val.split(',').map((s) => s.trim()).filter(Boolean);
  };

  const ccList = parseList(replyData.cc);
  const bccList = parseList(replyData.bcc);

  // 1. Process and Upload Attachments
  const emailAttachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
  const storedAttachments: Array<{
    fileName: string;
    fileType: string;
    fileSize: number;
    storagePath: string;
    storageUrl: string;
  }> = [];

  if (files && files.length > 0) {
    for (const file of files) {
      const storageUrl = await uploadAttachmentFile(
        {
          originalname: file.originalname,
          mimetype: file.mimetype,
          buffer: file.buffer,
          size: file.size,
        },
        'po-attachments'
      );

      emailAttachments.push({
        filename: file.originalname,
        content: file.buffer,
        contentType: file.mimetype,
      });

      storedAttachments.push({
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        storagePath: `po-attachments/${file.originalname}`,
        storageUrl,
      });
    }
  }

  // 2. Format HTML email body
  const escapedText = replyData.message.replace(/\n/g, '<br/>');
  const formattedHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">
      <div style="padding-bottom: 16px;">
        ${escapedText}
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
      <div style="font-size: 12px; color: #64748b;">
        <strong>PRC Hardware</strong><br/>
        PO Reference: ${po.poSubmissionId || 'General Inquiry'}<br/>
        <a href="https://prchardware.com" style="color: #8b5cf6; text-decoration: none;">prchardware.com</a>
      </div>
    </div>
  `;

  // 3. Send Email via sendMail
  const outboundMessageId = `<prc-po-reply-${Date.now()}-${uuidv4()}@${env.smtp.host?.replace(/^smtp\./, '') || 'pacifichardware.com'}>`;

  let emailDeliveryError: string | null = null;
  try {
    await sendMail({
      to: recipientEmail,
      subject: replyData.subject,
      text: replyData.message,
      html: formattedHtml,
      cc: ccList,
      bcc: bccList,
      inReplyTo,
      references,
      attachments: emailAttachments,
    });
  } catch (mailErr: any) {
    emailDeliveryError = mailErr?.message || 'SMTP delivery failure';
    logger.error(`[PO Management] Could not dispatch outbound email to ${recipientEmail}: ${emailDeliveryError}`);
  }

  // 4. Save outbound message, attachments, activity log, and status in DB
  const nextStatus = replyData.newStatus || (po.status === 'NEW' ? 'WAITING_FOR_CUSTOMER' : po.status);

  // a. Create PoEmailMessage
  const emailMsg = await prisma.poEmailMessage.create({
    data: {
      poSubmissionId: po.id,
      messageId: outboundMessageId,
      threadId: latestEmail?.threadId || inReplyTo,
      inReplyTo,
      references,
      direction: 'OUTGOING',
      senderName: env.smtp.fromName || 'PRC Hardware Support',
      senderEmail: env.smtp.fromEmail || 'po@pacifichardware.com',
      recipientEmail,
      cc: ccList || [],
      bcc: bccList || [],
      subject: replyData.subject,
      plainTextBody: replyData.message,
      htmlBody: formattedHtml,
      receivedAt: new Date(),
    },
  });

  // b. Create PoEmailAttachment records
  if (storedAttachments.length > 0) {
    await prisma.poEmailAttachment.createMany({
      data: storedAttachments.map((att) => ({
        poSubmissionId: po.id,
        emailMessageId: emailMsg.id,
        fileName: att.fileName,
        fileType: att.fileType,
        fileSize: att.fileSize,
        storagePath: att.storagePath,
        storageUrl: att.storageUrl,
      })),
    });
  }

  // c. Update PoSubmission status and lastActivityAt
  await prisma.poSubmission.update({
    where: { id: po.id },
    data: {
      status: nextStatus,
      lastActivityAt: new Date(),
    },
  });

  // d. Create Activity Log
  try {
    await prisma.poActivityLog.create({
      data: {
        poSubmissionId: po.id,
        activityType: 'REPLIED',
        title: emailDeliveryError ? 'Reply Recorded (Email Failed)' : 'Reply Sent to Customer',
        description: emailDeliveryError
          ? `Reply recorded in thread with subject "${replyData.subject}". Outbound delivery notice: ${emailDeliveryError}`
          : `Reply sent with subject "${replyData.subject}" and ${storedAttachments.length} attachment(s) to ${recipientEmail}`,
        performedByUserId: currentUserId || null,
        metadata: {
          to: recipientEmail,
          subject: replyData.subject,
          attachmentsCount: storedAttachments.length,
          newStatus: nextStatus,
          deliveryError: emailDeliveryError,
        },
      },
    });
  } catch (logErr) {
    logger.warn('[PO Management] Could not write activity log for reply:', logErr);
  }

  const updatedPo = await getPoSubmissionById(po.id);

  // 5. Broadcast SSE event
  eventBus.emitEvent('po.updated', {
    id: updatedPo.id,
    poSubmissionId: updatedPo.poSubmissionId,
    status: updatedPo.status,
    action: 'REPLIED',
  });

  logger.info(
    `[PO Management] Replied to PO Submission ${po.poSubmissionId || po.id} (${recipientEmail}) with ${storedAttachments.length} attachments by user ${currentUserId || 'system'}`
  );

  return updatedPo;
}

/**
 * Customer Storefront PO Submission (Quotation-linked, Custom Form, Direct Upload)
 */
export async function createCustomerPoSubmission(
  input: {
    source: PoSource;
    customerName: string;
    companyName?: string | null;
    customerEmail: string;
    customerPhone?: string | null;
    customerPoNumber?: string | null;
    quoteId?: string | null;
    quoteNumber?: string | null;
    subject?: string | null;
    notes?: string | null;
    billingAddress?: string | null;
    shippingAddress?: string | null;
    gstin?: string | null;
    deliveryTimeline?: string | null;
    paymentTerms?: string | null;
    priority?: PoPriority;
    lineItems?: Array<{
      productName: string;
      sku?: string;
      quantity: number;
      unit?: string;
      targetRate?: number;
      totalPrice?: number;
      specifications?: string;
    }>;
  },
  files: Express.Multer.File[] = []
) {
  const { uploadAttachmentFile } = await import('../upload/upload.service');
  const { sendMail } = await import('../../utils/email.utils');
  const { notifyAdmins } = await import('../notifications/admin-notification.service');
  const { v4: uuidv4 } = await import('uuid');

  // 1. Generate unique PO Submission ID
  const poSubmissionId = await generatePoSubmissionId();

  // 2. Determine subject & labels
  const customerOrCompany = input.companyName?.trim() || input.customerName.trim();
  const sourceLabel =
    input.source === PoSource.QUOTATION
      ? `Quote PO [${input.quoteNumber || 'Linked Quote'}]`
      : input.source === PoSource.PO_FORM
      ? 'Custom PO Form'
      : 'Direct PO Upload';

  const defaultSubject = input.subject?.trim() || `[${sourceLabel}] Purchase Order - ${customerOrCompany}`;

  // 3. Process and Upload Attachments
  const storedAttachments: Array<{
    fileName: string;
    fileType: string;
    fileSize: number;
    storagePath: string;
    storageUrl: string;
  }> = [];

  if (files && files.length > 0) {
    for (const file of files) {
      try {
        const storageUrl = await uploadAttachmentFile(
          {
            originalname: file.originalname,
            mimetype: file.mimetype,
            buffer: file.buffer,
            size: file.size,
          },
          'po-attachments'
        );

        storedAttachments.push({
          fileName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          storagePath: `po-attachments/${file.originalname}`,
          storageUrl,
        });
      } catch (err: any) {
        logger.error(`[Customer PO Submission] Failed to upload file ${file.originalname}:`, err);
      }
    }
  }

  // 4. Generate Line Items & HTML summary
  let items = Array.isArray(input.lineItems) ? [...input.lineItems] : [];

  if (items.length === 0 && input.source === 'QUOTATION' && (input.quoteId || input.quoteNumber)) {
    try {
      const dbQuote = await prisma.quote.findFirst({
        where: {
          isDeleted: false,
          OR: [
            ...(input.quoteId ? [{ id: input.quoteId }] : []),
            ...(input.quoteNumber
              ? [
                  { referenceNo: { equals: input.quoteNumber, mode: 'insensitive' as const } },
                  { quoteNumber: { equals: input.quoteNumber, mode: 'insensitive' as const } },
                ]
              : []),
          ],
        },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
        },
      });

      if (dbQuote && dbQuote.items && dbQuote.items.length > 0) {
        items = dbQuote.items.map((it) => ({
          productName: it.productNameSnapshot || it.product?.name || 'Hardware Fitting',
          sku: it.product?.sku || undefined,
          quantity: it.quantity,
          unit: it.unit || 'PCS',
          targetRate: it.rate !== null ? Number(it.rate) : 0,
          totalPrice: it.amount !== null ? Number(it.amount) : Number(it.quantity) * Number(it.rate || 0),
          specifications: `Quote Ref: ${dbQuote.referenceNo || dbQuote.quoteNumber}`,
        }));
      }
    } catch (err) {
      logger.warn('[Customer PO] Could not auto-fetch quote items from DB:', err);
    }
  }

  const totalAmount = items.reduce(
    (sum, it) => sum + (Number(it.totalPrice) || Number(it.quantity) * Number(it.targetRate) || 0),
    0
  );

  let itemsHtml = '';
  if (items.length > 0) {
    itemsHtml = `
      <div style="margin-top: 16px;">
        <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 13px; font-weight: 700; text-transform: uppercase;">Line Items (${items.length})</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 12px;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left;">
              <th style="padding: 8px 10px; color: #475569;">#</th>
              <th style="padding: 8px 10px; color: #475569;">Item / Description</th>
              <th style="padding: 8px 10px; color: #475569;">SKU</th>
              <th style="padding: 8px 10px; text-align: right; color: #475569;">Qty</th>
              <th style="padding: 8px 10px; text-align: right; color: #475569;">Expected Rate (₹)</th>
              <th style="padding: 8px 10px; text-align: right; color: #475569;">Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (it, idx) => `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 10px; color: #64748b;">${idx + 1}</td>
                <td style="padding: 8px 10px; font-weight: 600; color: #0f172a;">
                  ${it.productName}
                  ${it.specifications ? `<br/><span style="font-size: 11px; color: #64748b; font-weight: normal;">${it.specifications}</span>` : ''}
                </td>
                <td style="padding: 8px 10px; color: #64748b; font-family: monospace;">${it.sku || '-'}</td>
                <td style="padding: 8px 10px; text-align: right; font-weight: 600;">${it.quantity} ${it.unit || 'PCS'}</td>
                <td style="padding: 8px 10px; text-align: right;">₹${Number(it.targetRate || 0).toLocaleString('en-IN')}</td>
                <td style="padding: 8px 10px; text-align: right; font-weight: 700; color: #7c3aed;">₹${(Number(it.totalPrice) || Number(it.quantity) * Number(it.targetRate || 0)).toLocaleString('en-IN')}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
          ${
            totalAmount > 0
              ? `
            <tfoot>
              <tr style="background: #f8fafc; font-weight: bold; border-top: 2px solid #e2e8f0;">
                <td colspan="5" style="padding: 8px 10px; text-align: right; color: #334155;">Estimated Total:</td>
                <td style="padding: 8px 10px; text-align: right; color: #7c3aed; font-size: 13px;">₹${totalAmount.toLocaleString('en-IN')}</td>
              </tr>
            </tfoot>
          `
              : ''
          }
        </table>
      </div>
    `;
  }

  const formattedHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #1e293b;">
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
        <h3 style="margin: 0 0 12px 0; color: #0f172a; font-size: 15px;">Purchase Order Submission</h3>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 12px;">
          <div><strong>PO Reference:</strong> ${poSubmissionId}</div>
          <div><strong>Submission Channel:</strong> <span style="background: #ede9fe; color: #7c3aed; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${sourceLabel}</span></div>
          <div><strong>Customer / Contact:</strong> ${input.customerName}</div>
          <div><strong>Email:</strong> ${input.customerEmail}</div>
          ${input.customerPhone ? `<div><strong>Phone:</strong> ${input.customerPhone}</div>` : ''}
          ${input.companyName ? `<div><strong>Company:</strong> ${input.companyName}</div>` : ''}
          ${input.gstin ? `<div><strong>GSTIN:</strong> <span style="font-family: monospace;">${input.gstin}</span></div>` : ''}
          ${input.customerPoNumber ? `<div><strong>Customer PO #:</strong> <span style="font-family: monospace; font-weight: bold;">${input.customerPoNumber}</span></div>` : ''}
          ${input.quoteNumber ? `<div><strong>Linked Quote #:</strong> <span style="font-family: monospace;">${input.quoteNumber}</span></div>` : ''}
          ${input.deliveryTimeline ? `<div><strong>Required Delivery:</strong> ${input.deliveryTimeline}</div>` : ''}
          ${input.paymentTerms ? `<div><strong>Payment Terms:</strong> ${input.paymentTerms}</div>` : ''}
        </div>
      </div>

      ${
        input.billingAddress || input.shippingAddress
          ? `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px; font-size: 12px;">
          ${input.billingAddress ? `<div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;"><strong>Billing Address:</strong><br/>${input.billingAddress.replace(/\n/g, '<br/>')}</div>` : ''}
          ${input.shippingAddress ? `<div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;"><strong>Shipping / Site Address:</strong><br/>${input.shippingAddress.replace(/\n/g, '<br/>')}</div>` : ''}
        </div>
      `
          : ''
      }

      ${itemsHtml}

      ${
        input.notes
          ? `
        <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px; margin-top: 12px;">
          <strong style="color: #92400e; font-size: 12px;">Customer Remarks & Instructions:</strong>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #78350f; white-space: pre-line;">${input.notes}</p>
        </div>
      `
          : ''
      }

      ${
        storedAttachments.length > 0
          ? `
        <div style="margin-top: 16px;">
          <h4 style="margin: 0 0 6px 0; color: #475569; font-size: 12px;">Attached Documents (${storedAttachments.length})</h4>
          <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #2563eb;">
            ${storedAttachments.map((a) => `<li>${a.fileName} (${(a.fileSize / 1024).toFixed(1)} KB)</li>`).join('')}
          </ul>
        </div>
      `
          : ''
      }

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0 12px 0;" />
      <div style="font-size: 11px; color: #64748b;">
        Submitted via PRC Hardware Storefront • ${new Date().toLocaleString('en-IN')}
      </div>
    </div>
  `;

  const plainText = `
Purchase Order Submission (${poSubmissionId})
Channel: ${sourceLabel}
Customer: ${input.customerName} <${input.customerEmail}>
Company: ${input.companyName || 'N/A'}
Phone: ${input.customerPhone || 'N/A'}
GSTIN: ${input.gstin || 'N/A'}
Customer PO #: ${input.customerPoNumber || 'N/A'}
Quote Reference: ${input.quoteNumber || 'N/A'}
Delivery Timeline: ${input.deliveryTimeline || 'Standard'}
Payment Terms: ${input.paymentTerms || 'Standard'}

${items.length > 0 ? `Line Items:\n` + items.map((it, i) => `${i + 1}. ${it.productName} (Qty: ${it.quantity} ${it.unit || 'PCS'}) @ ₹${it.targetRate || 0} = ₹${it.totalPrice || 0}`).join('\n') : ''}

Remarks:
${input.notes || 'None'}
  `.trim();

  // 5. Atomic DB Transaction
  const messageId = `storefront-po-${Date.now()}-${uuidv4()}@pacifichardware.com`;
  const senderEmailNormalized = input.customerEmail.toLowerCase().trim();

  const createdRecord = await prisma.$transaction(async (tx) => {
    // A. Create PoSubmission
    const submission = await tx.poSubmission.create({
      data: {
        poSubmissionId,
        source: input.source,
        classification: PoClassification.PO_DETECTED,
        confidenceScore: 1.0,
        customerPoNumber: input.customerPoNumber?.trim() || null,
        customerName: input.customerName.trim(),
        companyName: input.companyName?.trim() || null,
        customerEmail: senderEmailNormalized,
        customerPhone: input.customerPhone?.trim() || null,
        subject: defaultSubject,
        previewText: plainText.slice(0, 240),
        status: PoStatus.NEW,
        priority: input.priority || PoPriority.MEDIUM,
        receivedAt: new Date(),
        lastActivityAt: new Date(),
        metadata: {
          source: input.source,
          quoteId: input.quoteId || null,
          quoteNumber: input.quoteNumber || null,
          gstin: input.gstin || null,
          billingAddress: input.billingAddress || null,
          shippingAddress: input.shippingAddress || null,
          deliveryTimeline: input.deliveryTimeline || null,
          paymentTerms: input.paymentTerms || null,
          lineItems: items,
          totalEstimatedValue: totalAmount,
          submissionType: 'STOREFRONT_CUSTOMER',
        },
      },
    });

    // B. Create Initial Email Message Record (Threads everything into /po-detail view)
    const emailMsg = await tx.poEmailMessage.create({
      data: {
        poSubmissionId: submission.id,
        messageId,
        threadId: submission.id,
        direction: EmailDirection.INCOMING,
        senderName: input.customerName,
        senderEmail: senderEmailNormalized,
        recipientEmail: 'po@pacifichardware.com',
        subject: defaultSubject,
        plainTextBody: plainText,
        htmlBody: formattedHtml,
        receivedAt: new Date(),
        attachments: {
          create: storedAttachments.map((att) => ({
            poSubmissionId: submission.id,
            fileName: att.fileName,
            fileType: att.fileType,
            fileSize: att.fileSize,
            storagePath: att.storagePath,
            storageUrl: att.storageUrl,
          })),
        },
      },
      include: { attachments: true },
    });

    // C. Activity Logs
    await tx.poActivityLog.create({
      data: {
        poSubmissionId: submission.id,
        activityType: 'PO_CREATED',
        title: 'Customer PO Submitted',
        description: `Customer ${input.customerName} submitted a purchase order via ${sourceLabel} with ${storedAttachments.length} attachment(s) and ${items.length} line item(s).`,
        metadata: {
          poSubmissionId,
          source: input.source,
          quoteNumber: input.quoteNumber,
          customerPoNumber: input.customerPoNumber,
          itemsCount: items.length,
          totalAmount,
        },
      },
    });

    await tx.poActivityLog.create({
      data: {
        poSubmissionId: submission.id,
        activityType: 'ID_GENERATED',
        title: 'PO Submission ID Assigned',
        description: `Internal PO reference generated: ${poSubmissionId}`,
        newValue: poSubmissionId,
      },
    });

    return { submission, emailMsg };
  });

  // 6. Broadcast Real-time Event to Admin Panel
  eventBus.emitEvent('po.created', createdRecord.submission as any);

  notifyAdmins(
    `New PO Received: ${poSubmissionId}`,
    `${customerOrCompany} submitted a new Purchase Order (${sourceLabel})`,
    'PO_ALERT',
    { poId: createdRecord.submission.id, poSubmissionId }
  ).catch((err) => logger.warn('[Customer PO] Admin notification failed:', err));

  // 7. Send Automated Confirmation Email to Customer
  sendMail({
    to: senderEmailNormalized,
    subject: `Purchase Order Received: [${poSubmissionId}] - PRC Hardware`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0f172a; margin-top: 0;">Thank You for Your Purchase Order</h2>
        <p>Dear ${input.customerName},</p>
        <p>We have successfully received your Purchase Order. Our commercial & technical team is reviewing your specifications and will issue your formal Proforma Invoice (PI) / Order Confirmation shortly.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 16px 0;">
          <strong>Your Reference Details:</strong><br/>
          • Internal PO Tracking ID: <span style="font-family: monospace; font-weight: bold; color: #7c3aed;">${poSubmissionId}</span><br/>
          ${input.customerPoNumber ? `• Your PO Number: <strong>${input.customerPoNumber}</strong><br/>` : ''}
          ${input.quoteNumber ? `• Linked Quotation: <strong>${input.quoteNumber}</strong><br/>` : ''}
          • Status: <strong>Under Review</strong>
        </div>
        <p>If you have any urgent inquiries regarding this order, please reply directly to this email referencing <strong>${poSubmissionId}</strong>.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
        <div style="font-size: 12px; color: #64748b;">
          <strong>PRC Hardware</strong><br/>
          Architectural Hardware & Commercial Solutions<br/>
          <a href="https://prchardware.com" style="color: #7c3aed; text-decoration: none;">prchardware.com</a> | sales@pacifichardware.com
        </div>
      </div>
    `,
    text: `Thank you for your Purchase Order. We have received your submission (Tracking ID: ${poSubmissionId}). Our team will review and contact you shortly.`,
  }).catch((err) => logger.warn('[Customer PO] Confirmation email failed:', err));

  return {
    success: true,
    message: 'Purchase Order submitted successfully! Our team will review and contact you shortly.',
    poSubmissionId,
    id: createdRecord.submission.id,
    po: createdRecord.submission,
  };
}
