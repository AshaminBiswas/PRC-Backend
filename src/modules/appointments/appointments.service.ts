import prisma, { readPrisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { sendAppointmentBookingEmail } from '../../utils/email.utils';
import { buildPagination, getPaginationParams } from '../../utils/response';
import { generateUniqueSlug } from '../../utils/slug.utils';
import { AppointmentStatus, Prisma } from '@prisma/client';
import type {
  CreateAppointmentInput,
  RescheduleAppointmentInput,
  CancelAppointmentInput,
  UpdateAppointmentStatusInput,
} from './appointments.schema';

interface UserContext {
  id: string;
  email: string;
  roles?: string[];
}

const appointmentSelect = {
  id: true,
  appointmentNumber: true,
  trackingId: true,
  serviceId: true,
  locationId: true,
  customerUserId: true,
  staffUserId: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  date: true,
  startTime: true,
  endTime: true,
  timezone: true,
  status: true,
  paidAmount: true,
  customFields: true,
  notes: true,
  cancelReason: true,
  cancelledAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  service: {
    select: { id: true, name: true, slug: true, durationMinutes: true, price: true },
  },
  staffUser: {
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
  },
  statusHistory: {
    select: { id: true, status: true, comment: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  },
} as const;

const parseTimeToMinutes = (timeStr: string): number => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const formatMinutesToTime = (totalMinutes: number): string => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const generateTrackingId = (): string => {
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `APT-${datePrefix}-${random}`;
};

const generateAppointmentNumber = async (tx: Prisma.TransactionClient): Promise<string> => {
  const year = new Date().getFullYear();
  const count = await tx.appointment.count();
  const seq = (count + 1).toString().padStart(4, '0');
  return `APT-${year}-${seq}`;
};

// ─── Services Management ──────────────────────────────────────────────────────

export const listServices = async (query: { isActive?: boolean; search?: string }) => {
  const where: Prisma.AppointmentServiceWhereInput = {};
  if (query.isActive !== undefined) where.isActive = query.isActive;
  if (query.search) {
    where.name = { contains: query.search, mode: 'insensitive' };
  }
  return readPrisma.appointmentService.findMany({
    where,
    orderBy: { name: 'asc' },
  });
};

export const createService = async (input: {
  name: string;
  description?: string;
  durationMinutes: number;
  bufferMinutes: number;
  maxParallelBookings: number;
  price: number;
  isPaid: boolean;
  isActive: boolean;
}) => {
  const slug = await generateUniqueSlug(input.name, 'appointmentService');
  return prisma.appointmentService.create({
    data: { ...input, slug },
  });
};

export const updateService = async (id: string, input: Partial<Parameters<typeof createService>[0]>) => {
  const service = await prisma.appointmentService.findUnique({ where: { id } });
  if (!service) throw new AppError('NOT_FOUND', 'Appointment service not found', 404);
  return prisma.appointmentService.update({
    where: { id },
    data: input,
  });
};

// ─── Slot Availability Engine ─────────────────────────────────────────────────

export const getAvailableSlots = async (params: {
  serviceId: string;
  date: string; // YYYY-MM-DD
  staffUserId?: string;
  locationId?: string;
}) => {
  const service = await readPrisma.appointmentService.findUnique({ where: { id: params.serviceId } });
  if (!service || !service.isActive) {
    throw new AppError('NOT_FOUND', 'Service not found or inactive', 404);
  }

  const bookingDate = new Date(params.date);
  const dayOfWeek = bookingDate.getUTCDay();

  // Check blackout dates
  const blackout = await readPrisma.blackoutDate.findFirst({
    where: {
      date: bookingDate,
      OR: [
        { locationId: params.locationId ?? null },
        { staffUserId: params.staffUserId ?? null },
        { locationId: null, staffUserId: null },
      ],
    },
  });

  if (blackout) {
    return { date: params.date, slots: [], reason: blackout.reason || 'Store/Staff on blackout date' };
  }

  // Fetch shift availability for staff or default shop hours (09:00 - 18:00)
  let workingStartTime = '09:00';
  let workingEndTime = '18:00';

  if (params.staffUserId) {
    const shift = await readPrisma.staffAvailability.findFirst({
      where: {
        staffUserId: params.staffUserId,
        dayOfWeek,
        isAvailable: true,
      },
    });
    if (!shift) {
      return { date: params.date, slots: [], reason: 'Staff member is not working on this day' };
    }
    workingStartTime = shift.startTime;
    workingEndTime = shift.endTime;
  }

  // Fetch existing non-cancelled bookings for date
  const existingBookings = await readPrisma.appointment.findMany({
    where: {
      serviceId: params.serviceId,
      date: bookingDate,
      status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS] },
      ...(params.staffUserId ? { staffUserId: params.staffUserId } : {}),
      ...(params.locationId ? { locationId: params.locationId } : {}),
    },
    select: { startTime: true, endTime: true },
  });

  const stepMinutes = service.durationMinutes + service.bufferMinutes;
  const startMin = parseTimeToMinutes(workingStartTime);
  const endMin = parseTimeToMinutes(workingEndTime);

  const availableSlots: Array<{ startTime: string; endTime: string; isAvailable: boolean }> = [];

  for (let currentMin = startMin; currentMin + service.durationMinutes <= endMin; currentMin += stepMinutes) {
    const slotStartStr = formatMinutesToTime(currentMin);
    const slotEndStr = formatMinutesToTime(currentMin + service.durationMinutes);

    // Count overlapping bookings
    const overlappingCount = existingBookings.filter((b) => {
      const bStart = parseTimeToMinutes(b.startTime);
      const bEnd = parseTimeToMinutes(b.endTime);
      return Math.max(currentMin, bStart) < Math.min(currentMin + service.durationMinutes, bEnd);
    }).length;

    const isAvailable = overlappingCount < service.maxParallelBookings;
    if (isAvailable) {
      availableSlots.push({
        startTime: slotStartStr,
        endTime: slotEndStr,
        isAvailable: true,
      });
    }
  }

  return {
    date: params.date,
    service: { id: service.id, name: service.name, durationMinutes: service.durationMinutes },
    availableSlotsCount: availableSlots.length,
    slots: availableSlots,
  };
};

