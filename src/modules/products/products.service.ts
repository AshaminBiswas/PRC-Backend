import prisma from '../../config/database';
import { readPrisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { generateUniqueSlug } from '../../utils/slug.utils';
import { buildPagination, getPaginationParams } from '../../utils/response';
import type { CreateProductInput, UpdateProductInput } from './products.schema';
import type { Prisma } from '@prisma/client';

// ─── Fast Projections (Separating Lightweight Catalog from Heavy Detail Views) ─

export const productListSelect = {
  id: true,
  name: true,
  slug: true,
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
  warranty: true,
  rating: true,
  reviewCount: true,
  colours: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, slug: true } },
} as const;

export const productDetailSelect = {
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

const formatProduct = (p: any) => {
  const effectivePrice = p.offerPrice ?? p.salePrice;
  const numOfferPrice = effectivePrice ? Number(effectivePrice) : null;
  return {
    ...p,
    price: Number(p.price),
    salePrice: numOfferPrice,
    offerPrice: numOfferPrice,
    rating: p.rating ? Number(p.rating) : 0,
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

// ─── List Products (B2C Fast Path with Server Pagination & Indexed Query) ──────

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
      select: productListSelect,
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

// ─── Get Products By Category (ID or Slug) ────────────────────────────────────

export const getProductsByCategory = async (
  categoryIdentifier: string,
  query: any
) => {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryIdentifier);

  const category = await readPrisma.category.findFirst({
    where: isUuid
      ? { id: categoryIdentifier, deletedAt: null }
      : { slug: categoryIdentifier, deletedAt: null },
    include: {
      children: { where: { deletedAt: null }, select: { id: true } },
    },
  });

  if (!category) {
    throw new AppError('NOT_FOUND', 'Category not found', 404);
  }

  const categoryIds = [category.id, ...category.children.map((c) => c.id)];

  const { page, limit, skip } = getPaginationParams(query);

  const where: Prisma.ProductWhereInput = {
    categoryId: { in: categoryIds },
    deletedAt: null,
  };

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { sku: { contains: query.search, mode: 'insensitive' } },
    ];
  }
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
  const sortBy = query.sortBy && validSortFields.includes(query.sortBy) ? query.sortBy : 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  const [products, totalItems, priceRange] = await Promise.all([
    readPrisma.product.findMany({
      where,
      select: productListSelect,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    readPrisma.product.count({ where }),
    readPrisma.product.aggregate({
      where: { categoryId: { in: categoryIds }, deletedAt: null },
      _min: { price: true },
      _max: { price: true },
    }),
  ]);

  return {
    category: {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      image: category.image,
    },
    data: products.map(formatProduct),
    pagination: buildPagination(page, limit, totalItems),
    filters: {
      priceRange: {
        min: priceRange._min.price ? Number(priceRange._min.price) : 0,
        max: priceRange._max.price ? Number(priceRange._max.price) : 0,
      },
    },
  };
};

// ─── Get Product By Slug (Optimized Single Lookups) ───────────────────────────

export const getProductBySlug = async (slug: string) => {
  const product = await readPrisma.product.findUnique({
    where: { slug, deletedAt: null },
    select: productDetailSelect,
  });

  if (!product) throw new AppError('NOT_FOUND', 'Product not found', 404);

  return formatProduct(product);
};

// ─── Get Product By ID ────────────────────────────────────────────────────────

export const getProductById = async (id: string) => {
  const product = await readPrisma.product.findUnique({
    where: { id, deletedAt: null },
    select: productDetailSelect,
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

  const {
    dimensions,
    attributes,
    specification,
    productSpecification,
    manufacturerInfo,
    seo,
    ...rest
  } = input;

  const product = await prisma.product.create({
    data: {
      ...rest,
      slug,
      dimensions: dimensions ? (dimensions as any) : undefined,
      attributes: attributes ? (attributes as any) : undefined,
      specification: (productSpecification || specification) ? ((productSpecification || specification) as any) : undefined,
      manufacturerInfo: manufacturerInfo ? (manufacturerInfo as any) : undefined,
      metaTitle: seo?.metaTitle,
      metaDescription: seo?.metaDescription,
      metaKeywords: seo?.metaKeywords,
    },
    select: productDetailSelect,
  });

  return formatProduct(product);
};

// ─── Update Product ───────────────────────────────────────────────────────────

export const updateProduct = async (id: string, input: UpdateProductInput) => {
  const existing = await prisma.product.findUnique({ where: { id, deletedAt: null } });
  if (!existing) throw new AppError('NOT_FOUND', 'Product not found', 404);

  if (input.sku && input.sku !== existing.sku) {
    const skuExists = await prisma.product.findUnique({ where: { sku: input.sku } });
    if (skuExists) throw new AppError('CONFLICT', 'A product with this SKU already exists', 409);
  }

  if (input.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId, deletedAt: null } });
    if (!category) throw new AppError('NOT_FOUND', 'Category not found', 404);
  }

  let slug = existing.slug;
  if (input.name && input.name !== existing.name) {
    slug = await generateUniqueSlug(input.name, 'product');
  }

  const {
    dimensions,
    attributes,
    specification,
    productSpecification,
    manufacturerInfo,
    seo,
    ...rest
  } = input;

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...rest,
      slug,
      dimensions: dimensions !== undefined ? (dimensions as any) : undefined,
      attributes: attributes !== undefined ? (attributes as any) : undefined,
      specification: (productSpecification !== undefined || specification !== undefined)
        ? ((productSpecification || specification) as any)
        : undefined,
      manufacturerInfo: manufacturerInfo !== undefined ? (manufacturerInfo as any) : undefined,
      ...(seo ? {
        metaTitle: seo.metaTitle,
        metaDescription: seo.metaDescription,
        metaKeywords: seo.metaKeywords,
      } : {}),
    },
    select: productDetailSelect,
  });

  return formatProduct(product);
};

// ─── Delete Product (Soft Delete) ─────────────────────────────────────────────

export const deleteProduct = async (id: string) => {
  const existing = await prisma.product.findUnique({ where: { id, deletedAt: null } });
  if (!existing) throw new AppError('NOT_FOUND', 'Product not found', 404);

  await prisma.product.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'INACTIVE', isVisible: false },
  });

  return { message: 'Product deleted successfully' };
};
