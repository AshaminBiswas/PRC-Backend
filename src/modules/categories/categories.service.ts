import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { generateUniqueSlug } from '../../utils/slug.utils';
import { buildPagination, getPaginationParams } from '../../utils/response';
import type { CreateCategoryInput, UpdateCategoryInput } from './categories.schema';
import type { Prisma } from '@prisma/client';

// ─── List Categories ──────────────────────────────────────────────────────────

export const listCategories = async (query: {
  page: number;
  limit: number;
  status?: 'ACTIVE' | 'INACTIVE';
  parentId?: string;
  search?: string;
}) => {
  const { page, limit, skip } = getPaginationParams(query);

  const where: Prisma.CategoryWhereInput = { deletedAt: null };
  if (query.status) where.status = query.status;
  if (query.parentId) where.parentId = query.parentId;
  if (query.search) where.name = { contains: query.search, mode: 'insensitive' };

  const [categories, totalItems] = await prisma.$transaction([
    prisma.category.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
        parentId: true,
        position: true,
        status: true,
        isVisible: true,
        _count: { select: { products: true } },
      },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.category.count({ where }),
  ]);

  const data = categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    image: c.image,
    parentId: c.parentId,
    position: c.position,
    productCount: c._count.products,
    status: c.status,
    isVisible: c.isVisible,
  }));

  return { data, pagination: buildPagination(page, limit, totalItems) };
};

// ─── Get Category Tree ────────────────────────────────────────────────────────

export const getCategoryTree = async () => {
  const categories = await prisma.category.findMany({
    where: { deletedAt: null, status: 'ACTIVE', isVisible: true },
    select: {
      id: true,
      name: true,
      slug: true,
      image: true,
      parentId: true,
      position: true,
    },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
  });

  // Build nested tree
  const buildTree = (
    items: typeof categories,
    parentId: string | null
  ): Array<(typeof categories)[0] & { children: unknown[] }> => {
    return items
      .filter((c) => c.parentId === parentId)
      .map((c) => ({
        ...c,
        children: buildTree(items, c.id),
      }));
  };

  return buildTree(categories, null);
};

// ─── Create Category ──────────────────────────────────────────────────────────

export const createCategory = async (input: CreateCategoryInput) => {
  const slug = await generateUniqueSlug(input.name, 'category');

  let level = 0;
  if (input.parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: input.parentId, deletedAt: null },
    });
    if (!parent) throw new AppError('NOT_FOUND', 'Parent category not found', 404);
    level = parent.level + 1;
  }

  const category = await prisma.category.create({
    data: {
      name: input.name,
      slug,
      description: input.description,
      parentId: input.parentId,
      image: input.image,
      icon: input.icon,
      position: input.position ?? 0,
      status: input.status ?? 'ACTIVE',
      isVisible: input.isVisible ?? true,
      level,
      metaTitle: input.seo?.metaTitle,
      metaDescription: input.seo?.metaDescription,
      metaKeywords: input.seo?.metaKeywords,
    },
  });

  return { id: category.id, name: category.name, slug: category.slug };
};

// ─── Get Category By Slug ─────────────────────────────────────────────────────

export const getCategoryBySlug = async (slug: string) => {
  const category = await prisma.category.findUnique({
    where: { slug, deletedAt: null },
    include: {
      parent: { select: { id: true, name: true, slug: true } },
      children: {
        where: { deletedAt: null },
        select: { id: true, name: true, slug: true, image: true },
      },
      _count: { select: { products: true } },
    },
  });

  if (!category) throw new AppError('NOT_FOUND', 'Category not found', 404);

  // Build breadcrumbs
  const breadcrumbs: Array<{ name: string; slug: string }> = [];
  let current: { parentId: string | null; name: string; slug: string } | null = category;

  // Simplified breadcrumb — for a full recursive breadcrumb, a CTE query would be ideal
  if (category.parent) {
    breadcrumbs.push({ name: category.parent.name, slug: category.parent.slug });
  }
  breadcrumbs.push({ name: category.name, slug: category.slug });

  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    image: category.image,
    icon: category.icon,
    parent: category.parent,
    children: category.children,
    breadcrumbs,
    productCount: category._count.products,
    status: category.status,
    seo: {
      metaTitle: category.metaTitle,
      metaDescription: category.metaDescription,
      metaKeywords: category.metaKeywords,
    },
  };
};

// ─── Update Category ──────────────────────────────────────────────────────────

