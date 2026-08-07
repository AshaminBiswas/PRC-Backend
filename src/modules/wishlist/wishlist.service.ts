import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import type { AddWishlistItemInput } from './wishlist.schema';
import type { Prisma } from '@prisma/client';

const wishlistSelect = {
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: {
      id: true,
      productId: true,
      variantId: true,
      createdAt: true,
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
    orderBy: { createdAt: 'desc' as const },
  },
} as const;

const formatWishlist = (wishlist: {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: string;
    productId: string;
    variantId: string | null;
    createdAt: Date;
    product: {
      price: Prisma.Decimal;
      salePrice: Prisma.Decimal | null;
      stock: number;
      [key: string]: unknown;
    };
    variant?: {
      price: Prisma.Decimal;
      salePrice: Prisma.Decimal | null;
      stock: number;
      [key: string]: unknown;
    } | null;
  }>;
}) => ({
  id: wishlist.id,
  userId: wishlist.userId,
  createdAt: wishlist.createdAt,
  updatedAt: wishlist.updatedAt,
  itemCount: wishlist.items.length,
  items: wishlist.items.map((item) => {
    const prodPrice = Number(item.product.price);
    const prodSalePrice = item.product.salePrice ? Number(item.product.salePrice) : null;

    let variantData = null;
    if (item.variant) {
      variantData = {
        ...item.variant,
        price: Number(item.variant.price),
        salePrice: item.variant.salePrice ? Number(item.variant.salePrice) : null,
        inStock: item.variant.stock > 0,
      };
    }

    return {
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      createdAt: item.createdAt,
      product: {
        ...item.product,
        price: prodPrice,
        salePrice: prodSalePrice,
        inStock: item.product.stock > 0,
      },
      variant: variantData,
    };
  }),
});

export const getWishlist = async (userId: string) => {
  let wishlist = await prisma.wishlist.findUnique({
    where: { userId },
    select: wishlistSelect,
  });

  if (!wishlist) {
    wishlist = await prisma.wishlist.create({
      data: { userId },
      select: wishlistSelect,
    });
  }

  return formatWishlist(wishlist);
};

export const addToWishlist = async (userId: string, input: AddWishlistItemInput) => {
  const product = await prisma.product.findUnique({
    where: { id: input.productId, deletedAt: null },
  });
  if (!product) {
    throw new AppError('NOT_FOUND', 'Product not found', 404);
  }

  if (input.variantId) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: input.variantId, productId: input.productId },
    });
    if (!variant) {
      throw new AppError('NOT_FOUND', 'Product variant not found', 404);
    }
  }

  let wishlist = await prisma.wishlist.findUnique({
    where: { userId },
  });

  if (!wishlist) {
    wishlist = await prisma.wishlist.create({
      data: { userId },
    });
  }

  const existingItem = await prisma.wishlistItem.findFirst({
    where: {
      wishlistId: wishlist.id,
      productId: input.productId,
      variantId: input.variantId ?? null,
    },
  });

  if (!existingItem) {
    await prisma.wishlistItem.create({
      data: {
        wishlistId: wishlist.id,
        productId: input.productId,
        variantId: input.variantId ?? null,
      },
    });
  }

  return getWishlist(userId);
};

export const removeFromWishlist = async (userId: string, itemId: string) => {
  const wishlist = await prisma.wishlist.findUnique({
    where: { userId },
  });
  if (!wishlist) {
    throw new AppError('NOT_FOUND', 'Wishlist not found', 404);
  }

  const item = await prisma.wishlistItem.findFirst({
    where: { id: itemId, wishlistId: wishlist.id },
  });

  if (!item) {
    throw new AppError('NOT_FOUND', 'Wishlist item not found', 404);
  }

  await prisma.wishlistItem.delete({
    where: { id: itemId },
  });

  return getWishlist(userId);
};

export const clearWishlist = async (userId: string) => {
  const wishlist = await prisma.wishlist.findUnique({
    where: { userId },
  });

  if (wishlist) {
    await prisma.wishlistItem.deleteMany({
      where: { wishlistId: wishlist.id },
    });
  }

  return getWishlist(userId);
};
