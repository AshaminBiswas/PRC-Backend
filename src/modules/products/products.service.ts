import prisma from '../../config/database';
import { readPrisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { generateUniqueSlug } from '../../utils/slug.utils';
import { buildPagination, getPaginationParams } from '../../utils/response';
import type { CreateProductInput, UpdateProductInput } from './products.schema';
import type { Prisma } from '@prisma/client';

const productSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  shortDesc: true,
  sku: true,
  price: true,
  salePrice: true,
  offerPrice: true,
  thumbnail: true,
  images: true,
  categoryId: true,
  stock: true,
  reorderLevel: true,
  status: true,
  isVisible: true,
  isFeatured: true,
  isBestseller: true,
  isInOffer: true,
  isNewArrival: true,
  compatibleFor: true,
  warranty: true,
  rating: true,
  reviewCount: true,
  weight: true,
  dimensions: true,
  attributes: true,
  specification: true,
  manufacturerInfo: true,
  colours: true,
  tags: true,
  metaTitle: true,
  metaDescription: true,
  metaKeywords: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, slug: true } },
} as const;

const formatProduct = (p: {
  price: Prisma.Decimal;
  salePrice?: Prisma.Decimal | null;
  offerPrice?: Prisma.Decimal | null;
  rating: Prisma.Decimal;
  weight: Prisma.Decimal | null;
  [key: string]: unknown;
}) => {
  const effectivePrice = p.offerPrice ?? p.salePrice;
  const numOfferPrice = effectivePrice ? Number(effectivePrice) : null;
  return {
    ...p,
    price: Number(p.price),
    salePrice: numOfferPrice,
    offerPrice: numOfferPrice,
    rating: Number(p.rating),
    weight: p.weight ? Number(p.weight) : null,
    inStock: (p.stock as number) > 0,
    productSpecification: p.specification ?? null,
    seo: {
      metaTitle: p.metaTitle ?? null,
      metaDescription: p.metaDescription ?? null,
      metaKeywords: p.metaKeywords ?? null,
    },
  };
};

// ─── List Products ────────────────────────────────────────────────────────────

export const listProducts = async (query: {
  page: number;
  limit: number;
  search?: string;
  categoryId?: string;
  status?: string;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  isFeatured?: boolean;
  isBestsaller?: boolean;
  isBestseller?: boolean;
  isInOffer?: boolean;
  isNewArrival?: boolean;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}) => {
  const { page, limit, skip } = getPaginationParams(query);

  const where: Prisma.ProductWhereInput = { deletedAt: null };

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { sku: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.status) where.status = query.status as 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  if (query.inStock) where.stock = { gt: 0 };
  if (query.isFeatured !== undefined) where.isFeatured = query.isFeatured;
  if (query.isBestseller !== undefined) where.isBestseller = query.isBestseller;
  if (query.isInOffer !== undefined) where.isInOffer = query.isInOffer;
  if (query.isNewArrival !== undefined) where.isNewArrival = query.isNewArrival;
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    where.price = {
      ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
      ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
    };
  }

  const validSortFields = ['price', 'name', 'createdAt', 'rating', 'stock'];
  const sortBy = validSortFields.includes(query.sortBy) ? query.sortBy : 'createdAt';

  const [products, totalItems] = await Promise.all([
    readPrisma.product.findMany({
      where,
      select: productSelect,
      orderBy: { [sortBy]: query.sortOrder },
      skip,
      take: limit,
    }),
    readPrisma.product.count({ where }),
  ]);

  return {
    data: products.map(formatProduct),
    pagination: buildPagination(page, limit, totalItems),
  };
};

// ─── Get Product By Slug ──────────────────────────────────────────────────────

export const getProductBySlug = async (slug: string) => {
  const product = await readPrisma.product.findUnique({
    where: { slug, deletedAt: null },
    select: productSelect,
  });

  if (!product) throw new AppError('NOT_FOUND', 'Product not found', 404);

  return formatProduct(product);
};

// ─── Get Product By ID ────────────────────────────────────────────────────────

export const getProductById = async (id: string) => {
  const product = await readPrisma.product.findUnique({
    where: { id, deletedAt: null },
    select: productSelect,
  });

  if (!product) throw new AppError('NOT_FOUND', 'Product not found', 404);

  return formatProduct(product);
};

// ─── Create Product ───────────────────────────────────────────────────────────

