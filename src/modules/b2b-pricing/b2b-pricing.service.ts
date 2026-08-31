import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import type {
  SetCustomerProductPriceInput,
  BulkSetCustomerPricesInput,
  ApplyFlatDiscountInput,
} from './b2b-pricing.schema';

// ─── Get Customer Pricing Matrix ─────────────────────────────────────────────

export const getCustomerPricingMatrix = async (userId: string) => {
  let cleanId = (userId || '').trim();

  // If passed a quote reference or composite ID, try resolving the user
  if (cleanId.startsWith('quote-')) {
    const quoteId = cleanId.replace('quote-', '');
    const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
    if (quote?.userId) {
      cleanId = quote.userId;
    } else if (quote?.email) {
      cleanId = quote.email;
    }
  }

  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { id: cleanId },
        { email: { equals: cleanId, mode: 'insensitive' } },
        { phone: cleanId },
      ],
      deletedAt: null,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      companyName: true,
      gstin: true,
      phone: true,
      status: true,
      userRoles: {
        select: { role: { select: { name: true, slug: true } } },
      },
    },
  });

  if (!user) {
    // If quote exists with this ID, check quote directly
    const quote = await prisma.quote.findUnique({ where: { id: cleanId } });
    if (quote?.userId) {
      user = await prisma.user.findUnique({
        where: { id: quote.userId, deletedAt: null },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          companyName: true,
          gstin: true,
          phone: true,
          status: true,
          userRoles: {
            select: { role: { select: { name: true, slug: true } } },
          },
        },
      });
    }
  }

  if (!user) throw new AppError('NOT_FOUND', 'Customer not found', 404);

  const effectiveUserId = user.id;

  // Fetch all active products
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
      price: true,
      salePrice: true,
      offerPrice: true,
      thumbnail: true,
      category: { select: { id: true, name: true, slug: true } },
      status: true,
      stock: true,
    },
    orderBy: { name: 'asc' },
  });

  // Fetch existing custom prices for this user
  const customPrices = await prisma.b2BCustomerPrice.findMany({
    where: { userId: effectiveUserId },
  });

  const customPriceMap = new Map<string, typeof customPrices[0]>();
  for (const cp of customPrices) {
    customPriceMap.set(cp.productId, cp);
  }

  // Combine products with custom prices
  const items = products.map((p) => {
    const cp = customPriceMap.get(p.id);
    const standardPrice = Number(p.salePrice ?? p.price);
    const customPriceNum = cp ? Number(cp.price) : null;
    const discountPercent =
      customPriceNum && standardPrice > 0
        ? Number((((standardPrice - customPriceNum) / standardPrice) * 100).toFixed(2))
        : 0;

    return {
      productId: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      thumbnail: p.thumbnail,
      categoryName: p.category?.name ?? 'Uncategorized',
      categoryId: p.category?.id ?? null,
      standardPrice,
      hasCustomPrice: !!cp,
      customPrice: customPriceNum,
      minQuantity: cp?.minQuantity ?? 1,
      notes: cp?.notes ?? null,
      discountPercent,
      customPriceId: cp?.id ?? null,
      updatedAt: cp?.updatedAt ?? null,
    };
  });

  return {
    customer: {
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      companyName: user.companyName,
      gstin: user.gstin,
      phone: user.phone,
      role: user.userRoles[0]?.role.name ?? 'Customer',
    },
    totalProducts: products.length,
    customPricesCount: customPrices.length,
    items,
  };
};

// ─── Set Single Customer Product Price ───────────────────────────────────────

export const setCustomerProductPrice = async (
  userId: string,
  input: SetCustomerProductPriceInput
) => {
  const user = await prisma.user.findUnique({ where: { id: userId, deletedAt: null } });
  if (!user) throw new AppError('NOT_FOUND', 'Customer not found', 404);

  const product = await prisma.product.findUnique({
    where: { id: input.productId, deletedAt: null },
  });
  if (!product) throw new AppError('NOT_FOUND', 'Product not found', 404);

  const record = await prisma.b2BCustomerPrice.upsert({
    where: {
      userId_productId: {
        userId,
        productId: input.productId,
      },
    },
    update: {
      price: input.price,
      minQuantity: input.minQuantity ?? 1,
      notes: input.notes,
    },
    create: {
      userId,
      productId: input.productId,
      price: input.price,
      minQuantity: input.minQuantity ?? 1,
      notes: input.notes,
    },
  });

  return record;
};

