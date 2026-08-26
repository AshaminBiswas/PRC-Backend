import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { validateCoupon } from '../coupons/coupons.service';
import type { AddCartItemInput } from './cart.schema';
import type { Prisma } from '@prisma/client';

const cartSelect = {
  id: true,
  userId: true,
  couponId: true,
  createdAt: true,
  updatedAt: true,
  coupon: {
    select: {
      id: true,
      code: true,
      description: true,
      discountType: true,
      discountValue: true,
      minOrderAmount: true,
      maxDiscountAmount: true,
      usageLimit: true,
      usedCount: true,
      perUserLimit: true,
      startDate: true,
      endDate: true,
      isActive: true,
    },
  },
  items: {
    select: {
      id: true,
      productId: true,
      variantId: true,
      quantity: true,
      createdAt: true,
      updatedAt: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          price: true,
          salePrice: true,
          thumbnail: true,
          stock: true,
          status: true,
          weight: true,
        },
      },
      variant: {
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          salePrice: true,
          stock: true,
          attributes: true,
          isAvailable: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

export const getCart = async (userId: string) => {
  let cart = await prisma.cart.findUnique({
    where: { userId },
    select: cartSelect,
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
      select: cartSelect,
    });
  }

  const [b2bCustomPrices] = await Promise.all([
    prisma.b2BCustomerPrice.findMany({
      where: { userId },
    }),
  ]);
  const b2bMap = new Map(b2bCustomPrices.map((cp) => [cp.productId, Number(cp.price)]));

  let subtotal = 0;
  let totalWeight = 0;

  const items = cart.items.map((item) => {
    const standardProdPrice = item.product.salePrice ? Number(item.product.salePrice) : Number(item.product.price);
    const customB2B = b2bMap.get(item.productId);
    const prodPrice = (customB2B !== undefined && customB2B > 0) ? customB2B : standardProdPrice;
    let unitPrice = prodPrice;
    let variantData = null;

    if (item.variant) {
      const varPrice = item.variant.salePrice ? Number(item.variant.salePrice) : Number(item.variant.price);
      unitPrice = varPrice;
      variantData = {
        ...item.variant,
        price: Number(item.variant.price),
        salePrice: item.variant.salePrice ? Number(item.variant.salePrice) : null,
        inStock: item.variant.stock >= item.quantity,
      };
    }

    const itemTotal = Number((unitPrice * item.quantity).toFixed(2));
    subtotal += itemTotal;

    const itemWeight = (item.product.weight ? Number(item.product.weight) : 0) * item.quantity;
    totalWeight += itemWeight;

    return {
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice,
      totalPrice: itemTotal,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        sku: item.product.sku,
        price: Number(item.product.price),
        salePrice: item.product.salePrice ? Number(item.product.salePrice) : null,
        thumbnail: item.product.thumbnail,
        weight: item.product.weight ? Number(item.product.weight) : null,
        inStock: item.product.stock >= item.quantity,
      },
      variant: variantData,
    };
  });

  subtotal = Number(subtotal.toFixed(2));
  totalWeight = Number(totalWeight.toFixed(2));

  let discount = 0;
  let couponInfo = null;

  if (cart.coupon && items.length > 0) {
    const now = new Date();
    const isDateValid =
      (!cart.coupon.startDate || now >= new Date(cart.coupon.startDate)) &&
      (!cart.coupon.endDate || now <= new Date(cart.coupon.endDate));
    const isMinAmountValid =
      cart.coupon.minOrderAmount === null || subtotal >= Number(cart.coupon.minOrderAmount);
    const isGlobalLimitValid =
      cart.coupon.usageLimit === null || cart.coupon.usedCount < cart.coupon.usageLimit;

    if (cart.coupon.isActive && isDateValid && isMinAmountValid && isGlobalLimitValid) {
      if (cart.coupon.discountType === 'PERCENTAGE') {
        discount = (subtotal * Number(cart.coupon.discountValue)) / 100;
        if (cart.coupon.maxDiscountAmount !== null) {
          discount = Math.min(discount, Number(cart.coupon.maxDiscountAmount));
        }
      } else {
        discount = Math.min(Number(cart.coupon.discountValue), subtotal);
      }
      discount = Number(discount.toFixed(2));

      couponInfo = {
        id: cart.coupon.id,
        code: cart.coupon.code,
        discountType: cart.coupon.discountType,
        discountValue: Number(cart.coupon.discountValue),
        discountAmount: discount,
      };
    }
  }

  const taxableAmount = Math.max(0, subtotal - discount);
  const tax = Number((taxableAmount * 0.18).toFixed(2));

  const shipping = items.length === 0 || subtotal - discount >= 5000 ? 0 : 100;
  const grandTotal = Number((taxableAmount + tax + shipping).toFixed(2));

  return {
    id: cart.id,
    userId: cart.userId,
    itemCount: items.reduce((count, i) => count + i.quantity, 0),
    items,
    summary: {
      subtotal,
      discount,
      tax,
      shipping,
      total: grandTotal,
      totalWeight,
    },
    coupon: couponInfo,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
  };
};

