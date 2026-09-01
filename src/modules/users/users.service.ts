import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { buildPagination, getPaginationParams } from '../../utils/response';
import { sendB2BCustomerWelcomeEmail } from '../../utils/email.utils';
import { validateGstin, validatePhoneNumber } from '../../utils/validation.utils';
import type {
  ListUsersQuery,
  CreateUserInput,
  UpdateUserInput,
  UpdateProfileInput,
} from './users.schema';

const SALT_ROUNDS = 12;

// ─── User select shape ────────────────────────────────────────────────────────

const userListSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  companyName: true,
  gstin: true,
  b2bAdvancePercentage: true,
  status: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  userRoles: { select: { role: { select: { id: true, name: true, slug: true } } } },
  addresses: {
    select: {
      id: true,
      type: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      postalCode: true,
      country: true,
      phone: true,
      email: true,
      isDefault: true,
    },
  },
  SavedAddress: {
    select: {
      id: true,
      label: true,
      attentionTo: true,
      companyName: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      postalCode: true,
      country: true,
      phone: true,
      email: true,
      isDefaultBilling: true,
      isDefaultDelivery: true,
    },
  },
} as const;

// ─── List Users ───────────────────────────────────────────────────────────────

export const listUsers = async (query: ListUsersQuery) => {
  const { page, limit, skip } = getPaginationParams(query);

  const where: Record<string, unknown> = { deletedAt: null };
  const andConditions: Array<Record<string, unknown>> = [];

  if (query.search) {
    andConditions.push({
      OR: [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
        { companyName: { contains: query.search, mode: 'insensitive' } },
        { gstin: { contains: query.search, mode: 'insensitive' } },
      ],
    });
  }
  if (query.status) where.status = query.status;
  if (query.role) {
    where.userRoles = { some: { role: { slug: query.role } } };
  } else if (query.type === 'b2b' || query.isB2B) {
    andConditions.push(
      {
        OR: [
          {
            AND: [
              { companyName: { not: null } },
              { companyName: { not: '' } },
            ],
          },
          {
            AND: [
              { gstin: { not: null } },
              { gstin: { not: '' } },
            ],
          },
          { userRoles: { some: { role: { slug: { in: ['b2b', 'b2b-customer', 'wholesale', 'enterprise'] } } } } },
        ],
      },
      {
        userRoles: {
          none: {
            role: {
              slug: {
                in: [
                  'super_admin',
                  'super-admin',
                  'admin',
                  'staff',
                  'manager',
                  'accounts',
                  'sales',
                  'support',
                  'operations',
                  'inventory_manager',
                  'inventory-manager',
                  'vendor',
                  'supplier',
                ],
              },
            },
          },
        },
      }
    );
  } else if (query.type === 'customer' || query.excludeStaff) {
    andConditions.push({
      userRoles: {
        none: {
          role: {
            slug: {
              in: [
                'super_admin',
                'super-admin',
                'admin',
                'staff',
                'manager',
                'accounts',
                'sales',
                'support',
                'operations',
                'inventory_manager',
                'inventory-manager',
                'vendor',
                'supplier',
              ],
            },
          },
        },
      },
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  } else if (query.type === 'admin') {
    where.userRoles = {
      some: {
        role: {
          slug: {
            in: [
              'super_admin',
              'super-admin',
              'admin',
              'staff',
              'manager',
              'accounts',
              'sales',
              'support',
              'operations',
              'inventory_manager',
              'inventory-manager',
            ],
          },
        },
      },
    };
  }

  const [users, totalItems] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: userListSelect,
      orderBy: { [query.sortBy]: query.sortOrder },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  const data = users.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    companyName: u.companyName,
    gstin: u.gstin,
    b2bAdvancePercentage: u.b2bAdvancePercentage ? Number(u.b2bAdvancePercentage) : 70.00,
    role: u.userRoles[0]?.role ?? null,
    status: u.status,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    addresses: u.addresses || [],
    SavedAddress: (u as any).SavedAddress || [],
  }));

  return { data, pagination: buildPagination(page, limit, totalItems) };
};

// ─── Get User By ID ───────────────────────────────────────────────────────────

