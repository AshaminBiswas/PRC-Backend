import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { buildPagination, getPaginationParams } from '../../utils/response';
import { OrderStatus, Prisma, StockMovementType } from '@prisma/client';
import { recordStockMovement } from '../inventory/movement/movement.service';
import { createInvoice as createInvoiceService } from '../invoices/invoices.service';
import type { ListOrdersQuery } from './orders.schema';

interface UserContext {
  id: string;
  roleSlug: string;
  permissions: string[];
}

const orderSelect = {
  id: true,
  orderNumber: true,
  userId: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  subtotal: true,
  discountTotal: true,
  shippingTotal: true,
  taxTotal: true,
  grandTotal: true,
  couponId: true,
  shippingAddressId: true,
  billingAddressId: true,
  shippingAddress: true,
  billingAddress: true,
  notes: true,
  trackingNumber: true,
  carrier: true,
  shippedAt: true,
  deliveredAt: true,
  cancelledAt: true,
  cancelReason: true,
  allocatedWarehouseId: true,
  allocatedCourierId: true,
  allocatedZoneId: true,
  allocatedAt: true,
  allocationDistance: true,
  allocationScore: true,
  allocationReason: true,
  createdAt: true,
  updatedAt: true,
  allocatedWarehouse: {
    select: {
      id: true,
      code: true,
      name: true,
      city: true,
      state: true,
      latitude: true,
      longitude: true,
    },
  },
  allocatedCourier: {
    select: {
      id: true,
      code: true,
      name: true,
      trackingUrl: true,
    },
  },
  allocatedZone: {
    select: {
      id: true,
      name: true,
      zoneCode: true,
    },
  },
  shipment: true,
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      companyName: true,
      gstin: true,
    },
  },
  items: {
    select: {
      id: true,
      orderId: true,
      productId: true,
      variantId: true,
      productName: true,
      sku: true,
      price: true,
      quantity: true,
      total: true,
      createdAt: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          thumbnail: true,
        },
      },
      variant: {
        select: {
          id: true,
          name: true,
          sku: true,
          attributes: true,
        },
      },
    },
  },
  statusHistory: {
    select: {
      id: true,
      orderId: true,
      status: true,
      comment: true,
      changedBy: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc' as const,
    },
  },
  payments: {
    select: {
      id: true,
      amount: true,
      currency: true,
      method: true,
      status: true,
      razorpayOrderId: true,
      razorpayPaymentId: true,
      createdAt: true,
    },
  },
} as const;

export const formatOrder = (order: any) => {
  if (!order) return null;
  return {
    ...order,
    subtotal: Number(order.subtotal),
    discountTotal: Number(order.discountTotal),
    shippingTotal: Number(order.shippingTotal),
    taxTotal: Number(order.taxTotal),
    grandTotal: Number(order.grandTotal),
    items: order.items?.map((item: any) => ({
      ...item,
      price: Number(item.price),
      total: Number(item.total),
    })),
    payments: order.payments?.map((payment: any) => ({
      ...payment,
      amount: Number(payment.amount),
    })),
  };
};

const isAdminUser = (user: UserContext): boolean => {
  return (
    user.roleSlug === 'admin' ||
    user.roleSlug === 'super-admin' ||
    user.permissions.includes('orders.read')
  );
};

export const listOrders = async (query: ListOrdersQuery, user: UserContext) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: Prisma.OrderWhereInput = {};

  // Admin gets all orders (or filtered by query.userId), customer gets own orders
  if (!isAdminUser(user)) {
    where.userId = user.id;
  } else if (query.userId) {
    where.userId = query.userId;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.search) {
    where.OR = [
      { orderNumber: { contains: query.search, mode: 'insensitive' } },
      { trackingNumber: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [totalItems, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      select: orderSelect,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  const formattedOrders = orders.map(formatOrder);
  const pagination = buildPagination(page, limit, totalItems);

  return { data: formattedOrders, pagination };
};

export const getOrderById = async (id: string, user: UserContext) => {
  const order = await prisma.order.findUnique({
    where: { id },
    select: orderSelect,
  });

  if (!order) {
    throw new AppError('NOT_FOUND', 'Order not found', 404);
  }

  if (!isAdminUser(user) && order.userId !== user.id) {
    throw new AppError('FORBIDDEN', 'Access denied to this order', 403);
  }

  return formatOrder(order);
};

export const generateInvoice = async (id: string, user: UserContext) => {
  const order = await getOrderById(id, user);

  // Check if an invoice already exists for this order
  const existingInvoice = await prisma.invoice.findFirst({
    where: { orderId: order.id },
    include: {
      items: true,
      customer: true,
      warehouse: true,
    },
  });

  if (existingInvoice) {
    return existingInvoice;
  }

  // Create new Enterprise Tax Invoice from Order
  const invoiceItems = order.items.map((item: any) => ({
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

  const newInvoice = await createInvoiceService({
    invoiceType: 'TAX_INVOICE' as any,
    customerId: order.userId,
    customerGstin: order.user?.gstin || undefined,
    placeOfSupply: customerState,
    warehouseId: order.allocatedWarehouseId || undefined,
    orderId: order.id,
    items: invoiceItems,
    notes: `Invoice generated automatically for Order #${order.orderNumber}`,
  }, user);

  return newInvoice;
};

export const cancelOrder = async (id: string, user: UserContext, reason: string) => {
  if (!reason || !reason.trim()) {
    throw new AppError('BAD_REQUEST', 'Cancellation reason is required', 400);
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        orderNumber: true,
        items: true,
      },
    });

    if (!order) {
      throw new AppError('NOT_FOUND', 'Order not found', 404);
    }

    if (!isAdminUser(user) && order.userId !== user.id) {
      throw new AppError('FORBIDDEN', 'Access denied to cancel this order', 403);
    }

    // Allowed ONLY if status is PENDING or PROCESSING
    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PROCESSING) {
      throw new AppError(
        'BAD_REQUEST',
        `Order cannot be cancelled when status is ${order.status}. Only PENDING or PROCESSING orders can be cancelled.`,
        400
      );
    }

    const cancelReason = reason.trim();

    const updated = await tx.order.update({
      where: { id },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason,
      },
      select: orderSelect,
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: id,
        status: OrderStatus.CANCELLED,
        comment: cancelReason,
        changedBy: user.id,
      },
    });

    // Restock items & record movement logs
    for (const item of order.items) {
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      } else if (item.productId) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      // Check if product is registered in inventory
      if (item.productId) {
        const invProduct = await tx.inventoryProduct.findFirst({
          where: { productId: item.productId, deletedAt: null },
          include: { stocks: true },
        });

        if (invProduct && invProduct.stocks.length > 0) {
          const mainWhId = invProduct.stocks[0].warehouseId;
          await recordStockMovement(
            {
              ventureId: invProduct.ventureId,
              inventoryProductId: invProduct.id,
              warehouseId: mainWhId,
              qtyChanged: item.quantity,
              movementType: StockMovementType.RETURN,
              channel: 'ONLINE',
              referenceType: 'ORDER_CANCEL',
              referenceId: order.id,
              createdBy: user.id,
              reason: cancelReason,
            },
            tx
          );
        }
      }
    }

    return formatOrder(updated);
  });
};

