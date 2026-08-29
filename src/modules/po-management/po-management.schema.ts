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

export const BulkDeletePoSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'At least one PO ID is required for bulk deletion'),
});

export const ReplyPoSubmissionSchema = z.object({
  to: z.string().email('Valid recipient email required').optional().or(z.literal('')),
  subject: z.string().min(1, 'Email subject is required'),
  message: z.string().min(1, 'Message body is required'),
  cc: z.union([z.string(), z.array(z.string())]).optional().or(z.literal('')),
  bcc: z.union([z.string(), z.array(z.string())]).optional().or(z.literal('')),
  newStatus: z.nativeEnum(PoStatus).optional().or(z.literal('')),
});

export const CustomerSubmitPoSchema = z.object({
  source: z.nativeEnum(PoSource).default(PoSource.PO_FORM),
  customerName: z.string().min(1, 'Full name / Contact Person is required'),
  companyName: z.string().optional().nullable(),
  customerEmail: z.string().email('Valid email address is required'),
  customerPhone: z.string().optional().nullable(),
  customerPoNumber: z.string().optional().nullable(),
  quoteId: z.string().optional().nullable(),
  quoteNumber: z.string().optional().nullable(),
  subject: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  billingAddress: z.string().optional().nullable(),
  shippingAddress: z.string().optional().nullable(),
  gstin: z.string().optional().nullable(),
  deliveryTimeline: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  priority: z.nativeEnum(PoPriority).optional().default(PoPriority.MEDIUM),
  lineItems: z
    .union([
      z.string().transform((val) => {
        try {
          return JSON.parse(val);
        } catch {
          return [];
        }
      }),
      z.array(
        z.object({
          productName: z.string().min(1, 'Product Name required'),
          sku: z.string().optional(),
          quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
          unit: z.string().optional().default('PCS'),
          targetRate: z.coerce.number().optional().default(0),
          totalPrice: z.coerce.number().optional().default(0),
          specifications: z.string().optional(),
        })
      ),
    ])
    .optional()
    .default([]),
});

export type CustomerSubmitPoInput = z.infer<typeof CustomerSubmitPoSchema>;
