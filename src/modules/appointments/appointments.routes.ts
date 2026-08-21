import { Router } from 'express';
import * as controller from './appointments.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import {
  formSubmissionLimiter,
  publicTrackingLimiter,
  adminLimiter,
} from '../../middleware/rateLimit.middleware';
import {
  ListServicesQuerySchema,
  CreateServiceSchema,
  UpdateServiceSchema,
  GetAvailableSlotsQuerySchema,
  CreateAppointmentSchema,
  RescheduleAppointmentSchema,
  CancelAppointmentSchema,
  UpdateAppointmentStatusSchema,
  ListAppointmentsQuerySchema,
} from './appointments.schema';

const router = Router();

// ─── Public Services & Slot Lookup ───────────────────────────────────────────

router.get(
  '/services',
  validate(ListServicesQuerySchema, 'query'),
  controller.listServices
);

router.get(
  '/available-slots',
  publicTrackingLimiter,
  validate(GetAvailableSlotsQuerySchema, 'query'),
  controller.getAvailableSlots
);

router.get(
  '/track/:trackingId',
  publicTrackingLimiter,
  controller.getAppointmentByTrackingId
);

// ─── Public / Customer Booking & Management ───────────────────────────────────

router.post(
  '/',
  formSubmissionLimiter,
  validate(CreateAppointmentSchema),
  controller.createAppointment
);

router.get(
  '/:id',
  publicTrackingLimiter,
  controller.getAppointmentById
);

router.patch(
  '/:id/reschedule',
  formSubmissionLimiter,
  validate(RescheduleAppointmentSchema),
  controller.rescheduleAppointment
);

router.post(
  '/:id/cancel',
  formSubmissionLimiter,
  validate(CancelAppointmentSchema),
  controller.cancelAppointment
);

router.patch(
  '/:id/cancel',
  formSubmissionLimiter,
  validate(CancelAppointmentSchema),
  controller.cancelAppointment
);

// ─── Admin & Staff Routes ────────────────────────────────────────────────────

router.get(
  '/',
  authenticate,
  authorize('appointments.read'),
  adminLimiter,
  validate(ListAppointmentsQuerySchema, 'query'),
  controller.listAppointments
);

router.post(
  '/services',
  authenticate,
  authorize('appointments.update'),
  adminLimiter,
  validate(CreateServiceSchema),
  controller.createService
);

router.patch(
  '/services/:id',
  authenticate,
  authorize('appointments.update'),
  adminLimiter,
  validate(UpdateServiceSchema),
  controller.updateService
);

router.patch(
  '/:id/status',
  authenticate,
  authorize('appointments.update', 'appointments.manage'),
  adminLimiter,
  validate(UpdateAppointmentStatusSchema),
  controller.updateAppointmentStatus
);

// Admin delete appointment permanently from database
router.delete(
  '/:id',
  authenticate,
  authorize('appointments.delete', 'appointments.update', 'appointments.manage'),
  adminLimiter,
  controller.deleteAppointment
);

// Admin delete service permanently from database
router.delete(
  '/services/:id',
  authenticate,
  authorize('appointments.delete', 'appointments.update', 'appointments.manage'),
  adminLimiter,
  controller.deleteService
);

export default router;
