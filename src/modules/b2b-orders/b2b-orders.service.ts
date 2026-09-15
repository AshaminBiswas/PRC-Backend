import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { generateNextB2bOrderNumber } from './b2b-order-numbering.service';
import { logAdminAction } from '../../utils/auditLogger';
import { notifyAdmins } from '../notifications/admin-notification.service';
import type {
  SubmitB2bOrderInput,
  AdminCreateB2bOrderInput,
  EditB2bOrderInput,
  ListB2bOrdersQuery,
} from './b2b-orders.schema';

interface UserContext {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  roleSlug?: string;
  companyName?: string | null;
  gstin?: string | null;
}

const isSuperAdmin = (user: UserContext): boolean => {
  const roleSlug = (user.roleSlug || '').toLowerCase();
  return ['super-admin', 'super_admin', 'superadmin'].includes(roleSlug);
};

// ─── Format Order Helper ──────────────────────────────────────────────────────

export const formatB2bOrder = (order: any) => {
  if (!order) return null;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    branchId: order.branchId,
    source: order.source,
    status: order.status,
    sourceQuotationId: order.sourceQuotationId,
    sourcePoId: order.sourcePoId,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    paidAmount: Number(order.paidAmount || 0),
    dueAmount: Number(order.dueAmount || 0),
    subtotal: Number(order.subtotal || 0),
    discountTotal: Number(order.discountTotal || 0),
    taxTotal: Number(order.taxTotal || 0),
    grandTotal: Number(order.grandTotal || 0),
    clientRequestId: order.clientRequestId,
    createdBy: order.createdBy,
    createdByType: order.createdByType,
    approvedBy: order.approvedBy,
    approvedAt: order.approvedAt,
    rejectedReason: order.rejectedReason,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    cancelledAt: order.cancelledAt,
    cancelledBy: order.cancelledBy,
    cancellationReason: order.cancellationReason,
    customer: order.customer
      ? {
          id: order.customer.id,
          firstName: order.customer.firstName,
          lastName: order.customer.lastName,
          email: order.customer.email,
          phone: order.customer.phone,
          companyName: order.customer.companyName,
          gstin: order.customer.gstin,
        }
      : undefined,
    branch: order.branch
      ? {
          id: order.branch.id,
          name: order.branch.name,
          code: order.branch.code,
          city: order.branch.city,
        }
      : undefined,
    items: order.items
      ? order.items.map((i: any) => ({
          id: i.id,
          productId: i.productId,
          sku: i.sku,
          quantity: Number(i.quantity || 0),
          unitPrice: Number(i.unitPrice || 0),
          discount: Number(i.discount || 0),
          tax: Number(i.tax || 0),
          lineTotal: Number(i.lineTotal || 0),
          configuration: i.configuration,
          isRemoved: Boolean(i.isRemoved),
          removedAt: i.removedAt,
          product: i.product
            ? {
                id: i.product.id,
                name: i.product.name,
                slug: i.product.slug,
                thumbnail: i.product.thumbnail,
              }
            : undefined,
        }))
      : undefined,
    reservations: order.reservations
      ? order.reservations.map((r: any) => ({
          id: r.id,
          orderItemId: r.orderItemId,
          productId: r.productId,
          branchId: r.branchId,
          quantity: Number(r.quantity || 0),
          status: r.status,
          createdAt: r.createdAt,
          releasedAt: r.releasedAt,
          consumedAt: r.consumedAt,
        }))
      : undefined,
  };
};

// ─── 1. Customer Self-Service Submission ──────────────────────────────────────