export const updateCategory = async (id: string, input: UpdateCategoryInput) => {
  const category = await prisma.category.findUnique({ where: { id, deletedAt: null } });
  if (!category) throw new AppError('NOT_FOUND', 'Category not found', 404);

  const updateData: Prisma.CategoryUpdateInput = {};

  if (input.name) {
    updateData.name = input.name;
    updateData.slug = await generateUniqueSlug(input.name, 'category', id);
  }
  if (input.description !== undefined) updateData.description = input.description;
  if (input.image !== undefined) updateData.image = input.image;
  if (input.icon !== undefined) updateData.icon = input.icon;
  if (input.position !== undefined) updateData.position = input.position;
  if (input.isVisible !== undefined) updateData.isVisible = input.isVisible;
  if (input.seo) {
    updateData.metaTitle = input.seo.metaTitle;
    updateData.metaDescription = input.seo.metaDescription;
    updateData.metaKeywords = input.seo.metaKeywords;
  }

  if (input.parentId !== undefined) {
    if (input.parentId === null) {
      updateData.parent = { disconnect: true };
      updateData.level = 0;
    } else {
      if (input.parentId === id) {
        throw new AppError('VALIDATION_ERROR', 'Category cannot be its own parent', 400);
      }
      const parent = await prisma.category.findUnique({ where: { id: input.parentId, deletedAt: null } });
      if (!parent) throw new AppError('NOT_FOUND', 'Parent category not found', 404);
      updateData.parent = { connect: { id: input.parentId } };
      updateData.level = parent.level + 1;
    }
  }

  await prisma.category.update({ where: { id }, data: updateData });
};

// ─── Update Status ────────────────────────────────────────────────────────────

export const updateCategoryStatus = async (id: string, status: 'ACTIVE' | 'INACTIVE') => {
  const category = await prisma.category.findUnique({ where: { id, deletedAt: null } });
  if (!category) throw new AppError('NOT_FOUND', 'Category not found', 404);
  await prisma.category.update({ where: { id }, data: { status } });
};

// ─── Reorder Categories ───────────────────────────────────────────────────────

export const reorderCategories = async (
  items: Array<{ id: string; position: number; parentId?: string | null }>
) => {
  await prisma.$transaction(
    items.map((item) =>
      prisma.category.update({
        where: { id: item.id },
        data: {
          position: item.position,
          ...(item.parentId !== undefined && { parentId: item.parentId }),
        },
      })
    )
  );
};

// ─── Get Category Products ────────────────────────────────────────────────────

export const getCategoryProducts = async (
  categoryId: string,
  query: {
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
  }
) => {
  const category = await prisma.category.findUnique({ where: { id: categoryId, deletedAt: null } });
  if (!category) throw new AppError('NOT_FOUND', 'Category not found', 404);

  const { page, limit, skip } = getPaginationParams(query);

  const where: Prisma.ProductWhereInput = {
    categoryId,
    deletedAt: null,
    status: 'ACTIVE',
  };

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    where.price = {
      ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
      ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
    };
  }
  if (query.inStock) where.stock = { gt: 0 };

  const validSortFields = ['price', 'name', 'createdAt', 'rating'];
  const sortBy = validSortFields.includes(query.sortBy) ? query.sortBy : 'createdAt';

  const [products, totalItems] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        thumbnail: true,
        price: true,
        salePrice: true,
        stock: true,
        rating: true,
        reviewCount: true,
      },
      orderBy: { [sortBy]: query.sortOrder },
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  const priceRange = await prisma.product.aggregate({
    where: { categoryId, deletedAt: null, status: 'ACTIVE' },
    _min: { price: true },
    _max: { price: true },
  });

  return {
    data: products.map((p) => ({
      ...p,
      price: Number(p.price),
      salePrice: p.salePrice ? Number(p.salePrice) : null,
      rating: Number(p.rating),
      inStock: p.stock > 0,
    })),
    pagination: buildPagination(page, limit, totalItems),
    filters: {
      priceRange: {
        min: Number(priceRange._min.price ?? 0),
        max: Number(priceRange._max.price ?? 0),
      },
      attributes: [],
    },
  };
};

// ─── Delete Category ──────────────────────────────────────────────────────────

export const deleteCategory = async (id: string) => {
  const category = await prisma.category.findUnique({
    where: { id, deletedAt: null },
    include: {
      _count: { select: { children: true, products: true } },
    },
  });
  if (!category) throw new AppError('NOT_FOUND', 'Category not found', 404);
  if (category._count.children > 0) {
    throw new AppError('CONFLICT', 'Cannot delete a category that has subcategories', 409);
  }
  if (category._count.products > 0) {
    throw new AppError('CONFLICT', 'Cannot delete a category that has products', 409);
  }

  await prisma.category.update({ where: { id }, data: { deletedAt: new Date() } });
};
