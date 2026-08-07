import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { ProductStatus, CategoryStatus, ReviewStatus } from '@prisma/client';
import type {
  CreateHomepageSectionInput,
  UpdateHomepageSectionInput,
} from './homepage.schema';

export const getHomepageData = async () => {
  const now = new Date();

  const [banners, sections, featuredProducts, topCategories, verifiedReviews] = await Promise.all([
    // Active Banners
    prisma.banner.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      },
      orderBy: { order: 'asc' },
    }),

    // Active Homepage Sections
    prisma.homepageSection.findMany({
      where: { isActive: true },
      orderBy: { position: 'asc' },
    }),

    // Featured Products
    prisma.product.findMany({
      where: {
        isFeatured: true,
        status: ProductStatus.ACTIVE,
        isVisible: true,
        deletedAt: null,
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        price: true,
        salePrice: true,
        thumbnail: true,
        rating: true,
        reviewCount: true,
        stock: true,
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    }),

    // Top Categories
    prisma.category.findMany({
      where: {
        parentId: null,
        status: CategoryStatus.ACTIVE,
        isVisible: true,
        deletedAt: null,
      },
      take: 8,
      orderBy: { position: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        icon: true,
      },
    }),

    // Verified Reviews (APPROVED, high rating)
    prisma.review.findMany({
      where: {
        status: ReviewStatus.APPROVED,
        rating: { gte: 4 },
      },
      take: 6,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        rating: true,
        title: true,
        comment: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            thumbnail: true,
          },
        },
      },
    }),
  ]);

  const formattedBanners = banners.map((b) => ({
    ...b,
    displayOrder: b.order,
  }));

  const formattedProducts = featuredProducts.map((p) => ({
    ...p,
    price: Number(p.price),
    salePrice: p.salePrice !== null ? Number(p.salePrice) : null,
    rating: Number(p.rating),
  }));

  return {
    banners: formattedBanners,
    sections,
    featuredProducts: formattedProducts,
    topCategories,
    verifiedReviews,
  };
};

export const listSections = async () => {
  return prisma.homepageSection.findMany({
    orderBy: { position: 'asc' },
  });
};

export const getSectionById = async (id: string) => {
  const section = await prisma.homepageSection.findUnique({
    where: { id },
  });

  if (!section) {
    throw new AppError('NOT_FOUND', 'Homepage section not found', 404);
  }

  return section;
};

export const createSection = async (input: CreateHomepageSectionInput) => {
  return prisma.homepageSection.create({
    data: {
      title: input.title,
      subtitle: input.subtitle,
      type: input.type,
      configuration: (input.configuration as any) || undefined,
      position: input.position,
      isActive: input.isActive,
    },
  });
};

export const updateSection = async (id: string, input: UpdateHomepageSectionInput) => {
  const existing = await prisma.homepageSection.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Homepage section not found', 404);
  }

  return prisma.homepageSection.update({
    where: { id },
    data: {
      ...input,
      configuration: input.configuration ? (input.configuration as any) : undefined,
    },
  });
};

export const deleteSection = async (id: string) => {
  const existing = await prisma.homepageSection.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Homepage section not found', 404);
  }

  await prisma.homepageSection.delete({ where: { id } });
};