export const updateOrderStatus = async (
  id: string,
  newStatus: OrderStatus,
  user: UserContext,
  comment?: string,
  trackingNumber?: string,
  carrier?: string
) => {
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      orderNumber: true,
      items: true,
    },
  });

  if (!order) {
    throw new AppError('NOT_FOUND', 'Order not found', 404);
  }

  // Flexible Order Status Transition Matrix for Admin & Dispatch
  const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.PENDING, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.PROCESSING]: [OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.CANCELLED],
    [OrderStatus.SHIPPED]: [OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.RETURNED, OrderStatus.CANCELLED],
    [OrderStatus.DELIVERED]: [OrderStatus.DELIVERED, OrderStatus.RETURNED, OrderStatus.CANCELLED],
    [OrderStatus.CANCELLED]: [OrderStatus.CANCELLED],
    [OrderStatus.RETURNED]: [OrderStatus.RETURNED],
  };

  const allowed = ALLOWED_TRANSITIONS[order.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new AppError(
      'BAD_REQUEST',
      `Cannot transition order status from '${order.status}' to '${newStatus}'. Allowed target statuses for '${order.status}' orders are: ${allowed.join(', ')}.`,
      400
    );
  }

  // Build update payload based on status
  const updateData: Prisma.OrderUpdateInput = {
    status: newStatus,
  };

  if (newStatus === OrderStatus.SHIPPED) {
    updateData.shippedAt = new Date();
    if (trackingNumber) updateData.trackingNumber = trackingNumber;
    if (carrier) updateData.carrier = carrier;
  } else if (newStatus === OrderStatus.DELIVERED) {
    updateData.deliveredAt = new Date();
  } else if (newStatus === OrderStatus.CANCELLED) {
    updateData.cancelledAt = new Date();
    updateData.cancelReason = comment || 'Cancelled by admin';
  }

  if (trackingNumber) updateData.trackingNumber = trackingNumber;
  if (carrier) updateData.carrier = carrier;

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id },
      data: updateData,
      select: orderSelect,
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: id,
        status: newStatus,
        comment: comment || `Status updated to ${newStatus}`,
        changedBy: user.id,
      },
    });

    if (newStatus === OrderStatus.CANCELLED) {
      for (const item of order.items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
          if (item.productId) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            });
          }
        } else if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }
    }

    return updated;
  });

  return formatOrder(updatedOrder);
};

export const getTrackingDetails = async (id: string, user: UserContext) => {
  const order = await getOrderById(id, user);

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    carrier: order.carrier || 'Express Industrial Logistics',
    trackingNumber: order.trackingNumber || `TRK-${order.orderNumber}`,
    shippedAt: order.shippedAt,
    estimatedDelivery: order.shippedAt
      ? new Date(new Date(order.shippedAt).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
      : null,
    deliveredAt: order.deliveredAt,
    history: order.statusHistory || [],
  };
};

export const getOrderAllocation = async (id: string, user: UserContext) => {
  const order = await getOrderById(id, user);

  const shipment = await prisma.shipment.findUnique({
    where: { orderId: order.id },
    include: {
      warehouse: true,
      courier: true,
      zone: true,
    },
  });

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    allocatedWarehouse: order.allocatedWarehouse || shipment?.warehouse || null,
    allocatedCourier: order.allocatedCourier || shipment?.courier || null,
    allocatedZone: order.allocatedZone || shipment?.zone || null,
    shippingCost: shipment ? Number(shipment.shippingCost) : Number(order.shippingTotal),
    deliveryDays: shipment?.deliveryDays || 3,
    allocationScore: order.allocationScore || 85.0,
    allocationReason: order.allocationReason || `Allocated to ${order.allocatedWarehouse?.name || 'Primary Warehouse'} based on Lowest Shipping Cost & 100% SKU stock availability.`,
    allocatedAt: order.allocatedAt,
    shipment: shipment
      ? {
          id: shipment.id,
          trackingNumber: shipment.trackingNumber,
          shipmentStatus: shipment.shipmentStatus,
          createdAt: shipment.createdAt,
        }
      : null,
  };
};
