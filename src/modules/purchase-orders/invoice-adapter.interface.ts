/**
 * invoice-adapter.interface.ts
 *
 * Contract for the PO Invoice Generation Module.
 * Defines the clean interface decoupling the PO dispatch flow from the underlying invoicing implementation
 * (Internal pdfmake engine vs external Invoice API).
 */

export interface CreateInvoicePayloadItem {
  slNo: number;
  productId?: string;
  sku?: string | null;
  productName: string;
  description?: string | null;
  hsnCode?: string;
  unit: string;
  quantity: number;
  rate: number;
  discount?: number;
  taxRate?: number;
  amount: number;
  taxAmount?: number;
  total: number;
}

export interface CreateInvoicePayload {
  purchaseOrderId: string;
  poNumber: string;
  quotationNumber: string;
  customerPoReferenceNumber?: string | null;
  customer: {
    id: string;
    name: string;
    companyName?: string | null;
    email: string;
    phone: string;
    gstin?: string | null;
  };
  billingAddress: {
    attentionTo: string;
    companyName?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string;
    email: string;
  };
  deliveryAddress: {
    attentionTo: string;
    companyName?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string;
    email: string;
  };
  dispatchInfo?: {
    carrierName: string;
    trackingNumber?: string | null;
    dispatchedAt: Date | string;
    dispatchNotes?: string | null;
  };
  items: CreateInvoicePayloadItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  shippingCost: number;
  grandTotal: number;
  advanceAmountPaid: number;
  balanceDue: number;
  currency?: string;
  issuedAt?: Date | string;
}

export interface InvoiceResult {
  invoiceId: string;
  invoiceNumber: string;
  source: 'INTERNAL' | 'LINKED_EXTERNAL';
  externalInvoiceId?: string | null;
  pdfStorageKeyOrUrl: string;
  pdfBuffer?: Buffer;
  amountInvoiced: number;
  amountPaidAdvance: number;
  balanceDue: number;
  fileHash?: string;
  verificationToken?: string;
  generatedAt: Date;
}

export interface InvoiceServiceAdapter {
  /**
   * Generates or requests a formal Tax Invoice for a dispatched Purchase Order.
   * Must be idempotent — if an invoice already exists for the PO, return the existing record.
   */
  createInvoice(payload: CreateInvoicePayload): Promise<InvoiceResult>;

  /**
   * Retrieves an invoice by PO ID or Invoice Number.
   */
  getInvoice(purchaseOrderId: string): Promise<InvoiceResult | null>;

  /**
   * Resends the invoice email notification to the customer.
   */
  resendInvoiceEmail(purchaseOrderId: string, recipientEmail?: string): Promise<void>;
}