export const submitB2bOrder = async (user: UserContext, input: SubmitB2bOrderInput) => {
  // Idempotency check: Return existing order if client_request_id already processed
  const existingOrder = await (prisma as any).b2bOrder.findUnique({
    where: { clientRequestId: input.clientRequestId },
    include: {
      customer: true,
      branch: true,
      items: { include: { product: true } },
      reservations: true,
    },
  });

  if (existingOrder) {
    return formatB2bOrder(existingOrder);
  }

  // Validate Customer is B2B
  const customer = await prisma.user.findUnique({
    where: { id: user.id, deletedAt: null },
    select: { id: true, companyName: true, gstin: true, firstName: true, lastName: true, email: true },
  });

  if (!customer) {
    throw new AppError('CUSTOMER_NOT_FOUND', 'Customer account not found', 404);
  }

  const isB2B = Boolean((customer.companyName && customer.companyName.trim()) || (customer.gstin && customer.gstin.trim()));
  if (!isB2B) {
    throw new AppError('CUSTOMER_NOT_B2B', 'Order submission requires a registered B2B wholesale partner account', 403);
  }

  // Validate Branch
  const branch = await prisma.branch.findUnique({
    where: { id: input.branchId, deletedAt: null },
  });

  if (!branch || !branch.isActive) {
    throw new AppError('INVALID_BRANCH', 'Selected fulfilment facility is invalid or inactive', 400);
  }

  // Compute Line Items & Totals with dynamic tax rate per item
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;

  const processedItems = input.items.map((item) => {
    const qty = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const discount = Number(item.discount || 0);
    const taxableLine = Math.max(0, qty * unitPrice - discount);
    const rate = Number(item.taxRate ?? item.taxPercent ?? 18);
    const itemTax = Math.round(taxableLine * (rate / 100) * 100) / 100;
    const lineTotal = Math.round((taxableLine + itemTax) * 100) / 100;

    subtotal += qty * unitPrice;
    discountTotal += discount;
    taxTotal += itemTax;

    return {
      product_id: item.productId,
      sku: item.sku,
      quantity: qty,
      unit_price: unitPrice,
      discount,
      tax: itemTax,
      line_total: lineTotal,
      configuration: item.configuration || null,
    };
  });

  subtotal = Math.round(subtotal * 100) / 100;
  discountTotal = Math.round(discountTotal * 100) / 100;
  taxTotal = Math.round(taxTotal * 100) / 100;
  const grandTotal = Math.round((subtotal - discountTotal + taxTotal) * 100) / 100;

  // Generate Reference Number
  const { orderNumber } = await generateNextB2bOrderNumber();

  const payload = {
    client_request_id: input.clientRequestId,
    customer_id: customer.id,
    branch_id: input.branchId,
    source: 'customer_frontend',
    created_by: customer.id,
    created_by_type: 'customer',
    order_number: orderNumber,
    source_quotation_id: input.sourceQuotationId || null,
    source_po_id: input.sourcePoId || null,
    payment_method: input.paymentMethod || 'bank_transfer',
    notes: input.notes || null,
    subtotal,
    discount_total: discountTotal,
    tax_total: taxTotal,
    grand_total: grandTotal,
    items: processedItems,
  };

  try {
    const rpcResult = await prisma.$queryRawUnsafe<{ submit_b2b_order: any }[]>(
      `SELECT submit_b2b_order($1::jsonb) AS submit_b2b_order;`,
      JSON.stringify(payload)
    );

    const createdMeta = rpcResult[0]?.submit_b2b_order;
    const orderId = createdMeta?.id;

    // Fetch newly created order with relations
    const createdOrder = await (prisma as any).b2bOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        branch: true,
        items: { include: { product: true } },
        reservations: true,
      },
    });

    // Notify Super Admins
    try {
      await notifyAdmins(
        'New B2B Order Pending Approval',
        `B2B Order ${orderNumber} (₹${grandTotal.toLocaleString('en-IN')}) placed by ${customer.companyName || `${customer.firstName} ${customer.lastName}`}.`,
        'B2B_ORDER_PENDING',
        { orderId, orderNumber, customerId: customer.id }
      );
    } catch (e) {
      console.warn('[B2bOrderService] Non-critical notification error:', e);
    }

    // Log Audit
    logAdminAction({
      userId: customer.id,
      adminEmail: customer.email,
      adminName: customer.companyName || `${customer.firstName} ${customer.lastName}`,
      adminRole: 'customer',
      action: 'B2B_ORDER_SUBMITTED',
      entity: 'B2B_ORDER',
      entityId: orderId,
      entityName: orderNumber,
      details: `Customer submitted B2B Order ${orderNumber} (Status: pending_approval) with ${processedItems.length} reserved item(s).`,
      metadata: { orderNumber, branchId: input.branchId, grandTotal },
    });

    return formatB2bOrder(createdOrder);
  } catch (error: any) {
    const msg = error?.message || '';
    if (msg.includes('INSUFFICIENT_STOCK:')) {
      const sku = msg.split('INSUFFICIENT_STOCK:')[1]?.split(/[\r\n\s",]+/)[0] || 'Unknown';
      throw new AppError('INSUFFICIENT_STOCK', `Insufficient available stock for SKU ${sku} at the selected facility`, 400, [{ sku }]);
    }
    if (msg.includes('CUSTOMER_NOT_B2B')) {
      throw new AppError('CUSTOMER_NOT_B2B', 'Customer is not registered as a B2B partner', 403);
    }
    throw new AppError('SUBMISSION_FAILED', error?.message || 'Failed to submit B2B order', 400);
  }
};

// ─── 2. Super Admin Approval ──────────────────────────────────────────────────

export const approveB2bOrder = async (adminUser: UserContext, orderId: string) => {
  if (!isSuperAdmin(adminUser)) {
    throw new AppError('FORBIDDEN', 'Only Super Administrators can approve B2B orders', 403);
  }

  try {
    const rpcResult = await prisma.$queryRawUnsafe<{ approve_b2b_order: any }[]>(
      `SELECT approve_b2b_order($1, $2) AS approve_b2b_order;`,
      orderId,
      adminUser.id
    );

    const approvedMeta = rpcResult[0]?.approve_b2b_order;

    const order = await (prisma as any).b2bOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        branch: true,
        items: { include: { product: true } },
        reservations: true,
      },
    });

    // Notify Customer of confirmation
    try {
      if (order?.customerId) {
        await prisma.notification.create({
          data: {
            userId: order.customerId,
            title: 'B2B Order Approved & Confirmed',
            message: `Your B2B Order ${order.orderNumber} has been approved by administration and is now confirmed.`,
            type: 'B2B_ORDER_CONFIRMED',
            data: { orderId: order.id, orderNumber: order.orderNumber },
          },
        });
      }
    } catch (notifErr) {
      console.warn('[B2bOrderService] Customer notification warning:', notifErr);
    }

    // Log Audit
    logAdminAction({
      userId: adminUser.id,
      adminEmail: adminUser.email,
      adminName: `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || 'Super Admin',
      adminRole: adminUser.roleSlug || 'super_admin',
      action: 'B2B_ORDER_APPROVED',
      entity: 'B2B_ORDER',
      entityId: orderId,
      entityName: order?.orderNumber,
      details: `Super Admin approved B2B Order ${order?.orderNumber}. Stock reservations converted to SALE_OUT/B2B_ORDER deductions.`,
      metadata: { orderId, orderNumber: order?.orderNumber, approvedBy: adminUser.id },
    });

    return formatB2bOrder(order);
  } catch (error: any) {
    const msg = error?.message || '';
    if (msg.includes('STOCK_CHANGED_SINCE_SUBMISSION')) {
      throw new AppError(
        'STOCK_CHANGED_SINCE_SUBMISSION',
        'Stock changed since order submission. Available physical stock is no longer sufficient to fulfill all lines.',
        400
      );
    }
    if (msg.includes('ORDER_NOT_FOUND')) {
      throw new AppError('ORDER_NOT_FOUND', 'B2B Order not found', 404);
    }
    if (msg.includes('INVALID_STATUS')) {
      throw new AppError('INVALID_STATUS', 'Order cannot be approved in its current status', 400);
    }
    throw new AppError('APPROVAL_FAILED', error?.message || 'Failed to approve order', 400);
  }
};

// ─── 3. Super Admin Rejection ─────────────────────────────────────────────────

export const rejectB2bOrder = async (adminUser: UserContext, orderId: string, reason: string) => {
  if (!isSuperAdmin(adminUser)) {
    throw new AppError('FORBIDDEN', 'Only Super Administrators can reject B2B orders', 403);
  }

  try {
    await prisma.$queryRawUnsafe(
      `SELECT reject_b2b_order($1, $2, $3);`,
      orderId,
      adminUser.id,
      reason
    );

    const order = await (prisma as any).b2bOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        branch: true,
        items: { include: { product: true } },
        reservations: true,
      },
    });

    // Notify Customer of rejection
    try {
      if (order?.customerId) {
        await prisma.notification.create({
          data: {
            userId: order.customerId,
            title: 'B2B Order Not Approved',
            message: `Your B2B Order ${order.orderNumber} was declined. Reason: ${reason}`,
            type: 'B2B_ORDER_REJECTED',
            data: { orderId: order.id, orderNumber: order.orderNumber, reason },
          },
        });
      }
    } catch (notifErr) {
      console.warn('[B2bOrderService] Customer notification warning:', notifErr);
    }

    // Log Audit
    logAdminAction({
      userId: adminUser.id,
      adminEmail: adminUser.email,
      adminName: `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || 'Super Admin',
      adminRole: adminUser.roleSlug || 'super_admin',
      action: 'B2B_ORDER_REJECTED',
      entity: 'B2B_ORDER',
      entityId: orderId,
      entityName: order?.orderNumber,
      details: `Super Admin rejected B2B Order ${order?.orderNumber}. Reason: ${reason}. Active reservations released without stock movements.`,
      metadata: { orderId, orderNumber: order?.orderNumber, reason },
    });

    return formatB2bOrder(order);
  } catch (error: any) {
    const msg = error?.message || '';
    if (msg.includes('ORDER_NOT_FOUND')) {
      throw new AppError('ORDER_NOT_FOUND', 'B2B Order not found', 404);
    }
    if (msg.includes('INVALID_STATUS')) {
      throw new AppError('INVALID_STATUS', 'Order cannot be rejected in its current status', 400);
    }
    throw new AppError('REJECTION_FAILED', error?.message || 'Failed to reject order', 400);
  }
};