// ─── Create Appointment Booking ───────────────────────────────────────────────

export const createAppointment = async (
  input: Omit<CreateAppointmentInput, 'timezone'> & { timezone?: string },
  customerUser?: UserContext
) => {
  const service = await readPrisma.appointmentService.findUnique({ where: { id: input.serviceId } });
  if (!service || !service.isActive) {
    throw new AppError('NOT_FOUND', 'Selected service is unavailable', 404);
  }

  const bookingDate = new Date(input.date);
  const startMin = parseTimeToMinutes(input.startTime);
  const endMin = startMin + service.durationMinutes;
  const endTimeStr = formatMinutesToTime(endMin);

  return prisma.$transaction(async (tx) => {
    // Check concurrent bookings under lock
    const overlapping = await tx.appointment.count({
      where: {
        serviceId: input.serviceId,
        date: bookingDate,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS] },
        startTime: { lt: endTimeStr },
        endTime: { gt: input.startTime },
        ...(input.staffUserId ? { staffUserId: input.staffUserId } : {}),
      },
    });

    if (overlapping >= service.maxParallelBookings) {
      throw new AppError('CONFLICT', 'The selected time slot is no longer available. Please choose another slot.', 409);
    }

    const trackingId = generateTrackingId();
    const appointmentNumber = await generateAppointmentNumber(tx);

    const appointment = await tx.appointment.create({
      data: {
        appointmentNumber,
        trackingId,
        serviceId: input.serviceId,
        locationId: input.locationId,
        customerUserId: customerUser?.id,
        staffUserId: input.staffUserId,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        date: bookingDate,
        startTime: input.startTime,
        endTime: endTimeStr,
        timezone: input.timezone || 'Asia/Kolkata',
        status: AppointmentStatus.CONFIRMED,
        paidAmount: service.price,
        customFields: input.customFields ? (input.customFields as Prisma.InputJsonValue) : undefined,
        notes: input.notes,
      },
      select: appointmentSelect,
    });

    await tx.appointmentStatusHistory.create({
      data: {
        appointmentId: appointment.id,
        status: AppointmentStatus.CONFIRMED,
        comment: 'Appointment booked successfully',
      },
    });

    // Automatically trigger email to customer with Tracking ID
    sendAppointmentBookingEmail({
      to: appointment.customerEmail,
      customerName: appointment.customerName,
      trackingId: appointment.trackingId,
      appointmentNumber: appointment.appointmentNumber,
      serviceName: service.name,
      date: input.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
    }).catch((err) => console.error('[Email Error] Failed to send appointment email:', err));

    return appointment;
  });
};

// ─── Tracking & Customer Lookup ───────────────────────────────────────────────

export const getAppointmentByTrackingId = async (trackingId: string) => {
  const appointment = await readPrisma.appointment.findUnique({
    where: { trackingId },
    select: appointmentSelect,
  });
  if (!appointment) throw new AppError('NOT_FOUND', 'Appointment not found for this tracking ID', 404);
  return appointment;
};

export const getAppointmentById = async (id: string, user?: UserContext) => {
  const appointment = await readPrisma.appointment.findUnique({
    where: { id },
    select: appointmentSelect,
  });
  if (!appointment) throw new AppError('NOT_FOUND', 'Appointment not found', 404);

  if (user && !user.roles?.includes('super-admin') && appointment.customerUserId !== user.id && appointment.customerEmail !== user.email) {
    throw new AppError('FORBIDDEN', 'Access denied to this appointment', 403);
  }
  return appointment;
};

// ─── Reschedule & Cancel ──────────────────────────────────────────────────────

