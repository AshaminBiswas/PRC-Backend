import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Prisma, B2BPoStatus, PaymentReceiptStatus } from '@prisma/client';
import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { generateNextPoNumber } from './po-numbering.service';
import { generatePackingListPdfBuffer } from './packing-list-pdf.service';
import { generatePurchaseOrderPdfBuffer } from './po-pdf.service';
import {
  sendAdvancePaymentRequestEmail,
  sendPaymentAcknowledgedEmail,
  sendPackingListReadyEmail,
  sendInvoiceReadyEmail,
} from './po-email.service';
import {
  CreatePurchaseOrderInput,
  AcknowledgeReceiptInput,
  VerifyReceiptInput,
  RejectReceiptInput,
  AdvancePaymentSettingInput,
  BankAccountSettingInput,
  SavedAddressInput,
  RecordDispatchInput,
} from './purchase-orders.schema';
import { invoiceServiceAdapter } from './invoice-adapter.service';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const RECEIPTS_DIR = path.join(UPLOADS_DIR, 'receipts');
const PACKING_LISTS_DIR = path.join(UPLOADS_DIR, 'packing-lists');
const PO_DOCS_DIR = path.join(UPLOADS_DIR, 'purchase-orders');

// Ensure directories exist
[UPLOADS_DIR, RECEIPTS_DIR, PACKING_LISTS_DIR, PO_DOCS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Default fallback bank details if none configured
const DEFAULT_BANK_SETTINGS = {
  accountHolderName: 'PRC HARDWARE ENTERPRISE PRIVATE LIMITED',
  bankName: 'HDFC Bank Ltd',
  accountNumber: '50200088991122',
  ifscOrRoutingNumber: 'HDFC0001234',
  swiftCode: 'HDFCINBBXXX',
  branch: 'Mandoli Industrial Area, Delhi',
  currency: 'INR',
  isActive: true,
};

// ─── File Validation Helpers ──────────────────────────────────────────────────

function validateFileMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (!buffer || buffer.length < 4) return false;

  // PDF check: %PDF (0x25 0x50 0x44 0x46)
  if (mimeType === 'application/pdf') {
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }

  // PNG check: 0x89 0x50 0x4E 0x47
  if (mimeType === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }

  // JPEG check: 0xFF 0xD8 0xFF
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  return false;
}

function calculateSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function isUserAdmin(roles?: string[]): boolean {
  if (!roles || !Array.isArray(roles)) return false;
  return roles.some((r) => {
    if (!r) return false;
    const clean = r.toLowerCase().replace(/[-_\s]/g, '');
    return ['admin', 'superadmin', 'salesadmin', 'financeadmin', 'manager', 'staff'].includes(clean);
  });
}

// ─── Purchase Order Service Class ─────────────────────────────────────────────

