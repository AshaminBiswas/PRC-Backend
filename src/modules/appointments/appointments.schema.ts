import { z } from 'zod';
import { AppointmentStatus } from '@prisma/client';

export const ListServicesQuerySchema = z.object({
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

export const CreateServiceSchema = z.object({
  name: z.string().min(1, 'Service name is required').max(150),
  description: z.string().optional(),
  durationMinutes: z.number().int().min(5).max(480).default(30),
  bufferMinutes: z.number().int().min(0).max(120).default(15),
  maxParallelBookings: z.number().int().min(1).default(1),
  price: z.number().min(0).default(0),
  isPaid: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const UpdateServiceSchema = CreateServiceSchema.partial();

export const GetAvailableSlotsQuerySchema = z.object({
  serviceId: z.string().uuid('Invalid service ID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  staffUserId: z.string().uuid().optional(),
  locationId: z.string().optional(),
  timezone: z.string().default('Asia/Kolkata'),
});

export const CreateAppointmentSchema = z.object({
  serviceId: z.string().uuid('Invalid service ID'),
  locationId: z.string().optional(),
  staffUserId: z.string().uuid().optional(),
  customerName: z.string().min(1, 'Customer name is required').max(100),
  customerEmail: z.string().email('Invalid email address'),
  customerPhone: z.string().min(5, 'Phone number is required').max(20),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must be HH:mm (e.g. 10:00)'),
  timezone: z.string().optional().default('Asia/Kolkata'),
  customFields: z.record(z.unknown()).optional(),
  notes: z.string().max(1000).optional(),
});

export const RescheduleAppointmentSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must be HH:mm (e.g. 10:00)'),
  reason: z.string().max(500).optional(),
});

export const CancelAppointmentSchema = z.object({
  reason: z
    .string({ required_error: 'Cancellation reason is required' })
    .trim()
    .min(1, 'Cancellation reason is required')
    .max(500, 'Reason must be at most 500 characters'),
});

export const UpdateAppointmentStatusSchema = z.object({
  status: z.nativeEnum(AppointmentStatus, {
    errorMap: () => ({ message: 'Invalid appointment status' }),
  }),
  comment: z.string().max(500).optional(),
});

export const SetStaffAvailabilitySchema = z.object({
  staffUserId: z.string().uuid('Invalid staff user ID'),
  locationId: z.string().optional(),
  availabilities: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      isAvailable: z.boolean().default(true),
    })
  ),
});

export const SetBlackoutDateSchema = z.object({
  locationId: z.string().optional(),
  staffUserId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().optional(),
});

export const ListAppointmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(AppointmentStatus).optional(),
  serviceId: z.string().uuid().optional(),
  staffUserId: z.string().uuid().optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;
export type RescheduleAppointmentInput = z.infer<typeof RescheduleAppointmentSchema>;
export type CancelAppointmentInput = z.infer<typeof CancelAppointmentSchema>;
export type UpdateAppointmentStatusInput = z.infer<typeof UpdateAppointmentStatusSchema>;