export const createProduct = async (input: CreateProductInput) => {
  const skuExists = await prisma.product.findUnique({ where: { sku: input.sku } });
  if (skuExists) throw new AppError('CONFLICT', 'A product with this SKU already exists', 409);

  if (input.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId, deletedAt: null } });
    if (!category) throw new AppError('NOT_FOUND', 'Category not found', 404);
  }

  const slug = await generateUniqueSlug(input.name, 'product');

  const effectiveOfferPrice = input.offerPrice ?? input.salePrice;

  const product = await prisma.product.create({
    data: {
      name: input.name,
      slug,
      description: input.description,
      shortDesc: input.shortDesc,
      sku: input.sku,
      price: input.price,
      salePrice: effectiveOfferPrice,
      offerPrice: effectiveOfferPrice,
      thumbnail: input.thumbnail,
      images: input.images ?? [],
      category: input.categoryId ? { connect: { id: input.categoryId } } : undefined,
      stock: input.stock ?? 0,
      reorderLevel: input.reorderLevel ?? 10,
      status: input.status ?? 'DRAFT',
      isVisible: input.isVisible ?? true,
      isFeatured: input.isFeatured ?? false,
      isBestseller: input.isBestseller ?? false,
      isInOffer: input.isInOffer ?? false,
      isNewArrival: input.isNewArrival ?? false,
      compatibleFor: input.compatibleFor ?? [],
      warranty: input.warranty ?? '2 years',
      weight: input.weight,
      dimensions: input.dimensions ? (input.dimensions as Prisma.InputJsonValue) : undefined,
      attributes: input.attributes ? (input.attributes as Prisma.InputJsonValue) : undefined,
      specification: (input.specification || input.productSpecification)
        ? ((input.specification || input.productSpecification) as Prisma.InputJsonValue)
        : undefined,
      manufacturerInfo: input.manufacturerInfo ? (input.manufacturerInfo as Prisma.InputJsonValue) : undefined,
      colours: input.colours ?? [],
      tags: input.tags ?? [],
      metaTitle: input.seo?.metaTitle,
      metaDescription: input.seo?.metaDescription,
      metaKeywords: input.seo?.metaKeywords,
    },
    select: productSelect,
  });

  return formatProduct(product);
};

// ─── Update Product ───────────────────────────────────────────────────────────

export const updateProduct = async (id: string, input: UpdateProductInput) => {
  const product = await prisma.product.findUnique({ where: { id, deletedAt: null } });
  if (!product) throw new AppError('NOT_FOUND', 'Product not found', 404);

  if (input.sku && input.sku !== product.sku) {
    const skuExists = await prisma.product.findUnique({ where: { sku: input.sku } });
    if (skuExists) throw new AppError('CONFLICT', 'A product with this SKU already exists', 409);
  }

  const updateData: Prisma.ProductUpdateInput = {};

  if (input.name) {
    updateData.name = input.name;
    updateData.slug = await generateUniqueSlug(input.name, 'product', id);
  }
  if (input.description !== undefined) updateData.description = input.description;
  if (input.shortDesc !== undefined) updateData.shortDesc = input.shortDesc;
  if (input.sku) updateData.sku = input.sku;
  if (input.price !== undefined) updateData.price = input.price;
  if (input.offerPrice !== undefined || input.salePrice !== undefined) {
    const pVal = input.offerPrice ?? input.salePrice;
    updateData.salePrice = pVal;
    updateData.offerPrice = pVal;
  }
  if (input.thumbnail !== undefined) updateData.thumbnail = input.thumbnail;
  if (input.images !== undefined) updateData.images = input.images;
  if (input.categoryId !== undefined) {
    if (input.categoryId === null) {
      updateData.category = { disconnect: true };
    } else {
      updateData.category = { connect: { id: input.categoryId } };
    }
  }
  if (input.stock !== undefined) updateData.stock = input.stock;
  if (input.reorderLevel !== undefined) updateData.reorderLevel = input.reorderLevel;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.isVisible !== undefined) updateData.isVisible = input.isVisible;
  if (input.isFeatured !== undefined) updateData.isFeatured = input.isFeatured;
  if (input.isBestseller !== undefined) updateData.isBestseller = input.isBestseller;
  if (input.isInOffer !== undefined) updateData.isInOffer = input.isInOffer;
  if (input.isNewArrival !== undefined) updateData.isNewArrival = input.isNewArrival;
  if (input.compatibleFor !== undefined) updateData.compatibleFor = input.compatibleFor;
  if (input.warranty !== undefined) updateData.warranty = input.warranty;
  if (input.weight !== undefined) updateData.weight = input.weight;
  if (input.dimensions !== undefined) updateData.dimensions = input.dimensions as Prisma.InputJsonValue;
  if (input.attributes !== undefined) updateData.attributes = input.attributes as Prisma.InputJsonValue;
  if (input.specification !== undefined || input.productSpecification !== undefined) {
    updateData.specification = (input.specification || input.productSpecification) as Prisma.InputJsonValue;
  }
  if (input.manufacturerInfo !== undefined) updateData.manufacturerInfo = input.manufacturerInfo as Prisma.InputJsonValue;
  if (input.colours !== undefined) updateData.colours = input.colours;
  if (input.tags !== undefined) updateData.tags = input.tags;
  if (input.seo) {
    updateData.metaTitle = input.seo.metaTitle;
    updateData.metaDescription = input.seo.metaDescription;
    updateData.metaKeywords = input.seo.metaKeywords;
  }

  const updated = await prisma.product.update({
    where: { id },
    data: updateData,
    select: productSelect,
  });

  return formatProduct(updated);
};

// ─── Delete Product ───────────────────────────────────────────────────────────

export const deleteProduct = async (id: string) => {
  const product = await prisma.product.findUnique({ where: { id, deletedAt: null } });
  if (!product) throw new AppError('NOT_FOUND', 'Product not found', 404);
  await prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
};
