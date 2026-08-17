import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { buildPagination, getPaginationParams } from '../../utils/response';
import { QuoteStatus, OrderStatus, PaymentStatus, PaymentMethod, Prisma } from '@prisma/client';
import type {
  ListQuotesQuery,
  CreateQuoteInput,
  UpdateQuoteStatusInput,
  ConvertQuoteInput,
  UpdateQuotePricingInput,
} from './quotes.schema';

interface UserContext {
  id: string;
  roleSlug: string;
  permissions: string[];
}

const quoteSelect = {
  id: true,
  quoteNumber: true,
  userId: true,
  status: true,
  subtotal: true,
  discountTotal: true,
  taxTotal: true,
  grandTotal: true,
  notes: true,
  adminNotes: true,
  validUntil: true,
  convertedOrderId: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      companyName: true,
      gstin: true,
    },
  },
  items: {
    select: {
      id: true,
      quoteId: true,
      productId: true,
      variantId: true,
      quantity: true,
      requestedPrice: true,
      offeredPrice: true,
      total: true,
      createdAt: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          price: true,
          thumbnail: true,
        },
      },
      variant: {
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          attributes: true,
        },
      },
    },
  },
} as const;

export const formatQuote = (quote: any) => {
  if (!quote) return null;
  return {
    ...quote,
    subtotal: quote.subtotal !== null ? Number(quote.subtotal) : null,
    discountTotal: quote.discountTotal !== null ? Number(quote.discountTotal) : null,
    taxTotal: quote.taxTotal !== null ? Number(quote.taxTotal) : null,
    grandTotal: quote.grandTotal !== null ? Number(quote.grandTotal) : null,
    items: quote.items?.map((item: any) => ({
      ...item,
      requestedPrice: item.requestedPrice !== null ? Number(item.requestedPrice) : null,
      offeredPrice: item.offeredPrice !== null ? Number(item.offeredPrice) : null,
      total: item.total !== null ? Number(item.total) : null,
    })),
  };
};

const isAdminUser = (user: UserContext): boolean => {
  return (
    user.roleSlug === 'admin' ||
    user.roleSlug === 'super-admin' ||
    user.permissions.includes('quotes.read') ||
    user.permissions.includes('quotes.approve')
  );
};

