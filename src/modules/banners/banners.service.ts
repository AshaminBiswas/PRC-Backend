import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { Prisma } from '@prisma/client';
import type {
  CreateBannerInput,
  UpdateBannerInput,
  ReorderBannersInput,
  ListBannersQuery,
} from './banners.schema';

export const POSITION_DIMENSIONS: Record<
  string,
  {
    desktop: { width: number; height: number; recommendedSize: string };
    tablet: { width: number; height: number; recommendedSize: string };
    mobile: { width: number; height: number; recommendedSize: string };
    aspectRatio: { desktop: string; mobile: string };
  }
> = {
  HERO_SLIDER: {
    desktop: { width: 1920, height: 1080, recommendedSize: '1920x1080 px' },
    tablet: { width: 1024, height: 768, recommendedSize: '1024x768 px' },
    mobile: { width: 750, height: 1000, recommendedSize: '750x1000 px' },
    aspectRatio: { desktop: '16:9', mobile: '3:4' },
  },
  HOME_UPCOMING: {
    desktop: { width: 1920, height: 600, recommendedSize: '1920x600 px' },
    tablet: { width: 1024, height: 500, recommendedSize: '1024x500 px' },
    mobile: { width: 750, height: 600, recommendedSize: '750x600 px' },
    aspectRatio: { desktop: '3.2:1', mobile: '5:4' },
  },
  BESTSELLERS_TOP: {
    desktop: { width: 1920, height: 1080, recommendedSize: '1920x1080 px' },
    tablet: { width: 1024, height: 768, recommendedSize: '1024x768 px' },
    mobile: { width: 750, height: 1000, recommendedSize: '750x1000 px' },
    aspectRatio: { desktop: '16:9', mobile: '3:4' },
  },
  BESTSELLERS_MID: {
    desktop: { width: 1920, height: 600, recommendedSize: '1920x600 px' },
    tablet: { width: 1024, height: 500, recommendedSize: '1024x500 px' },
    mobile: { width: 750, height: 600, recommendedSize: '750x600 px' },
    aspectRatio: { desktop: '3.2:1', mobile: '5:4' },
  },
  NEW_ARRIVALS_TOP: {
    desktop: { width: 1920, height: 900, recommendedSize: '1920x900 px' },
    tablet: { width: 1024, height: 680, recommendedSize: '1024x680 px' },
    mobile: { width: 750, height: 900, recommendedSize: '750x900 px' },
    aspectRatio: { desktop: '2.1:1', mobile: '5:6' },
  },
  NEW_ARRIVALS_MID: {
    desktop: { width: 1920, height: 600, recommendedSize: '1920x600 px' },
    tablet: { width: 1024, height: 500, recommendedSize: '1024x500 px' },
    mobile: { width: 750, height: 600, recommendedSize: '750x600 px' },
    aspectRatio: { desktop: '3.2:1', mobile: '5:4' },
  },
  OFFERS_TOP: {
    desktop: { width: 1920, height: 800, recommendedSize: '1920x800 px' },
    tablet: { width: 1024, height: 600, recommendedSize: '1024x600 px' },
    mobile: { width: 750, height: 800, recommendedSize: '750x800 px' },
    aspectRatio: { desktop: '2.4:1', mobile: '15:16' },
  },
  OFFERS_SIDE: {
    desktop: { width: 800, height: 1000, recommendedSize: '800x1000 px' },
    tablet: { width: 600, height: 750, recommendedSize: '600x750 px' },
    mobile: { width: 500, height: 625, recommendedSize: '500x625 px' },
    aspectRatio: { desktop: '4:5', mobile: '4:5' },
  },
  SHOP_BY_AESTHETIC: {
    desktop: { width: 800, height: 1000, recommendedSize: '800x1000 px' },
    tablet: { width: 600, height: 750, recommendedSize: '600x750 px' },
    mobile: { width: 500, height: 625, recommendedSize: '500x625 px' },
    aspectRatio: { desktop: '4:5', mobile: '4:5' },
  },
  CUBICLE_COLLECTION: {
    desktop: { width: 1200, height: 600, recommendedSize: '1200x600 px' },
    tablet: { width: 1024, height: 500, recommendedSize: '1024x500 px' },
    mobile: { width: 750, height: 600, recommendedSize: '750x600 px' },
    aspectRatio: { desktop: '2:1', mobile: '5:4' },
  },
  LOCKER_COLLECTION: {
    desktop: { width: 1200, height: 600, recommendedSize: '1200x600 px' },
    tablet: { width: 1024, height: 500, recommendedSize: '1024x500 px' },
    mobile: { width: 750, height: 600, recommendedSize: '750x600 px' },
    aspectRatio: { desktop: '2:1', mobile: '5:4' },
  },
  ABOUT_HERO: {
    desktop: { width: 1920, height: 720, recommendedSize: '1920x720 px' },
    tablet: { width: 1024, height: 550, recommendedSize: '1024x550 px' },
    mobile: { width: 750, height: 800, recommendedSize: '750x800 px' },
    aspectRatio: { desktop: '2.6:1', mobile: '15:16' },
  },
  CONTACT_HERO: {
    desktop: { width: 1920, height: 500, recommendedSize: '1920x500 px' },
    tablet: { width: 1024, height: 450, recommendedSize: '1024x450 px' },
    mobile: { width: 750, height: 500, recommendedSize: '750x500 px' },
    aspectRatio: { desktop: '3.8:1', mobile: '3:2' },
  },
  FAQ_HERO: {
    desktop: { width: 1920, height: 500, recommendedSize: '1920x500 px' },
    tablet: { width: 1024, height: 450, recommendedSize: '1024x450 px' },
    mobile: { width: 750, height: 500, recommendedSize: '750x500 px' },
    aspectRatio: { desktop: '3.8:1', mobile: '3:2' },
  },
};