// ─── 4. Admin-Created (Offline) Order Placement ───────────────────────────────

export const adminCreateB2bOrder = async (adminUser: UserContext, input: AdminCreateB2bOrderInput) => {
  if (!isSuperAdmin(adminUser)) {
    throw new AppError('FORBIDDEN', 'Only Super Administrators can create offline B2B orders', 403);
  }

  // Verify Customer exists and has B2B credentials
  const customer = await prisma.user.findUnique({
    where: { id: input.customerId, deletedAt: null },
  });

  if (!customer) {
    throw new AppError('CUSTOMER_NOT_FOUND', 'Selected B2B customer not found', 404);
  }

  const isB2B = Boolean((customer.companyName && customer.companyName.trim()) || (customer.gstin && customer.gstin.trim()));
  if (!isB2B) {
    throw new AppError('CUSTOMER_NOT_B2B', 'Selected customer does not have registered B2B credentials', 400);
  }

  // Compute Line Items & Totals with dynamic tax rate per item
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;

  const processedItems = input.items.map((item) => {
    const qty = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const discount = Number(item.discount || 0);
    const taxableLine = Math.max(0, qty * unitPrice - discount);
    const rate = Number(item.taxRate ?? item.taxPercent ?? 18);
    const itemTax = Math.round(taxableLine * (rate / 100) * 100) / 100;
    const lineTotal = Math.round((taxableLine + itemTax) * 100) / 100;

    subtotal += qty * unitPrice;
    discountTotal += discount;
    taxTotal += itemTax;

    return {
      product_id: item.productId,
      sku: item.sku,
      quantity: qty,
      unit_price: unitPrice,
      discount,
      tax: itemTax,
      line_total: lineTotal,
      configuration: item.configuration || null,
    };
  });

  subtotal = Math.round(subtotal * 100) / 100;
  discountTotal = Math.round(discountTotal * 100) / 100;
  taxTotal = Math.round(taxTotal * 100) / 100;
  const grandTotal = Math.round((subtotal - discountTotal + taxTotal) * 100) / 100;

  const { orderNumber } = await generateNextB2bOrderNumber();

  const payload = {
    client_request_id: input.clientRequestId,
    customer_id: customer.id,
    branch_id: input.branchId,
    source: 'admin_created',
    created_by: adminUser.id,
    created_by_type: 'admin',
    order_number: orderNumber,
    source_quotation_id: input.sourceQuotationId || null,
    source_po_id: input.sourcePoId || null,
    payment_method: input.paymentMethod || 'bank_transfer',
    notes: input.notes || null,
    subtotal,
    discount_total: discountTotal,
    tax_total: taxTotal,
    grand_total: grandTotal,
    items: processedItems,
  };

  // Step 1: Submit B2B Order (reserves stock)
  let createdOrderId: string;
  try {
    const submitResult = await prisma.$queryRawUnsafe<{ submit_b2b_order: any }[]>(
      `SELECT submit_b2b_order($1::jsonb) AS submit_b2b_order;`,
      JSON.stringify(payload)
    );
    createdOrderId = submitResult[0]?.submit_b2b_order?.id;
  } catch (error: any) {
    const msg = error?.message || '';
    if (msg.includes('INSUFFICIENT_STOCK:')) {
      const sku = msg.split('INSUFFICIENT_STOCK:')[1]?.split(/[\r\n\s",]+/)[0] || 'Unknown';
      throw new AppError('INSUFFICIENT_STOCK', `Insufficient available stock for SKU ${sku} at selected branch`, 400, [{ sku }]);
    }
    throw new AppError('SUBMISSION_FAILED', error?.message || 'Failed to initialize offline order', 400);
  }

  // Step 2: Approve B2B Order back-to-back in the same request (converts reservations to deductions)
  try {
    await prisma.$queryRawUnsafe(
      `SELECT approve_b2b_order($1, $2);`,
      createdOrderId,
      adminUser.id
    );
  } catch (error: any) {
    throw new AppError('APPROVAL_FAILED', error?.message || 'Failed to auto-confirm offline order', 400);
  }

  const confirmedOrder = await (prisma as any).b2bOrder.findUnique({
    where: { id: createdOrderId },
    include: {
      customer: true,
      branch: true,
      items: { include: { product: true } },
      reservations: true,
    },
  });

  // Log Audit
  logAdminAction({
    userId: adminUser.id,
    adminEmail: adminUser.email,
    adminName: `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || 'Super Admin',
    adminRole: adminUser.roleSlug || 'super_admin',
    action: 'B2B_ORDER_CREATED',
    entity: 'B2B_ORDER',
    entityId: createdOrderId,
    entityName: orderNumber,
    details: `Super Admin created and confirmed offline B2B Order ${orderNumber} for ${customer.companyName || customer.email} (₹${grandTotal.toLocaleString('en-IN')}).`,
    metadata: { orderId: createdOrderId, orderNumber, branchId: input.branchId, grandTotal },
  });

  return formatB2bOrder(confirmedOrder);
};

// ─── 5. Customer Self-Cancellation (Pending Approval only) ────────────────────

export const customerCancelB2bOrder = async (user: UserContext, orderId: string) => {
  const order = await (prisma as any).b2bOrder.findUnique({
    where: { id: orderId },
    include: { reservations: true },
  });

  if (!order) {
    throw new AppError('ORDER_NOT_FOUND', 'B2B Order not found', 404);
  }

  if (order.customerId !== user.id) {
    throw new AppError('FORBIDDEN', 'You do not have permission to cancel this order', 403);
  }

  if (order.status !== 'pending_approval') {
    throw new AppError('CANNOT_CANCEL', 'Only orders in pending_approval status can be cancelled by the customer', 400);
  }

  // Release reservations and set cancelled status
  await prisma.$transaction(async (tx) => {
    // Release active reservations
    const activeReservations = await (tx as any).stockReservation.findMany({
      where: { orderId, status: 'active' },
    });

    for (const res of activeReservations) {
      const inv = await tx.inventory.findFirst({
        where: { productId: res.productId, branchId: res.branchId },
      });

      if (inv) {
        await tx.inventory.update({
          where: { id: inv.id },
          data: {
            reservedQuantity: Math.max(0, inv.reservedQuantity - Number(res.quantity)),
          },
        });
      }

      await (tx as any).stockReservation.update({
        where: { id: res.id },
        data: { status: 'released', releasedAt: new Date() },
      });
    }

    await (tx as any).b2bOrder.update({
      where: { id: orderId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: user.id,
        cancellationReason: 'Cancelled by customer',
      },
    });
  });

  const updatedOrder = await (prisma as any).b2bOrder.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      branch: true,
      items: { include: { product: true } },
      reservations: true,
    },
  });

  logAdminAction({
    userId: user.id,
    adminEmail: user.email,
    adminRole: 'customer',
    action: 'B2B_ORDER_CANCELLED',
    entity: 'B2B_ORDER',
    entityId: orderId,
    entityName: order.orderNumber,
    details: `Customer self-cancelled B2B Order ${order.orderNumber} while in pending_approval state. Reservations released with 0 stock movement.`,
  });

  return formatB2bOrder(updatedOrder);
};

// ─── 6. Super Admin Cancellation (Confirmed Orders) ───────────────────────────

export const adminCancelConfirmedB2bOrder = async (adminUser: UserContext, orderId: string, reason?: string) => {
  if (!isSuperAdmin(adminUser)) {
    throw new AppError('FORBIDDEN', 'Only Super Administrators can cancel confirmed B2B orders', 403);
  }

  const order = await (prisma as any).b2bOrder.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    throw new AppError('ORDER_NOT_FOUND', 'B2B Order not found', 404);
  }

  if (order.status === 'cancelled') {
    return formatB2bOrder(order);
  }

  if (!['confirmed', 'processing', 'ready'].includes(order.status)) {
    throw new AppError('INVALID_STATUS', `Order in status ${order.status} cannot be cancelled via this route`, 400);
  }

  const cancelReason = reason || 'Cancelled by Super Administrator';

  await prisma.$transaction(async (tx) => {
    // Restore deducted stock for each non-removed item and log B2B_CANCELLATION
    for (const item of order.items) {
      if (item.isRemoved) continue;

      const qty = Number(item.quantity);
      const inv = await tx.inventory.findFirst({
        where: { productId: item.productId, branchId: order.branchId },
      });

      const oldStock = inv?.quantity || 0;
      const newStock = oldStock + qty;

      if (inv) {
        await tx.inventory.update({
          where: { id: inv.id },
          data: { quantity: newStock },
        });
      } else {
        await tx.inventory.create({
          data: {
            productId: item.productId,
            branchId: order.branchId,
            quantity: newStock,
            reservedQuantity: 0,
          },
        });
      }

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          branchId: order.branchId,
          type: 'B2B_CANCELLATION' as any,
          quantity: qty,
          previousQty: oldStock,
          newQty: newStock,
          referenceType: 'B2B_ORDER',
          referenceId: order.id,
          performedById: adminUser.id,
          notes: `B2B Order Cancellation (${order.orderNumber}): Restored ${qty} units. Reason: ${cancelReason}`,
        },
      });
    }

    await (tx as any).b2bOrder.update({
      where: { id: orderId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: adminUser.id,
        cancellationReason: cancelReason,
      },
    });
  });

  const updatedOrder = await (prisma as any).b2bOrder.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      branch: true,
      items: { include: { product: true } },
      reservations: true,
    },
  });

  // Notify customer
  try {
    if (order.customerId) {
      await prisma.notification.create({
        data: {
          userId: order.customerId,
          title: 'B2B Order Cancelled',
          message: `Your B2B Order ${order.orderNumber} has been cancelled by administration. Reason: ${cancelReason}`,
          type: 'B2B_ORDER_CANCELLED',
          data: { orderId: order.id, orderNumber: order.orderNumber, reason: cancelReason },
        },
      });
    }
  } catch {}

  logAdminAction({
    userId: adminUser.id,
    adminEmail: adminUser.email,
    adminName: `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || 'Super Admin',
    adminRole: adminUser.roleSlug || 'super_admin',
    action: 'B2B_ORDER_CANCELLED',
    entity: 'B2B_ORDER',
    entityId: orderId,
    entityName: order.orderNumber,
    details: `Super Admin cancelled confirmed B2B Order ${order.orderNumber}. Restored quantities to branch inventory and logged B2B_CANCELLATION movements. Reason: ${cancelReason}`,
  });

  return formatB2bOrder(updatedOrder);
};

// ─── 7. Super Admin Editing (Confirmed Orders only) ───────────────────────────

export const adminEditConfirmedB2bOrder = async (adminUser: UserContext, orderId: string, input: EditB2bOrderInput) => {
  if (!isSuperAdmin(adminUser)) {
    throw new AppError('FORBIDDEN', 'Only Super Administrators can edit B2B orders', 403);
  }

  const order = await (prisma as any).b2bOrder.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    throw new AppError('ORDER_NOT_FOUND', 'B2B Order not found', 404);
  }

  if (order.status !== 'confirmed') {
    throw new AppError('INVALID_STATUS', 'Only orders in confirmed status can be edited by administration', 400);
  }

  await prisma.$transaction(async (tx) => {
    const existingItemMap = new Map<string, any>();
    for (const item of order.items) {
      existingItemMap.set(item.id, item);
      existingItemMap.set(item.productId, item);
    }

    for (const editedItem of input.items) {
      const origItem = editedItem.orderItemId
        ? existingItemMap.get(editedItem.orderItemId)
        : existingItemMap.get(editedItem.productId);

      if (!origItem) continue;

      const origQty = Number(origItem.quantity);
      const isRemoving = Boolean(editedItem.isRemoved);

      if (isRemoving) {
        if (!origItem.isRemoved) {
          // Return full quantity to branch stock
          const inv = await tx.inventory.findFirst({
            where: { productId: origItem.productId, branchId: order.branchId },
          });

          const oldStock = inv?.quantity || 0;
          const newStock = oldStock + origQty;

          if (inv) {
            await tx.inventory.update({
              where: { id: inv.id },
              data: { quantity: newStock },
            });
          }

          await tx.stockMovement.create({
            data: {
              productId: origItem.productId,
              branchId: order.branchId,
              type: 'B2B_ADJUSTMENT' as any,
              quantity: origQty,
              previousQty: oldStock,
              newQty: newStock,
              referenceType: 'B2B_ORDER',
              referenceId: order.id,
              performedById: adminUser.id,
              notes: `B2B Order Edit (${order.orderNumber}): Removed item ${origItem.sku}, returned ${origQty} units to stock.`,
            },
          });

          await (tx as any).b2bOrderItem.update({
            where: { id: origItem.id },
            data: {
              isRemoved: true,
              removedAt: new Date(),
              removedBy: adminUser.id,
            },
          });
        }
        continue;
      }

      // Quantity adjustments
      const newQty = Number(editedItem.quantity);
      const delta = newQty - origQty;

      if (delta > 0) {
        // Check available stock
        const inv = await tx.inventory.findFirst({
          where: { productId: origItem.productId, branchId: order.branchId },
        });

        const available = inv ? inv.quantity - inv.reservedQuantity : 0;
        if (available < delta) {
          throw new AppError(
            'INSUFFICIENT_STOCK',
            `Insufficient available stock for SKU ${origItem.sku} to increase quantity by ${delta}. Available: ${available}`,
            400
          );
        }

        const oldStock = inv?.quantity || 0;
        const newStock = oldStock - delta;

        if (inv) {
          await tx.inventory.update({
            where: { id: inv.id },
            data: { quantity: newStock },
          });
        }

        await tx.stockMovement.create({
          data: {
            productId: origItem.productId,
            branchId: order.branchId,
            type: 'B2B_ADJUSTMENT' as any,
            quantity: delta,
            previousQty: oldStock,
            newQty: newStock,
            referenceType: 'B2B_ORDER',
            referenceId: order.id,
            performedById: adminUser.id,
            notes: `B2B Order Edit (${order.orderNumber}): Increased SKU ${origItem.sku} by ${delta} units.`,
          },
        });
      } else if (delta < 0) {
        const returnQty = Math.abs(delta);
        const inv = await tx.inventory.findFirst({
          where: { productId: origItem.productId, branchId: order.branchId },
        });

        const oldStock = inv?.quantity || 0;
        const newStock = oldStock + returnQty;

        if (inv) {
          await tx.inventory.update({
            where: { id: inv.id },
            data: { quantity: newStock },
          });
        }

        await tx.stockMovement.create({
          data: {
            productId: origItem.productId,
            branchId: order.branchId,
            type: 'B2B_ADJUSTMENT' as any,
            quantity: returnQty,
            previousQty: oldStock,
            newQty: newStock,
            referenceType: 'B2B_ORDER',
            referenceId: order.id,
            performedById: adminUser.id,
            notes: `B2B Order Edit (${order.orderNumber}): Decreased SKU ${origItem.sku} by ${returnQty} units.`,
          },
        });
      }

      // Update item row
      const unitPrice = editedItem.unitPrice !== undefined ? Number(editedItem.unitPrice) : Number(origItem.unitPrice);
      const discount = editedItem.discount !== undefined ? Number(editedItem.discount) : Number(origItem.discount);
      const taxableLine = Math.max(0, newQty * unitPrice - discount);
      const origTaxable = Math.max(0, Number(origItem.quantity) * Number(origItem.unitPrice) - Number(origItem.discount || 0));
      const origRate = origTaxable > 0 && origItem.tax ? (Number(origItem.tax) / origTaxable) * 100 : 18;
      const rate = Number(editedItem.taxRate ?? editedItem.taxPercent ?? origRate);
      const itemTax = Math.round(taxableLine * (rate / 100) * 100) / 100;
      const lineTotal = Math.round((taxableLine + itemTax) * 100) / 100;

      await (tx as any).b2bOrderItem.update({
        where: { id: origItem.id },
        data: {
          quantity: newQty,
          unitPrice,
          discount,
          tax: itemTax,
          lineTotal,
          isRemoved: false,
        },
      });
    }

    // Recompute order totals
    const currentActiveItems = await (tx as any).b2bOrderItem.findMany({
      where: { orderId, isRemoved: false },
    });

    let newSubtotal = 0;
    let newDiscountTotal = 0;
    let newTaxTotal = 0;

    for (const it of currentActiveItems) {
      newSubtotal += Number(it.quantity) * Number(it.unitPrice);
      newDiscountTotal += Number(it.discount || 0);
      newTaxTotal += Number(it.tax || 0);
    }

    newSubtotal = Math.round(newSubtotal * 100) / 100;
    newDiscountTotal = Math.round(newDiscountTotal * 100) / 100;
    newTaxTotal = Math.round(newTaxTotal * 100) / 100;
    const newGrandTotal = Math.round((newSubtotal - newDiscountTotal + newTaxTotal) * 100) / 100;

    await (tx as any).b2bOrder.update({
      where: { id: orderId },
      data: {
        subtotal: newSubtotal,
        discountTotal: newDiscountTotal,
        taxTotal: newTaxTotal,
        grandTotal: newGrandTotal,
        dueAmount: Math.max(0, newGrandTotal - Number(order.paidAmount || 0)),
        updatedAt: new Date(),
      },
    });
  });

  const updatedOrder = await (prisma as any).b2bOrder.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      branch: true,
      items: { include: { product: true } },
      reservations: true,
    },
  });

  logAdminAction({
    userId: adminUser.id,
    adminEmail: adminUser.email,
    adminName: `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || 'Super Admin',
    adminRole: adminUser.roleSlug || 'super_admin',
    action: 'B2B_ORDER_UPDATED',
    entity: 'B2B_ORDER',
    entityId: orderId,
    entityName: order.orderNumber,
    details: `Super Admin modified confirmed B2B Order ${order.orderNumber}. Stock adjustments logged with delta auditing.`,
  });

  return formatB2bOrder(updatedOrder);
};

// ─── 8. Update Order Status (processing -> ready -> completed) ────────────────

export const updateB2bOrderStatus = async (
  adminUser: UserContext,
  orderId: string,
  newStatus: 'processing' | 'ready' | 'completed'
) => {
  const order = await (prisma as any).b2bOrder.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new AppError('ORDER_NOT_FOUND', 'B2B Order not found', 404);
  }

  if (['cancelled', 'rejected'].includes(order.status)) {
    throw new AppError('INVALID_STATUS', `Cannot transition order from ${order.status} to ${newStatus}`, 400);
  }

  const updated = await (prisma as any).b2bOrder.update({
    where: { id: orderId },
    data: { status: newStatus, updatedAt: new Date() },
    include: {
      customer: true,
      branch: true,
      items: { include: { product: true } },
    },
  });

  // Notify customer
  try {
    if (order.customerId) {
      await prisma.notification.create({
        data: {
          userId: order.customerId,
          title: `B2B Order Status: ${newStatus.toUpperCase()}`,
          message: `Your B2B Order ${order.orderNumber} is now ${newStatus.replace('_', ' ')}.`,
          type: 'B2B_ORDER_STATUS_CHANGED',
          data: { orderId: order.id, orderNumber: order.orderNumber, status: newStatus },
        },
      });
    }
  } catch {}

  logAdminAction({
    userId: adminUser.id,
    adminEmail: adminUser.email,
    adminName: `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || 'Staff',
    adminRole: adminUser.roleSlug || 'admin',
    action: 'B2B_ORDER_STATUS_CHANGED',
    entity: 'B2B_ORDER',
    entityId: orderId,
    entityName: order.orderNumber,
    details: `B2B Order ${order.orderNumber} status changed from ${order.status} to ${newStatus}.`,
  });

  return formatB2bOrder(updated);
};

