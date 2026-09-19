export type AgingBucket = '0_30' | '31_60' | '61_90' | '90_PLUS';

export type DueSourceType = 'OPENING_BALANCE' | 'TAX_INVOICE' | 'B2B_ORDER' | 'PROFORMA_INVOICE';

export type AllocationMode = 'INVOICE_SPECIFIC' | 'OLDEST_DUE_FIRST';

export type FollowupChannel = 'CALL' | 'SMS' | 'EMAIL' | 'LEDGER_EMAIL' | 'NOTE' | 'IN_PERSON' | 'OTHER';

export type FollowupOutcome =
  | 'PAYMENT_PROMISED'
  | 'PAYMENT_RECEIVED'
  | 'NO_ANSWER'
  | 'CALL_BACK_LATER'
  | 'DISPUTED'
  | 'REFUSED'
  | 'WRONG_NUMBER'
  | 'EMAIL_BOUNCED'
  | 'SMS_FAILED'
  | 'CALL_MADE'
  | 'OTHER';

export type FollowupProfileStatus =
  | 'ACTIVE'
  | 'PAYMENT_PROMISED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'DISPUTED'
  | 'DECLINED'
  | 'MANUAL_REVIEW';

export interface TraceableDueItem {
  id: string;
  sourceType: DueSourceType;
  documentNumber: string;
  referenceDate: string; // ISO date
  dueDate: string; // ISO date
  deliveryDate?: string | null;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  paymentTerms?: string;
  daysOverdue: number;
  agingBucket: AgingBucket;
  status: string;
  notes?: string | null;
  rawDoc?: any;
}

export interface CustomerDueSummary {
  customerId: string;
  customerName: string;
  companyName?: string | null;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  source: string; // 'ORGANIC' | 'OLD_CUSTOMER'

  // Missing flags
  missingEmail: boolean;
  missingPhone: boolean;
  missingGstin: boolean;

  // Dues & Aging
  totalOutstanding: number;
  overdueAmount: number;
  oldestDueDate?: string | null;
  maxDaysOverdue: number;
  agingBucket: AgingBucket;
  invoicesCount: number;

  // Follow-up status
  followupStatus: FollowupProfileStatus;
  declineReason?: string | null;
  declinedAt?: string | null;
  declinedByName?: string | null;
  lastFollowupDate?: string | null;
  lastFollowupChannel?: string | null;
  lastFollowupOutcome?: string | null;
  lastPaymentDate?: string | null;
  nextActionDate?: string | null;
  ptpDate?: string | null;
  ptpAmount?: number | null;
  totalRemindersSent: number;
}

