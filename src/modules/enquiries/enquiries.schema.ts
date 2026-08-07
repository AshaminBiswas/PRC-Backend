import { z } from 'zod';

export const EnquiryStatusEnum = z.enum(['OPEN', 'NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);

export const CreateEnquirySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().min(1, 'Message is required'),
  companyName: z.string().optional(),
});

export const UpdateEnquirySchema = z.object({
  status: EnquiryStatusEnum.optional(),
  notes: z.string().optional(),
  adminNotes: z.string().optional(),
});

export const ListEnquiriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  search: z.string().optional(),
});

export const UuidParamSchema = z.object({
  id: z.string().uuid('Invalid enquiry ID'),
});

export type CreateEnquiryInput = z.infer<typeof CreateEnquirySchema>;
export type UpdateEnquiryInput = z.infer<typeof UpdateEnquirySchema>;
export type ListEnquiriesQuery = z.infer<typeof ListEnquiriesQuerySchema>;
