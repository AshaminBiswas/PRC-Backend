import { readPrisma } from '../../config/database';
import { buildPagination, getPaginationParams } from '../../utils/response';
import { ProductStatus, CategoryStatus, Prisma } from '@prisma/client';
import type { SearchProductsQuery, SearchSuggestionsQuery } from './search.schema';

export const searchProducts = async (query: SearchProductsQuery) => {
  const { page, limit, skip } = getPaginationParams(query);

  const where: Prisma.ProductWhereInput = {
    status: ProductStatus.ACTIVE,
    isVisible: true,
    deletedAt: null,
  };

  // Search query q
  if (query.q && query.q.trim().length > 0) {
    const q = query.q.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { shortDesc: { contains: q, mode: 'insensitive' } },
      { sku: { contains: q, mode: 'insensitive' } },
      { tags: { has: q } },
    ];
  }

  // Category filter (support categoryId or category slug/name)
  const categoryIdentifier = query.categoryId || query.category;
  if (categoryIdentifier) {
    // Check if categoryIdentifier is a UUID or slug
    let category = await readPrisma.category.findFirst({
      where: {
        OR: [{ id: categoryIdentifier }, { slug: categoryIdentifier }],
        status: CategoryStatus.ACTIVE,
      },
      select: { id: true, children: { select: { id: true } } },
    });

    if (category) {
      const categoryIds = [category.id, ...category.children.map((c) => c.id)];
      where.categoryId = { in: categoryIds };
    } else {
      where.categoryId = categoryIdentifier;
    }
  }

  // Price range
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    where.price = {};
    if (query.minPrice !== undefined) {
      where.price.gte = query.minPrice;
    }
    if (query.maxPrice !== undefined) {
      where.price.lte = query.maxPrice;
    }
  }

  // Availability / Stock
  if (query.inStock || query.availability === 'in_stock') {
    where.stock = { gt: 0 };
  }

  // Brand / Attribute tag
  if (query.brand) {
    where.OR = [
      ...(where.OR || []),
      { tags: { has: query.brand } },
      { name: { contains: query.brand, mode: 'insensitive' } },
    ];
  }

  // Sorting
  let orderBy: Prisma.ProductOrderByWithRelationInput[] = [{ createdAt: 'desc' }];
  switch (query.sortBy) {
    case 'price_asc':
      orderBy = [{ price: 'asc' }];
      break;
    case 'price_desc':
      orderBy = [{ price: 'desc' }];
      break;
    case 'newest':
      orderBy = [{ createdAt: 'desc' }];
      break;
    case 'rating':
      orderBy = [{ rating: 'desc' }, { reviewCount: 'desc' }];
      break;
    case 'name_asc':
      orderBy = [{ name: 'asc' }];
      break;
    case 'name_desc':
      orderBy = [{ name: 'desc' }];
      break;
    case 'relevance':
    default:
      orderBy = [{ createdAt: 'desc' }];
      break;
  }

  const [totalItems, products] = await Promise.all([
    readPrisma.product.count({ where }),
    readPrisma.product.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        shortDesc: true,
        sku: true,
        price: true,
        salePrice: true,
        thumbnail: true,
        stock: true,
        rating: true,
        reviewCount: true,
        isFeatured: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    }),
  ]);

  const formattedProducts = products.map((p) => ({
    ...p,
    price: Number(p.price),
    salePrice: p.salePrice !== null ? Number(p.salePrice) : null,
    rating: Number(p.rating),
  }));

  const pagination = buildPagination(page, limit, totalItems);

  return { data: formattedProducts, pagination };
};

export const getSearchSuggestions = async (query: SearchSuggestionsQuery) => {
  const q = query.q.trim();
  const limit = query.limit || 5;

  const [matchingProducts, matchingCategories] = await Promise.all([
    readPrisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        isVisible: true,
        deletedAt: null,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          { tags: { has: q } },
        ],
      },
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        thumbnail: true,
        price: true,
        salePrice: true,
      },
    }),

    readPrisma.category.findMany({
      where: {
        status: CategoryStatus.ACTIVE,
        isVisible: true,
        deletedAt: null,
        name: { contains: q, mode: 'insensitive' },
      },
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
      },
    }),
  ]);

  const formattedProducts = matchingProducts.map((p) => ({
    ...p,
    price: Number(p.price),
    salePrice: p.salePrice !== null ? Number(p.salePrice) : null,
  }));

  return {
    products: formattedProducts,
    categories: matchingCategories,
  };
};
