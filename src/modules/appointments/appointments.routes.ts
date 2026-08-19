import { Router } from 'express';
import * as controller from './appointments.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
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
  validate(GetAvailableSlotsQuerySchema, 'query'),
  controller.getAvailableSlots
);

router.get(
  '/track/:trackingId',
  controller.getAppointmentByTrackingId
);

// ─── Public / Customer Booking & Management ───────────────────────────────────

router.post(
  '/',
  validate(CreateAppointmentSchema),
  controller.createAppointment
);

router.get(
  '/:id',
  controller.getAppointmentById
);

router.patch(
  '/:id/reschedule',
  validate(RescheduleAppointmentSchema),
  controller.rescheduleAppointment
);

router.post(
  '/:id/cancel',
  validate(CancelAppointmentSchema),
  controller.cancelAppointment
);

router.patch(
  '/:id/cancel',
  validate(CancelAppointmentSchema),
  controller.cancelAppointment
);

// ─── Admin & Staff Routes ────────────────────────────────────────────────────

router.get(
  '/',
  authenticate,
  authorize('appointments.read'),
  validate(ListAppointmentsQuerySchema, 'query'),
  controller.listAppointments
);

router.post(
  '/services',
  authenticate,
  authorize('appointments.update'),
  validate(CreateServiceSchema),
  controller.createService
);

router.patch(
  '/services/:id',
  authenticate,
  authorize('appointments.update'),
  validate(UpdateServiceSchema),
  controller.updateService
);

router.patch(
  '/:id/status',
  authenticate,
  authorize('appointments.update', 'appointments.manage'),
  validate(UpdateAppointmentStatusSchema),
  controller.updateAppointmentStatus
);

// Admin delete appointment permanently from database
router.delete(
  '/:id',
  authenticate,
  authorize('appointments.delete', 'appointments.update', 'appointments.manage'),
  controller.deleteAppointment
);

// Admin delete service permanently from database
router.delete(
  '/services/:id',
  authenticate,
  authorize('appointments.delete', 'appointments.update', 'appointments.manage'),
  controller.deleteService
);

export default router;
