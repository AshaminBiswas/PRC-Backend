import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { getPaginationParams, buildPagination } from '../../utils/response';
import { generateNextInvoiceNumber } from './services/numbering.service';
import { calculateGST } from './services/gst.service';
import { generateDocumentVerification } from './services/qr.service';
import { generateInvoiceHtml } from './services/pdf.service';
import { sendMail } from '../../utils/email.utils';
import { InvoiceStatus, InvoiceType, Prisma } from '@prisma/client';
import type {
  CreateInvoiceInput,
  UpdateInvoiceInput,
  ListInvoicesQueryInput,
  SignInvoiceInput,
} from './invoices.schema';

export interface UserContext {
  id: string;
  email?: string;
  roles?: string[];
  roleSlug?: string;
  permissions?: string[];
}

const isAdminUser = (user: UserContext) => {
  const roleSlug = (user.roleSlug || '').toLowerCase();
  if (['super-admin', 'super_admin', 'superadmin', 'admin', 'accountant', 'manager'].includes(roleSlug)) {
    return true;
  }
  if (user.roles && user.roles.length > 0) {
    return user.roles.some((r) =>
      ['SUPER_ADMIN', 'SUPER-ADMIN', 'ADMIN', 'ACCOUNTANT', 'MANAGER'].includes(r.toUpperCase())
    );
  }
  if (user.permissions && user.permissions.length > 0) {
    return user.permissions.some((p) =>
      ['invoices.read', 'invoices.create', 'invoices.approve', 'finance.manage', 'orders.read'].includes(p)
    );
  }
  return false;
};

export const createInvoice = async (input: CreateInvoiceInput, user?: UserContext) => {
  const invoiceType: InvoiceType = input.invoiceType || InvoiceType.TAX_INVOICE;
  const branchCode = input.branchCode || 'MAIN';

  // 1. Calculate Indian GST & Totals
  const gstResult = calculateGST(
    input.items,
    input.supplierState || 'Karnataka',
    input.placeOfSupply || 'Karnataka'
  );

  // 2. Generate FY Sequence Invoice Number
  const { invoiceNumber, financialYear } = await generateNextInvoiceNumber(
    invoiceType,
    branchCode
  );

  // 3. Generate SHA-256 Hash & QR Tokens
  const verification = await generateDocumentVerification(
    invoiceNumber,
    gstResult.grandTotal
  );

  // 4. Create Invoice Record with Line Items in Transaction
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        financialYear,
        invoiceType,
        status: InvoiceStatus.DRAFT,
        customerId: input.customerId,
        warehouseId: input.warehouseId,
        orderId: input.orderId,
        shipmentId: input.shipmentId,
        paymentId: input.paymentId,
        subtotal: gstResult.subtotal,
        discount: gstResult.discount,
        taxableAmount: gstResult.taxableAmount,
        cgst: gstResult.cgst,
        sgst: gstResult.sgst,
        igst: gstResult.igst,
        cess: gstResult.cess,
        roundOff: gstResult.roundOff,
        grandTotal: gstResult.grandTotal,
        amountInWords: gstResult.amountInWords,
        placeOfSupply: input.placeOfSupply || 'Karnataka',
        isReverseCharge: input.isReverseCharge || false,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        paymentTerms: input.paymentTerms || 'DUE_ON_RECEIPT',
        verificationToken: verification.verificationToken,
        verificationId: verification.verificationId,
        documentHash: verification.documentHash,
        createdBy: user?.id,
        notes: input.notes,
        internalRemarks: input.internalRemarks,
        items: {
          create: gstResult.items.map((item) => ({
            productId: item.productId,
            sku: item.sku,
            productName: item.productName,
            description: item.description,
            hsnCode: item.hsnCode,
            unit: item.unit,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            taxableValue: item.taxableValue,
            cgstRate: item.cgstRate,
            cgstAmount: item.cgstAmount,
            sgstRate: item.sgstRate,
            sgstAmount: item.sgstAmount,
            igstRate: item.igstRate,
            igstAmount: item.igstAmount,
            cessRate: item.cessRate,
            cessAmount: item.cessAmount,
            lineTotal: item.lineTotal,
          })),
        },
        history: {
          create: {
            action: 'CREATED',
            performedBy: user?.id,
            comment: `Invoice ${invoiceNumber} created as DRAFT (${invoiceType})`,
          },
        },
      },
      include: {
        items: true,
        customer: true,
        warehouse: true,
        order: true,
        history: true,
      },
    });

    return invoice;
  });
};

