import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { logger } from '../../config/logger';
import { eventBus } from '../../events/eventBus';
import {
  PoClassification,
  PoPriority,
  PoSource,
  PoStatus,
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