export const formatBanner = (banner: any) => {
  if (!banner) return null;
  const desktopImg = banner.desktopImage || banner.image || '';
  const tabletImg = banner.tabletImage || desktopImg;
  const mobileImg = banner.mobileImage || desktopImg;
  const link = banner.linkUrl || banner.link || null;
  const dims = POSITION_DIMENSIONS[banner.position] || POSITION_DIMENSIONS.HERO_SLIDER;

  return {
    id: banner.id,
    title: banner.title,
    subtitle: banner.subtitle ?? null,
    badgeText: banner.badgeText ?? null,
    desktopImage: desktopImg,
    tabletImage: tabletImg,
    mobileImage: mobileImg,
    image: desktopImg,
    linkUrl: link,
    link,
    ctaText: banner.ctaText || 'Explore Now',
    position: banner.position,
    order: banner.order,
    displayOrder: banner.order,
    isActive: banner.isActive,
    startDate: banner.startDate,
    endDate: banner.endDate,
    createdAt: banner.createdAt,
    updatedAt: banner.updatedAt,
    targetDimensions: dims,
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
  const orderValue = input.displayOrder !== undefined ? input.displayOrder : (input.order ?? 0);
  const desktopImg = input.desktopImage || input.image || '';
  const linkVal = input.linkUrl || input.link || null;

  const banner = await prisma.banner.create({
    data: {
      title: input.title,
      subtitle: input.subtitle,
      badgeText: input.badgeText,
      desktopImage: desktopImg,
      tabletImage: input.tabletImage,
      mobileImage: input.mobileImage,
      image: desktopImg,
      linkUrl: linkVal,
      link: linkVal,
      ctaText: input.ctaText || 'Explore Now',
      position: input.position,
      order: orderValue,
      isActive: input.isActive ?? true,
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

  const updateData: Prisma.BannerUpdateInput = {};

  if (input.title !== undefined) updateData.title = input.title;
  if (input.subtitle !== undefined) updateData.subtitle = input.subtitle;
  if (input.badgeText !== undefined) updateData.badgeText = input.badgeText;
  if (input.desktopImage !== undefined || input.image !== undefined) {
    const desktopImg = input.desktopImage || input.image || '';
    updateData.desktopImage = desktopImg;
    updateData.image = desktopImg;
  }
  if (input.tabletImage !== undefined) updateData.tabletImage = input.tabletImage;
  if (input.mobileImage !== undefined) updateData.mobileImage = input.mobileImage;
  if (input.linkUrl !== undefined || input.link !== undefined) {
    const linkVal = input.linkUrl || input.link || null;
    updateData.linkUrl = linkVal;
    updateData.link = linkVal;
  }
  if (input.ctaText !== undefined) updateData.ctaText = input.ctaText;
  if (input.position !== undefined) updateData.position = input.position;
  if (input.order !== undefined || input.displayOrder !== undefined) {
    updateData.order = input.displayOrder !== undefined ? input.displayOrder : input.order;
  }
  if (input.isActive !== undefined) updateData.isActive = input.isActive;
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

export const reorderBanners = async (input: ReorderBannersInput) => {
  const transactions = input.items.map((item) =>
    prisma.banner.update({
      where: { id: item.id },
      data: { order: item.order },
    })
  );

  await prisma.$transaction(transactions);
  return { success: true, count: input.items.length };
};

export const deleteBanner = async (id: string) => {
  const existing = await prisma.banner.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Banner not found', 404);
  }

  await prisma.banner.delete({ where: { id } });
};
