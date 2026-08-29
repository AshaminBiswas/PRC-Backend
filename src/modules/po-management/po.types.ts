import { PoClassification, PoPriority, PoSource, PoStatus, EmailDirection } from '@prisma/client';

export { PoClassification, PoPriority, PoSource, PoStatus, EmailDirection };

export interface EmailAttachmentPayload {
  fileName: string;
  fileType: string;
  fileSize: number;
  buffer?: Buffer;
  content?: string; // base64 or url
  storagePath?: string;
  storageUrl?: string;
  extractedText?: string | null;
}

export interface InboundEmailPayload {
  messageId: string;
  providerEmailId?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string[];
  senderName?: string;
  senderEmail: string;
  recipientEmail: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  plainTextBody?: string;
  htmlBody?: string;
  rawHeaders?: Record<string, any>;
  receivedAt?: Date | string;
  attachments?: EmailAttachmentPayload[];
}

export interface PoClassificationResult {
  classification: PoClassification;
  confidenceScore: number;
  reasons: string[];
  extractedCustomerPoNumber?: string;
  extractedCompanyName?: string;
}

export interface PoListFilters {
  tab?: 'ALL' | 'PO_DETECTED' | 'POSSIBLE_PO' | 'GENERAL_EMAIL';
  classification?: PoClassification;
  status?: PoStatus;
  priority?: PoPriority;
  source?: PoSource;
  assignedUserId?: string;
  assignedDepartment?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
  sortBy?: 'receivedAt' | 'lastActivityAt' | 'status' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

export interface PoManagementMetrics {
  totalReceived: number;
  poDetectedCount: number;
  possiblePoCount: number;
  generalEmailCount: number;
  newCount: number;
  inReviewCount: number;
  processingCount: number;
  completedCount: number;
  urgentCount: number;
}
