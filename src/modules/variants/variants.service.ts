import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import type { CreateVariantInput, UpdateVariantInput } from './variants.schema';
import type { Prisma } from '@prisma/client';

const variantSelect = {
  id: true,
  productId: true,
  sku: true,
  name: true,
  price: true,
  salePrice: true,
  stock: true,
  attributes: true,
  image: true,
  isAvailable: true,
  createdAt: true,
  updatedAt: true,
  product: {
    select: {
      id: true,
      name: true,
      sku: true,
    },
  },
} as const;

const formatVariant = (v: {
  price: Prisma.Decimal;
  salePrice: Prisma.Decimal | null;
  [key: string]: unknown;
}) => ({
  ...v,
  price: Number(v.price),
  salePrice: v.salePrice !== null && v.salePrice !== undefined ? Number(v.salePrice) : null,
  inStock: (v.stock as number) > 0,
});

export const listVariants = async (productId: string) => {
  const product = await prisma.product.findUnique({
    where: { id: productId, deletedAt: null },
  });
  if (!product) {
    throw new AppError('NOT_FOUND', 'Product not found', 404);
  }

  const variants = await prisma.productVariant.findMany({
    where: { productId },
    select: variantSelect,
    orderBy: { createdAt: 'asc' },
  });

  return variants.map(formatVariant);
};

export const getVariantById = async (productId: string | undefined, id: string) => {
  const variant = await prisma.productVariant.findUnique({
    where: { id },
    select: variantSelect,
  });

  if (!variant) {
    throw new AppError('NOT_FOUND', 'Product variant not found', 404);
  }

  if (productId && variant.productId !== productId) {
    throw new AppError('NOT_FOUND', 'Variant does not belong to the specified product', 404);
  }

  return formatVariant(variant);
};

export const createVariant = async (productId: string, input: CreateVariantInput) => {
  const product = await prisma.product.findUnique({
    where: { id: productId, deletedAt: null },
  });
  if (!product) {
    throw new AppError('NOT_FOUND', 'Product not found', 404);
  }

  const existingSku = await prisma.productVariant.findUnique({
    where: { sku: input.sku },
  });
  if (existingSku) {
    throw new AppError('CONFLICT', 'A variant with this SKU already exists', 409);
  }

  const variant = await prisma.productVariant.create({
    data: {
      productId,
      sku: input.sku,
      name: input.name,
      price: input.price,
      salePrice: input.salePrice,
      stock: input.stock ?? 0,
      attributes: input.attributes as Prisma.InputJsonValue,
      image: input.image,
      isAvailable: input.isAvailable ?? true,
    },
    select: variantSelect,
  });

  return formatVariant(variant);
};

export const updateVariant = async (productId: string | undefined, id: string, input: UpdateVariantInput) => {
  const variant = await prisma.productVariant.findUnique({
    where: { id },
  });
  if (!variant) {
    throw new AppError('NOT_FOUND', 'Product variant not found', 404);
  }

  if (productId && variant.productId !== productId) {
    throw new AppError('NOT_FOUND', 'Variant does not belong to the specified product', 404);
  }

  if (input.sku && input.sku !== variant.sku) {
    const existingSku = await prisma.productVariant.findUnique({
      where: { sku: input.sku },
    });
    if (existingSku) {
      throw new AppError('CONFLICT', 'A variant with this SKU already exists', 409);
    }
  }

  const updateData: Prisma.ProductVariantUpdateInput = {};

  if (input.sku !== undefined) updateData.sku = input.sku;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.price !== undefined) updateData.price = input.price;
  if (input.salePrice !== undefined) updateData.salePrice = input.salePrice;
  if (input.stock !== undefined) updateData.stock = input.stock;
  if (input.attributes !== undefined) updateData.attributes = input.attributes as Prisma.InputJsonValue;
  if (input.image !== undefined) updateData.image = input.image;
  if (input.isAvailable !== undefined) updateData.isAvailable = input.isAvailable;

  const updated = await prisma.productVariant.update({
    where: { id },
    data: updateData,
    select: variantSelect,
  });

  return formatVariant(updated);
};

export const deleteVariant = async (productId: string | undefined, id: string) => {
  const variant = await prisma.productVariant.findUnique({
    where: { id },
  });
  if (!variant) {
    throw new AppError('NOT_FOUND', 'Product variant not found', 404);
  }

  if (productId && variant.productId !== productId) {
    throw new AppError('NOT_FOUND', 'Variant does not belong to the specified product', 404);
  }

  await prisma.productVariant.delete({
    where: { id },
  });
};