export const getInvoiceById = async (id: string, user?: UserContext) => {
  const invoice = await prisma.invoice.findFirst({
    where: {
      OR: [{ id }, { invoiceNumber: id }, { verificationToken: id }],
    },
    include: {
      items: true,
      customer: true,
      warehouse: true,
      order: true,
      shipment: true,
      history: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!invoice) {
    throw new AppError('NOT_FOUND', 'Invoice not found', 404);
  }

  if (user && !isAdminUser(user) && invoice.customerId !== user.id) {
    throw new AppError('FORBIDDEN', 'Access denied to this invoice', 403);
  }

  return invoice;
};

export const listInvoices = async (query: ListInvoicesQueryInput, user?: UserContext) => {
  const { page, limit, skip } = getPaginationParams(query);

  const where: Prisma.InvoiceWhereInput = {};

  if (user && !isAdminUser(user)) {
    where.customerId = user.id;
  } else if (query.customerId) {
    where.customerId = query.customerId;
  }

  if (query.invoiceType) where.invoiceType = query.invoiceType;
  if (query.status) where.status = query.status;
  if (query.financialYear) where.financialYear = query.financialYear;

  if (query.search) {
    where.OR = [
      { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
      { verificationId: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [totalItems, invoices] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true, companyName: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  const pagination = buildPagination(page, limit, totalItems);

  return { data: invoices, pagination };
};

export const approveInvoice = async (id: string, user?: UserContext) => {
  const invoice = await getInvoiceById(id, user);

  if (invoice.status !== InvoiceStatus.DRAFT) {
    throw new AppError('BAD_REQUEST', `Invoice is already in ${invoice.status} status`, 400);
  }

  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: InvoiceStatus.APPROVED,
      approvedBy: user?.id,
      approvedAt: new Date(),
      history: {
        create: {
          action: 'APPROVED',
          performedBy: user?.id,
          comment: `Invoice ${invoice.invoiceNumber} approved`,
        },
      },
    },
    include: { items: true, customer: true, warehouse: true },
  });

  return updated;
};

export const cancelInvoice = async (id: string, reason: string, user?: UserContext) => {
  const invoice = await getInvoiceById(id, user);

  if (invoice.status === InvoiceStatus.CANCELLED) {
    throw new AppError('BAD_REQUEST', 'Invoice is already cancelled', 400);
  }

  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: InvoiceStatus.CANCELLED,
      cancelledAt: new Date(),
      notes: reason ? `Cancelled: ${reason}` : invoice.notes,
      history: {
        create: {
          action: 'CANCELLED',
          performedBy: user?.id,
          comment: `Invoice cancelled: ${reason}`,
        },
      },
    },
    include: { items: true },
  });

  return updated;
};

export const signInvoice = async (id: string, input: SignInvoiceInput, user?: UserContext) => {
  const invoice = await getInvoiceById(id, user);

  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      digitalSignatureStatus: `SIGNED_BY_${input.signedBy.toUpperCase()}`,
      signedAt: new Date(),
      history: {
        create: {
          action: 'SIGNED',
          performedBy: user?.id,
          comment: `Digitally signed by ${input.signedBy} (${input.designation || 'Authorized Signatory'})`,
        },
      },
    },
    include: { items: true, customer: true },
  });

  return updated;
};

export const emailInvoice = async (id: string, recipientEmail?: string, user?: UserContext) => {
  const invoice = await getInvoiceById(id, user);
  const targetEmail = recipientEmail || invoice.customer?.email;

  if (!targetEmail) {
    throw new AppError('BAD_REQUEST', 'Recipient email is required to send invoice', 400);
  }

  const htmlContent = await generateInvoiceHtml(invoice as any);

  await sendMail({
    to: targetEmail,
    subject: `${invoice.invoiceType.replace('_', ' ')} #${invoice.invoiceNumber} - Pacific Hardware`,
    html: `
      <h2>Invoice Document Ready</h2>
      <p>Dear ${invoice.customer ? invoice.customer.firstName : 'Customer'},</p>
      <p>Your ${invoice.invoiceType.replace('_', ' ')} <strong>${invoice.invoiceNumber}</strong> for amount <strong>₹${Number(invoice.grandTotal).toFixed(2)}</strong> has been generated.</p>
      <p><a href="https://pacifichardware.com/verify/${invoice.verificationToken}" style="display:inline-block; padding:10px 18px; background:#0f172a; color:#fff; text-decoration:none; border-radius:4px;">View & Verify Invoice Online</a></p>
      <hr />
      ${htmlContent}
    `,
  });

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      emailedAt: new Date(),
      history: {
        create: {
          action: 'EMAILED',
          performedBy: user?.id,
          comment: `Invoice emailed to ${targetEmail}`,
        },
      },
    },
  });

  return { success: true, emailedTo: targetEmail };
};

/**
 * PUBLIC Verification Endpoint (Accessible without Login)
 */
