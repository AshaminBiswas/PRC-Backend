import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { buildPagination, getPaginationParams } from '../../utils/response';
import { EnquiryStatus, Prisma } from '@prisma/client';
import type {
  CreateEnquiryInput,
  UpdateEnquiryInput,
  ListEnquiriesQuery,
} from './enquiries.schema';

const mapStatusToDb = (statusStr?: string): EnquiryStatus | undefined => {
  if (!statusStr) return undefined;
  const upper = statusStr.toUpperCase();
  if (upper === 'NEW' || upper === 'OPEN') return EnquiryStatus.OPEN;
  if (upper === 'IN_PROGRESS') return EnquiryStatus.IN_PROGRESS;
  if (upper === 'RESOLVED') return EnquiryStatus.RESOLVED;
  if (upper === 'CLOSED') return EnquiryStatus.CLOSED;
  if (Object.values(EnquiryStatus).includes(upper as EnquiryStatus)) {
    return upper as EnquiryStatus;
  }
  return undefined;
};

export const submitEnquiry = async (input: CreateEnquiryInput, userId?: string) => {
  // Check active enquiry limit: Maximum 2 active queries (OPEN or IN_PROGRESS) per email
  const activeCount = await prisma.enquiry.count({
    where: {
      email: { equals: input.email, mode: 'insensitive' },
      status: { in: [EnquiryStatus.OPEN, EnquiryStatus.IN_PROGRESS] },
    },
  });

  if (activeCount >= 2) {
    throw new AppError(
      'BAD_REQUEST',
      'Active enquiry limit reached. You currently have 2 active queries under review. Please wait until your existing query is resolved before submitting a new one.',
      400
    );
  }

  let subject = input.subject || 'General Enquiry';
  if (input.companyName && !subject.includes(input.companyName)) {
    subject = `[${input.companyName}] ${subject}`;
  }

  const enquiry = await prisma.enquiry.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      subject,
      message: input.message,
      status: EnquiryStatus.OPEN,
      userId: userId || null,
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  // Emit event to notify admins
  try {
    const { eventBus } = await import('../../events/eventBus');
    eventBus.emitEvent('enquiry.submitted', {
      enquiryId: enquiry.id,
      name: enquiry.name,
      email: enquiry.email,
      subject: enquiry.subject || 'General Enquiry',
    });
  } catch (err) {
    console.error('[Enquiry Event Error]', err);
  }

  return enquiry;
};

export const listEnquiries = async (query: ListEnquiriesQuery) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: Prisma.EnquiryWhereInput = {};

  if (query.status && query.status !== 'ALL') {
    const mappedStatus = mapStatusToDb(query.status);
    if (mappedStatus) {
      where.status = mappedStatus;
    }
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { subject: { contains: query.search, mode: 'insensitive' } },
      { message: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [totalItems, enquiries] = await Promise.all([
    prisma.enquiry.count({ where }),
    prisma.enquiry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    }),
  ]);

  const pagination = buildPagination(page, limit, totalItems);

  return { data: enquiries, pagination };
};

export const getEnquiryById = async (id: string) => {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!enquiry) {
    throw new AppError('NOT_FOUND', 'Enquiry not found', 404);
  }

  return enquiry;
};

export const trackEnquiry = async (identifier: string) => {
  const cleanId = (identifier || '').trim();
  if (!cleanId) {
    throw new AppError('BAD_REQUEST', 'Please provide a valid Enquiry Ticket ID or Email address.', 400);
  }

  const enquiry = await prisma.enquiry.findFirst({
    where: {
      OR: [
        { id: cleanId },
        { email: { equals: cleanId, mode: 'insensitive' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!enquiry) {
    throw new AppError('NOT_FOUND', `No enquiry record found for '${cleanId}'`, 404);
  }

  // Calculate 48h Max SLA timeline
  const createdAtDate = new Date(enquiry.createdAt);
  const slaDeadlineDate = new Date(createdAtDate.getTime() + 48 * 60 * 60 * 1000);
  const now = new Date();
  const isSlaExpired = now > slaDeadlineDate && enquiry.status === EnquiryStatus.OPEN;

  return {
    ...enquiry,
    trackingId: enquiry.id,
    adminNotes: enquiry.notes,
    sla: {
      maxSlaHours: 48,
      createdAt: enquiry.createdAt,
      slaDeadline: slaDeadlineDate.toISOString(),
      isSlaExpired,
      hoursRemaining: Math.max(0, Math.round((slaDeadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60))),
    },
  };
};

export const updateEnquiry = async (id: string, input: UpdateEnquiryInput) => {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id },
    select: { id: true, notes: true },
  });

  if (!enquiry) {
    throw new AppError('NOT_FOUND', 'Enquiry not found', 404);
  }

  const dataToUpdate: Prisma.EnquiryUpdateInput = {};

  if (input.status) {
    const mappedStatus = mapStatusToDb(input.status);
    if (mappedStatus) {
      dataToUpdate.status = mappedStatus;
    }
  }

  const newNotes = input.adminNotes !== undefined ? input.adminNotes : input.notes;
  if (newNotes !== undefined) {
    dataToUpdate.notes = newNotes;
  }

  const updatedEnquiry = await prisma.enquiry.update({
    where: { id },
    data: dataToUpdate,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  return updatedEnquiry;
};

export const deleteEnquiry = async (id: string) => {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id },
    select: { id: true, name: true, subject: true },
  });

  if (!enquiry) {
    throw new AppError('NOT_FOUND', 'Enquiry not found', 404);
  }

  await prisma.enquiry.delete({
    where: { id },
  });

  return { success: true, message: `Enquiry from ${enquiry.name} deleted permanently from database.` };
};
