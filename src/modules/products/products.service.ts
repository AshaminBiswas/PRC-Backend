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
  materialId: true,
  material: { select: { id: true, name: true, slug: true, shortName: true, gradeBadge: true } },
  frequentlyPairedIds: true,
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
  materialId: true,
  material: { select: { id: true, name: true, slug: true, shortName: true, gradeBadge: true } },
  frequentlyPairedIds: true,
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
    materialId: p.materialId ?? null,
    material: p.material?.name || (typeof p.attributes?.material === 'string' ? p.attributes.material : (p.specification?.material || null)),
    materialObj: p.material ?? null,
    frequentlyPairedIds: Array.isArray(p.frequentlyPairedIds) ? p.frequentlyPairedIds : [],
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
  if ((query as any).materialId) where.materialId = (query as any).materialId;
  if ((query as any).material) {
    const matVal = String((query as any).material).trim();
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { materialId: matVal },
          { material: { slug: matVal.toLowerCase() } },
          { material: { name: { contains: matVal, mode: 'insensitive' } } },
        ],
      },
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

  let frequentlyPairedProducts: any[] = [];
  if (product.frequentlyPairedIds && product.frequentlyPairedIds.length > 0) {
    const rawPaired = await readPrisma.product.findMany({
      where: {
        id: { in: product.frequentlyPairedIds },
        deletedAt: null,
      },
      select: productListSelect,
    });
    const map = new Map(rawPaired.map((p) => [p.id, p]));
    frequentlyPairedProducts = product.frequentlyPairedIds
      .map((pid) => map.get(pid))
      .filter(Boolean)
      .map(formatProduct);
  }

  return {
    ...formatProduct(product),
    frequentlyPairedProducts,
  };
};

// ─── Get Product By ID ────────────────────────────────────────────────────────

export const getProductById = async (id: string) => {
  const product = await readPrisma.product.findUnique({
    where: { id, deletedAt: null },
    select: productDetailSelect,
  });

  if (!product) throw new AppError('NOT_FOUND', 'Product not found', 404);

  let frequentlyPairedProducts: any[] = [];
  if (product.frequentlyPairedIds && product.frequentlyPairedIds.length > 0) {
    const rawPaired = await readPrisma.product.findMany({
      where: {
        id: { in: product.frequentlyPairedIds },
        deletedAt: null,
      },
      select: productListSelect,
    });
    const map = new Map(rawPaired.map((p) => [p.id, p]));
    frequentlyPairedProducts = product.frequentlyPairedIds
      .map((pid) => map.get(pid))
      .filter(Boolean)
      .map(formatProduct);
  }

  return {
    ...formatProduct(product),
    frequentlyPairedProducts,
  };
};

// ─── Get Frequently Paired Products ───────────────────────────────────────────

export const getFrequentlyPairedProducts = async (idOrSlug: string) => {
  const product = await readPrisma.product.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug.toLowerCase().trim() }],
      deletedAt: null,
    },
    select: { id: true, frequentlyPairedIds: true },
  });

  if (!product || !product.frequentlyPairedIds || product.frequentlyPairedIds.length === 0) {
    return [];
  }

  const rawPaired = await readPrisma.product.findMany({
    where: {
      id: { in: product.frequentlyPairedIds },
      deletedAt: null,
    },
    select: productListSelect,
  });

  const map = new Map(rawPaired.map((p) => [p.id, p]));
  return product.frequentlyPairedIds
    .map((pid) => map.get(pid))
    .filter(Boolean)
    .map(formatProduct);
};

// ─── Create Product ───────────────────────────────────────────────────────────