export const addCartItem = async (userId: string, input: AddCartItemInput) => {
  const product = await prisma.product.findUnique({
    where: { id: input.productId, deletedAt: null },
  });
  if (!product) {
    throw new AppError('NOT_FOUND', 'Product not found', 404);
  }
  if (product.status !== 'ACTIVE') {
    throw new AppError('BAD_REQUEST', 'Product is currently unavailable', 400);
  }

  const requestedQty = input.quantity ?? 1;

  if (input.variantId) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: input.variantId, productId: input.productId },
    });
    if (!variant) {
      throw new AppError('NOT_FOUND', 'Product variant not found', 404);
    }
    if (!variant.isAvailable) {
      throw new AppError('BAD_REQUEST', 'Variant is currently unavailable', 400);
    }
    if (variant.stock < requestedQty) {
      throw new AppError('BAD_REQUEST', `Insufficient stock for variant. Available: ${variant.stock}`, 400);
    }
  } else {
    if (product.stock < requestedQty) {
      throw new AppError('BAD_REQUEST', `Insufficient stock for product. Available: ${product.stock}`, 400);
    }
  }

  let cart = await prisma.cart.findUnique({
    where: { userId },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
    });
  }

  const existingItem = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      productId: input.productId,
      variantId: input.variantId ?? null,
    },
  });

  if (existingItem) {
    const newQuantity = existingItem.quantity + requestedQty;

    if (input.variantId) {
      const variant = await prisma.productVariant.findUnique({ where: { id: input.variantId } });
      if (variant && variant.stock < newQuantity) {
        throw new AppError('BAD_REQUEST', `Insufficient stock. Available: ${variant.stock}`, 400);
      }
    } else {
      if (product.stock < newQuantity) {
        throw new AppError('BAD_REQUEST', `Insufficient stock. Available: ${product.stock}`, 400);
      }
    }

    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: newQuantity },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: input.productId,
        variantId: input.variantId ?? null,
        quantity: requestedQty,
      },
    });
  }

  return getCart(userId);
};

export const updateCartItem = async (userId: string, itemId: string, quantity: number) => {
  const cart = await prisma.cart.findUnique({
    where: { userId },
  });
  if (!cart) {
    throw new AppError('NOT_FOUND', 'Cart not found', 404);
  }

  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId: cart.id },
    include: { product: true, variant: true },
  });

  if (!item) {
    throw new AppError('NOT_FOUND', 'Cart item not found', 404);
  }

  if (item.variant) {
    if (item.variant.stock < quantity) {
      throw new AppError('BAD_REQUEST', `Insufficient stock for variant. Available: ${item.variant.stock}`, 400);
    }
  } else {
    if (item.product.stock < quantity) {
      throw new AppError('BAD_REQUEST', `Insufficient stock for product. Available: ${item.product.stock}`, 400);
    }
  }

  await prisma.cartItem.update({
    where: { id: itemId },
    data: { quantity },
  });

  return getCart(userId);
};

export const removeCartItem = async (userId: string, itemId: string) => {
  const cart = await prisma.cart.findUnique({
    where: { userId },
  });
  if (!cart) {
    throw new AppError('NOT_FOUND', 'Cart not found', 404);
  }

  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId: cart.id },
  });

  if (!item) {
    throw new AppError('NOT_FOUND', 'Cart item not found', 404);
  }

  await prisma.cartItem.delete({
    where: { id: itemId },
  });

  return getCart(userId);
};

export const clearCart = async (userId: string) => {
  const cart = await prisma.cart.findUnique({
    where: { userId },
  });

  if (cart) {
    await prisma.$transaction([
      prisma.cartItem.deleteMany({ where: { cartId: cart.id } }),
      prisma.cart.update({ where: { id: cart.id }, data: { couponId: null } }),
    ]);
  }

  return getCart(userId);
};

export const applyCoupon = async (userId: string, code: string) => {
  const currentCart = await getCart(userId);
  if (currentCart.items.length === 0) {
    throw new AppError('BAD_REQUEST', 'Cannot apply coupon to an empty cart', 400);
  }

  const validation = await validateCoupon(userId, code, currentCart.summary.subtotal);

  await prisma.cart.update({
    where: { userId },
    data: { couponId: validation.coupon.id },
  });

  return getCart(userId);
};

export const removeCoupon = async (userId: string) => {
  const cart = await prisma.cart.findUnique({
    where: { userId },
  });

  if (cart) {
    await prisma.cart.update({
      where: { id: cart.id },
      data: { couponId: null },
    });
  }

  return getCart(userId);
};
