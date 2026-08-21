import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { buildPagination, getPaginationParams } from '../../utils/response';
import { sendB2BCustomerWelcomeEmail } from '../../utils/email.utils';
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
  status: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  userRoles: { select: { role: { select: { id: true, name: true, slug: true } } } },
} as const;

// ─── List Users ───────────────────────────────────────────────────────────────

export const listUsers = async (query: ListUsersQuery) => {
  const { page, limit, skip } = getPaginationParams(query);

  const where: Record<string, unknown> = { deletedAt: null };

  if (query.search) {
    where.OR = [
      { firstName: { contains: query.search, mode: 'insensitive' } },
      { lastName: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { companyName: { contains: query.search, mode: 'insensitive' } },
      { gstin: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.status) where.status = query.status;
  if (query.role) {
    where.userRoles = { some: { role: { slug: query.role } } };
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
    role: u.userRoles[0]?.role ?? null,
    status: u.status,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
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
      addresses: true,
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
    addresses: user.addresses,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
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
    status: updated!.status,
  };
};

// ─── Delete User (Permanent from Database) ───────────────────────────────────

export const deleteUser = async (id: string) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

  await prisma.$transaction(
    async (tx) => {
      // 1. Delete authentication tokens & security sessions
      await tx.refreshToken.deleteMany({ where: { userId: id } }).catch(() => {});
      await tx.emailVerification.deleteMany({ where: { userId: id } }).catch(() => {});
      await tx.passwordReset.deleteMany({ where: { userId: id } }).catch(() => {});
      await tx.userActivityLog.deleteMany({ where: { userId: id } }).catch(() => {});
      await tx.userRole.deleteMany({ where: { userId: id } }).catch(() => {});
      await tx.staffAvailability.deleteMany({ where: { staffUserId: id } }).catch(() => {});
      await tx.b2BCustomerPrice.deleteMany({ where: { userId: id } }).catch(() => {});
      await tx.savedAddress.deleteMany({ where: { customerId: id } }).catch(() => {});
      await tx.notification.deleteMany({ where: { userId: id } }).catch(() => {});
      await tx.couponUsage.deleteMany({ where: { userId: id } }).catch(() => {});
      await tx.review.deleteMany({ where: { userId: id } }).catch(() => {});
      await tx.ventureUser.deleteMany({ where: { userId: id } }).catch(() => {});

      // 2. Clear Cart & Wishlist with their child items
      const userCart = await tx.cart.findUnique({ where: { userId: id }, select: { id: true } });
      if (userCart) {
        await tx.cartItem.deleteMany({ where: { cartId: userCart.id } }).catch(() => {});
        await tx.cart.delete({ where: { id: userCart.id } }).catch(() => {});
      }

      const userWishlist = await tx.wishlist.findUnique({ where: { userId: id }, select: { id: true } });
      if (userWishlist) {
        await tx.wishlistItem.deleteMany({ where: { wishlistId: userWishlist.id } }).catch(() => {});
        await tx.wishlist.delete({ where: { id: userWishlist.id } }).catch(() => {});
      }

      // 3. Delete user addresses
      await tx.address.deleteMany({ where: { userId: id } }).catch(() => {});

      // 4. Nullify foreign key references on historical/auditing records
      await tx.auditLog.updateMany({ where: { userId: id }, data: { userId: null } }).catch(() => {});
      await tx.quoteActivityLog.updateMany({ where: { changedBy: id }, data: { changedBy: null } }).catch(() => {});
      await tx.quotationRevision.updateMany({ where: { changedById: id }, data: { changedById: null } }).catch(() => {});
      await tx.blogPost.updateMany({ where: { authorId: id }, data: { authorId: null } }).catch(() => {});
      await tx.invoice.updateMany({ where: { customerId: id }, data: { customerId: null } }).catch(() => {});
      await tx.enquiry.updateMany({ where: { userId: id }, data: { userId: null } }).catch(() => {});
      await tx.quote.updateMany({ where: { userId: id }, data: { userId: null } }).catch(() => {});
      await tx.appointment.updateMany({ where: { customerUserId: id }, data: { customerUserId: null } }).catch(() => {});
      await tx.appointment.updateMany({ where: { staffUserId: id }, data: { staffUserId: null } }).catch(() => {});

      // 5. Handle any orders placed by this user
      const userOrders = await tx.order.findMany({ where: { userId: id }, select: { id: true } });
      const orderIds = userOrders.map((o) => o.id);
      if (orderIds.length > 0) {
        await tx.shipment.deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {});
        await tx.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {});
        await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {});
        await tx.payment.deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {});
        await tx.order.deleteMany({ where: { userId: id } }).catch(() => {});
      }

      // 6. Delete user record permanently
      await tx.user.delete({ where: { id } });
    },
    {
      maxWait: 15000,
      timeout: 45000,
    }
  );

  return { success: true, message: `User ${user.email} permanently deleted from database.` };
};

// ─── Update Profile ───────────────────────────────────────────────────────────

export const updateProfile = async (userId: string, input: UpdateProfileInput) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: input,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      companyName: true,
      gstin: true,
    },
  });
  return user;
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