export const listQuotes = async (query: ListQuotesQuery, user: UserContext) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: Prisma.QuoteWhereInput = {};

  // Admin gets all quotes, B2B Customer gets own quotes
  if (!isAdminUser(user)) {
    where.userId = user.id;
  } else if (query.userId) {
    where.userId = query.userId;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.search) {
    where.OR = [{ quoteNumber: { contains: query.search, mode: 'insensitive' } }];
  }

  const [totalItems, quotes] = await Promise.all([
    prisma.quote.count({ where }),
    prisma.quote.findMany({
      where,
      select: quoteSelect,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  const formattedQuotes = quotes.map(formatQuote);
  const pagination = buildPagination(page, limit, totalItems);

  return { data: formattedQuotes, pagination };
};

export const createQuote = async (userId: string, input: CreateQuoteInput) => {
  const quoteNumber = `QT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')}`;

  // Fetch product/variant details to validate existence and compute initial prices
  let subtotal = 0;
  const itemsToCreate = [];

  for (const itemInput of input.items) {
    let product: any = await prisma.product.findUnique({
      where: { id: itemInput.productId },
      include: { variants: true },
    });

    let targetProductId = itemInput.productId;
    let targetVariantId: string | null = itemInput.variantId || null;
    let unitPrice = product ? Number(product.price) : 0;

    if (itemInput.variantId) {
      let variant = product?.variants?.find((v: any) => v.id === itemInput.variantId);

      if (!variant) {
        // Search globally across productVariant table in case variantId belongs to another product
        const globalVariant = await prisma.productVariant.findUnique({
          where: { id: itemInput.variantId },
          include: { product: true },
        });

        if (globalVariant) {
          variant = globalVariant;
          targetProductId = globalVariant.productId;
          product = globalVariant.product;
          unitPrice = Number(globalVariant.price);
        } else if (product) {
          // If variantId was invalid or not found, fallback to base product
          targetVariantId = null;
          unitPrice = Number(product.price);
        } else {
          throw new AppError('NOT_FOUND', `Variant with ID ${itemInput.variantId} not found`, 404);
        }
      } else {
        unitPrice = Number(variant.price);
      }
    }

    if (!product) {
      throw new AppError('NOT_FOUND', `Product with ID ${itemInput.productId} not found`, 404);
    }

    const priceToUse = itemInput.requestedPrice !== undefined ? itemInput.requestedPrice : unitPrice;
    const itemTotal = priceToUse * itemInput.quantity;
    subtotal += itemTotal;

    itemsToCreate.push({
      productId: targetProductId,
      variantId: targetVariantId,
      quantity: itemInput.quantity,
      requestedPrice: priceToUse,
      total: itemTotal,
    });
  }

  const createdQuote = await prisma.quote.create({
    data: {
      quoteNumber,
      userId,
      status: QuoteStatus.PENDING,
      subtotal,
      grandTotal: subtotal,
      notes: input.notes,
      items: {
        create: itemsToCreate,
      },
    },
    select: quoteSelect,
  });

  return formatQuote(createdQuote);
};

export const getQuoteById = async (id: string, user: UserContext) => {
  const quote = await prisma.quote.findUnique({
    where: { id },
    select: quoteSelect,
  });

  if (!quote) {
    throw new AppError('NOT_FOUND', 'Quote not found', 404);
  }

  if (!isAdminUser(user) && quote.userId !== user.id) {
    throw new AppError('FORBIDDEN', 'Access denied to this quote', 403);
  }

  return formatQuote(quote);
};

export const updateQuoteStatus = async (id: string, input: UpdateQuoteStatusInput, user: UserContext) => {
  const quote = await prisma.quote.findUnique({
    where: { id },
    select: { id: true, status: true, quoteNumber: true },
  });

  if (!quote) {
    throw new AppError('NOT_FOUND', 'Quote not found', 404);
  }

  const currentStatus = quote.status;
  const targetStatus = input.status;

  if (currentStatus === targetStatus) {
    return getQuoteById(id, user);
  }

  // Guard invalid transitions:
  // Cannot approve or modify an already REJECTED, EXPIRED, or CONVERTED quote
  if (currentStatus === QuoteStatus.REJECTED && targetStatus === QuoteStatus.APPROVED) {
    throw new AppError(
      'BAD_REQUEST',
      'Cannot approve a quote that has already been REJECTED',
      400
    );
  }

  if (currentStatus === QuoteStatus.EXPIRED && targetStatus === QuoteStatus.APPROVED) {
    throw new AppError(
      'BAD_REQUEST',
      'Cannot approve a quote that has already EXPIRED',
      400
    );
  }

  if (currentStatus === QuoteStatus.CONVERTED) {
    throw new AppError(
      'BAD_REQUEST',
      'Cannot change status of a quote that has already been CONVERTED to an order',
      400
    );
  }

  if (targetStatus === QuoteStatus.CONVERTED) {
    throw new AppError(
      'BAD_REQUEST',
      'Use the /convert endpoint to convert an APPROVED quote into an order',
      400
    );
  }

  const updatedQuote = await prisma.quote.update({
    where: { id },
    data: {
      status: targetStatus,
      ...(input.adminNotes && { adminNotes: input.adminNotes }),
    },
    select: quoteSelect,
  });

  return formatQuote(updatedQuote);
};

export const convertQuoteToOrder = async (quoteId: string, user: UserContext, input: ConvertQuoteInput) => {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: quoteSelect,
  });

  if (!quote) {
    throw new AppError('NOT_FOUND', 'Quote not found', 404);
  }

  // Guard: Allowed ONLY if status is APPROVED
  if (quote.status !== QuoteStatus.APPROVED) {
    throw new AppError(
      'BAD_REQUEST',
      `Only APPROVED quotes can be converted to an order. Current status: ${quote.status}`,
      400
    );
  }

  if (quote.convertedOrderId) {
    throw new AppError('BAD_REQUEST', 'Quote has already been converted to an order', 400);
  }

  const orderNumber = `ORD-QT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')}`;

  const subtotal = quote.subtotal !== null ? Number(quote.subtotal) : 0;
  const discountTotal = quote.discountTotal !== null ? Number(quote.discountTotal) : 0;
  const taxTotal = quote.taxTotal !== null ? Number(quote.taxTotal) : 0;
  const grandTotal = quote.grandTotal !== null ? Number(quote.grandTotal) : Math.max(0, subtotal - discountTotal + taxTotal);

  const order = await prisma.$transaction(async (tx) => {
    // 1. Create order
    const createdOrder = await tx.order.create({
      data: {
        orderNumber,
        userId: quote.userId,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: input.paymentMethod || PaymentMethod.BANK_TRANSFER,
        subtotal,
        discountTotal,
        taxTotal,
        grandTotal,
        shippingAddressId: input.shippingAddressId || null,
        billingAddressId: input.billingAddressId || null,
        notes: input.notes || quote.notes || `Converted from quote ${quote.quoteNumber}`,
      },
    });

    // 2. Create order items from quote items
    for (const item of quote.items) {
      const itemPrice = item.offeredPrice !== null ? Number(item.offeredPrice) : (item.requestedPrice !== null ? Number(item.requestedPrice) : Number(item.product.price));
      const itemTotal = item.total !== null ? Number(item.total) : itemPrice * item.quantity;
      const sku = item.variant?.sku || item.product.sku;
      const productName = item.variant ? `${item.product.name} (${item.variant.name || 'Variant'})` : item.product.name;

      await tx.orderItem.create({
        data: {
          orderId: createdOrder.id,
          productId: item.productId,
          variantId: item.variantId || null,
          productName,
          sku,
          price: itemPrice,
          quantity: item.quantity,
          total: itemTotal,
        },
      });

      // Deduct stock
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.quantity } },
        });
      } else {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }
    }

    // 3. Record Order Status History
    await tx.orderStatusHistory.create({
      data: {
        orderId: createdOrder.id,
        status: OrderStatus.PENDING,
        comment: `Order converted from quote ${quote.quoteNumber}`,
        changedBy: user.id,
      },
    });

    // 4. Update Quote status to CONVERTED
    await tx.quote.update({
      where: { id: quoteId },
      data: {
        status: QuoteStatus.CONVERTED,
        convertedOrderId: createdOrder.id,
      },
    });

    return createdOrder;
  });

  return prisma.order.findUnique({
    where: { id: order.id },
    include: { items: true, statusHistory: true, user: true },
  });
};