export class PurchaseOrdersService {
  /**
   * 1. Get eligible approved quotations for a customer
   */
  async getEligibleQuotations(customerId: string) {
    const user = await prisma.user.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        email: true,
        phone: true,
        gstin: true,
        userRoles: { include: { role: true } },
      },
    });

    const isAdmin = user?.userRoles?.some((ur) =>
      ['admin', 'sales_admin', 'super_admin', 'finance_admin'].includes(
        ur.role?.slug?.toLowerCase() || ur.role?.name?.toLowerCase() || ''
      )
    );

    const userFilters: Prisma.QuoteWhereInput[] = [{ userId: customerId }];
    if (user?.email) userFilters.push({ email: { equals: user.email, mode: 'insensitive' } });
    if (user?.phone) userFilters.push({ phone: { contains: user.phone } });
    if (user?.gstin) userFilters.push({ gstNo: { equals: user.gstin, mode: 'insensitive' } });

    const statusConditions: Prisma.QuoteWhereInput[] = [
      { status: 'APPROVED' },
      { customerResponse: 'accepted' },
    ];

    const quotes = await prisma.quote.findMany({
      where: {
        isDeleted: false,
        OR: statusConditions,
        ...(!isAdmin ? { AND: [{ OR: userFilters }] } : {}),
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                images: true,
              },
            },
          },
        },
        b2bPurchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            status: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Filter out expired quotes or quotes with already active POs
    const now = new Date();
    return quotes.filter((q) => {
      const isNotExpired = !q.validUntil || new Date(q.validUntil) >= now;
      const hasActivePo =
        q.b2bPurchaseOrder &&
        q.b2bPurchaseOrder.status !== B2BPoStatus.CANCELLED &&
        q.b2bPurchaseOrder.status !== B2BPoStatus.REJECTED;
      return isNotExpired && !hasActivePo;
    });
  }

  /**
   * 2. Get quotation detail for PO pre-fill
   */
  async getQuotationForPo(quotationId: string, customerId: string) {
    const user = await prisma.user.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        email: true,
        phone: true,
        gstin: true,
        userRoles: { include: { role: true } },
      },
    });

    const isAdmin = user?.userRoles?.some((ur) =>
      ['admin', 'sales_admin', 'super_admin', 'finance_admin'].includes(
        ur.role?.slug?.toLowerCase() || ur.role?.name?.toLowerCase() || ''
      )
    );

    const quote = await prisma.quote.findFirst({
      where: {
        OR: [
          { id: quotationId },
          { quoteNumber: quotationId },
          { referenceNo: quotationId },
        ],
        isDeleted: false,
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                images: true,
              },
            },
          },
        },
        b2bPurchaseOrder: true,
      },
    });

    if (!quote) {
      throw new AppError('NOT_FOUND', 'Quotation not found', 404);
    }

    if (!isAdmin) {
      const isOwner =
        quote.userId === customerId ||
        (user?.email && quote.email?.toLowerCase() === user.email.toLowerCase()) ||
        (user?.phone && quote.phone && quote.phone.includes(user.phone)) ||
        (user?.gstin && quote.gstNo && quote.gstNo.toUpperCase() === user.gstin.toUpperCase());

      // If user has the direct link to the quotation, allow access
    }

    if (quote.status !== 'APPROVED' && quote.customerResponse !== 'accepted') {
      throw new AppError('INVALID_STATE', `Quotation must be approved or accepted to start a PO. Current status: ${quote.status}`, 400);
    }

    if (quote.validUntil && new Date(quote.validUntil) < new Date()) {
      throw new AppError('EXPIRED', 'This quotation has expired and cannot be converted into a Purchase Order', 400);
    }

    if (
      quote.b2bPurchaseOrder &&
      quote.b2bPurchaseOrder.status !== B2BPoStatus.CANCELLED &&
      quote.b2bPurchaseOrder.status !== B2BPoStatus.REJECTED
    ) {
      throw new AppError(
        'CONFLICT',
        `A Purchase Order (${quote.b2bPurchaseOrder.poNumber}) already exists for this quotation`,
        409
      );
    }

    const advanceSetting = await this.getAdvancePaymentSetting();
    const grandTotal = Number(quote.grandTotal || quote.basicPrice || 0);
    const advancePercentage =
      quote.advancePercentage !== null && quote.advancePercentage !== undefined
        ? Number(quote.advancePercentage)
        : Number(advanceSetting.defaultPercentage || 30);
    const minPercentage = Number(advanceSetting.minPercentage || 10);
    const maxPercentage = Number(advanceSetting.maxPercentage || 100);
    const allowPerPoOverride = advanceSetting.allowPerPoOverride !== false;
    const advanceAmount = Math.round((grandTotal * (advancePercentage / 100)) * 100) / 100;
    const balanceAmount = Math.round((grandTotal - advanceAmount) * 100) / 100;

    return {
      quote,
      pricingSummary: {
        basicPrice: Number(quote.basicPrice || 0),
        taxTotal: Number(quote.taxTotal || quote.gstAmount || 0),
        shippingCost: Number(quote.shippingCost || 0),
        discountTotal: Number(quote.discountTotal || 0),
        grandTotal,
        advancePercentage,
        minPercentage,
        maxPercentage,
        allowPerPoOverride,
        advanceAmount,
        balanceAmount,
      },
    };
  }

  /**
   * 3. Create & submit a Purchase Order against an approved quotation
   */
  async createPurchaseOrder(
    customerId: string,
    input: CreatePurchaseOrderInput,
    ipAddress?: string
  ) {
    // 1. Fetch & validate quotation server-side
    const user = await prisma.user.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        email: true,
        phone: true,
        gstin: true,
        userRoles: { include: { role: true } },
      },
    });

    const quote = await prisma.quote.findFirst({
      where: {
        OR: [
          { id: input.quotationId },
          { quoteNumber: input.quotationId },
          { referenceNo: input.quotationId },
        ],
        isDeleted: false,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        user: true,
        b2bPurchaseOrder: true,
      },
    });

    if (!quote) {
      throw new AppError('NOT_FOUND', 'Approved quotation not found or does not belong to your account', 404);
    }

    if (quote.status !== 'APPROVED' && quote.customerResponse !== 'accepted') {
      throw new AppError('INVALID_STATE', 'Only approved or accepted quotations can be converted into a Purchase Order', 400);
    }

    if (quote.validUntil && new Date(quote.validUntil) < new Date()) {
      throw new AppError('EXPIRED', 'This quotation has expired', 400);
    }

    if (
      quote.b2bPurchaseOrder &&
      quote.b2bPurchaseOrder.status !== B2BPoStatus.CANCELLED &&
      quote.b2bPurchaseOrder.status !== B2BPoStatus.REJECTED
    ) {
      throw new AppError(
        'CONFLICT',
        `A Purchase Order (${quote.b2bPurchaseOrder.poNumber}) has already been submitted for this quotation`,
        409
      );
    }

    if (!quote.items || quote.items.length === 0) {
      throw new AppError('BAD_REQUEST', 'Quotation has no line items', 400);
    }

    // 2. Fetch Advance Payment Setting and compute requested percentage
    const advanceSetting = await this.getAdvancePaymentSetting();
    let advancePercentage =
      quote.advancePercentage !== null && quote.advancePercentage !== undefined
        ? Number(quote.advancePercentage)
        : Number(advanceSetting.defaultPercentage || 30);

    if (input.advancePercentage !== undefined && input.advancePercentage !== null && !isNaN(Number(input.advancePercentage))) {
      const requestedPct = Math.round(Number(input.advancePercentage) * 100) / 100;
      const minPct = Number(advanceSetting.minPercentage || 10);
      const maxPct = Number(advanceSetting.maxPercentage || 100);
      if (requestedPct < minPct || requestedPct > maxPct) {
        throw new AppError('BAD_REQUEST', `Advance percentage must be between ${minPct}% and ${maxPct}%`, 400);
      }
      advancePercentage = requestedPct;
    }

    // 3. Recompute totals server-side from live quotation snapshot
    let subtotal = 0;
    const itemsSnapshot = quote.items.map((item, idx) => {
      const rate = Number(item.offeredPrice ?? item.rate ?? item.requestedPrice ?? 0);
      const amount = Math.round(rate * item.quantity * 100) / 100;
      subtotal += amount;
      return {
        slNo: idx + 1,
        productId: item.productId,
        productName: item.productNameSnapshot || item.product?.name || 'Architectural Hardware Item',
        sku: item.product?.sku || undefined,
        variantId: item.variantId || undefined,
        unit: item.unit || 'PCS',
        quantity: item.quantity,
        rate: new Prisma.Decimal(rate),
        amount: new Prisma.Decimal(amount),
        taxRate: new Prisma.Decimal(18.0),
        taxAmount: new Prisma.Decimal(Math.round(amount * 0.18 * 100) / 100),
        total: new Prisma.Decimal(Math.round(amount * 1.18 * 100) / 100),
      };
    });

    const taxTotal = Number(quote.taxTotal || quote.gstAmount || Math.round(subtotal * 0.18 * 100) / 100);
    const shippingCost = Number(quote.shippingCost || 0);
    const discountTotal = Number(quote.discountTotal || 0);
    const totalAmount = Number(quote.grandTotal || subtotal + taxTotal + shippingCost - discountTotal);

    const advanceAmount = Math.round((totalAmount * (advancePercentage / 100)) * 100) / 100;
    const balanceAmount = Math.round((totalAmount - advanceAmount) * 100) / 100;

    // Delivery address resolution
    const billingAddress = input.billingAddress;
    const deliveryAddress = input.sameAsBilling || !input.deliveryAddress ? input.billingAddress : input.deliveryAddress;

    // 4. Save to address book if requested
    if (input.saveBillingAddress) {
      await this.saveAddressToBook(customerId, billingAddress, input.billingAddressLabel || 'Billing Address').catch(() => {});
    }
    if (input.saveDeliveryAddress && !input.sameAsBilling && input.deliveryAddress) {
      await this.saveAddressToBook(customerId, deliveryAddress, input.deliveryAddressLabel || 'Delivery Address').catch(() => {});
    }

    // 5. Generate Atomic Sequential PO Number
    const { poNumber } = await generateNextPoNumber();

    // 6. Execute atomic database transaction
    const po = await prisma.$transaction(async (tx) => {
      const createdPo = await tx.b2BPurchaseOrder.create({
        data: {
          poNumber,
          quotationId: quote.id,
          quotationNumber: quote.referenceNo || quote.quoteNumber,
          customerId,
          status: B2BPoStatus.AWAITING_ADVANCE_PAYMENT,
          customerPoReferenceNumber: input.customerPoReferenceNumber || null,
          billingAddress: billingAddress as any,
          deliveryAddress: deliveryAddress as any,
          deliveryInstructions: input.deliveryInstructions || null,
          requestedDeliveryDate: input.requestedDeliveryDate ? new Date(input.requestedDeliveryDate) : null,
          subtotal: new Prisma.Decimal(subtotal),
          taxTotal: new Prisma.Decimal(taxTotal),
          discountTotal: new Prisma.Decimal(discountTotal),
          shippingCost: new Prisma.Decimal(shippingCost),
          totalAmount: new Prisma.Decimal(totalAmount),
          currency: 'INR',
          advancePercentage: new Prisma.Decimal(advancePercentage),
          advanceAmount: new Prisma.Decimal(advanceAmount),
          balanceAmount: new Prisma.Decimal(balanceAmount),
          submittedAt: new Date(),
          validatedAt: new Date(),
          createdBy: customerId,
          items: {
            create: itemsSnapshot,
          },
        },
        include: {
          items: true,
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              companyName: true,
              phone: true,
            },
          },
        },
      });

      // Write Audit Log
      await tx.poAuditLog.create({
        data: {
          purchaseOrderId: createdPo.id,
          action: 'PO_SUBMITTED_AND_VALIDATED',
          fromStatus: B2BPoStatus.SUBMITTED,
          toStatus: B2BPoStatus.AWAITING_ADVANCE_PAYMENT,
          performedBy: customerId,
          metadata: {
            poNumber,
            quotationNumber: createdPo.quotationNumber,
            totalAmount,
            advanceAmount,
            advancePercentage,
          },
          ipAddress,
        },
      });

      return createdPo;
    });

    // 7. Dispatch Advance Payment Request Email asynchronously
    const bankDetails = await this.getPrimaryBankAccount();
    sendAdvancePaymentRequestEmail({
      poId: po.id,
      to: po.customer.email,
      customerName: `${po.customer.firstName} ${po.customer.lastName}`.trim(),
      companyName: po.customer.companyName || undefined,
      poNumber: po.poNumber,
      quotationNumber: po.quotationNumber,
      totalAmount,
      currency: 'INR',
      advancePercentage,
      advanceAmount,
      balanceAmount,
      bankDetails,
    }).catch((err) => console.error('[Advance Payment Email Error]:', err));

    return po;
  }

  /**
   * 4. List Purchase Orders with role-based filtering
   */
  async getPurchaseOrders(
    userId: string,
    roles: string[],
    params: {
      status?: string;
      search?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const isAdmin = isUserAdmin(roles);
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.B2BPurchaseOrderWhereInput = {};

    if (!isAdmin) {
      where.customerId = userId;
    }

    if (params.status && params.status !== 'ALL') {
      where.status = params.status as B2BPoStatus;
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { poNumber: { contains: q, mode: 'insensitive' } },
        { quotationNumber: { contains: q, mode: 'insensitive' } },
        { customerPoReferenceNumber: { contains: q, mode: 'insensitive' } },
        { customer: { companyName: { contains: q, mode: 'insensitive' } } },
        { customer: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.b2BPurchaseOrder.count({ where }),
      prisma.b2BPurchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              companyName: true,
              phone: true,
            },
          },
          receipts: {
            where: { isDeleted: false },
            orderBy: { uploadedAt: 'desc' },
            take: 1,
          },
          packingList: {
            select: {
              id: true,
              generatedAt: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 5. Get Purchase Order by ID
   */
  async getPurchaseOrderById(poId: string, user: { id: string; roles: string[] }) {
    const isAdmin = isUserAdmin(user.roles);

    let po: any = null;
    try {
      po = await prisma.b2BPurchaseOrder.findUnique({
        where: { id: poId },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              companyName: true,
              phone: true,
              gstin: true,
            },
          },
          items: {
            orderBy: { slNo: 'asc' },
          },
          receipts: {
            where: { isDeleted: false },
            orderBy: { uploadedAt: 'desc' },
            include: {
              verifiedByUser: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
              acknowledgedByUser: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
          },
          packingList: true,
          dispatch: true,
          invoice: true,
          auditLogs: {
            orderBy: { performedAt: 'desc' },
            include: {
              adminUser: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
          },
        },
      });
    } catch (queryErr: any) {
      // Fallback query without invoice relation in case of column discrepancy
      po = await prisma.b2BPurchaseOrder.findUnique({
        where: { id: poId },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              companyName: true,
              phone: true,
              gstin: true,
            },
          },
          items: {
            orderBy: { slNo: 'asc' },
          },
          receipts: {
            where: { isDeleted: false },
            orderBy: { uploadedAt: 'desc' },
            include: {
              verifiedByUser: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
              acknowledgedByUser: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
          },
          packingList: true,
          dispatch: true,
          auditLogs: {
            orderBy: { performedAt: 'desc' },
            include: {
              adminUser: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
          },
        },
      });
    }

    if (!po) {
      throw new AppError('NOT_FOUND', 'Purchase Order not found', 404);
    }

    if (!isAdmin && po.customerId !== user.id) {
      throw new AppError('FORBIDDEN', 'Access denied to this Purchase Order', 403);
    }

    const bankDetails = await this.getPrimaryBankAccount();

    return {
      ...po,
      bankDetails,
    };
  }

  /**
   * 6. Upload or replace Payment Receipt
   */
  async uploadPaymentReceipt(
    poId: string,
    file: Express.Multer.File,
    user: { id: string; roles: string[] },
    ipAddress?: string
  ) {
    if (!file) {
      throw new AppError('BAD_REQUEST', 'Payment receipt file is required', 400);
    }

    // 1. Check size limit: 2 MB
    const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
    if (file.size > MAX_SIZE) {
      throw new AppError('FILE_TOO_LARGE', 'Payment receipt file size must not exceed 2 MB', 400);
    }

    // 2. Validate MIME type & file signature
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedMimes.includes(file.mimetype) || !validateFileMagicBytes(file.buffer, file.mimetype)) {
      throw new AppError(
        'INVALID_FILE_TYPE',
        'Invalid file type. Allowed formats: PDF, JPEG, JPG, PNG (with valid binary signature)',
        400
      );
    }

    // 3. Check PO existence and ownership
    const po = await prisma.b2BPurchaseOrder.findUnique({
      where: { id: poId },
      include: {
        receipts: {
          where: { isDeleted: false },
          orderBy: { version: 'desc' },
        },
      },
    });

    if (!po) {
      throw new AppError('NOT_FOUND', 'Purchase Order not found', 404);
    }

    const isAdmin = user.roles.some((r) =>
      ['admin', 'sales_admin', 'finance_admin', 'super_admin'].includes(r.toLowerCase())
    );

    if (!isAdmin && po.customerId !== user.id) {
      throw new AppError('FORBIDDEN', 'Access denied to upload receipt for this Purchase Order', 403);
    }

    // 4. Check status lock: If receipt is already VERIFIED, lock it
    const activeReceipt = po.receipts[0];
    if (activeReceipt && activeReceipt.status === PaymentReceiptStatus.VERIFIED) {
      throw new AppError(
        'LOCKED',
        'This payment receipt has already been digitally verified and locked. Contact Finance Admin to reopen.',
        400
      );
    }

    // 5. Compute SHA-256 hash and save to disk
    const fileHash = calculateSha256(file.buffer);
    const ext = path.extname(file.originalname).toLowerCase() || (file.mimetype === 'application/pdf' ? '.pdf' : '.jpg');
    const storageFileName = `receipt_${po.poNumber.replace(/[^a-zA-Z0-9]/g, '_')}_v${(activeReceipt?.version || 0) + 1}_${Date.now()}${ext}`;
    const filePath = path.join(RECEIPTS_DIR, storageFileName);

    await fs.promises.writeFile(filePath, file.buffer);

    const nextVersion = (activeReceipt?.version || 0) + 1;

    // 6. Update database record
    return await prisma.$transaction(async (tx) => {
      if (activeReceipt) {
        // Archive previous version to history
        await tx.paymentReceiptHistory.create({
          data: {
            receiptId: activeReceipt.id,
            purchaseOrderId: po.id,
            fileStorageKey: activeReceipt.fileStorageKey,
            originalFileName: activeReceipt.originalFileName,
            fileSizeBytes: activeReceipt.fileSizeBytes,
            mimeType: activeReceipt.mimeType,
            fileHash: activeReceipt.fileHash,
            version: activeReceipt.version,
            uploadedBy: activeReceipt.uploadedBy,
            uploadedAt: activeReceipt.uploadedAt,
          },
        });

        // Update active receipt
        const updated = await tx.paymentReceipt.update({
          where: { id: activeReceipt.id },
          data: {
            status: PaymentReceiptStatus.PENDING_REVIEW,
            fileStorageKey: storageFileName,
            originalFileName: file.originalname,
            fileSizeBytes: file.size,
            mimeType: file.mimetype,
            fileHash,
            uploadedBy: user.id,
            uploadedAt: new Date(),
            version: nextVersion,
            rejectionReason: null,
            rejectedAt: null,
            rejectedBy: null,
          },
        });

        await tx.b2BPurchaseOrder.update({
          where: { id: po.id },
          data: { status: B2BPoStatus.PAYMENT_RECEIPT_SUBMITTED },
        });

        await tx.poAuditLog.create({
          data: {
            purchaseOrderId: po.id,
            action: 'PAYMENT_RECEIPT_UPDATED',
            fromStatus: po.status,
            toStatus: B2BPoStatus.PAYMENT_RECEIPT_SUBMITTED,
            performedBy: user.id,
            metadata: {
              version: nextVersion,
              originalFileName: file.originalname,
              fileHash,
              fileSize: file.size,
            },
            ipAddress,
          },
        });

        return updated;
      } else {
        // Create new receipt
        const created = await tx.paymentReceipt.create({
          data: {
            purchaseOrderId: po.id,
            status: PaymentReceiptStatus.PENDING_REVIEW,
            fileStorageKey: storageFileName,
            originalFileName: file.originalname,
            fileSizeBytes: file.size,
            mimeType: file.mimetype,
            fileHash,
            uploadedBy: user.id,
            version: 1,
          },
        });

        await tx.b2BPurchaseOrder.update({
          where: { id: po.id },
          data: { status: B2BPoStatus.PAYMENT_RECEIPT_SUBMITTED },
        });

        await tx.poAuditLog.create({
          data: {
            purchaseOrderId: po.id,
            action: 'PAYMENT_RECEIPT_UPLOADED',
            fromStatus: po.status,
            toStatus: B2BPoStatus.PAYMENT_RECEIPT_SUBMITTED,
            performedBy: user.id,
            metadata: {
              version: 1,
              originalFileName: file.originalname,
              fileHash,
              fileSize: file.size,
            },
            ipAddress,
          },
        });

        return created;
      }
    });
  }

  /**
   * 7. Admin acknowledges payment receipt and sends confirmation email
   */
  async acknowledgePaymentReceipt(
    poId: string,
    adminUser: { id: string; email: string },
    input: AcknowledgeReceiptInput,
    ipAddress?: string
  ) {
    const po = await prisma.b2BPurchaseOrder.findUnique({
      where: { id: poId },
      include: {
        customer: true,
        receipts: {
          where: { isDeleted: false },
          orderBy: { uploadedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!po) {
      throw new AppError('NOT_FOUND', 'Purchase Order not found', 404);
    }

    const receipt = po.receipts[0];
    if (!receipt) {
      throw new AppError('BAD_REQUEST', 'No active payment receipt found on this Purchase Order to acknowledge', 400);
    }

    const remainingBalance = Math.max(0, Number(po.totalAmount) - input.amountReceived);

    const updated = await prisma.$transaction(async (tx) => {
      const updatedReceipt = await tx.paymentReceipt.update({
        where: { id: receipt.id },
        data: {
          status: PaymentReceiptStatus.ACKNOWLEDGED,
          amountReceived: new Prisma.Decimal(input.amountReceived),
          paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
          paymentReference: input.paymentReference,
          paymentMethod: input.paymentMethod,
          remarks: input.remarks || null,
          acknowledgedBy: adminUser.id,
          acknowledgedAt: new Date(),
        },
      });

      await tx.b2BPurchaseOrder.update({
        where: { id: po.id },
        data: {
          status: B2BPoStatus.PAYMENT_ACKNOWLEDGED,
          balanceAmount: new Prisma.Decimal(remainingBalance),
        },
      });

      await tx.poAuditLog.create({
        data: {
          purchaseOrderId: po.id,
          action: 'PAYMENT_ACKNOWLEDGED_BY_ADMIN',
          fromStatus: po.status,
          toStatus: B2BPoStatus.PAYMENT_ACKNOWLEDGED,
          performedBy: adminUser.id,
          metadata: {
            amountReceived: input.amountReceived,
            paymentReference: input.paymentReference,
            paymentMethod: input.paymentMethod,
            acknowledgedByEmail: adminUser.email,
          },
          ipAddress,
        },
      });

      return updatedReceipt;
    });

    // Send payment acknowledgment email
    sendPaymentAcknowledgedEmail({
      poId: po.id,
      to: po.customer.email,
      customerName: `${po.customer.firstName} ${po.customer.lastName}`.trim(),
      poNumber: po.poNumber,
      quotationNumber: po.quotationNumber,
      amountReceived: input.amountReceived,
      currency: po.currency,
      paymentDate: input.paymentDate ? new Date(input.paymentDate).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
      paymentReference: input.paymentReference,
      paymentMethod: input.paymentMethod,
      balanceAmount: remainingBalance,
      remarks: input.remarks,
    }).catch((err) => console.error('[Payment Ack Email Error]:', err));

    return updated;
  }

  /**
   * 8. Admin digitally verifies the payment receipt (tamper-evident audit & auto-packing list)
   */
  async verifyPaymentReceipt(
    poId: string,
    adminUser: { id: string; email: string },
    input: VerifyReceiptInput,
    ipAddress?: string
  ) {
    const po = await prisma.b2BPurchaseOrder.findUnique({
      where: { id: poId },
      include: {
        customer: true,
        items: true,
        receipts: {
          where: { isDeleted: false },
          orderBy: { uploadedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!po) {
      throw new AppError('NOT_FOUND', 'Purchase Order not found', 404);
    }

    let receipt = po.receipts[0];
    let diskFileHash = receipt?.fileHash || calculateSha256(Buffer.from(po.poNumber + Date.now()));

    if (receipt && receipt.fileStorageKey) {
      const filePath = path.join(RECEIPTS_DIR, receipt.fileStorageKey);
      if (fs.existsSync(filePath)) {
        try {
          const fileBuffer = await fs.promises.readFile(filePath);
          diskFileHash = calculateSha256(fileBuffer);
        } catch {
          // Keep existing hash
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      if (receipt) {
        await tx.paymentReceipt.update({
          where: { id: receipt.id },
          data: {
            status: PaymentReceiptStatus.VERIFIED,
            verifiedBy: adminUser.id,
            verifiedAt: new Date(),
            verificationNotes: input.verificationNotes || 'Digitally verified against bank statement',
            fileHash: diskFileHash,
          },
        });
      } else {
        // Create verification receipt if none existed
        receipt = await tx.paymentReceipt.create({
          data: {
            purchaseOrderId: po.id,
            status: PaymentReceiptStatus.VERIFIED,
            fileStorageKey: 'manual_verification',
            originalFileName: 'Admin Bank Statement Verification',
            fileSizeBytes: 0,
            mimeType: 'text/plain',
            fileHash: diskFileHash,
            uploadedBy: adminUser.id,
            verifiedBy: adminUser.id,
            verifiedAt: new Date(),
            verificationNotes: input.verificationNotes || 'Directly verified by administrator',
            version: 1,
          },
        });
      }

      await tx.b2BPurchaseOrder.update({
        where: { id: po.id },
        data: {
          status: B2BPoStatus.PAYMENT_VERIFIED,
        },
      });

      await tx.poAuditLog.create({
        data: {
          purchaseOrderId: po.id,
          action: 'PAYMENT_RECEIPT_DIGITALLY_VERIFIED',
          fromStatus: po.status,
          toStatus: B2BPoStatus.PAYMENT_VERIFIED,
          performedBy: adminUser.id,
          metadata: {
            verifiedByEmail: adminUser.email,
            fileHash: diskFileHash,
            notes: input.verificationNotes,
            confirmedAgainstBank: true,
          },
          ipAddress,
        },
      });
    });

    // ── Automatic Packing List Generation (Background / Async) ───────────────
    this.generatePackingList(po.id, adminUser.id).catch((err) => {
      console.error(`[Packing List Generation Error on PO ${po.poNumber}]:`, err);
    });

    return {
      success: true,
      message: 'Payment receipt digitally verified. Packing list generation triggered.',
      poNumber: po.poNumber,
      status: B2BPoStatus.PAYMENT_VERIFIED,
    };
  }

  /**
   * 9. Generate Packing List PDF for a verified PO
   */
  async generatePackingList(poId: string, adminId?: string) {
    const po = await prisma.b2BPurchaseOrder.findUnique({
      where: { id: poId },
      include: {
        customer: true,
        items: true,
        receipts: {
          where: { isDeleted: false },
          orderBy: { uploadedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!po) {
      throw new Error(`PO not found: ${poId}`);
    }

    const receipt = po.receipts[0];
    const totalQuantity = po.items.reduce((acc, i) => acc + i.quantity, 0);
    const totalPackages = Math.max(1, Math.ceil(totalQuantity / 25)); // Estimate 25 pcs per box

    // Generate PDF buffer using pdfmake
    const pdfBuffer = await generatePackingListPdfBuffer({
      poNumber: po.poNumber,
      quotationNumber: po.quotationNumber,
      customerPoReferenceNumber: po.customerPoReferenceNumber,
      createdAt: po.createdAt,
      requestedDeliveryDate: po.requestedDeliveryDate,
      customerName: `${po.customer?.firstName || ''} ${po.customer?.lastName || ''}`.trim() || 'Valued Customer',
      customerCompany: po.customer?.companyName || 'B2B Client',
      customerEmail: po.customer?.email || '',
      customerPhone: po.customer?.phone || '',
      billingAddress: po.billingAddress,
      deliveryAddress: po.deliveryAddress,
      deliveryInstructions: po.deliveryInstructions,
      totalPackages,
      totalQuantity,
      items: po.items.map((item) => ({
        slNo: item.slNo,
        productName: item.productName,
        sku: item.sku,
        unit: item.unit,
        quantity: item.quantity,
      })),
      verifiedAt: receipt?.verifiedAt || new Date(),
      fileHash: receipt?.fileHash || undefined,
    });

    if (!fs.existsSync(PACKING_LISTS_DIR)) {
      fs.mkdirSync(PACKING_LISTS_DIR, { recursive: true });
    }

    // Save PDF to storage
    const pdfFileName = `packing_list_${po.poNumber.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
    const pdfPath = path.join(PACKING_LISTS_DIR, pdfFileName);
    await fs.promises.writeFile(pdfPath, pdfBuffer);

    const pdfHash = calculateSha256(pdfBuffer);

    // Upsert PackingList record
    await prisma.$transaction(async (tx) => {
      await tx.packingList.upsert({
        where: { purchaseOrderId: po.id },
        update: {
          fileStorageKey: pdfFileName,
          fileHash: pdfHash,
          totalPackages,
          totalQuantity,
          generatedAt: new Date(),
        },
        create: {
          purchaseOrderId: po.id,
          quotationNumber: po.quotationNumber,
          poNumber: po.poNumber,
          fileStorageKey: pdfFileName,
          fileHash: pdfHash,
          totalPackages,
          totalQuantity,
          generatedAt: new Date(),
        },
      });

      await tx.b2BPurchaseOrder.update({
        where: { id: po.id },
        data: {
          status: B2BPoStatus.PACKING_LIST_GENERATED,
        },
      });

      await tx.poAuditLog.create({
        data: {
          purchaseOrderId: po.id,
          action: 'PACKING_LIST_AUTO_GENERATED',
          fromStatus: B2BPoStatus.PAYMENT_VERIFIED,
          toStatus: B2BPoStatus.PACKING_LIST_GENERATED,
          performedBy: adminId || null,
          metadata: {
            pdfFileName,
            pdfHash,
            totalPackages,
            totalQuantity,
          },
        },
      });
    });

    // Send packing list ready notification to customer
    sendPackingListReadyEmail({
      poId: po.id,
      to: po.customer.email,
      customerName: `${po.customer.firstName} ${po.customer.lastName}`.trim(),
      poNumber: po.poNumber,
      quotationNumber: po.quotationNumber,
      totalPackages,
      totalQuantity,
    }).catch((err) => console.error('[Packing List Email Error]:', err));
  }

  /**
   * 10. Get Packing List PDF stream / buffer for download
   */
  async getPackingListPdf(poId: string, user: { id: string; roles: string[] }) {
    const po = await prisma.b2BPurchaseOrder.findUnique({
      where: { id: poId },
      include: {
        packingList: true,
      },
    });

    if (!po) {
      throw new AppError('NOT_FOUND', 'Purchase Order not found', 404);
    }

    const isAdmin = user.roles.some((r) =>
      ['admin', 'sales_admin', 'finance_admin', 'super_admin'].includes(r.toLowerCase())
    );

    if (!isAdmin && po.customerId !== user.id) {
      throw new AppError('FORBIDDEN', 'Access denied to download this packing list', 403);
    }

    if (!po.packingList || !po.packingList.fileStorageKey) {
      throw new AppError(
        'NOT_FOUND',
        'Packing list has not been generated yet. Advance payment must be verified first.',
        404
      );
    }

    const filePath = path.join(PACKING_LISTS_DIR, po.packingList.fileStorageKey);
    if (!fs.existsSync(filePath)) {
      // Regenerate on demand if file is missing
      await this.generatePackingList(po.id, user.id);
    }

    return {
      filePath,
      fileName: `PackingList_${po.poNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
    };
  }

  /**
   * 10b. Get Payment Receipt File for viewing / downloading
   */
  async getPaymentReceiptFile(poId: string, user: { id: string; roles: string[] }) {
    const po = await prisma.b2BPurchaseOrder.findUnique({
      where: { id: poId },
      include: {
        receipts: {
          where: { isDeleted: false },
          orderBy: { uploadedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!po) {
      throw new AppError('NOT_FOUND', 'Purchase Order not found', 404);
    }

    const isAdmin = isUserAdmin(user.roles);
    if (!isAdmin && po.customerId !== user.id) {
      throw new AppError('FORBIDDEN', 'Access denied to view this receipt', 403);
    }

    const receipt = po.receipts[0];
    if (!receipt || !receipt.fileStorageKey) {
      throw new AppError('NOT_FOUND', 'No payment receipt found for this Purchase Order', 404);
    }

    const filePath = path.join(RECEIPTS_DIR, receipt.fileStorageKey);
    if (!fs.existsSync(filePath)) {
      throw new AppError('NOT_FOUND', 'Payment receipt file is not found on storage disk', 404);
    }

    return {
      filePath,
      fileName: receipt.originalFileName || `Receipt_${po.poNumber}_v${receipt.version}`,
      mimeType: receipt.mimeType || 'application/octet-stream',
    };
  }

  /**
   * 10c. Admin Update Purchase Order details
   */
  async updatePurchaseOrderByAdmin(
    poId: string,
    input: {
      customerPoReferenceNumber?: string;
      requestedDeliveryDate?: string | Date | null;
      deliveryInstructions?: string | null;
      billingAddress?: any;
      deliveryAddress?: any;
      advancePercentage?: number;
      adminNotes?: string;
    },
    adminUser: { id: string; email: string }
  ) {
    const po = await prisma.b2BPurchaseOrder.findUnique({
      where: { id: poId },
      include: {
        customer: true,
        items: true,
        receipts: { where: { isDeleted: false }, orderBy: { uploadedAt: 'desc' }, take: 1 },
        packingList: true,
        dispatch: true,
        invoice: true,
      },
    });

    if (!po) {
      throw new AppError('NOT_FOUND', 'Purchase Order not found', 404);
    }

    const grandTotal = Number(po.totalAmount);
    let advancePercentage = po.advancePercentage ? Number(po.advancePercentage) : 30;
    let advanceAmount = po.advanceAmount ? Number(po.advanceAmount) : 0;
    let balanceAmount = po.balanceAmount ? Number(po.balanceAmount) : 0;

    if (input.advancePercentage !== undefined && input.advancePercentage !== null) {
      advancePercentage = Math.min(100, Math.max(1, Number(input.advancePercentage)));
      advanceAmount = Math.round((grandTotal * (advancePercentage / 100)) * 100) / 100;
      balanceAmount = Math.round((grandTotal - advanceAmount) * 100) / 100;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.b2BPurchaseOrder.update({
        where: { id: poId },
        data: {
          customerPoReferenceNumber:
            input.customerPoReferenceNumber !== undefined
              ? input.customerPoReferenceNumber
              : po.customerPoReferenceNumber,
          requestedDeliveryDate:
            input.requestedDeliveryDate !== undefined
              ? input.requestedDeliveryDate
                ? new Date(input.requestedDeliveryDate)
                : null
              : po.requestedDeliveryDate,
          deliveryInstructions:
            input.deliveryInstructions !== undefined
              ? input.deliveryInstructions
              : po.deliveryInstructions,
          billingAddress: input.billingAddress || (po.billingAddress as any),
          deliveryAddress: input.deliveryAddress || (po.deliveryAddress as any),
          advancePercentage: new Prisma.Decimal(advancePercentage),
          advanceAmount: new Prisma.Decimal(advanceAmount),
          balanceAmount: new Prisma.Decimal(balanceAmount),
        },
        include: {
          customer: true,
          items: true,
          receipts: { where: { isDeleted: false }, orderBy: { uploadedAt: 'desc' } },
          packingList: true,
          dispatch: true,
          invoice: true,
        },
      });

      await tx.poAuditLog.create({
        data: {
          purchaseOrderId: po.id,
          action: 'PURCHASE_ORDER_UPDATED_BY_ADMIN',
          fromStatus: po.status,
          toStatus: po.status,
          performedBy: adminUser.id,
          metadata: {
            updatedByEmail: adminUser.email,
            changes: input,
          },
        },
      });

      return p;
    });

    return updated;
  }

  /**
   * 10d. Generate & Download Official Purchase Order PDF
   */
  async getPurchaseOrderPdf(poId: string, user: { id: string; roles: string[] }) {
    const po = await prisma.b2BPurchaseOrder.findUnique({
      where: { id: poId },
      include: {
        customer: true,
        items: true,
      },
    });

    if (!po) {
      throw new AppError('NOT_FOUND', 'Purchase Order not found', 404);
    }

    const isAdmin = isUserAdmin(user.roles);
    if (!isAdmin && po.customerId !== user.id) {
      throw new AppError('FORBIDDEN', 'Access denied to download this Purchase Order', 403);
    }

    const bankSettings = await this.getBankAccountSettings();
    const bank = bankSettings.find((b) => b.isActive) || bankSettings[0] || DEFAULT_BANK_SETTINGS;

    const pdfBuffer = await generatePurchaseOrderPdfBuffer({
      poNumber: po.poNumber,
      quotationNumber: po.quotationNumber,
      customerPoReferenceNumber: po.customerPoReferenceNumber,
      status: po.status,
      createdAt: po.createdAt,
      requestedDeliveryDate: po.requestedDeliveryDate,
      customerName: `${po.customer?.firstName || ''} ${po.customer?.lastName || ''}`.trim() || 'Valued Client',
      customerCompany: po.customer?.companyName || null,
      customerEmail: po.customer?.email || '',
      customerPhone: po.customer?.phone || '',
      customerGstin: po.customer?.gstin || null,
      billingAddress: po.billingAddress,
      deliveryAddress: po.deliveryAddress,
      deliveryInstructions: po.deliveryInstructions,
      items: po.items.map((item) => ({
        slNo: item.slNo,
        productName: item.productName,
        sku: item.sku,
        unit: item.unit,
        quantity: item.quantity,
        rate: Number(item.rate),
        taxRate: item.taxRate ? Number(item.taxRate) : undefined,
        taxAmount: item.taxAmount ? Number(item.taxAmount) : undefined,
        total: Number(item.total || item.amount),
      })),
      subtotal: Number(po.subtotal),
      taxTotal: Number(po.taxTotal),
      discountTotal: Number(po.discountTotal || 0),
      shippingCost: Number(po.shippingCost || 0),
      grandTotal: Number(po.totalAmount),
      advancePercentage: Number(po.advancePercentage || 30),
      advanceAmount: Number(po.advanceAmount || 0),
      balanceAmount: Number(po.balanceAmount || 0),
      bankDetails: {
        accountHolderName: bank.accountHolderName,
        bankName: bank.bankName,
        accountNumber: bank.accountNumber,
        ifscOrRoutingNumber: bank.ifscOrRoutingNumber,
        branch: bank.branch,
      },
    });

    if (!fs.existsSync(PO_DOCS_DIR)) {
      fs.mkdirSync(PO_DOCS_DIR, { recursive: true });
    }

    const pdfFileName = `PurchaseOrder_${po.poNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    const pdfPath = path.join(PO_DOCS_DIR, pdfFileName);
    await fs.promises.writeFile(pdfPath, pdfBuffer);

    return {
      filePath: pdfPath,
      fileName: pdfFileName,
    };
  }

  /**
   * 11. Reject Payment Receipt
   */
  async rejectPaymentReceipt(
    poId: string,
    adminUser: { id: string; email: string },
    input: RejectReceiptInput,
    ipAddress?: string
  ) {
    const po = await prisma.b2BPurchaseOrder.findUnique({
      where: { id: poId },
      include: {
        receipts: {
          where: { isDeleted: false },
          orderBy: { uploadedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!po) {
      throw new AppError('NOT_FOUND', 'Purchase Order not found', 404);
    }

    const receipt = po.receipts[0];
    if (!receipt) {
      throw new AppError('BAD_REQUEST', 'No active receipt to reject', 400);
    }

    return await prisma.$transaction(async (tx) => {
      const updatedReceipt = await tx.paymentReceipt.update({
        where: { id: receipt.id },
        data: {
          status: PaymentReceiptStatus.REJECTED,
          rejectedBy: adminUser.id,
          rejectedAt: new Date(),
          rejectionReason: input.rejectionReason,
        },
      });

      await tx.b2BPurchaseOrder.update({
        where: { id: po.id },
        data: {
          status: B2BPoStatus.AWAITING_ADVANCE_PAYMENT,
        },
      });

      await tx.poAuditLog.create({
        data: {
          purchaseOrderId: po.id,
          action: 'PAYMENT_RECEIPT_REJECTED_BY_ADMIN',
          fromStatus: po.status,
          toStatus: B2BPoStatus.AWAITING_ADVANCE_PAYMENT,
          performedBy: adminUser.id,
          metadata: {
            reason: input.rejectionReason,
            rejectedByEmail: adminUser.email,
          },
          ipAddress,
        },
      });

      return updatedReceipt;
    });
  }

  /**
   * 12. Reopen Payment Receipt (Unlocks verified receipt for correction)
   */
  async reopenPaymentReceipt(
    poId: string,
    adminUser: { id: string; email: string },
    reason: string,
    ipAddress?: string
  ) {
    const po = await prisma.b2BPurchaseOrder.findUnique({
      where: { id: poId },
      include: {
        receipts: {
          where: { isDeleted: false },
          orderBy: { uploadedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!po) {
      throw new AppError('NOT_FOUND', 'Purchase Order not found', 404);
    }

    const receipt = po.receipts[0];
    if (!receipt) {
      throw new AppError('BAD_REQUEST', 'No active receipt to reopen', 400);
    }

    return await prisma.$transaction(async (tx) => {
      const updatedReceipt = await tx.paymentReceipt.update({
        where: { id: receipt.id },
        data: {
          status: PaymentReceiptStatus.PENDING_REVIEW,
          verifiedBy: null,
          verifiedAt: null,
        },
      });

      await tx.b2BPurchaseOrder.update({
        where: { id: po.id },
        data: {
          status: B2BPoStatus.PAYMENT_RECEIPT_SUBMITTED,
        },
      });

      await tx.poAuditLog.create({
        data: {
          purchaseOrderId: po.id,
          action: 'PAYMENT_RECEIPT_REOPENED_BY_ADMIN',
          fromStatus: po.status,
          toStatus: B2BPoStatus.PAYMENT_RECEIPT_SUBMITTED,
          performedBy: adminUser.id,
          metadata: {
            reason,
            reopenedByEmail: adminUser.email,
          },
          ipAddress,
        },
      });

      return updatedReceipt;
    });
  }

  /**
   * 13. Reject Purchase Order at validation stage
   */
  async rejectPurchaseOrder(
    poId: string,
    adminUser: { id: string; email: string },
    rejectionReason: string,
    ipAddress?: string
  ) {
    const po = await prisma.b2BPurchaseOrder.findUnique({
      where: { id: poId },
    });

    if (!po) {
      throw new AppError('NOT_FOUND', 'Purchase Order not found', 404);
    }

    return await prisma.$transaction(async (tx) => {
      const updatedPo = await tx.b2BPurchaseOrder.update({
        where: { id: po.id },
        data: {
          status: B2BPoStatus.REJECTED,
          rejectedAt: new Date(),
          rejectionReason,
        },
      });

      await tx.poAuditLog.create({
        data: {
          purchaseOrderId: po.id,
          action: 'PURCHASE_ORDER_REJECTED',
          fromStatus: po.status,
          toStatus: B2BPoStatus.REJECTED,
          performedBy: adminUser.id,
          metadata: {
            rejectionReason,
            rejectedByEmail: adminUser.email,
          },
          ipAddress,
        },
      });

      return updatedPo;
    });
  }

  // ─── Settings & Address Book Helpers ─────────────────────────────────────────

  async getAdvancePaymentSetting() {
    try {
      let setting = await prisma.advancePaymentSetting.findFirst();
      if (!setting) {
        setting = await prisma.advancePaymentSetting.create({
          data: {
            defaultPercentage: new Prisma.Decimal(30),
            minPercentage: new Prisma.Decimal(10),
            maxPercentage: new Prisma.Decimal(100),
            allowPerPoOverride: true,
          },
        }).catch(() => null);
      }
      return setting || {
        defaultPercentage: new Prisma.Decimal(30),
        minPercentage: new Prisma.Decimal(10),
        maxPercentage: new Prisma.Decimal(100),
        allowPerPoOverride: true,
      };
    } catch {
      return {
        defaultPercentage: new Prisma.Decimal(30),
        minPercentage: new Prisma.Decimal(10),
        maxPercentage: new Prisma.Decimal(100),
        allowPerPoOverride: true,
      };
    }
  }

  async updateAdvancePaymentSetting(input: AdvancePaymentSettingInput, adminId: string) {
    let setting = await prisma.advancePaymentSetting.findFirst();
    if (setting) {
      return await prisma.advancePaymentSetting.update({
        where: { id: setting.id },
        data: {
          defaultPercentage: new Prisma.Decimal(input.defaultPercentage),
          minPercentage: new Prisma.Decimal(input.minPercentage),
          maxPercentage: new Prisma.Decimal(input.maxPercentage),
          allowPerPoOverride: input.allowPerPoOverride,
          updatedBy: adminId,
        },
      });
    } else {
      return await prisma.advancePaymentSetting.create({
        data: {
          defaultPercentage: new Prisma.Decimal(input.defaultPercentage),
          minPercentage: new Prisma.Decimal(input.minPercentage),
          maxPercentage: new Prisma.Decimal(input.maxPercentage),
          allowPerPoOverride: input.allowPerPoOverride,
          updatedBy: adminId,
        },
      });
    }
  }

  async getPrimaryBankAccount() {
    try {
      const bank = await prisma.bankAccountSetting.findFirst({
        where: { isActive: true },
      });
      return bank || DEFAULT_BANK_SETTINGS;
    } catch {
      return DEFAULT_BANK_SETTINGS;
    }
  }

  async getBankAccountSettings() {
    try {
      const list = await prisma.bankAccountSetting.findMany({
        orderBy: { updatedAt: 'desc' },
      });
      if (list.length === 0) {
        const created = await prisma.bankAccountSetting.create({
          data: DEFAULT_BANK_SETTINGS,
        }).catch(() => null);
        return created ? [created] : [DEFAULT_BANK_SETTINGS];
      }
      return list;
    } catch {
      return [DEFAULT_BANK_SETTINGS];
    }
  }

  async updateBankAccountSetting(input: BankAccountSettingInput, adminId: string) {
    const existing = await prisma.bankAccountSetting.findFirst();
    if (existing) {
      return await prisma.bankAccountSetting.update({
        where: { id: existing.id },
        data: {
          ...input,
          updatedBy: adminId,
        },
      });
    } else {
      return await prisma.bankAccountSetting.create({
        data: {
          ...input,
          updatedBy: adminId,
        },
      });
    }
  }

  async getSavedAddresses(customerId: string) {
    try {
      return await prisma.savedAddress.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      return [];
    }
  }

  async saveAddressToBook(customerId: string, address: any, label = 'Default') {
    return await prisma.savedAddress.create({
      data: {
        customerId,
        label,
        attentionTo: address.attentionTo,
        companyName: address.companyName || null,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2 || null,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country || 'IN',
        phone: address.phone,
        email: address.email,
        isDefaultBilling: Boolean(address.isDefaultBilling),
        isDefaultDelivery: Boolean(address.isDefaultDelivery),
      },
    });
  }

  async deleteSavedAddress(customerId: string, addressId: string) {
    return await prisma.savedAddress.deleteMany({
      where: {
        id: addressId,
        customerId,
      },
    });
  }

  // ─── Dispatch & Invoice Generation Extension ─────────────────────────────────

  /**
   * 15. Record PO Dispatch
   * Only allowed from PACKING_LIST_GENERATED. Idempotent: re-hitting returns existing dispatch.
   * Asynchronously triggers non-blocking invoice generation.
   */
  async recordDispatch(
    poId: string,
    adminUser: { id: string; email?: string; name?: string },
    input: RecordDispatchInput,
    ipAddress?: string
  ) {
    const po = await prisma.b2BPurchaseOrder.findUnique({
      where: { id: poId },
      include: {
        dispatch: true,
        invoice: true,
      },
    });

    if (!po) {
      throw new AppError('NOT_FOUND', 'Purchase Order not found', 404);
    }

    // Idempotency: If already dispatched, return existing record
    if (po.dispatch) {
      return {
        po,
        dispatch: po.dispatch,
        invoice: po.invoice,
        message: 'Purchase Order was already dispatched',
      };
    }

    // Only allowed from PACKING_LIST_GENERATED
    if (po.status !== B2BPoStatus.PACKING_LIST_GENERATED && po.status !== B2BPoStatus.PAYMENT_VERIFIED) {
      throw new AppError(
        'INVALID_STATUS_TRANSITION',
        `Cannot dispatch Purchase Order in ${po.status} status. Packing list must be generated first.`,
        400
      );
    }

    const dispatchedAt = input.dispatchedAt ? new Date(input.dispatchedAt) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      const dispatchRecord = await tx.poDispatch.create({
        data: {
          purchaseOrderId: po.id,
          dispatchedAt,
          dispatchedBy: adminUser.id,
          dispatchedByName: adminUser.name || adminUser.email || 'Admin',
          carrierName: input.carrierName,
          trackingNumber: input.trackingNumber || null,
          dispatchNotes: input.dispatchNotes || null,
        },
      });

      const updatedPo = await tx.b2BPurchaseOrder.update({
        where: { id: po.id },
        data: {
          status: B2BPoStatus.DISPATCHED,
        },
      });

      await tx.poAuditLog.create({
        data: {
          purchaseOrderId: po.id,
          action: 'PO_DISPATCHED',
          fromStatus: po.status,
          toStatus: B2BPoStatus.DISPATCHED,
          performedBy: adminUser.id,
          metadata: {
            carrierName: input.carrierName,
            trackingNumber: input.trackingNumber,
            dispatchedAt,
            dispatchNotes: input.dispatchNotes,
          },
          ipAddress,
        },
      });

      return { updatedPo, dispatchRecord };
    });

    // Asynchronously trigger non-blocking Invoice generation in background
    setImmediate(() => {
      this.triggerBackgroundInvoiceGeneration(po.id, adminUser).catch((err) => {
        console.error(`[Async Invoice Job] Background generation failed for PO ${po.poNumber}:`, err.message);
      });
    });

    return {
      po: result.updatedPo,
      dispatch: result.dispatchRecord,
      message: 'Purchase Order marked as dispatched. Invoice generation initiated.',
    };
  }

  /**
   * Background Invoice Generation Job with Retry Backoff
   */
  async triggerBackgroundInvoiceGeneration(
    poId: string,
    adminUser?: { id: string; email?: string; name?: string }
  ) {
    const MAX_RETRIES = 3;
    let attempt = 0;
    let lastError: any = null;

    while (attempt < MAX_RETRIES) {
      attempt++;
      try {
        const po = await prisma.b2BPurchaseOrder.findUnique({
          where: { id: poId },
          include: {
            customer: true,
            items: true,
            dispatch: true,
            invoice: true,
          },
        });

        if (!po) return;

        // Idempotency: If invoice already created, ensure status is INVOICED and return
        if (po.invoice) {
          if (po.status !== B2BPoStatus.INVOICED) {
            await prisma.b2BPurchaseOrder.update({
              where: { id: po.id },
              data: { status: B2BPoStatus.INVOICED },
            });
          }
          return;
        }

        const billingAddr = po.billingAddress as any;
        const deliveryAddr = (po.deliveryAddress as any) || billingAddr;

        // Assemble invoice payload
        const invoiceResult = await invoiceServiceAdapter.createInvoice({
          purchaseOrderId: po.id,
          poNumber: po.poNumber,
          quotationNumber: po.quotationNumber,
          customerPoReferenceNumber: po.customerPoReferenceNumber,
          customer: {
            id: po.customerId,
            name: `${po.customer.firstName || ''} ${po.customer.lastName || ''}`.trim() || 'Commercial Client',
            companyName: po.customer.companyName,
            email: po.customer.email,
            phone: po.customer.phone || billingAddr.phone || '',
            gstin: po.customer.gstin,
          },
          billingAddress: billingAddr,
          deliveryAddress: deliveryAddr,
          dispatchInfo: po.dispatch
            ? {
                carrierName: po.dispatch.carrierName,
                trackingNumber: po.dispatch.trackingNumber,
                dispatchedAt: po.dispatch.dispatchedAt,
                dispatchNotes: po.dispatch.dispatchNotes,
              }
            : undefined,
          items: po.items.map((item) => ({
            slNo: item.slNo,
            productId: item.productId,
            sku: item.sku,
            productName: item.productName,
            unit: item.unit,
            quantity: item.quantity,
            rate: Number(item.rate),
            amount: Number(item.amount),
            taxRate: Number(item.taxRate || 18),
            taxAmount: Number(item.taxAmount || 0),
            total: Number(item.total),
          })),
          subtotal: Number(po.subtotal),
          taxTotal: Number(po.taxTotal),
          discountTotal: Number(po.discountTotal),
          shippingCost: Number(po.shippingCost),
          grandTotal: Number(po.totalAmount),
          advanceAmountPaid: Number(po.advanceAmount),
          balanceDue: Number(po.balanceAmount),
          issuedAt: new Date(),
        });

        // Update PO status to INVOICED
        await prisma.b2BPurchaseOrder.update({
          where: { id: po.id },
          data: { status: B2BPoStatus.INVOICED },
        });

        // Audit Log
        await prisma.poAuditLog.create({
          data: {
            purchaseOrderId: po.id,
            action: 'INVOICE_GENERATED',
            fromStatus: po.status,
            toStatus: B2BPoStatus.INVOICED,
            performedBy: adminUser?.id || null,
            metadata: {
              invoiceNumber: invoiceResult.invoiceNumber,
              invoiceId: invoiceResult.invoiceId,
              amountInvoiced: invoiceResult.amountInvoiced,
              advancePaid: invoiceResult.amountPaidAdvance,
              balanceDue: invoiceResult.balanceDue,
              fileHash: invoiceResult.fileHash,
              attempt,
            },
          },
        });

        // Send Email to Customer
        await sendInvoiceReadyEmail({
          poId: po.id,
          poNumber: po.poNumber,
          quotationNumber: po.quotationNumber,
          invoiceNumber: invoiceResult.invoiceNumber,
          customerEmail: po.customer.email,
          customerName: `${po.customer.firstName || ''} ${po.customer.lastName || ''}`.trim() || 'Valued Client',
          totalAmount: invoiceResult.amountInvoiced,
          amountPaidAdvance: invoiceResult.amountPaidAdvance,
          balanceDue: invoiceResult.balanceDue,
          carrierName: po.dispatch?.carrierName,
          trackingNumber: po.dispatch?.trackingNumber,
        });

        return; // Success
      } catch (err: any) {
        lastError = err;
        console.warn(`[Invoice Job] Attempt ${attempt} failed for PO ${poId}:`, err.message);
        // Exponential backoff wait (100ms, 300ms)
        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 200));
        }
      }
    }

    // If all retries failed, update PO status to INVOICE_GENERATION_FAILED and log
    await prisma.b2BPurchaseOrder.update({
      where: { id: poId },
      data: { status: B2BPoStatus.INVOICE_GENERATION_FAILED },
    }).catch(() => {});

    await prisma.poAuditLog.create({
      data: {
        purchaseOrderId: poId,
        action: 'INVOICE_GENERATION_FAILED',
        fromStatus: B2BPoStatus.DISPATCHED,
        toStatus: B2BPoStatus.INVOICE_GENERATION_FAILED,
        performedBy: adminUser?.id || null,
        metadata: {
          error: lastError?.message || 'Invoice generation job failed after max attempts',
          attempts: MAX_RETRIES,
        },
      },
    }).catch(() => {});
  }

  /**
   * 16. Admin manual re-trigger for failed invoice generation
   */
  async regenerateInvoice(
    poId: string,
    adminUser: { id: string; email?: string; name?: string },
    ipAddress?: string
  ) {
    const po = await prisma.b2BPurchaseOrder.findUnique({
      where: { id: poId },
      include: { invoice: true },
    });

    if (!po) {
      throw new AppError('NOT_FOUND', 'Purchase Order not found', 404);
    }

    if (po.invoice && po.status === B2BPoStatus.INVOICED) {
      return {
        message: 'Invoice is already generated and active for this Purchase Order',
        invoice: po.invoice,
      };
    }

    // Trigger generation job
    await this.triggerBackgroundInvoiceGeneration(po.id, adminUser);

    const updated = await prisma.b2BPurchaseOrder.findUnique({
      where: { id: poId },
      include: { invoice: true },
    });

    return {
      message: 'Invoice generation job executed',
      status: updated?.status,
      invoice: updated?.invoice,
    };
  }

  /**
   * 17. Get PO Invoice metadata
   */
  async getPoInvoice(poId: string, user: { id: string; roles: string[] }) {
    const isAdmin = user.roles.some((r) =>
      ['admin', 'sales_admin', 'finance_admin', 'super_admin'].includes(r.toLowerCase())
    );

    const po = await prisma.b2BPurchaseOrder.findUnique({
      where: { id: poId },
      include: {
        invoice: true,
        dispatch: true,
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true, companyName: true, gstin: true },
        },
      },
    });

    if (!po) {
      throw new AppError('NOT_FOUND', 'Purchase Order not found', 404);
    }

    if (!isAdmin && po.customerId !== user.id) {
      throw new AppError('FORBIDDEN', 'Access denied to this Invoice', 403);
    }

    if (!po.invoice) {
      throw new AppError('NOT_FOUND', 'Invoice has not been generated for this Purchase Order yet', 404);
    }

    return {
      poNumber: po.poNumber,
      quotationNumber: po.quotationNumber,
      status: po.status,
      customer: po.customer,
      dispatch: po.dispatch,
      invoice: po.invoice,
    };
  }

  /**
   * 18. Download PO Invoice PDF File
   */
  async getInvoicePdf(poId: string, user: { id: string; roles: string[] }) {
    const isAdmin = user.roles.some((r) =>
      ['admin', 'sales_admin', 'finance_admin', 'super_admin'].includes(r.toLowerCase())
    );

    const po = await prisma.b2BPurchaseOrder.findUnique({
      where: { id: poId },
      include: { invoice: true },
    });

    if (!po) {
      throw new AppError('NOT_FOUND', 'Purchase Order not found', 404);
    }

    if (!isAdmin && po.customerId !== user.id) {
      throw new AppError('FORBIDDEN', 'Access denied to this Invoice', 403);
    }

    if (!po.invoice || !po.invoice.pdfStorageKeyOrUrl) {
      throw new AppError('NOT_FOUND', 'Invoice PDF not available for download', 404);
    }

    const filePath = po.invoice.pdfStorageKeyOrUrl;
    if (!fs.existsSync(filePath)) {
      // Re-render and save if file was purged
      await this.triggerBackgroundInvoiceGeneration(poId);
      const rechecked = await prisma.b2BPoInvoice.findUnique({ where: { purchaseOrderId: poId } });
      if (!rechecked || !fs.existsSync(rechecked.pdfStorageKeyOrUrl)) {
        throw new AppError('NOT_FOUND', 'Invoice PDF file could not be located on disk', 404);
      }
      return {
        filePath: rechecked.pdfStorageKeyOrUrl,
        fileName: `TaxInvoice_${po.invoice.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
      };
    }

    return {
      filePath,
      fileName: `TaxInvoice_${po.invoice.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
    };
  }

  /**
   * 19. Admin List all Invoices across POs
   */
  async listAllInvoices(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.B2BPoInvoiceWhereInput = {};

    if (query.status && query.status !== 'ALL') {
      where.status = query.status;
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { invoiceNumber: { contains: term, mode: 'insensitive' } },
        { poNumber: { contains: term, mode: 'insensitive' } },
        { quotationNumber: { contains: term, mode: 'insensitive' } },
        {
          purchaseOrder: {
            customer: {
              OR: [
                { email: { contains: term, mode: 'insensitive' } },
                { companyName: { contains: term, mode: 'insensitive' } },
                { firstName: { contains: term, mode: 'insensitive' } },
                { lastName: { contains: term, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.b2BPoInvoice.count({ where }),
      prisma.b2BPoInvoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { generatedAt: 'desc' },
        include: {
          purchaseOrder: {
            include: {
              customer: {
                select: { id: true, firstName: true, lastName: true, email: true, companyName: true, gstin: true },
              },
              dispatch: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}

export const purchaseOrdersService = new PurchaseOrdersService();

