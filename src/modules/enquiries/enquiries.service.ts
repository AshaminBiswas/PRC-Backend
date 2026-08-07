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
  if (upper === 'NEW') return EnquiryStatus.OPEN;
  if (Object.values(EnquiryStatus).includes(upper as EnquiryStatus)) {
    return upper as EnquiryStatus;
  }
  return undefined;
};

export const submitEnquiry = async (input: CreateEnquiryInput, userId?: string) => {
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

  return enquiry;
};

export const listEnquiries = async (query: ListEnquiriesQuery) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: Prisma.EnquiryWhereInput = {};

  if (query.status) {
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

  const newNotes = input.notes || input.adminNotes;
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
