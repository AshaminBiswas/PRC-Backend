import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { buildPagination, getPaginationParams } from '../../utils/response';
import type { CreateVariantInput, UpdateVariantInput, ListVariantsQuery } from './variants.schema';
import type { Prisma } from '@prisma/client';

const variantSelect = {
  id: true,
  productId: true,
  sku: true,
  name: true,
  price: true,
  salePrice: true,
  offerPrice: true,
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
      thumbnail: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} as const;

const formatVariant = (v: any) => ({
  ...v,
  price: Number(v.price),
  salePrice: v.salePrice !== null && v.salePrice !== undefined ? Number(v.salePrice) : null,
  offerPrice: v.offerPrice !== null && v.offerPrice !== undefined ? Number(v.offerPrice) : null,
  inStock: Number(v.stock || 0) > 0,
});

export const listVariants = async (productId?: string, query: ListVariantsQuery = { page: 1, limit: 50, sortBy: 'createdAt', sortOrder: 'desc' }) => {
  const { page, limit, skip } = getPaginationParams(query);

  const targetProductId = productId || query.productId;

  const where: Prisma.ProductVariantWhereInput = {};

  if (targetProductId) {
    where.productId = targetProductId;
  }

  if (query.search) {
    const q = query.search.trim();
    where.OR = [
      { sku: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
      { product: { name: { contains: q, mode: 'insensitive' } } },
      { product: { sku: { contains: q, mode: 'insensitive' } } },
    ];
  }

  if (query.inStock === 'true') {
    where.stock = { gt: 0 };
  } else if (query.inStock === 'false') {
    where.stock = { lte: 0 };
  }

  if (query.isAvailable === 'true') {
    where.isAvailable = true;
  } else if (query.isAvailable === 'false') {
    where.isAvailable = false;
  }

  const sortByField = query.sortBy || 'createdAt';
  const sortOrderDir = query.sortOrder || 'desc';

  const [variants, totalItems] = await prisma.$transaction([
    prisma.productVariant.findMany({
      where,
      select: variantSelect,
      orderBy: { [sortByField]: sortOrderDir },
      skip,
      take: limit,
    }),
    prisma.productVariant.count({ where }),
  ]);

  const data = variants.map(formatVariant);

  return {
    data,
    pagination: buildPagination(page, limit, totalItems),
  };
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

export const createVariant = async (productId: string | undefined, input: CreateVariantInput) => {
  const targetProductId = productId || input.productId;

  if (!targetProductId) {
    throw new AppError('BAD_REQUEST', 'Product ID is required to create a variant', 400);
  }

  const product = await prisma.product.findUnique({
    where: { id: targetProductId, deletedAt: null },
  });
  if (!product) {
    throw new AppError('NOT_FOUND', 'Parent product not found', 404);
  }

  const existingSku = await prisma.productVariant.findUnique({
    where: { sku: input.sku },
  });
  if (existingSku) {
    throw new AppError('CONFLICT', `A variant with SKU "${input.sku}" already exists`, 409);
  }

  const variant = await prisma.productVariant.create({
    data: {
      productId: targetProductId,
      sku: input.sku,
      name: input.name || null,
      price: input.price,
      salePrice: input.salePrice !== undefined ? input.salePrice : null,
      offerPrice: input.offerPrice !== undefined ? input.offerPrice : null,
      stock: input.stock ?? 0,
      attributes: (input.attributes || {}) as Prisma.InputJsonValue,
      image: input.image || null,
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
      throw new AppError('CONFLICT', `A variant with SKU "${input.sku}" already exists`, 409);
    }
  }

  const updateData: Prisma.ProductVariantUpdateInput = {};

  if (input.productId !== undefined) {
    const parentProd = await prisma.product.findUnique({ where: { id: input.productId, deletedAt: null } });
    if (!parentProd) throw new AppError('NOT_FOUND', 'Target parent product not found', 404);
    updateData.product = { connect: { id: input.productId } };
  }

  if (input.sku !== undefined) updateData.sku = input.sku;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.price !== undefined) updateData.price = input.price;
  if (input.salePrice !== undefined) updateData.salePrice = input.salePrice;
  if (input.offerPrice !== undefined) updateData.offerPrice = input.offerPrice;
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

  return { success: true, message: `Variant with SKU "${variant.sku}" deleted permanently.` };
};
