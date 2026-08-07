import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { Prisma } from '@prisma/client';
import type {
  CreateBannerInput,
  UpdateBannerInput,
  ListBannersQuery,
} from './banners.schema';

const formatBanner = (banner: any) => {
  if (!banner) return null;
  return {
    ...banner,
    displayOrder: banner.order,
  };
};

export const getPublicBanners = async (position?: string) => {
  const now = new Date();
  const where: Prisma.BannerWhereInput = {
    isActive: true,
    AND: [
      { OR: [{ startDate: null }, { startDate: { lte: now } }] },
      { OR: [{ endDate: null }, { endDate: { gte: now } }] },
    ],
  };

  if (position) {
    where.position = position;
  }

  const banners = await prisma.banner.findMany({
    where,
    orderBy: { order: 'asc' },
  });

  return banners.map(formatBanner);
};

export const listAdminBanners = async (query: ListBannersQuery) => {
  const where: Prisma.BannerWhereInput = {};

  if (query.position) {
    where.position = query.position;
  }

  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  const banners = await prisma.banner.findMany({
    where,
    orderBy: [{ position: 'asc' }, { order: 'asc' }],
  });

  return banners.map(formatBanner);
};

export const getBannerById = async (id: string) => {
  const banner = await prisma.banner.findUnique({
    where: { id },
  });

  if (!banner) {
    throw new AppError('NOT_FOUND', 'Banner not found', 404);
  }

  return formatBanner(banner);
};

export const createBanner = async (input: CreateBannerInput) => {
  const orderValue = input.displayOrder !== undefined ? input.displayOrder : input.order;

  const banner = await prisma.banner.create({
    data: {
      title: input.title,
      subtitle: input.subtitle,
      image: input.image,
      link: input.link,
      position: input.position,
      order: orderValue,
      isActive: input.isActive,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
    },
  });

  return formatBanner(banner);
};

export const updateBanner = async (id: string, input: UpdateBannerInput) => {
  const existing = await prisma.banner.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Banner not found', 404);
  }

  const updateData: Prisma.BannerUpdateInput = { ...input };

  if (input.displayOrder !== undefined && input.order === undefined) {
    updateData.order = input.displayOrder;
  }
  delete (updateData as any).displayOrder;

  if (input.startDate !== undefined) {
    updateData.startDate = input.startDate ? new Date(input.startDate) : null;
  }
  if (input.endDate !== undefined) {
    updateData.endDate = input.endDate ? new Date(input.endDate) : null;
  }

  const banner = await prisma.banner.update({
    where: { id },
    data: updateData,
  });

  return formatBanner(banner);
};

export const deleteBanner = async (id: string) => {
  const existing = await prisma.banner.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Banner not found', 404);
  }

  await prisma.banner.delete({ where: { id } });
};