// ─── 9. List B2B Orders ───────────────────────────────────────────────────────

export const listB2bOrders = async (query: ListB2bOrdersQuery) => {
  const page = query.page || 1;
  const limit = query.limit || 20;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (query.status && query.status !== 'ALL') {
    where.status = query.status;
  }

  if (query.branchId && query.branchId !== 'ALL') {
    where.branchId = query.branchId;
  }

  if (query.customerId) {
    where.customerId = query.customerId;
  }

  if (query.source) {
    where.source = query.source;
  }

  if (query.search && query.search.trim()) {
    const s = query.search.trim();
    where.OR = [
      { orderNumber: { contains: s, mode: 'insensitive' } },
      { customer: { companyName: { contains: s, mode: 'insensitive' } } },
      { customer: { firstName: { contains: s, mode: 'insensitive' } } },
      { customer: { lastName: { contains: s, mode: 'insensitive' } } },
      { customer: { email: { contains: s, mode: 'insensitive' } } },
      { items: { some: { sku: { contains: s, mode: 'insensitive' } } } },
    ];
  }

  const [total, orders] = await Promise.all([
    (prisma as any).b2bOrder.count({ where }),
    (prisma as any).b2bOrder.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        branch: true,
        items: { include: { product: true } },
        reservations: true,
      },
    }),
  ]);

  // Status counts rollup for UI tabs (Pending Approval priority view)
  const statusCountsRaw = await (prisma as any).b2bOrder.groupBy({
    by: ['status'],
    _count: { id: true },
  });

  const statusCounts: Record<string, number> = {
    pending_approval: 0,
    confirmed: 0,
    processing: 0,
    ready: 0,
    completed: 0,
    rejected: 0,
    cancelled: 0,
  };

  for (const row of statusCountsRaw) {
    statusCounts[row.status] = row._count.id;
  }

  return {
    items: orders.map(formatB2bOrder),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + orders.length < total,
    },
    statusCounts,
  };
};