export const updateQuotePricing = async (id: string, input: UpdateQuotePricingInput, user: UserContext) => {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!quote) {
    throw new AppError('NOT_FOUND', 'Quote not found', 404);
  }

  if (quote.status === QuoteStatus.CONVERTED || quote.status === QuoteStatus.REJECTED) {
    throw new AppError(
      'BAD_REQUEST',
      `Cannot update pricing for quote in ${quote.status} status`,
      400
    );
  }

  await prisma.$transaction(async (tx) => {
    // If item offered prices are provided, update each item
    if (input.items && input.items.length > 0) {
      for (const itemInput of input.items) {
        const existingItem = quote.items.find((i) => i.id === itemInput.id);
        if (existingItem) {
          const itemTotal = itemInput.offeredPrice * existingItem.quantity;
          await tx.quoteItem.update({
            where: { id: itemInput.id },
            data: {
              offeredPrice: itemInput.offeredPrice,
              total: itemTotal,
            },
          });
        }
      }
    }
  });

  // Re-fetch updated items to compute subtotal
  const updatedItems = await prisma.quoteItem.findMany({
    where: { quoteId: id },
  });

  let calculatedSubtotal = 0;
  for (const item of updatedItems) {
    const itemPrice = item.offeredPrice !== null ? Number(item.offeredPrice) : (item.requestedPrice !== null ? Number(item.requestedPrice) : 0);
    calculatedSubtotal += itemPrice * item.quantity;
  }

  const subtotal = input.subtotal !== undefined ? input.subtotal : calculatedSubtotal;
  const discountTotal = input.discountTotal !== undefined ? input.discountTotal : (quote.discountTotal ? Number(quote.discountTotal) : 0);
  const taxTotal = input.taxTotal !== undefined ? input.taxTotal : (quote.taxTotal ? Number(quote.taxTotal) : 0);
  const grandTotal = input.grandTotal !== undefined ? input.grandTotal : Math.max(0, subtotal - discountTotal + taxTotal);

  const updateData: Prisma.QuoteUpdateInput = {
    subtotal,
    discountTotal,
    taxTotal,
    grandTotal,
  };

  if (input.adminNotes !== undefined) updateData.adminNotes = input.adminNotes;
  if (input.notes !== undefined) updateData.notes = input.notes;
  if (input.validUntil !== undefined) updateData.validUntil = input.validUntil ? new Date(input.validUntil) : null;

  const finalQuote = await prisma.quote.update({
    where: { id },
    data: updateData,
    select: quoteSelect,
  });

  return formatQuote(finalQuote);
};

