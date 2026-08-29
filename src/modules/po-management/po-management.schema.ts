import { z } from 'zod';
import { PoClassification, PoPriority, PoSource, PoStatus } from './po.types';

export const GetPoSubmissionsQuerySchema = z.object({
  tab: z.enum(['ALL', 'PO_DETECTED', 'POSSIBLE_PO', 'GENERAL_EMAIL']).optional(),
  classification: z.nativeEnum(PoClassification).optional(),
  status: z.nativeEnum(PoStatus).optional(),
  priority: z.nativeEnum(PoPriority).optional(),
  source: z.nativeEnum(PoSource).optional(),
  assignedUserId: z.string().optional(),
  assignedDepartment: z.string().optional(),
  search: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(15),
  sortBy: z.enum(['receivedAt', 'lastActivityAt', 'status', 'priority']).default('receivedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const UpdatePoStatusSchema = z.object({
  status: z.nativeEnum(PoStatus),
  comment: z.string().optional(),
});

export const UpdatePoPrioritySchema = z.object({
  priority: z.nativeEnum(PoPriority),
});

export const AssignPoSchema = z.object({
  assignedUserId: z.string().nullable().optional(),
  assignedDepartment: z.string().nullable().optional(),
});

export const ReclassifyPoSchema = z.object({
  classification: z.nativeEnum(PoClassification),
});

export const UpdateCustomerPoSchema = z.object({
  customerPoNumber: z.string().min(1, 'Customer PO Number is required'),
});

export const AddInternalNoteSchema = z.object({
  note: z.string().min(1, 'Note content cannot be empty'),
});

export const InboundWebhookSchema = z.object({
  messageId: z.string().optional(),
  providerEmailId: z.string().optional(),
  threadId: z.string().optional(),
  inReplyTo: z.string().optional(),
  references: z.array(z.string()).optional(),
  senderName: z.string().optional(),
  senderEmail: z.string().email('Valid sender email required'),
  recipientEmail: z.string().email().optional().default('po@pacifichardware.com'),
  cc: z.array(z.string()).optional(),
  bcc: z.array(z.string()).optional(),
  subject: z.string().default('No Subject'),
  plainTextBody: z.string().optional(),
  htmlBody: z.string().optional(),
  rawHeaders: z.record(z.any()).optional(),
  receivedAt: z.string().optional(),
  attachments: z
    .array(
      z.object({
        fileName: z.string(),
        fileType: z.string(),
        fileSize: z.number().default(0),
        content: z.string().optional(),
        storageUrl: z.string().optional(),
      })
    )
    .optional(),
});