export interface StatementLedgerRow {
  date: string;
  refNo: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface SelectableDocumentItem {
  id: string;
  type: 'PROFORMA_INVOICE' | 'PURCHASE_ORDER' | 'QUOTATION' | 'TAX_INVOICE';
  documentNumber: string;
  date: string;
  amount: number;
  balanceDue?: number;
  status: string;
  viewUrl?: string;
}

export interface CustomerDuesDetail {
  customer: {
    id: string;
    name: string;
    companyName?: string | null;
    phone?: string | null;
    email?: string | null;
    gstin?: string | null;
    source: string;
    billingAddress?: string | null;
    shippingAddress?: string | null;
    billingAddressDetails?: {
      addressLine1: string;
      addressLine2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    } | null;
    shippingAddressDetails?: {
      addressLine1: string;
      addressLine2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    } | null;
    missingEmail: boolean;
    missingPhone: boolean;
    missingGstin: boolean;
  };
  summary: {
    totalOutstanding: number;
    overdueAmount: number;
    maxDaysOverdue: number;
    oldestDueDate?: string | null;
    agingBucket: AgingBucket;
    lastPaymentDate?: string | null;
    nextActionDate?: string | null;
    ptpDate?: string | null;
    ptpAmount?: number | null;
    followupStatus: FollowupProfileStatus;
    declineReason?: string | null;
    declinedAt?: string | null;
    totalBilledAmount: number;
    totalAdvancePaid: number;
    totalPaymentsCollected: number;
    netBalanceDue: number;
  };
  agingBreakdown: {
    bucket0_30: number;
    bucket31_60: number;
    bucket61_90: number;
    bucket90_plus: number;
  };
  dues: TraceableDueItem[];
  paymentAllocations: Array<{
    id: string;
    paymentAmount: number;
    paymentDate: string;
    paymentMode: string;
    transactionRef?: string | null;
    allocationMode: AllocationMode;
    targetType: DueSourceType;
    targetId: string;
    targetDocumentNumber?: string | null;
    allocatedAmount: number;
    notes?: string | null;
    recordedByName?: string | null;
    createdAt: string;
  }>;
  followupHistory: Array<{
    id: string;
    followupType: FollowupChannel;
    outcome: FollowupOutcome;
    notes: string;
    ptpDate?: string | null;
    ptpAmount?: number | null;
    nextActionDate?: string | null;
    performedByName?: string | null;
    createdAt: string;
  }>;
  ledgerEntries: StatementLedgerRow[];
  selectableDocuments: {
    proformas: SelectableDocumentItem[];
    purchaseOrders: SelectableDocumentItem[];
    quotations: SelectableDocumentItem[];
    invoices: SelectableDocumentItem[];
  };
  emailLogs: Array<{
    id: string;
    recipientEmail: string;
    subject: string;
    body: string;
    attachmentName?: string | null;
    outstandingAmount: number;
    status: string;
    errorMessage?: string | null;
    createdAt: string;
  }>;
  smsLogs: Array<{
    id: string;
    phoneNumber: string;
    message: string;
    templateUsed?: string | null;
    outstandingAmount: number;
    status: string;
    errorMessage?: string | null;
    createdAt: string;
  }>;
}

export interface DuesDashboardMetrics {
  totalOutstanding: number;
  overdueAmount: number;
  customersWithDuesCount: number;
  bucket0_30Count: number;
  bucket0_30Amount: number;
  bucket31_60Count: number;
  bucket31_60Amount: number;
  bucket61_90Count: number;
  bucket61_90Amount: number;
  bucket90_plusCount: number;
  bucket90_plusAmount: number;
  todayFollowupsCount: number;
  declinedDisputedCount: number;
  declinedDisputedAmount: number;
}

export interface AddOldCustomerInput {
  customerName: string;
  companyName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  billingAddress?: string;
  shippingAddress?: string;
  openingDueBalance: number;
  referenceDate: string; // YYYY-MM-DD
  notes?: string;
}

export interface DuplicateWarningMatch {
  id: string;
  name: string;
  companyName?: string | null;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  matchedFields: string[]; // e.g. ['phone', 'gstin']
}

export interface RecordPaymentAllocationInput {
  customerId: string;
  amount: number;
  paymentDate?: string;
  paymentMode: string; // 'NEFT' | 'RTGS' | 'UPI' | 'CHEQUE' | 'CASH' | 'OTHER'
  transactionRef?: string;
  allocationMode: AllocationMode;
  targetId?: string; // required if INVOICE_SPECIFIC
  targetType?: DueSourceType; // required if INVOICE_SPECIFIC
  notes?: string;
}

export interface LogFollowupInput {
  channel: FollowupChannel;
  outcome: FollowupOutcome;
  notes: string;
  ptpDate?: string;
  ptpAmount?: number;
  nextActionDate?: string;
  targetDocumentId?: string;
  targetDocumentNumber?: string;
}

export interface DeclineDisputeInput {
  status: 'DISPUTED' | 'DECLINED';
  reason: string;
}

export interface FollowupRuleInput {
  id?: string;
  name: string;
  isEnabled: boolean;
  agingThresholdDays: number;
  repeatIntervalDays: number;
  communicationType: 'EMAIL_LEDGER' | 'SMS_REMINDER' | 'CALL_REMINDER';
  maxReminders?: number;
  templateSubject?: string;
  templateBody: string;
}

export interface BulkActionPreviewItem {
  customerId: string;
  customerName: string;
  companyName?: string | null;
  phone?: string | null;
  email?: string | null;
  outstandingAmount: number;
  agingBucket: AgingBucket;
  invoicesCount: number;
  isEligible: boolean;
  skipReason?: string; // 'MISSING_EMAIL' | 'MISSING_PHONE' | 'DECLINED_OR_DISPUTED' | 'ALREADY_REMINDED'
}

export interface BulkActionPreviewResult {
  totalSelected: number;
  eligibleCount: number;
  missingPhoneCount: number;
  missingEmailCount: number;
  declinedDisputedCount: number;
  alreadyRemindedCount: number;
  totalEligibleAmount: number;
  items: BulkActionPreviewItem[];
}

export interface BulkActionResult {
  totalSelected: number;
  successful: number;
  failed: number;
  skipped: number;
  details: Array<{
    customerId: string;
    customerName: string;
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
    reason?: string;
  }>;
}

export interface AddCustomerBalanceEntryInput {
  amount: number;
  entryType: 'DEBIT' | 'CREDIT'; // DEBIT = Opening balance / dues owed, CREDIT = Payment received
  referenceDate: string; // YYYY-MM-DD
  referenceNumber?: string;
  notes?: string;
  paymentMode?: string; // CASH, NEFT, RTGS, UPI, CHEQUE
}

export interface SendCustomerCommunicationInput {
  channels: Array<'EMAIL' | 'WHATSAPP' | 'SMS'>;
  emailSubject?: string;
  emailBody?: string;
  smsMessage?: string;
  whatsappMessage?: string;
  attachLedgerPdf?: boolean;
  selectedDocumentIds?: Array<{
    type: 'PROFORMA_INVOICE' | 'PURCHASE_ORDER' | 'QUOTATION' | 'TAX_INVOICE';
    id: string;
    documentNumber?: string;
  }>;
}