export const rescheduleAppointment = async (id: string, input: RescheduleAppointmentInput, user?: UserContext) => {
  const appointment = await prisma.appointment.findUnique({ where: { id }, include: { service: true } });
  if (!appointment) throw new AppError('NOT_FOUND', 'Appointment not found', 404);

  if (appointment.status === AppointmentStatus.CANCELLED || appointment.status === AppointmentStatus.COMPLETED) {
    throw new AppError('BAD_REQUEST', `Cannot reschedule appointment with status ${appointment.status}`, 400);
  }

  const startMin = parseTimeToMinutes(input.startTime);
  const endMin = startMin + appointment.service.durationMinutes;
  const endTimeStr = formatMinutesToTime(endMin);
  const newDate = new Date(input.date);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.appointment.update({
      where: { id },
      data: {
        date: newDate,
        startTime: input.startTime,
        endTime: endTimeStr,
        status: AppointmentStatus.RESCHEDULED,
      },
      select: appointmentSelect,
    });

    await tx.appointmentStatusHistory.create({
      data: {
        appointmentId: id,
        status: AppointmentStatus.RESCHEDULED,
        comment: input.reason || 'Rescheduled by user',
      },
    });

    return updated;
  });
};

export const cancelAppointment = async (id: string, reason: string, user?: UserContext) => {
  if (!reason || !reason.trim()) {
    throw new AppError('BAD_REQUEST', 'Cancellation reason is required', 400);
  }

  const appointment = await prisma.appointment.findUnique({ where: { id } });
  if (!appointment) throw new AppError('NOT_FOUND', 'Appointment not found', 404);

  if (appointment.status === AppointmentStatus.CANCELLED || appointment.status === AppointmentStatus.COMPLETED) {
    throw new AppError('BAD_REQUEST', `Appointment is already ${appointment.status}`, 400);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancelReason: reason.trim(),
        cancelledAt: new Date(),
      },
      select: appointmentSelect,
    });

    await tx.appointmentStatusHistory.create({
      data: {
        appointmentId: id,
        status: AppointmentStatus.CANCELLED,
        comment: reason.trim(),
      },
    });

    return updated;
  });
};

// ─── Admin Status Update & Master List ────────────────────────────────────────

export const updateAppointmentStatus = async (id: string, input: UpdateAppointmentStatusInput, user: UserContext) => {
  const appointment = await prisma.appointment.findUnique({ where: { id } });
  if (!appointment) throw new AppError('NOT_FOUND', 'Appointment not found', 404);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.appointment.update({
      where: { id },
      data: {
        status: input.status,
        ...(input.status === AppointmentStatus.COMPLETED ? { completedAt: new Date() } : {}),
        ...(input.status === AppointmentStatus.CANCELLED ? { cancelledAt: new Date(), cancelReason: input.comment } : {}),
      },
      select: appointmentSelect,
    });

    await tx.appointmentStatusHistory.create({
      data: {
        appointmentId: id,
        status: input.status,
        comment: input.comment || `Status updated to ${input.status}`,
      },
    });

    return updated;
  });
};

export const listAppointments = async (query: {
  page: number;
  limit: number;
  status?: AppointmentStatus;
  serviceId?: string;
  staffUserId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: Prisma.AppointmentWhereInput = {};

  if (query.status) where.status = query.status;
  if (query.serviceId) where.serviceId = query.serviceId;
  if (query.staffUserId) where.staffUserId = query.staffUserId;
  if (query.search) {
    where.OR = [
      { trackingId: { contains: query.search, mode: 'insensitive' } },
      { appointmentNumber: { contains: query.search, mode: 'insensitive' } },
      { customerName: { contains: query.search, mode: 'insensitive' } },
      { customerEmail: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.startDate || query.endDate) {
    where.date = {
      ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
      ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
    };
  }

  const [appointments, totalItems] = await Promise.all([
    readPrisma.appointment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: appointmentSelect,
    }),
    readPrisma.appointment.count({ where }),
  ]);

  return {
    data: appointments,
    pagination: buildPagination(page, limit, totalItems),
  };
};

export const deleteAppointment = async (id: string) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    select: { id: true, appointmentNumber: true, customerName: true },
  });

  if (!appointment) {
    throw new AppError('NOT_FOUND', 'Appointment not found', 404);
  }

  await prisma.$transaction(async (tx) => {
    await tx.appointmentStatusHistory.deleteMany({
      where: { appointmentId: id },
    });
    await tx.appointment.delete({
      where: { id },
    });
  });

  return {
    success: true,
    message: `Appointment ${appointment.appointmentNumber} deleted permanently from database.`,
  };
};

export const deleteService = async (id: string) => {
  const service = await prisma.appointmentService.findUnique({
    where: { id },
    select: { id: true, name: true },
  });

  if (!service) {
    throw new AppError('NOT_FOUND', 'Service offering not found', 404);
  }

  await prisma.$transaction(async (tx) => {
    const apts = await tx.appointment.findMany({
      where: { serviceId: id },
      select: { id: true },
    });

    const aptIds = apts.map((a) => a.id);
    if (aptIds.length > 0) {
      await tx.appointmentStatusHistory.deleteMany({
        where: { appointmentId: { in: aptIds } },
      });
      await tx.appointment.deleteMany({
        where: { serviceId: id },
      });
    }

    await tx.appointmentService.delete({
      where: { id },
    });
  });

  return {
    success: true,
    message: `Service "${service.name}" and any associated bookings deleted permanently.`,
  };
};