// ─── Bulk Set Customer Prices ────────────────────────────────────────────────

export const bulkSetCustomerPrices = async (
  userId: string,
  input: BulkSetCustomerPricesInput
) => {
  const user = await prisma.user.findUnique({ where: { id: userId, deletedAt: null } });
  if (!user) throw new AppError('NOT_FOUND', 'Customer not found', 404);

  const operations = input.prices.map((item) =>
    prisma.b2BCustomerPrice.upsert({
      where: {
        userId_productId: {
          userId,
          productId: item.productId,
        },
      },
      update: {
        price: item.price,
        minQuantity: item.minQuantity ?? 1,
        notes: item.notes,
      },
      create: {
        userId,
        productId: item.productId,
        price: item.price,
        minQuantity: item.minQuantity ?? 1,
        notes: item.notes,
      },
    })
  );

  const results = await prisma.$transaction(operations);
  return { updatedCount: results.length };
};

// ─── Apply Flat Percentage Discount to All / Category Products ───────────────

export const applyFlatDiscount = async (
  userId: string,
  input: ApplyFlatDiscountInput
) => {
  const user = await prisma.user.findUnique({ where: { id: userId, deletedAt: null } });
  if (!user) throw new AppError('NOT_FOUND', 'Customer not found', 404);

  const whereClause: any = { deletedAt: null };
  if (input.categoryId) {
    whereClause.categoryId = input.categoryId;
  }

  const products = await prisma.product.findMany({
    where: whereClause,
    select: { id: true, price: true, salePrice: true },
  });

  if (products.length === 0) {
    throw new AppError('NOT_FOUND', 'No products found to apply discount', 404);
  }

  const multiplier = (100 - input.discountPercent) / 100;

  const operations = products.map((p) => {
    const base = Number(p.salePrice ?? p.price);
    const discounted = Math.max(1, Number((base * multiplier).toFixed(2)));

    return prisma.b2BCustomerPrice.upsert({
      where: {
        userId_productId: {
          userId,
          productId: p.id,
        },
      },
      update: {
        price: discounted,
        minQuantity: input.minQuantity ?? 1,
        notes: `Flat ${input.discountPercent}% B2B discount applied`,
      },
      create: {
        userId,
        productId: p.id,
        price: discounted,
        minQuantity: input.minQuantity ?? 1,
        notes: `Flat ${input.discountPercent}% B2B discount applied`,
      },
    });
  });

  const results = await prisma.$transaction(operations);
  return { appliedCount: results.length, discountPercent: input.discountPercent };
};

// ─── Delete Customer Custom Price (Revert to Retail) ─────────────────────────

export const deleteCustomerProductPrice = async (userId: string, productId: string) => {
  const existing = await prisma.b2BCustomerPrice.findUnique({
    where: {
      userId_productId: { userId, productId },
    },
  });

  if (!existing) {
    throw new AppError('NOT_FOUND', 'Custom price record not found', 404);
  }

  await prisma.b2BCustomerPrice.delete({
    where: { id: existing.id },
  });

  return { message: 'Custom price removed. Product reverted to standard retail price.' };
};

// ─── Get Active B2B Pricing for Logged-In User ────────────────────────────────

export const getMyPricing = async (userId: string) => {
  const customPrices = await prisma.b2BCustomerPrice.findMany({
    where: { userId },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          price: true,
          salePrice: true,
          thumbnail: true,
        },
      },
    },
  });

  return customPrices.map((cp) => ({
    productId: cp.productId,
    name: cp.product.name,
    slug: cp.product.slug,
    sku: cp.product.sku,
    thumbnail: cp.product.thumbnail,
    standardPrice: Number(cp.product.salePrice ?? cp.product.price),
    customB2BPrice: Number(cp.price),
    minQuantity: cp.minQuantity,
    notes: cp.notes,
  }));
};