export const updateCustomerQuote = async (id: string, userId: string, input: CreateQuoteInput) => {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!quote) {
    throw new AppError('NOT_FOUND', 'Quote not found', 404);
  }

  if (quote.userId !== userId) {
    throw new AppError('FORBIDDEN', 'You can only update your own quotations', 403);
  }

  if (quote.status !== QuoteStatus.PENDING && quote.status !== QuoteStatus.UNDER_REVIEW) {
    throw new AppError(
      'BAD_REQUEST',
      `Cannot modify quotation in ${quote.status} status. Only PENDING or UNDER_REVIEW quotations can be updated.`,
      400
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.quoteItem.deleteMany({
      where: { quoteId: id },
    });

    let subtotal = 0;
    const itemsToCreate: any[] = [];

    for (const itemInput of input.items) {
      let product: any = await tx.product.findUnique({
        where: { id: itemInput.productId },
        include: { variants: true },
      });

      let targetProductId = itemInput.productId;
      let targetVariantId: string | null = itemInput.variantId || null;
      let unitPrice = product ? Number(product.price) : 0;

      if (itemInput.variantId) {
        let variant = product?.variants?.find((v: any) => v.id === itemInput.variantId);
        if (!variant) {
          const globalVariant = await tx.productVariant.findUnique({
            where: { id: itemInput.variantId },
            include: { product: true },
          });
          if (globalVariant) {
            variant = globalVariant;
            targetProductId = globalVariant.productId;
            product = globalVariant.product;
            unitPrice = Number(globalVariant.price);
          } else if (product) {
            targetVariantId = null;
            unitPrice = Number(product.price);
          }
        } else {
          unitPrice = Number(variant.price);
        }
      }

      if (!product) {
        throw new AppError('NOT_FOUND', `Product with ID ${itemInput.productId} not found`, 404);
      }

      const priceToUse = itemInput.requestedPrice !== undefined ? itemInput.requestedPrice : unitPrice;
      const itemTotal = priceToUse * itemInput.quantity;
      subtotal += itemTotal;

      itemsToCreate.push({
        quoteId: id,
        productId: targetProductId,
        variantId: targetVariantId,
        quantity: itemInput.quantity,
        requestedPrice: priceToUse,
        total: itemTotal,
      });
    }

    await tx.quoteItem.createMany({
      data: itemsToCreate,
    });

    const updatedQuote = await tx.quote.update({
      where: { id },
      data: {
        subtotal,
        grandTotal: subtotal,
        notes: input.notes !== undefined ? input.notes : quote.notes,
      },
      select: quoteSelect,
    });

    return formatQuote(updatedQuote);
  });
};

