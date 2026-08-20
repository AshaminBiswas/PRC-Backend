import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import prisma from '../../config/database';
import {
  InvoiceServiceAdapter,
  CreateInvoicePayload,
  InvoiceResult,
} from './invoice-adapter.interface';
import { generateInvoicePdfBuffer } from './invoice-pdf.service';
import { getCurrentFinancialYear } from './po-numbering.service';
import { sendInvoiceReadyEmail } from './po-email.service';

const INVOICE_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'invoices');

export class InternalInvoiceAdapterService implements InvoiceServiceAdapter {
  constructor() {
    if (!fs.existsSync(INVOICE_UPLOAD_DIR)) {
      fs.mkdirSync(INVOICE_UPLOAD_DIR, { recursive: true });
    }
  }

  /**
   * Generates next sequential invoice number atomically for the PO
   */
  private async generateNextInvoiceNumber(): Promise<string> {
    const financialYear = getCurrentFinancialYear();
    try {
      const count = await prisma.b2BPoInvoice.count();
      const seq = count + 1;
      const padded = seq < 1000 ? seq.toString().padStart(3, '0') : seq.toString();
      return `PRC-INV-${financialYear}/${padded}`;
    } catch {
      return `PRC-INV-${financialYear}/001`;
    }
  }

  /**
   * Generates or requests a formal Tax Invoice for a dispatched Purchase Order.
   * Idempotent — returns existing invoice if already generated.
   */
  async createInvoice(payload: CreateInvoicePayload): Promise<InvoiceResult> {
    // 1. Idempotency Check: check if invoice already exists for this PO
    const existing = await prisma.b2BPoInvoice.findUnique({
      where: { purchaseOrderId: payload.purchaseOrderId },
    });

    if (existing) {
      return {
        invoiceId: existing.id,
        invoiceNumber: existing.invoiceNumber,
        source: existing.source as 'INTERNAL' | 'LINKED_EXTERNAL',
        externalInvoiceId: existing.externalInvoiceId,
        pdfStorageKeyOrUrl: existing.pdfStorageKeyOrUrl,
        amountInvoiced: Number(existing.amountInvoiced),
        amountPaidAdvance: Number(existing.amountPaidAdvance),
        balanceDue: Number(existing.balanceDue),
        fileHash: existing.fileHash || undefined,
        verificationToken: existing.verificationToken || undefined,
        generatedAt: existing.generatedAt,
      };
    }

    // 2. Fetch active bank settings
    const bankSetting = await prisma.bankAccountSetting.findFirst({
      where: { isActive: true },
    });

    // 3. Generate sequential invoice number
    const invoiceNumber = await this.generateNextInvoiceNumber();

    // 4. Generate PDF buffer
    const pdfBuffer = await generateInvoicePdfBuffer({
      invoiceNumber,
      poNumber: payload.poNumber,
      quotationNumber: payload.quotationNumber,
      customerPoReferenceNumber: payload.customerPoReferenceNumber,
      issuedAt: payload.issuedAt || new Date(),
      customerName: payload.customer.name,
      customerCompany: payload.customer.companyName,
      customerEmail: payload.customer.email,
      customerPhone: payload.customer.phone,
      customerGstin: payload.customer.gstin,
      billingAddress: payload.billingAddress,
      deliveryAddress: payload.deliveryAddress,
      dispatchInfo: payload.dispatchInfo,
      items: payload.items,
      subtotal: payload.subtotal,
      taxTotal: payload.taxTotal,
      discountTotal: payload.discountTotal,
      shippingCost: payload.shippingCost,
      grandTotal: payload.grandTotal,
      advanceAmountPaid: payload.advanceAmountPaid,
      balanceDue: payload.balanceDue,
      bankDetails: bankSetting
        ? {
            accountHolderName: bankSetting.accountHolderName,
            bankName: bankSetting.bankName,
            accountNumber: bankSetting.accountNumber,
            ifscOrRoutingNumber: bankSetting.ifscOrRoutingNumber,
            branch: bankSetting.branch,
          }
        : undefined,
    });

    // 5. Calculate SHA-256 Hash
    const fileHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    const verificationToken = crypto.randomUUID();

    // 6. Save PDF to disk
    const fileName = `Invoice_${invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    const fullPath = path.join(INVOICE_UPLOAD_DIR, fileName);
    await fs.promises.writeFile(fullPath, pdfBuffer);

    // 7. Persist B2BPoInvoice record in database
    const saved = await prisma.b2BPoInvoice.create({
      data: {
        purchaseOrderId: payload.purchaseOrderId,
        quotationNumber: payload.quotationNumber,
        poNumber: payload.poNumber,
        invoiceNumber,
        source: 'INTERNAL',
        pdfStorageKeyOrUrl: fullPath,
        amountInvoiced: payload.grandTotal,
        amountPaidAdvance: payload.advanceAmountPaid,
        balanceDue: payload.balanceDue,
        status: 'GENERATED',
        fileHash,
        verificationToken,
      },
    });

    return {
      invoiceId: saved.id,
      invoiceNumber: saved.invoiceNumber,
      source: 'INTERNAL',
      pdfStorageKeyOrUrl: fullPath,
      pdfBuffer,
      amountInvoiced: Number(saved.amountInvoiced),
      amountPaidAdvance: Number(saved.amountPaidAdvance),
      balanceDue: Number(saved.balanceDue),
      fileHash,
      verificationToken,
      generatedAt: saved.generatedAt,
    };
  }

  /**
   * Retrieves an invoice by PO ID
   */
  async getInvoice(purchaseOrderId: string): Promise<InvoiceResult | null> {
    const record = await prisma.b2BPoInvoice.findUnique({
      where: { purchaseOrderId },
    });

    if (!record) return null;

    return {
      invoiceId: record.id,
      invoiceNumber: record.invoiceNumber,
      source: record.source as 'INTERNAL' | 'LINKED_EXTERNAL',
      externalInvoiceId: record.externalInvoiceId,
      pdfStorageKeyOrUrl: record.pdfStorageKeyOrUrl,
      amountInvoiced: Number(record.amountInvoiced),
      amountPaidAdvance: Number(record.amountPaidAdvance),
      balanceDue: Number(record.balanceDue),
      fileHash: record.fileHash || undefined,
      verificationToken: record.verificationToken || undefined,
      generatedAt: record.generatedAt,
    };
  }

  /**
   * Resends invoice email to customer
   */
  async resendInvoiceEmail(purchaseOrderId: string, recipientEmail?: string): Promise<void> {
    const po = await prisma.b2BPurchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        customer: true,
        invoice: true,
      },
    });

    if (!po || !po.invoice) {
      throw new Error('Invoice not found for this purchase order');
    }

    await sendInvoiceReadyEmail({
      poId: po.id,
      poNumber: po.poNumber,
      quotationNumber: po.quotationNumber || po.poNumber,
      invoiceNumber: po.invoice.invoiceNumber,
      customerEmail: recipientEmail || po.customer.email,
      customerName: `${po.customer.firstName || ''} ${po.customer.lastName || ''}`.trim() || 'Valued Client',
      totalAmount: Number(po.invoice.amountInvoiced),
      amountPaidAdvance: Number(po.invoice.amountPaidAdvance),
      balanceDue: Number(po.invoice.balanceDue),
    });
  }
}

export const invoiceServiceAdapter = new InternalInvoiceAdapterService();