export const createProduct = async (input: CreateProductInput) => {
  const skuExists = await prisma.product.findUnique({ where: { sku: input.sku } });
  if (skuExists && skuExists.deletedAt === null) {
    throw new AppError('CONFLICT', 'A product with this SKU already exists', 409);
  }

  if (input.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId, deletedAt: null } });
    if (!category) throw new AppError('NOT_FOUND', 'Category not found', 404);
  }

  let slug: string;
  if (input.slug && input.slug.trim()) {
    const rawSlug = input.slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const existingWithSlug = await prisma.product.findFirst({
      where: { slug: rawSlug, deletedAt: null },
      select: { id: true },
    });
    if (existingWithSlug && (!skuExists || skuExists.id !== existingWithSlug.id)) {
      slug = `${rawSlug}-${Date.now().toString().slice(-4)}`;
    } else {
      slug = rawSlug;
    }
  } else {
    slug = await generateUniqueSlug(input.name, 'product');
  }

  const {
    dimensions,
    attributes,
    specification,
    productSpecification,
    manufacturerInfo,
    seo,
    metaTitle,
    metaDescription,
    metaKeywords,
    pairedProductIds,
    ...rest
  } = input;

  const finalPairedIds = input.frequentlyPairedIds || pairedProductIds || [];
  const finalMetaTitle = metaTitle || seo?.metaTitle || undefined;
  const finalMetaDescription = metaDescription || seo?.metaDescription || undefined;
  const finalMetaKeywords = metaKeywords || seo?.metaKeywords || undefined;

  let product: any;
  if (skuExists && skuExists.deletedAt !== null) {
    product = await prisma.product.update({
      where: { id: skuExists.id },
      data: {
        ...rest,
        frequentlyPairedIds: finalPairedIds,
        materialId: input.materialId || null,
        name: input.name,
        slug,
        deletedAt: null,
        status: input.status || 'ACTIVE',
        isVisible: input.isVisible ?? true,
        isFeatured: input.isFeatured ?? false,
        isBestseller: input.isBestseller ?? false,
        isInOffer: input.isInOffer ?? false,
        isNewArrival: input.isNewArrival ?? false,
        dimensions: dimensions ? (dimensions as any) : undefined,
        attributes: attributes ? (attributes as any) : undefined,
        specification: (productSpecification || specification) ? ((productSpecification || specification) as any) : undefined,
        manufacturerInfo: manufacturerInfo ? (manufacturerInfo as any) : undefined,
        metaTitle: finalMetaTitle,
        metaDescription: finalMetaDescription,
        metaKeywords: finalMetaKeywords,
      },
      select: productDetailSelect,
    });
  } else {
    product = await prisma.product.create({
      data: {
        ...rest,
        frequentlyPairedIds: finalPairedIds,
        materialId: input.materialId || null,
        slug,
        status: input.status || 'ACTIVE',
        isVisible: input.isVisible ?? true,
        isFeatured: input.isFeatured ?? false,
        isBestseller: input.isBestseller ?? false,
        isInOffer: input.isInOffer ?? false,
        isNewArrival: input.isNewArrival ?? false,
        dimensions: dimensions ? (dimensions as any) : undefined,
        attributes: attributes ? (attributes as any) : undefined,
        specification: (productSpecification || specification) ? ((productSpecification || specification) as any) : undefined,
        manufacturerInfo: manufacturerInfo ? (manufacturerInfo as any) : undefined,
        metaTitle: finalMetaTitle,
        metaDescription: finalMetaDescription,
        metaKeywords: finalMetaKeywords,
      },
      select: productDetailSelect,
    });
  }

  // Automatically initialize branch inventory rows
  try {
    const branches = await prisma.branch.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, code: true },
    });
    if (branches.length > 0) {
      await prisma.inventory.createMany({
        data: branches.map((b) => ({
          productId: product.id,
          branchId: b.id,
          quantity: b.code === 'DEL' ? (input.stock || 0) : 0,
          reservedQuantity: 0,
          reorderLevel: input.reorderLevel || 10,
        })),
        skipDuplicates: true,
      });
    }
  } catch (err: any) {
    console.warn('[ProductsService] Non-fatal branch inventory init notice:', err?.message || err);
  }

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
  if (input.slug && input.slug.trim()) {
    const rawSlug = input.slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (rawSlug !== existing.slug) {
      const existingWithSlug = await prisma.product.findFirst({
        where: { slug: rawSlug, id: { not: id }, deletedAt: null },
        select: { id: true },
      });
      slug = existingWithSlug ? `${rawSlug}-${Date.now().toString().slice(-4)}` : rawSlug;
    }
  } else if (input.name && input.name !== existing.name) {
    slug = await generateUniqueSlug(input.name, 'product');
  }

  const {
    dimensions,
    attributes,
    specification,
    productSpecification,
    manufacturerInfo,
    seo,
    metaTitle,
    metaDescription,
    metaKeywords,
    pairedProductIds,
    stock: _ignoredStock, // Stock updates are strictly managed through Multi-Branch Inventory Hub & Stock Ledger
    ...rest
  } = input;

  const finalPairedIds = input.frequentlyPairedIds !== undefined
    ? input.frequentlyPairedIds
    : pairedProductIds !== undefined
    ? pairedProductIds
    : undefined;

  const finalMetaTitle = metaTitle !== undefined ? metaTitle : seo?.metaTitle;
  const finalMetaDescription = metaDescription !== undefined ? metaDescription : seo?.metaDescription;
  const finalMetaKeywords = metaKeywords !== undefined ? metaKeywords : seo?.metaKeywords;

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...rest,
      slug,
      ...(input.materialId !== undefined ? { materialId: input.materialId || null } : {}),
      ...(finalPairedIds !== undefined ? { frequentlyPairedIds: finalPairedIds } : {}),
      dimensions: dimensions !== undefined ? (dimensions as any) : undefined,
      attributes: attributes !== undefined ? (attributes as any) : undefined,
      specification: (productSpecification !== undefined || specification !== undefined)
        ? ((productSpecification || specification) as any)
        : undefined,
      manufacturerInfo: manufacturerInfo !== undefined ? (manufacturerInfo as any) : undefined,
      ...(finalMetaTitle !== undefined ? { metaTitle: finalMetaTitle } : {}),
      ...(finalMetaDescription !== undefined ? { metaDescription: finalMetaDescription } : {}),
      ...(finalMetaKeywords !== undefined ? { metaKeywords: finalMetaKeywords } : {}),
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
