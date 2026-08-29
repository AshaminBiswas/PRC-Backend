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

export interface SendProformaEmailDirectInput {
  piNumber: string;
  customerName: string;
  companyName?: string;
  customerEmail: string;
  customerPhone?: string;
  customerGstin?: string;
  issueDate?: string;
  validUntil?: string;
  facilityCode?: string;
  facilityName?: string;
  billingAddress?: string;
  shippingAddress?: string;
  grandTotal: number;
  subtotal?: number;
  cgstTotal?: number;
  sgstTotal?: number;
  igstTotal?: number;
  advancePercentage?: number;
  advancePayable?: number;
  balancePayable?: number;
  poReference?: string;
  quoteReference?: string;
  notes?: string;
  items?: Array<{
    sku: string;
    productName: string;
    description?: string;
    hsnCode?: string;
    unit?: string;
    quantity: number;
    unitPrice: number;
    gstRate?: number;
    total: number;
  }>;
}

export const sendProformaInvoiceEmailDirect = async (
  payload: SendProformaEmailDirectInput,
  user?: UserContext
) => {
  const targetEmail = (payload.customerEmail || '').trim();
  if (!targetEmail) {
    throw new AppError('BAD_REQUEST', 'Recipient email address is required', 400);
  }

  const companyOrClient = payload.companyName || payload.customerName || 'Valued Client';
  const piNumber = payload.piNumber || 'PRC-PI-DRAFT';
  const grandTotalStr = `₹${Number(payload.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const advancePercent = payload.advancePercentage || 30;
  const advanceAmount =
    payload.advancePayable ||
    Math.round(((Number(payload.grandTotal || 0) * advancePercent) / 100) * 100) / 100;
  const advanceStr = `₹${Number(advanceAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const balanceStr = `₹${Number(
    payload.balancePayable || Number(payload.grandTotal || 0) - advanceAmount
  ).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const itemsHtml = (payload.items || [])
    .map(
      (item, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
        <td style="padding: 10px 8px; text-align: center; color: #64748b;">${idx + 1}</td>
        <td style="padding: 10px 8px;">
          <strong style="color: #0f172a;">${item.productName}</strong>
          <div style="font-size: 11px; color: #64748b;">SKU: <span style="font-family: monospace; color: #d97706;">${item.sku}</span>${item.hsnCode ? ` • HSN: ${item.hsnCode}` : ''}</div>
        </td>
        <td style="padding: 10px 8px; text-align: center; font-weight: 600;">${item.quantity} ${item.unit || 'PCS'}</td>
        <td style="padding: 10px 8px; text-align: right; font-family: monospace;">₹${Number(item.unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="padding: 10px 8px; text-align: right; font-weight: 700; color: #0f172a; font-family: monospace;">₹${Number(item.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
    `
    )
    .join('');

  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Proforma Invoice - ${piNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; background: #f4f6f8; margin: 0; padding: 24px 12px; }
    .email-container { max-width: 650px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .header-bar { background: #0f172a; padding: 24px 30px; border-bottom: 3px solid #d97706; }
    .content-body { padding: 30px; }
    .badge { display: inline-block; background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; border: 1px solid #fde68a; }
    .dossier-card { background: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #d97706; border-radius: 6px; padding: 16px; margin: 20px 0; }
    .advance-card { background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 16px; margin: 20px 0; }
    .bank-card { background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #16a34a; border-radius: 6px; padding: 16px; margin: 20px 0; font-size: 13px; line-height: 1.5; color: #166534; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 30px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header-bar">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <h1 style="color: #ffffff; font-size: 20px; font-weight: 900; margin: 0; letter-spacing: 0.5px;">PRC HARDWARE</h1>
            <p style="color: #d97706; font-size: 11px; font-weight: 700; text-transform: uppercase; margin: 4px 0 0 0;">Commercial Architectural Hardware</p>
          </td>
          <td align="right">
            <span class="badge">PROFORMA INVOICE</span>
          </td>
        </tr>
      </table>
    </div>

    <div class="content-body">
      <h2 style="font-size: 18px; color: #0f172a; margin: 0 0 10px 0;">Commercial Proforma Invoice Generated</h2>
      <p style="font-size: 14px; color: #475569; line-height: 1.5; margin: 0 0 18px 0;">
        Dear <strong>${companyOrClient}</strong>,<br />
        Please find attached the official Commercial Proforma Invoice <strong>${piNumber}</strong> issued for your order specifications.
      </p>

      <div class="dossier-card">
        <table width="100%" style="font-size: 13px; color: #1e293b;">
          <tr>
            <td style="padding: 4px 0; color: #64748b; width: 40%;">PI Number:</td>
            <td style="padding: 4px 0; font-weight: 800; font-family: monospace; color: #d97706;">${piNumber}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Issued Date:</td>
            <td style="padding: 4px 0; font-weight: 600;">${payload.issueDate || new Date().toISOString().slice(0, 10)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Grand Total (Incl. GST):</td>
            <td style="padding: 4px 0; font-weight: 900; color: #0f172a; font-size: 15px;">${grandTotalStr}</td>
          </tr>
          ${payload.poReference ? `
          <tr>
            <td style="padding: 4px 0; color: #64748b;">PO Reference:</td>
            <td style="padding: 4px 0; font-weight: 600; font-family: monospace;">${payload.poReference}</td>
          </tr>` : ''}
          ${payload.quoteReference ? `
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Quote Reference:</td>
            <td style="padding: 4px 0; font-weight: 600; font-family: monospace;">${payload.quoteReference}</td>
          </tr>` : ''}
        </table>
      </div>

      ${itemsHtml ? `
      <h3 style="font-size: 14px; color: #0f172a; margin: 20px 0 10px 0; border-bottom: 2px solid #0f172a; padding-bottom: 6px;">Ordered Line Items</h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background: #0f172a; color: #ffffff; font-size: 11px; text-transform: uppercase;">
            <th style="padding: 8px; text-align: center;">#</th>
            <th style="padding: 8px; text-align: left;">Product</th>
            <th style="padding: 8px; text-align: center;">Qty</th>
            <th style="padding: 8px; text-align: right;">Rate (₹)</th>
            <th style="padding: 8px; text-align: right;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      ` : ''}

      <div class="advance-card">
        <h4 style="margin: 0 0 6px 0; color: #92400e; font-size: 14px;">Commercial Advance Terms:</h4>
        <p style="margin: 0; font-size: 13px; color: #78350f; line-height: 1.5;">
          • <strong>Required Advance (${advancePercent}%):</strong> <span style="font-size: 14px; font-weight: 900; color: #92400e;">${advanceStr}</span><br />
          • <strong>Balance Payable at Dispatch Readiness:</strong> ${balanceStr}<br />
          • Production queueing & dispatch commence immediately upon receipt of advance deposit.
        </p>
      </div>

      <div class="bank-card">
        <div style="font-weight: 800; font-size: 13px; color: #14532d; margin-bottom: 6px; border-bottom: 1px solid #bbf7d0; padding-bottom: 4px;">
          🏦 Official PRC Hardware Bank Details (RTGS / NEFT / IMPS):
        </div>
        <strong>Beneficiary Name:</strong> Pacific Products and Solutions<br />
        <strong>Bank Name:</strong> HDFC Bank Ltd.<br />
        <strong>Account Number:</strong> <span style="font-family: monospace; font-weight: 900;">50200089412356</span><br />
        <strong>IFSC Code:</strong> <span style="font-family: monospace; font-weight: 900;">HDFC0000280</span> &nbsp;|&nbsp; <strong>Branch:</strong> Dilshad Garden, Delhi<br />
        <strong>Account Type:</strong> Current Account &nbsp;|&nbsp; <strong>UPI:</strong> pacificproducts@hdfcbank
      </div>

      ${payload.notes ? `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-size: 12px; color: #475569; margin: 16px 0;">
        <strong>Special Notes from Billing Team:</strong><br />
        ${payload.notes}
      </div>
      ` : ''}

      <p style="font-size: 13px; color: #475569; margin-top: 24px;">
        For any billing inquiries, order customization, or dispatch coordination, please reply directly or reach our corporate desk at <strong>support@pacifichardware.com</strong>.
      </p>
    </div>

    <div class="footer">
      <p style="margin: 0 0 4px 0; font-weight: 700; color: #0f172a;">PRC HARDWARE • Architectural Solutions</p>
      <p style="margin: 0; font-size: 11px; color: #94a3b8;">This is an official commercial transaction document generated by the PRC Core Billing System.</p>
    </div>
  </div>
</body>
</html>
  `;

  await sendMail({
    to: targetEmail,
    subject: `Commercial Proforma Invoice #${piNumber} - PRC Hardware`,
    html: emailHtml,
  });

  return {
    success: true,
    piNumber,
    emailedTo: targetEmail,
    message: `Proforma Invoice ${piNumber} emailed successfully to ${targetEmail}`,
  };
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

