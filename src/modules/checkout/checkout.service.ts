import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import * as cartService from '../cart/cart.service';
import * as shippingService from '../shipping/shipping.service';
import { allocateWarehouseForOrder } from '../allocation/allocation.service';
import type { GetShippingRatesInput, PlaceOrderInput } from './checkout.schema';
import type { Prisma } from '@prisma/client';

export const validateCheckout = async (userId: string) => {
  const cart = await cartService.getCart(userId);
  if (cart.items.length === 0) {
    throw new AppError('BAD_REQUEST', 'Cart is empty', 400);
  }

  const errors: string[] = [];

  for (const item of cart.items) {
    if (!item.product.inStock) {
      errors.push(`Product "${item.product.name}" is out of stock`);
    }
    if (item.variant && !item.variant.inStock) {
      errors.push(`Variant "${item.variant.name || item.variant.sku}" for product "${item.product.name}" is out of stock`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: cart.summary,
    itemCount: cart.itemCount,
  };
};

export const getShippingRates = async (userId: string, input: GetShippingRatesInput) => {
  const cart = await cartService.getCart(userId);
  if (cart.items.length === 0) {
    throw new AppError('BAD_REQUEST', 'Cart is empty', 400);
  }

  let address = input.address;

  if (input.shippingAddressId) {
    const savedAddress = await prisma.address.findFirst({
      where: { id: input.shippingAddressId, userId },
    });
    if (savedAddress) {
      address = {
        addressLine1: savedAddress.addressLine1,
        addressLine2: savedAddress.addressLine2,
        city: savedAddress.city,
        state: savedAddress.state,
        postalCode: savedAddress.postalCode,
        country: savedAddress.country,
      };
    }
  }

  return shippingService.calculateShipping({
    address: address ?? { country: 'India' },
    weight: cart.summary.totalWeight,
    orderAmount: cart.summary.subtotal,
  });
};

export const placeOrder = async (userId: string, input: PlaceOrderInput) => {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      coupon: true,
      items: {
        include: {
          product: true,
          variant: true,
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    throw new AppError('BAD_REQUEST', 'Cannot place order with an empty cart', 400);
  }

  // 1. Initial stock availability check
  for (const item of cart.items) {
    if (item.product.deletedAt || item.product.status !== 'ACTIVE') {
      throw new AppError('BAD_REQUEST', `Product "${item.product.name}" is not available`, 400);
    }

    if (item.variant) {
      if (!item.variant.isAvailable) {
        throw new AppError('BAD_REQUEST', `Variant for "${item.product.name}" is not available`, 400);
      }
      if (item.variant.stock < item.quantity) {
        throw new AppError(
          'BAD_REQUEST',
          `Insufficient stock for "${item.product.name} (${item.variant.name || item.variant.sku})". Available: ${item.variant.stock}`,
          400
        );
      }
      if (item.product.stock < item.quantity) {
        throw new AppError(
          'BAD_REQUEST',
          `Insufficient stock for "${item.product.name}". Available: ${item.product.stock}`,
          400
        );
      }
    } else {
      if (item.product.stock < item.quantity) {
        throw new AppError(
          'BAD_REQUEST',
          `Insufficient stock for "${item.product.name}". Available: ${item.product.stock}`,
          400
        );
      }
    }
  }

  // 2. Resolve Shipping Address
  let shippingAddressJson = input.shippingAddress;
  if (input.shippingAddressId) {
    const dbAddr = await prisma.address.findFirst({
      where: { id: input.shippingAddressId, userId },
    });
    if (dbAddr) {
      shippingAddressJson = {
        addressLine1: dbAddr.addressLine1,
        addressLine2: dbAddr.addressLine2,
        city: dbAddr.city,
        state: dbAddr.state,
        postalCode: dbAddr.postalCode,
        country: dbAddr.country,
      };
    }
  }

  if (!shippingAddressJson) {
    throw new AppError('BAD_REQUEST', 'Shipping address is required to place an order', 400);
  }

  // 3. Resolve Billing Address
  let billingAddressJson = input.billingAddress;
  if (input.billingAddressId) {
    const dbAddr = await prisma.address.findFirst({
      where: { id: input.billingAddressId, userId },
    });
    if (dbAddr) {
      billingAddressJson = {
        addressLine1: dbAddr.addressLine1,
        addressLine2: dbAddr.addressLine2,
        city: dbAddr.city,
        state: dbAddr.state,
        postalCode: dbAddr.postalCode,
        country: dbAddr.country,
      };
    }
  }

  if (!billingAddressJson) {
    billingAddressJson = shippingAddressJson;
  }

  // 4. Calculate Subtotal & Total Weight
  let subtotal = 0;
  let totalWeight = 0;

  for (const item of cart.items) {
    const unitPrice = item.variant
      ? (item.variant.salePrice ? Number(item.variant.salePrice) : Number(item.variant.price))
      : (item.product.salePrice ? Number(item.product.salePrice) : Number(item.product.price));
    subtotal += unitPrice * item.quantity;
    totalWeight += (item.product.weight ? Number(item.product.weight) : 0) * item.quantity;
  }

  subtotal = Number(subtotal.toFixed(2));
  totalWeight = Number(totalWeight.toFixed(2));

  const orderNumber = `PRC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // 5. Execute Order Placement Transaction
  const createdOrder = await prisma.$transaction(async (tx) => {
    // 5a. Coupon Re-validation inside transaction
    let discountTotal = 0;
    if (cart.couponId) {
      const coupon = await tx.coupon.findUnique({
        where: { id: cart.couponId },
      });

      if (!coupon || !coupon.isActive) {
        throw new AppError('BAD_REQUEST', 'Coupon is inactive or invalid', 400);
      }

      const now = new Date();
      if (coupon.startDate && now < new Date(coupon.startDate)) {
        throw new AppError('BAD_REQUEST', 'Coupon is not active yet', 400);
      }

      if (coupon.endDate && now > new Date(coupon.endDate)) {
        throw new AppError('BAD_REQUEST', 'Coupon has expired', 400);
      }

      if (coupon.minOrderAmount !== null && subtotal < Number(coupon.minOrderAmount)) {
        throw new AppError(
          'BAD_REQUEST',
          `Minimum order amount of ${Number(coupon.minOrderAmount)} is required for this coupon`,
          400
        );
      }

      if (coupon.usageLimit !== null && coupon.usageLimit !== undefined && coupon.usedCount >= coupon.usageLimit) {
        throw new AppError('BAD_REQUEST', 'Coupon global usage limit has been reached', 400);
      }

      if (coupon.perUserLimit !== null && coupon.perUserLimit !== undefined) {
        const userUsageCount = await tx.couponUsage.count({
          where: { couponId: coupon.id, userId },
        });
        if (userUsageCount >= coupon.perUserLimit) {
          throw new AppError(
            'BAD_REQUEST',
            'You have reached the maximum allowed usage limit for this coupon',
            400
          );
        }
      }

      if (coupon.discountType === 'PERCENTAGE') {
        discountTotal = (subtotal * Number(coupon.discountValue)) / 100;
        if (coupon.maxDiscountAmount !== null) {
          discountTotal = Math.min(discountTotal, Number(coupon.maxDiscountAmount));
        }
      } else {
        discountTotal = Math.min(Number(coupon.discountValue), subtotal);
      }
      discountTotal = Number(discountTotal.toFixed(2));
    }

    let shippingTotal = subtotal - discountTotal >= 5000 ? 0 : 100;

    if (input.shippingRateId && input.shippingRateId !== 'free-shipping' && input.shippingRateId !== 'standard-default') {
      const rateRecord = await tx.shippingRate.findUnique({ where: { id: input.shippingRateId } });
      if (rateRecord && rateRecord.isActive) {
        shippingTotal = Number(rateRecord.rate);
      }
    }

    const taxableSubtotal = Math.max(0, subtotal - discountTotal);
    const taxTotal = Number((taxableSubtotal * 0.18).toFixed(2));
    const grandTotal = Number((taxableSubtotal + taxTotal + shippingTotal).toFixed(2));

    // 5a-ii. Lowest Shipping Cost Logistics Allocation Engine Integration
    const shippingPincode = (shippingAddressJson as any)?.postalCode || (shippingAddressJson as any)?.pincode;
    let allocatedWarehouseId: string | null = null;
    let allocatedCourierId: string | null = null;
    let allocatedZoneId: string | null = null;
    let allocatedAt: Date | null = null;
    let allocationDistance: number | null = null;
    let allocationScore: number | null = null;
    let allocationReason: string | null = null;
    let computedShippingCost: number | null = null;

    if (shippingPincode) {
      try {
        const allocationItems = cart.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId ?? undefined,
          sku: item.variant ? item.variant.sku : item.product.sku,
          quantity: item.quantity,
        }));

        const allocationRes = await allocateWarehouseForOrder(
          {
            pincode: String(shippingPincode),
            items: allocationItems,
            reserveStock: true,
          },
          tx
        );

        allocatedWarehouseId = allocationRes.allocatedWarehouse.id;
        allocatedCourierId = allocationRes.allocatedCourier?.id || null;
        allocatedZoneId = allocationRes.allocatedZone?.id || null;
        allocatedAt = new Date();
        allocationDistance = allocationRes.distanceKm;
        allocationScore = allocationRes.allocationScore;
        allocationReason = allocationRes.allocationReason;
        computedShippingCost = allocationRes.shippingCost;

        if (computedShippingCost !== null && computedShippingCost > 0) {
          shippingTotal = computedShippingCost;
        }
      } catch (allocError: any) {
        if (allocError instanceof AppError) {
          throw allocError;
        }
        console.warn(`[Allocation Engine] Warehouse allocation warning for PIN ${shippingPincode}: ${allocError.message}`);
      }
    }

    const recalculatedGrandTotal = Number((taxableSubtotal + taxTotal + shippingTotal).toFixed(2));

    const order = await tx.order.create({
      data: {
        orderNumber,
        userId,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        paymentMethod: input.paymentMethod ?? 'RAZORPAY',
        subtotal,
        discountTotal,
        shippingTotal,
        taxTotal,
        grandTotal: recalculatedGrandTotal,
        couponId: cart.couponId,
        shippingAddressId: input.shippingAddressId,
        billingAddressId: input.billingAddressId,
        shippingAddress: shippingAddressJson as Prisma.InputJsonValue,
        billingAddress: billingAddressJson as Prisma.InputJsonValue,
        allocatedWarehouseId,
        allocatedCourierId,
        allocatedZoneId,
        allocatedAt,
        allocationDistance,
        allocationScore,
        allocationReason,
        notes: input.notes,
      },
    });

    if (allocatedWarehouseId) {
      await tx.shipment.create({
        data: {
          orderId: order.id,
          warehouseId: allocatedWarehouseId,
          courierId: allocatedCourierId,
          zoneId: allocatedZoneId,
          shippingCost: shippingTotal,
          deliveryDays: 3,
          trackingNumber: `TRK-${order.orderNumber}`,
          shipmentStatus: 'PENDING',
        },
      });
    }

    // 5b. Variant Stock Sync & Stock Re-verification inside transaction
    for (const item of cart.items) {
      const dbProduct = await tx.product.findUnique({
        where: { id: item.productId },
      });

      if (!dbProduct || dbProduct.deletedAt || dbProduct.status !== 'ACTIVE') {
        throw new AppError('BAD_REQUEST', `Product "${item.product.name}" is not available`, 400);
      }

      if (item.variantId) {
        const dbVariant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
        });

        if (!dbVariant || !dbVariant.isAvailable) {
          throw new AppError('BAD_REQUEST', `Variant for "${item.product.name}" is not available`, 400);
        }

        if (dbVariant.stock < item.quantity) {
          throw new AppError(
            'BAD_REQUEST',
            `Insufficient stock for "${item.product.name} (${dbVariant.name || dbVariant.sku})". Available: ${dbVariant.stock}`,
            400
          );
        }

        if (dbProduct.stock < item.quantity) {
          throw new AppError(
            'BAD_REQUEST',
            `Insufficient stock for "${item.product.name}". Available: ${dbProduct.stock}`,
            400
          );
        }

        const unitPrice = dbVariant.salePrice ? Number(dbVariant.salePrice) : Number(dbVariant.price);
        const totalItemPrice = Number((unitPrice * item.quantity).toFixed(2));

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            variantId: item.variantId,
            productName: item.product.name,
            sku: dbVariant.sku,
            price: unitPrice,
            quantity: item.quantity,
            total: totalItemPrice,
          },
        });

        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.quantity } },
        });

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      } else {
        if (dbProduct.stock < item.quantity) {
          throw new AppError(
            'BAD_REQUEST',
            `Insufficient stock for "${item.product.name}". Available: ${dbProduct.stock}`,
            400
          );
        }

        const unitPrice = dbProduct.salePrice ? Number(dbProduct.salePrice) : Number(dbProduct.price);
        const totalItemPrice = Number((unitPrice * item.quantity).toFixed(2));

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            productName: item.product.name,
            sku: dbProduct.sku,
            price: unitPrice,
            quantity: item.quantity,
            total: totalItemPrice,
          },
        });

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: 'PENDING',
        comment: 'Order placed from checkout',
        changedBy: userId,
      },
    });

    if (cart.couponId) {
      await tx.coupon.update({
        where: { id: cart.couponId },
        data: { usedCount: { increment: 1 } },
      });
      await tx.couponUsage.create({
        data: {
          couponId: cart.couponId,
          userId,
          orderId: order.id,
        },
      });
    }

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    await tx.cart.update({ where: { id: cart.id }, data: { couponId: null } });

    return order;
  });

  const fullOrder = await prisma.order.findUnique({
    where: { id: createdOrder.id },
    include: {
      items: true,
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      coupon: { select: { id: true, code: true, discountValue: true } },
    },
  });

  // Emit Domain Event for Real-Time SSE and Background Workers
  try {
    const { eventBus } = await import('../../events/eventBus');
    const customerName = fullOrder?.user
      ? `${fullOrder.user.firstName || ''} ${fullOrder.user.lastName || ''}`.trim()
      : 'Customer';
    eventBus.emitEvent('order.created', {
      orderId: createdOrder.id,
      orderNumber: createdOrder.orderNumber,
      userId,
      totalAmount: Number(fullOrder?.grandTotal || 0),
      itemsCount: fullOrder?.items.length || 0,
      customerName,
      customerEmail: fullOrder?.user?.email,
    });
  } catch (e: any) {
    console.error('[Checkout EventBus Error]:', e.message);
  }

  return {
    ...fullOrder,
    subtotal: Number(fullOrder?.subtotal),
    discountTotal: Number(fullOrder?.discountTotal),
    shippingTotal: Number(fullOrder?.shippingTotal),
    taxTotal: Number(fullOrder?.taxTotal),
    grandTotal: Number(fullOrder?.grandTotal),
    items: fullOrder?.items.map((i) => ({
      ...i,
      price: Number(i.price),
      total: Number(i.total),
    })),
  };
};