export const verifyInvoiceToken = async (verificationToken: string) => {
  const invoice = await prisma.invoice.findUnique({
    where: { verificationToken },
    include: {
      items: true,
      customer: { select: { firstName: true, lastName: true, companyName: true, gstin: true } },
      warehouse: { select: { name: true, code: true, address: true, city: true, state: true } },
    },
  });

  if (!invoice) {
    throw new AppError('NOT_FOUND', 'Invoice Verification Failed: Invalid or expired verification token', 404);
  }

  // Log verification event
  await prisma.invoiceHistory.create({
    data: {
      invoiceId: invoice.id,
      action: 'VERIFIED',
      comment: 'Public QR Code / Token verification request processed',
    },
  });

  return {
    verified: true,
    invoiceNumber: invoice.invoiceNumber,
    financialYear: invoice.financialYear,
    invoiceType: invoice.invoiceType,
    status: invoice.status,
    grandTotal: Number(invoice.grandTotal),
    currency: invoice.currency,
    createdAt: invoice.createdAt,
    customerName: invoice.customer ? `${invoice.customer.firstName} ${invoice.customer.lastName}` : 'Valued Customer',
    companyName: invoice.customer?.companyName || null,
    customerGstin: invoice.customer?.gstin || null,
    warehouseName: invoice.warehouse?.name || 'Primary Warehouse',
    verificationId: invoice.verificationId,
    documentHash: invoice.documentHash,
    digitalSignatureStatus: invoice.digitalSignatureStatus,
    signedAt: invoice.signedAt,
  };
};

/**
 * Dedicated Generators for all 9 Commercial Document Types
 */
export const generateOrderDocument = async (
  orderId: string,
  invoiceType: InvoiceType,
  user?: UserContext,
  customNotes?: string
) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: true } },
      user: true,
    },
  });

  if (!order) {
    throw new AppError('NOT_FOUND', 'Order not found', 404);
  }

  const items = order.items.map((item: any) => ({
    productId: item.productId,
    sku: item.sku,
    productName: item.productName,
    description: item.product?.name,
    hsnCode: '8467',
    unit: 'PCS',
    quantity: item.quantity,
    unitPrice: item.price,
    discount: 0,
    taxRate: 18,
    cessRate: 0,
  }));

  const customerState = (order.shippingAddress as any)?.state || 'Karnataka';

  return createInvoice(
    {
      invoiceType,
      customerId: order.userId,
      customerGstin: order.user?.gstin || undefined,
      placeOfSupply: customerState,
      warehouseId: order.allocatedWarehouseId || undefined,
      orderId: order.id,
      items,
      notes: customNotes || `${invoiceType.replace('_', ' ')} generated for Order #${order.orderNumber}`,
    },
    user
  );
};

export const generateProformaInvoice = (orderId: string, user?: UserContext, notes?: string) =>
  generateOrderDocument(orderId, InvoiceType.PROFORMA_INVOICE, user, notes);

export const generateDeliveryChallan = (orderId: string, user?: UserContext, notes?: string) =>
  generateOrderDocument(orderId, InvoiceType.DELIVERY_CHALLAN, user, notes);

export const generatePackingSlip = (orderId: string, user?: UserContext, notes?: string) =>
  generateOrderDocument(orderId, InvoiceType.PACKING_SLIP, user, notes);

export const generateCommercialInvoice = (orderId: string, user?: UserContext, notes?: string) =>
  generateOrderDocument(orderId, InvoiceType.COMMERCIAL_INVOICE, user, notes);

export const generateAdjustmentNote = async (
  originalInvoiceId: string,
  invoiceType: InvoiceType,
  reason: string,
  items: any[],
  user?: UserContext,
  customNotes?: string
) => {
  const origInvoice = await getInvoiceById(originalInvoiceId, user);

  return createInvoice(
    {
      invoiceType,
      customerId: origInvoice.customerId || undefined,
      placeOfSupply: origInvoice.placeOfSupply || 'Karnataka',
      warehouseId: origInvoice.warehouseId || undefined,
      orderId: origInvoice.orderId || undefined,
      items,
      notes: `${invoiceType.replace('_', ' ')} issued against Invoice #${origInvoice.invoiceNumber}. Reason: ${reason}. ${customNotes || ''}`,
    },
    user
  );
};

export const generateCreditNote = (originalInvoiceId: string, reason: string, items: any[], user?: UserContext, notes?: string) =>
  generateAdjustmentNote(originalInvoiceId, InvoiceType.CREDIT_NOTE, reason, items, user, notes);

export const generateDebitNote = (originalInvoiceId: string, reason: string, items: any[], user?: UserContext, notes?: string) =>
  generateAdjustmentNote(originalInvoiceId, InvoiceType.DEBIT_NOTE, reason, items, user, notes);

export const generatePurchaseOrder = (input: CreateInvoiceInput, user?: UserContext) =>
  createInvoice({ ...input, invoiceType: InvoiceType.PURCHASE_ORDER }, user);

export const generateQuotation = (input: CreateInvoiceInput, user?: UserContext) =>
  createInvoice({ ...input, invoiceType: InvoiceType.QUOTATION }, user);

