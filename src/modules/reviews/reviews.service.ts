import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { buildPagination, getPaginationParams } from '../../utils/response';
import { ReviewStatus, OrderStatus } from '@prisma/client';
import type {
  CreateReviewInput,
  UpdateReviewStatusInput,
  ListReviewsQuery,
  ProductReviewsQuery,
} from './reviews.schema';

const reviewUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatar: true,
};

const reviewProductSelect = {
  id: true,
  name: true,
  slug: true,
  thumbnail: true,
};

export const createReview = async (userId: string, input: CreateReviewInput, roleSlug: string) => {
  // 1. Verify product existence
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { id: true, name: true },
  });

  if (!product) {
    throw new AppError('NOT_FOUND', 'Product not found', 404);
  }

  // 2. Check for verified purchase (skip for super-admin)
  if (roleSlug !== 'super-admin') {
    const deliveredOrder = await prisma.order.findFirst({
      where: {
        userId,
        status: OrderStatus.DELIVERED,
        items: {
          some: {
            productId: input.productId,
          },
        },
      },
      select: { id: true },
    });

    if (!deliveredOrder) {
      throw new AppError(
        'BAD_REQUEST',
        'Verified purchase required: You can only review products from delivered orders',
        400
      );
    }
  }

  // 3. Create review (Default status: PENDING)
  const review = await prisma.review.create({
    data: {
      productId: input.productId,
      userId,
      rating: input.rating,
      title: input.title,
      comment: input.comment,
      status: ReviewStatus.PENDING,
    },
    include: {
      user: { select: reviewUserSelect },
      product: { select: reviewProductSelect },
    },
  });

  return review;
};

export const updateReviewStatus = async (id: string, input: UpdateReviewStatusInput) => {
  const review = await prisma.review.findUnique({
    where: { id },
    select: { id: true, productId: true, status: true },
  });

  if (!review) {
    throw new AppError('NOT_FOUND', 'Review not found', 404);
  }

  const updatedReview = await prisma.review.update({
    where: { id },
    data: { status: input.status },
    include: {
      user: { select: reviewUserSelect },
      product: { select: reviewProductSelect },
    },
  });

  // Recalculate product rating and reviewCount based on APPROVED reviews
  const approvedReviewsAggregate = await prisma.review.aggregate({
    where: {
      productId: review.productId,
      status: ReviewStatus.APPROVED,
    },
    _avg: { rating: true },
    _count: { id: true },
  });

  const reviewCount = (approvedReviewsAggregate as any)._count?.id ?? 0;
  const ratingAvg = (approvedReviewsAggregate as any)._avg?.rating || 0;

  await prisma.product.update({
    where: { id: review.productId },
    data: {
      rating: Number(ratingAvg.toFixed(2)),
      reviewCount,
    },
  });

  return updatedReview;
};

export const getProductReviews = async (productId: string, query: ProductReviewsQuery) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });

  if (!product) {
    throw new AppError('NOT_FOUND', 'Product not found', 404);
  }

  const { page, limit, skip } = getPaginationParams(query);

  const where = {
    productId,
    status: ReviewStatus.APPROVED,
  };

  const [totalItems, reviews, ratingCounts] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: { select: reviewUserSelect },
      },
    }),
    prisma.review.groupBy({
      by: ['rating'],
      where,
      _count: { rating: true },
    }),
  ]);

  const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalRatingSum = 0;

  for (const rc of ratingCounts) {
    breakdown[rc.rating] = rc._count.rating;
    totalRatingSum += rc.rating * rc._count.rating;
  }

  const averageRating = totalItems > 0 ? Number((totalRatingSum / totalItems).toFixed(2)) : 0;

  const pagination = buildPagination(page, limit, totalItems);

  return {
    data: reviews,
    summary: {
      totalReviews: totalItems,
      averageRating,
      ratingBreakdown: breakdown,
    },
    pagination,
  };
};

export const listAllReviews = async (query: ListReviewsQuery) => {
  const { page, limit, skip } = getPaginationParams(query);

  const where: any = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.productId) {
    where.productId = query.productId;
  }

  if (query.userId) {
    where.userId = query.userId;
  }

  const [totalItems, reviews] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: { select: reviewUserSelect },
        product: { select: reviewProductSelect },
      },
    }),
  ]);

  const pagination = buildPagination(page, limit, totalItems);

  return { data: reviews, pagination };
};
