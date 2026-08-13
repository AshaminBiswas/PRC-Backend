import { Request, Response, NextFunction } from 'express';
import * as enquiriesService from './enquiries.service';
import { sendSuccess, sendPaginated } from '../../utils/response';

export const submitEnquiry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const data = await enquiriesService.submitEnquiry(req.body, userId);
    sendSuccess(res, data, 'Enquiry submitted successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const listEnquiries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await enquiriesService.listEnquiries(req.query as any);
    sendPaginated(res, result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getEnquiryById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await enquiriesService.getEnquiryById(req.params.id);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const trackEnquiry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const identifier = req.params.id || (req.query.id as string) || (req.query.email as string);
    const data = await enquiriesService.trackEnquiry(identifier);
    sendSuccess(res, data, 'Ticket tracking details retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const updateEnquiry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await enquiriesService.updateEnquiry(req.params.id, req.body);
    sendSuccess(res, data, 'Enquiry updated successfully');
  } catch (error) {
    next(error);
  }
};