export const getUserById = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id, deletedAt: null },
    include: {
      userRoles: {
        include: {
          role: {
            include: { rolePermissions: { include: { permission: true } } },
          },
        },
      },
      addresses: {
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      },
      SavedAddress: {
        orderBy: [{ isDefaultBilling: 'desc' }, { createdAt: 'desc' }],
      } as any,
    },
  });

  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

  const role = user.userRoles[0]?.role;

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    companyName: user.companyName,
    gstin: user.gstin,
    b2bAdvancePercentage: user.b2bAdvancePercentage ? Number(user.b2bAdvancePercentage) : 70.00,
    avatar: user.avatar,
    role: role
      ? {
          id: role.id,
          name: role.name,
          slug: role.slug,
          permissions: role.rolePermissions.map((rp) => rp.permission.slug),
        }
      : null,
    status: user.status,
    isVerified: user.isVerified,
    addresses: user.addresses || [],
    SavedAddress: (user as any).SavedAddress || [],
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

// ─── Get Customer 360 Full Profile & Dossier ─────────────────────────────────

export const getCustomer360 = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id, deletedAt: null },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
      addresses: {
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      },
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, images: true, thumbnail: true },
              },
            },
          },
          payments: true,
        },
      },
      quotes: {
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true },
              },
            },
          },
        },
      },
      b2bCustomerPrices: {
        include: {
          product: {
            select: { id: true, name: true, sku: true, price: true, thumbnail: true, images: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      },
      activityLogs: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      passwordResets: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!user) throw new AppError('NOT_FOUND', 'Customer account not found', 404);

  // Fetch GST Invoices by customer's userId or order IDs
  const orderIds = user.orders.map((o) => o.id);
  const [invoices, gstInvoices, savedAddresses] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        OR: [
          { customerId: user.id },
          ...(orderIds.length > 0 ? [{ orderId: { in: orderIds } }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }).catch(() => []),
    prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "gst_invoices" WHERE "customer_id" = $1 OR "customer_email" = $2 OR ("customer_gstin" IS NOT NULL AND "customer_gstin" != '' AND "customer_gstin" = $3) ORDER BY "created_at" DESC LIMIT 50`,
      user.id,
      user.email,
      user.gstin || 'NONE'
    ).catch(() => []),
    prisma.savedAddress.findMany({
      where: { customerId: user.id },
      orderBy: { createdAt: 'desc' },
    }).catch(() => []),
  ]);

  // Compute seniority / customer age
  const now = new Date();
  const created = new Date(user.createdAt);
  const diffMs = Math.max(0, now.getTime() - created.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  const years = Math.floor(diffDays / 365);
  const remainingDays = diffDays % 365;
  const months = Math.floor(remainingDays / 30);
  const days = remainingDays % 30;

  let longevityLabel = '';
  if (years > 0) {
    longevityLabel = `${years} Year${years > 1 ? 's' : ''}${months > 0 ? `, ${months} Month${months > 1 ? 's' : ''}` : ''}`;
  } else if (months > 0) {
    longevityLabel = `${months} Month${months > 1 ? 's' : ''}${days > 0 ? `, ${days} Day${days > 1 ? 's' : ''}` : ''}`;
  } else if (diffDays > 0) {
    longevityLabel = `${diffDays} Day${diffDays > 1 ? 's' : ''}`;
  } else {
    longevityLabel = 'Joined Today';
  }

  // Summary KPIs
  const totalOrdersCount = user.orders.length;
  const totalSpend = user.orders
    .filter((o) => o.status !== 'CANCELLED' && o.status !== 'RETURNED')
    .reduce((acc, curr) => acc + Number(curr.grandTotal || 0), 0);
  const totalQuotesCount = user.quotes.length;
  const activeQuotesCount = user.quotes.filter((q) => q.status === 'PENDING' || q.status === 'UNDER_REVIEW').length;
  const customPricesCount = user.b2bCustomerPrices.length;

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      companyName: user.companyName,
      gstin: user.gstin,
      b2bAdvancePercentage: user.b2bAdvancePercentage ? Number(user.b2bAdvancePercentage) : null,
      avatar: user.avatar,
      status: user.status,
      isVerified: user.isVerified,
      mustChangePassword: user.mustChangePassword,
      twoFactorEnabled: user.twoFactorEnabled,
      role: user.userRoles[0]?.role || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      seniority: {
        totalDays: diffDays,
        years,
        months,
        days,
        label: longevityLabel,
      },
    },
    addresses: [
      ...user.addresses.map((a) => ({
        id: a.id,
        type: a.type,
        label: a.label || 'Standard',
        addressLine1: a.addressLine1,
        addressLine2: a.addressLine2,
        city: a.city,
        state: a.state,
        postalCode: a.postalCode,
        country: a.country || 'India',
        phone: a.phone || user.phone,
        email: a.email || user.email,
        altPhone: a.altPhone,
        hasWhatsapp: a.hasWhatsapp,
        latitude: a.latitude,
        longitude: a.longitude,
        isDefault: a.isDefault,
        createdAt: a.createdAt,
      })),
      ...savedAddresses.map((sa) => ({
        id: sa.id,
        type: 'SHIPPING' as const,
        label: sa.label || 'Saved Address',
        addressLine1: sa.addressLine1,
        addressLine2: sa.addressLine2,
        city: sa.city,
        state: sa.state,
        postalCode: sa.postalCode,
        country: sa.country || 'India',
        phone: sa.phone || user.phone,
        email: sa.email || user.email,
        altPhone: null,
        hasWhatsapp: false,
        latitude: null,
        longitude: null,
        isDefault: sa.isDefaultDelivery,
        createdAt: sa.createdAt,
      })),
    ],
    orders: user.orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      totalAmount: Number(o.grandTotal),
      subtotal: Number(o.subtotal),
      taxTotal: Number(o.taxTotal),
      shippingTotal: Number(o.shippingTotal),
      discountTotal: Number(o.discountTotal),
      orderStatus: o.status,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      isB2B: Boolean(user.companyName || user.gstin),
      companyName: user.companyName,
      gstin: user.gstin,
      createdAt: o.createdAt,
      itemsCount: o.items?.length || 0,
      items: o.items.map((it) => ({
        id: it.id,
        productId: it.productId,
        productName: it.productName || it.product?.name,
        sku: it.sku || it.product?.sku,
        price: Number(it.price),
        quantity: it.quantity,
        total: Number(it.total),
        thumbnail: it.product?.thumbnail || it.product?.images?.[0] || null,
      })),
    })),
    quotes: user.quotes.map((q) => ({
      id: q.id,
      quoteNumber: q.quoteNumber,
      referenceNo: q.referenceNo || q.quoteNumber,
      projectName: q.projectName,
      status: q.status,
      grandTotal: Number(q.grandTotal || 0),
      itemsCount: q.items?.length || 0,
      validUntil: q.validUntil,
      digitalSignature: q.digitalSignature,
      signedBy: q.signedBy,
      signedAt: q.signedAt,
      createdAt: q.createdAt,
      items: q.items.map((qi: any) => ({
        id: qi.id,
        productName: qi.productNameSnapshot || qi.product?.name || 'Custom Hardware Line Item',
        sku: qi.product?.sku || 'SKU-CUSTOM',
        quantity: qi.quantity,
        unitPrice: Number(qi.offeredPrice || qi.rate || 0),
        totalPrice: Number(qi.total || qi.amount || 0),
      })),
    })),
    invoices: [
      ...gstInvoices.map((gi: any) => ({
        id: gi.id,
        invoiceNumber: gi.invoice_number,
        invoiceDate: gi.invoice_date || gi.created_at,
        taxableAmount: Number(gi.taxable_amount || 0),
        cgstAmount: Number(gi.cgst_amount || 0),
        sgstAmount: Number(gi.sgst_amount || 0),
        igstAmount: Number(gi.igst_amount || 0),
        grandTotal: Number(gi.grand_total || 0),
        status: gi.status,
        type: 'GST_TAX_INVOICE',
        irn: gi.irn,
        pdfUrl: gi.pdf_url,
        createdAt: gi.created_at,
      })),
      ...invoices.map((inv: any) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.createdAt,
        taxableAmount: Number(inv.subtotal || 0),
        cgstAmount: Number(inv.cgst || 0),
        sgstAmount: Number(inv.sgst || 0),
        igstAmount: Number(inv.igst || 0),
        grandTotal: Number(inv.total || 0),
        status: inv.status || 'ISSUED',
        type: 'INVOICE',
        createdAt: inv.createdAt,
      })),
    ],
    b2bPrices: user.b2bCustomerPrices.map((bp) => ({
      id: bp.id,
      productId: bp.productId,
      productName: bp.product?.name,
      sku: bp.product?.sku,
      standardPrice: Number(bp.product?.price || 0),
      customPrice: Number(bp.price),
      minQuantity: bp.minQuantity,
      discountPercentage:
        Number(bp.product?.price || 0) > 0
          ? Math.round(((Number(bp.product?.price) - Number(bp.price)) / Number(bp.product?.price)) * 100)
          : 0,
      notes: bp.notes,
      updatedAt: bp.updatedAt,
    })),
    activityLogs: user.activityLogs.map((al) => ({
      id: al.id,
      action: al.action,
      description: al.description,
      ipAddress: al.ipAddress,
      userAgent: al.userAgent,
      createdAt: al.createdAt,
    })),
    passwordResets: user.passwordResets.map((pr) => ({
      id: pr.id,
      usedAt: pr.usedAt,
      createdAt: pr.createdAt,
    })),
    summary: {
      totalOrdersCount,
      totalSpend,
      totalQuotesCount,
      activeQuotesCount,
      invoicesCount: gstInvoices.length + invoices.length,
      customPricesCount,
      addressesCount: user.addresses.length + savedAddresses.length,
    },
  };
};

// ─── Create User ──────────────────────────────────────────────────────────────

export const createUser = async (input: CreateUserInput) => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    if (existing.deletedAt === null) {
      throw new AppError('EMAIL_TAKEN', 'Email already in use', 409);
    }
    // User was soft-deleted: purge or anonymize old soft-deleted user to free the unique email constraint
    try {
      await prisma.user.delete({ where: { id: existing.id } });
    } catch (_err) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { email: `deleted_${Date.now()}_${existing.email}` },
      });
    }
  }

  const role = await prisma.role.findUnique({ where: { id: input.roleId } });
  if (!role) throw new AppError('NOT_FOUND', 'Role not found', 404);

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      companyName: input.companyName || null,
      gstin: input.gstin || null,
      status: input.status,
      isVerified: true,
      mustChangePassword: input.mustChangePassword ?? false,
      userRoles: { create: { roleId: input.roleId } },
    },
  });

  if (input.sendWelcomeEmail !== false) {
    sendB2BCustomerWelcomeEmail({
      to: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      companyName: user.companyName || undefined,
      temporaryPassword: input.password,
    }).catch((err) =>
      console.error('[CreateUser] Failed to dispatch welcome email:', err?.message || err)
    );
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    companyName: user.companyName,
    temporaryPassword: input.password,
    mustChangePassword: user.mustChangePassword,
  };
};

// ─── Update User ──────────────────────────────────────────────────────────────

export const updateUser = async (id: string, input: UpdateUserInput) => {
  const user = await prisma.user.findUnique({ where: { id, deletedAt: null } });
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        companyName: input.companyName !== undefined ? (input.companyName || null) : undefined,
        gstin: input.gstin !== undefined ? (input.gstin || null) : undefined,
        b2bAdvancePercentage: input.b2bAdvancePercentage !== undefined ? input.b2bAdvancePercentage : undefined,
        status: input.status,
      },
    });

    if (input.roleId) {
      const role = await tx.role.findUnique({ where: { id: input.roleId } });
      if (!role) throw new AppError('NOT_FOUND', 'Role not found', 404);

      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.create({ data: { userId: id, roleId: input.roleId } });
    }
  });

  const updated = await prisma.user.findUnique({
    where: { id },
    include: { userRoles: { include: { role: true } } },
  });

  return {
    id: updated!.id,
    email: updated!.email,
    firstName: updated!.firstName,
    lastName: updated!.lastName,
    b2bAdvancePercentage: updated!.b2bAdvancePercentage ? Number(updated!.b2bAdvancePercentage) : 70.00,
    status: updated!.status,
  };
};

// ─── Delete User (Permanent from Database) ───────────────────────────────────

export const deleteUser = async (id: string) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

  // ── Step 1: Nullify nullable FK references (SET NULL) ──────────────────────
  // These tables allow null userId, so we unlink before deleting the user.

  await prisma.quote.updateMany({ where: { userId: id }, data: { userId: null } }).catch(() => {});
  await prisma.enquiry.updateMany({ where: { userId: id }, data: { userId: null } }).catch(() => {});
  await prisma.appointment.updateMany({ where: { customerUserId: id }, data: { customerUserId: null } }).catch(() => {});
  await prisma.appointment.updateMany({ where: { staffUserId: id }, data: { staffUserId: null } }).catch(() => {});

  // Audit / log tables — nullable actor fields
  await prisma.$executeRawUnsafe(
    `UPDATE "audit_logs" SET "user_id" = NULL WHERE "user_id" = $1`, id
  ).catch(() => {});
  await prisma.$executeRawUnsafe(
    `UPDATE "quote_activity_logs" SET "changed_by" = NULL WHERE "changed_by" = $1`, id
  ).catch(() => {});
  await prisma.$executeRawUnsafe(
    `UPDATE "quotation_revisions" SET "changed_by_id" = NULL WHERE "changed_by_id" = $1`, id
  ).catch(() => {});
  await prisma.$executeRawUnsafe(
    `UPDATE "blog_posts" SET "author_id" = NULL WHERE "author_id" = $1`, id
  ).catch(() => {});
  await prisma.$executeRawUnsafe(
    `UPDATE "invoices" SET "customer_id" = NULL WHERE "customer_id" = $1`, id
  ).catch(() => {});
  await prisma.$executeRawUnsafe(
    `UPDATE "invoices" SET "created_by" = NULL WHERE "created_by" = $1`, id
  ).catch(() => {});
  await prisma.$executeRawUnsafe(
    `UPDATE "invoices" SET "approved_by" = NULL WHERE "approved_by" = $1`, id
  ).catch(() => {});
  await prisma.$executeRawUnsafe(
    `UPDATE "proforma_invoices" SET "customer_id" = NULL WHERE "customer_id" = $1`, id
  ).catch(() => {});
  await prisma.$executeRawUnsafe(
    `UPDATE "proforma_invoices" SET "created_by" = NULL WHERE "created_by" = $1`, id
  ).catch(() => {});
  await prisma.$executeRawUnsafe(
    `UPDATE "b2b_purchase_orders" SET "customer_id" = NULL WHERE "customer_id" = $1`, id
  ).catch(() => {});
  await prisma.$executeRawUnsafe(
    `UPDATE "b2b_purchase_orders" SET "created_by" = NULL WHERE "created_by" = $1`, id
  ).catch(() => {});
  await prisma.$executeRawUnsafe(
    `UPDATE "po_submission_logs" SET "actor_id" = NULL WHERE "actor_id" = $1`, id
  ).catch(() => {});

  // ── Step 2: Delete owned child records (hard delete, in dependency order) ───

  // Auth tokens & verifications
  await prisma.refreshToken.deleteMany({ where: { userId: id } }).catch(() => {});
  await prisma.emailVerification.deleteMany({ where: { userId: id } }).catch(() => {});
  await prisma.passwordReset.deleteMany({ where: { userId: id } }).catch(() => {});

  // Roles, activity, B2B pricing, staff
  await prisma.userRole.deleteMany({ where: { userId: id } }).catch(() => {});
  await prisma.userActivityLog.deleteMany({ where: { userId: id } }).catch(() => {});
  await prisma.b2BCustomerPrice.deleteMany({ where: { userId: id } }).catch(() => {});
  await prisma.$executeRawUnsafe(
    `DELETE FROM "staff_availabilities" WHERE "staff_user_id" = $1`, id
  ).catch(() => {});

  // Notifications, reviews, coupons, venture memberships
  await prisma.notification.deleteMany({ where: { userId: id } }).catch(() => {});
  await prisma.review.deleteMany({ where: { userId: id } }).catch(() => {});
  await prisma.couponUsage.deleteMany({ where: { userId: id } }).catch(() => {});
  await prisma.$executeRawUnsafe(
    `DELETE FROM "venture_users" WHERE "user_id" = $1`, id
  ).catch(() => {});

  // Cart & wishlist (child items first, then parent)
  await prisma.$executeRawUnsafe(
    `DELETE FROM "cart_items" WHERE "cart_id" IN (SELECT id FROM "carts" WHERE "user_id" = $1)`, id
  ).catch(() => {});
  await prisma.cart.deleteMany({ where: { userId: id } }).catch(() => {});

  await prisma.$executeRawUnsafe(
    `DELETE FROM "wishlist_items" WHERE "wishlist_id" IN (SELECT id FROM "wishlists" WHERE "user_id" = $1)`, id
  ).catch(() => {});
  await prisma.wishlist.deleteMany({ where: { userId: id } }).catch(() => {});

  // Addresses
  await prisma.address.deleteMany({ where: { userId: id } }).catch(() => {});

  // Orders & their children
  await prisma.$executeRawUnsafe(
    `DELETE FROM "order_status_history" WHERE "order_id" IN (SELECT id FROM "orders" WHERE "user_id" = $1)`, id
  ).catch(() => {});
  await prisma.$executeRawUnsafe(
    `DELETE FROM "order_items" WHERE "order_id" IN (SELECT id FROM "orders" WHERE "user_id" = $1)`, id
  ).catch(() => {});
  await prisma.$executeRawUnsafe(
    `DELETE FROM "payments" WHERE "order_id" IN (SELECT id FROM "orders" WHERE "user_id" = $1)`, id
  ).catch(() => {});
  await prisma.$executeRawUnsafe(
    `DELETE FROM "shipments" WHERE "order_id" IN (SELECT id FROM "orders" WHERE "user_id" = $1)`, id
  ).catch(() => {});
  await prisma.order.deleteMany({ where: { userId: id } }).catch(() => {});

  // ── Step 3: Delete the user record itself ───────────────────────────────────
  try {
    await prisma.user.delete({ where: { id } });
  } catch (err: any) {
    // Last resort — if any unknown FK constraint still blocks, surface it clearly
    throw new AppError(
      'DELETE_FAILED',
      `Could not delete user: a related record is still linked. Details: ${err?.message || err}`,
      409
    );
  }

  return { success: true, message: `User ${user.email} permanently deleted.` };
};

// ─── Update Profile ───────────────────────────────────────────────────────────

export const updateProfile = async (userId: string, input: UpdateProfileInput) => {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    include: { userRoles: { include: { role: true } } },
  });
  if (!existingUser) throw new AppError('NOT_FOUND', 'User not found', 404);

  // 1. Phone number validation
  let normalizedPhone: string | undefined;
  if (input.phone) {
    const phoneCheck = validatePhoneNumber(input.phone);
    if (!phoneCheck.isValid) {
      throw new AppError('INVALID_PHONE', phoneCheck.error!, 400);
    }
    normalizedPhone = phoneCheck.normalized;
  }

  const existingRoles = existingUser.userRoles.map((ur) => ur.role.slug);
  const isCurrentlyB2B =
    existingRoles.includes('b2b-customer') ||
    existingRoles.includes('b2b_customer') ||
    Boolean(existingUser.companyName && existingUser.gstin);

  // Prevent B2B customer from downgrading to B2C
  if (isCurrentlyB2B) {
    if (
      (input.companyName !== undefined && !input.companyName?.trim()) ||
      (input.gstin !== undefined && !input.gstin?.trim())
    ) {
      throw new AppError(
        'DOWNGRADE_NOT_ALLOWED',
        'B2B Business accounts cannot be downgraded to B2C Retail accounts. Please contact support if you need assistance.',
        400
      );
    }
    if (input.gstin) {
      const gstCheck = validateGstin(input.gstin);
      if (!gstCheck.isValid) {
        throw new AppError('INVALID_GSTIN', gstCheck.error!, 400);
      }
    }
  }

  // Check if upgrading from B2C to B2B
  const isUpgradingToB2B =
    !isCurrentlyB2B &&
    Boolean(input.companyName?.trim() && input.gstin?.trim());

  let b2bRoleId: string | undefined;
  if (isUpgradingToB2B) {
    const gstCheck = validateGstin(input.gstin!);
    if (!gstCheck.isValid) {
      throw new AppError('INVALID_GSTIN', gstCheck.error!, 400);
    }

    let b2bRole = await prisma.role.findFirst({
      where: { OR: [{ slug: 'b2b-customer' }, { slug: 'b2b_customer' }] },
    });
    if (!b2bRole) {
      b2bRole = await prisma.role.create({
        data: {
          name: 'B2B Customer',
          slug: 'b2b-customer',
          description: 'Business-to-business customer with custom pricing & quote access',
          isSystem: true,
        },
      });
    }
    b2bRoleId = b2bRole.id;
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: userId },
      data: {
        ...(input.firstName !== undefined ? { firstName: input.firstName.trim() } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName.trim() } : {}),
        ...(normalizedPhone !== undefined ? { phone: normalizedPhone } : {}),
        ...(input.companyName !== undefined ? { companyName: input.companyName?.trim() || null } : {}),
        ...(input.gstin !== undefined ? { gstin: input.gstin?.trim()?.toUpperCase() || null } : {}),
      },
      include: {
        userRoles: { include: { role: true } },
      },
    });

    if (isUpgradingToB2B && b2bRoleId) {
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.userRole.create({ data: { userId, roleId: b2bRoleId } });
    }

    return u;
  });

  const primaryRole = isUpgradingToB2B
    ? 'b2b-customer'
    : (updatedUser.userRoles[0]?.role?.slug ?? 'customer');

  return {
    id: updatedUser.id,
    email: updatedUser.email,
    firstName: updatedUser.firstName,
    lastName: updatedUser.lastName,
    phone: updatedUser.phone,
    companyName: updatedUser.companyName,
    gstin: updatedUser.gstin,
    role: primaryRole,
    avatar: updatedUser.avatar,
    isVerified: updatedUser.isVerified,
  };
};

// ─── Update Avatar ────────────────────────────────────────────────────────────

export const updateAvatar = async (userId: string, avatar: string) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatar },
    select: { avatar: true },
  });
  return user;
};

// ─── Activity Log ─────────────────────────────────────────────────────────────

export const getUserActivity = async (
  userId: string,
  query: { page: number; limit: number; startDate?: string; endDate?: string }
) => {
  const { page, limit, skip } = getPaginationParams(query);

  const where: Record<string, unknown> = { userId };
  if (query.startDate || query.endDate) {
    where.createdAt = {
      ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
      ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
    };
  }

  const [logs, totalItems] = await prisma.$transaction([
    prisma.userActivityLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.userActivityLog.count({ where }),
  ]);

  return { data: logs, pagination: buildPagination(page, limit, totalItems) };
};

// ─── Get User Roles ───────────────────────────────────────────────────────────

export const getUserRoles = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    include: { userRoles: { include: { role: { select: { id: true, name: true, slug: true } } } } },
  });
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

  return { userId, roles: user.userRoles.map((ur) => ur.role) };
};

// ─── Update User Roles ────────────────────────────────────────────────────────

export const updateUserRoles = async (userId: string, roleIds: string[]) => {
  const user = await prisma.user.findUnique({ where: { id: userId, deletedAt: null } });
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

  const roles = await prisma.role.findMany({ where: { id: { in: roleIds } } });
  if (roles.length !== roleIds.length) {
    throw new AppError('NOT_FOUND', 'One or more roles not found', 404);
  }

  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId } }),
    prisma.userRole.createMany({
      data: roleIds.map((roleId) => ({ userId, roleId })),
    }),
  ]);
};

// ─── Stub responses ───────────────────────────────────────────────────────────

export const getUserOrders = async (userId: string, query: { page: number; limit: number }) => {
  const { page, limit } = getPaginationParams(query);
  return { data: [], pagination: buildPagination(page, limit, 0) };
};

export const getUserQuotes = async (userId: string, query: { page: number; limit: number }) => {
  const { page, limit } = getPaginationParams(query);
  return { data: [], pagination: buildPagination(page, limit, 0) };
};

export const getUserReviews = async (userId: string, query: { page: number; limit: number }) => {
  const { page, limit } = getPaginationParams(query);
  return { data: [], pagination: buildPagination(page, limit, 0) };
};

// ─── User Addresses CRUD ──────────────────────────────────────────────────────

export const getUserAddresses = async (userId: string) => {
  const addresses = await prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  return addresses.map((addr) => ({
    id: addr.id,
    userId: addr.userId,
    type: addr.type,
    label: addr.label || (addr.type === 'SHIPPING' ? 'Home' : 'Billing'),
    addressLine1: addr.addressLine1,
    line1: addr.addressLine1,
    addressLine2: addr.addressLine2,
    line2: addr.addressLine2,
    city: addr.city,
    state: addr.state,
    postalCode: addr.postalCode,
    pincode: addr.postalCode,
    country: addr.country,
    phone: addr.phone || null,
    email: addr.email || null,
    altPhone: addr.altPhone || null,
    hasWhatsapp: addr.hasWhatsapp || false,
    latitude: addr.latitude || null,
    longitude: addr.longitude || null,
    isDefault: addr.isDefault,
    createdAt: addr.createdAt,
    updatedAt: addr.updatedAt,
  }));
};

export const createAddress = async (userId: string, input: any) => {
  const line1 = input.addressLine1 || input.line1;
  const line2 = input.addressLine2 || input.line2 || null;
  const pincode = input.postalCode || input.pincode;
  const type = input.type === 'BILLING' ? 'BILLING' : 'SHIPPING';
  const label = input.label || 'Home';
  const isDefault = Boolean(input.isDefault);

  if (isDefault) {
    await prisma.address.updateMany({
      where: { userId, type },
      data: { isDefault: false },
    });
  }

  const count = await prisma.address.count({ where: { userId } });
  const shouldBeDefault = isDefault || count === 0;

  const addr = await prisma.address.create({
    data: {
      userId,
      type,
      label,
      addressLine1: line1,
      addressLine2: line2,
      city: input.city,
      state: input.state,
      postalCode: pincode,
      country: input.country || 'India',
      phone: input.phone || null,
      email: input.email || null,
      altPhone: input.altPhone || null,
      hasWhatsapp: Boolean(input.hasWhatsapp),
      latitude: input.latitude !== undefined ? input.latitude : null,
      longitude: input.longitude !== undefined ? input.longitude : null,
      isDefault: shouldBeDefault,
    },
  });

  return {
    id: addr.id,
    userId: addr.userId,
    type: addr.type,
    label: addr.label || label,
    addressLine1: addr.addressLine1,
    line1: addr.addressLine1,
    addressLine2: addr.addressLine2,
    line2: addr.addressLine2,
    city: addr.city,
    state: addr.state,
    postalCode: addr.postalCode,
    pincode: addr.postalCode,
    country: addr.country,
    phone: addr.phone,
    email: addr.email,
    altPhone: addr.altPhone,
    hasWhatsapp: addr.hasWhatsapp,
    latitude: addr.latitude,
    longitude: addr.longitude,
    isDefault: addr.isDefault,
    createdAt: addr.createdAt,
    updatedAt: addr.updatedAt,
  };
};

export const updateAddress = async (userId: string, addressId: string, input: any) => {
  const existing = await prisma.address.findFirst({
    where: { id: addressId, userId },
  });
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Address not found', 404);
  }

  const line1 = input.addressLine1 || input.line1;
  const line2 = input.addressLine2 !== undefined ? input.addressLine2 : input.line2;
  const pincode = input.postalCode || input.pincode;

  if (input.isDefault) {
    await prisma.address.updateMany({
      where: { userId, type: input.type || existing.type },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.address.update({
    where: { id: addressId },
    data: {
      ...(line1 ? { addressLine1: line1 } : {}),
      ...(line2 !== undefined ? { addressLine2: line2 } : {}),
      ...(input.label ? { label: input.label } : {}),
      ...(input.city ? { city: input.city } : {}),
      ...(input.state ? { state: input.state } : {}),
      ...(pincode ? { postalCode: pincode } : {}),
      ...(input.country ? { country: input.country } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(input.email !== undefined ? { email: input.email || null } : {}),
      ...(input.altPhone !== undefined ? { altPhone: input.altPhone || null } : {}),
      ...(input.hasWhatsapp !== undefined ? { hasWhatsapp: Boolean(input.hasWhatsapp) } : {}),
      ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
      ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
    },
  });

  return {
    id: updated.id,
    userId: updated.userId,
    type: updated.type,
    label: updated.label || 'Home',
    addressLine1: updated.addressLine1,
    line1: updated.addressLine1,
    addressLine2: updated.addressLine2,
    line2: updated.addressLine2,
    city: updated.city,
    state: updated.state,
    postalCode: updated.postalCode,
    pincode: updated.postalCode,
    country: updated.country,
    phone: updated.phone,
    email: updated.email,
    altPhone: updated.altPhone,
    hasWhatsapp: updated.hasWhatsapp,
    latitude: updated.latitude,
    longitude: updated.longitude,
    isDefault: updated.isDefault,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
};

export const deleteAddress = async (userId: string, addressId: string) => {
  const existing = await prisma.address.findFirst({
    where: { id: addressId, userId },
  });
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Address not found', 404);
  }

  await prisma.address.delete({ where: { id: addressId } });
  return { success: true, message: 'Address deleted successfully' };
};