// ─── 10. Get B2B Order Details ────────────────────────────────────────────────

export const getB2bOrderById = async (orderId: string, user: UserContext, isAdmin: boolean) => {
  const order = await (prisma as any).b2bOrder.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      branch: true,
      items: { include: { product: true } },
      reservations: true,
    },
  });

  if (!order) {
    throw new AppError('ORDER_NOT_FOUND', 'B2B Order not found', 404);
  }

  if (!isAdmin && order.customerId !== user.id) {
    throw new AppError('FORBIDDEN', 'Access to this order is restricted', 403);
  }

  // If Admin, also load stock movements and audit timeline
  let movements: any[] = [];
  if (isAdmin) {
    movements = await prisma.stockMovement.findMany({
      where: { referenceId: orderId, referenceType: 'B2B_ORDER' },
      orderBy: { createdAt: 'desc' },
      include: { product: true },
    });
  }

  return {
    ...formatB2bOrder(order),
    stockMovements: movements.map((m) => ({
      id: m.id,
      productId: m.productId,
      productName: m.product?.name,
      sku: m.product?.sku,
      type: m.type,
      quantity: m.quantity,
      previousQty: m.previousQty,
      newQty: m.newQty,
      notes: m.notes,
      createdAt: m.createdAt,
    })),
  };
};

// ─── 11. Check Available Stock (Available = Stock - Reserved) ─────────────────

export const checkProductStock = async (branchId: string, productIds: string[]) => {
  const inventories = await prisma.inventory.findMany({
    where: {
      branchId,
      productId: { in: productIds },
    },
    include: { product: { select: { id: true, sku: true, name: true } } },
  });

  return inventories.map((inv) => {
    const stock = inv.quantity || 0;
    const reserved = inv.reservedQuantity || 0;
    const available = Math.max(0, stock - reserved);
    return {
      productId: inv.productId,
      sku: inv.product?.sku,
      name: inv.product?.name,
      physicalStock: stock,
      reservedStock: reserved,
      availableStock: available,
    };
  });
};
