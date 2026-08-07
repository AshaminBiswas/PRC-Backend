import { Request, Response, NextFunction } from 'express';
import * as appointmentsService from './appointments.service';
import { sendSuccess, sendPaginated } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';

export const listServices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const services = await appointmentsService.listServices(req.query as any);
    sendSuccess(res, services);
  } catch (error) {
    next(error);
  }
};

export const createService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = await appointmentsService.createService(req.body);
    sendSuccess(res, service, 'Appointment service created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = await appointmentsService.updateService(req.params.id, req.body);
    sendSuccess(res, service, 'Appointment service updated successfully');
  } catch (error) {
    next(error);
  }
};

export const getAvailableSlots = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await appointmentsService.getAvailableSlots(req.query as any);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const createAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const appointment = await appointmentsService.createAppointment(req.body, req.user as any);
    sendSuccess(res, appointment, 'Appointment booked successfully. Confirmation email with Tracking ID sent.', 201);
  } catch (error) {
    next(error);
  }
};

export const getAppointmentByTrackingId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const appointment = await appointmentsService.getAppointmentByTrackingId(req.params.trackingId);
    sendSuccess(res, appointment);
  } catch (error) {
    next(error);
  }
};

export const getAppointmentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const appointment = await appointmentsService.getAppointmentById(req.params.id, req.user as any);
    sendSuccess(res, appointment);
  } catch (error) {
    next(error);
  }
};

export const rescheduleAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const appointment = await appointmentsService.rescheduleAppointment(req.params.id, req.body, req.user as any);
    sendSuccess(res, appointment, 'Appointment rescheduled successfully');
  } catch (error) {
    next(error);
  }
};

export const cancelAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const appointment = await appointmentsService.cancelAppointment(req.params.id, req.body.reason, req.user as any);
    sendSuccess(res, appointment, 'Appointment cancelled successfully');
  } catch (error) {
    next(error);
  }
};

export const updateAppointmentStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    const appointment = await appointmentsService.updateAppointmentStatus(req.params.id, req.body, req.user as any);
    sendSuccess(res, appointment, 'Appointment status updated successfully');
  } catch (error) {
    next(error);
  }
};

export const listAppointments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await appointmentsService.listAppointments(req.query as any);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};
