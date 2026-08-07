import prisma from '../../../config/database';
import { AppError } from '../../../middleware/error.middleware';
import { generateUniqueSlug } from '../../../utils/slug.utils';
import { buildPagination, getPaginationParams } from '../../../utils/response';
import type { CreateVentureInput, UpdateVentureInput, AddUserToVentureInput } from './ventures.schema';

export const listVentures = async (query: { page?: number; limit?: number; search?: string; status?: string }, userId: string, roleSlug: string) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: any = { deletedAt: null };

  if (roleSlug !== 'super-admin') {
    where.ventureUsers = { some: { userId } };
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { code: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.status) where.status = query.status;

  const [ventures, totalItems] = await Promise.all([
    prisma.venture.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { warehouses: true, inventoryProducts: true, posStores: true } },
      },
    }),
    prisma.venture.count({ where }),
  ]);

  return { data: ventures, pagination: buildPagination(page, limit, totalItems) };
};

export const getVentureById = async (id: string) => {
  const venture = await prisma.venture.findUnique({
    where: { id, deletedAt: null },
    include: {
      warehouses: true,
      ventureUsers: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } }, role: true } },
      _count: { select: { warehouses: true, inventoryProducts: true, posStores: true, suppliers: true } },
    },
  });

  if (!venture) throw new AppError('NOT_FOUND', 'Venture not found', 404);
  return venture;
};

export const createVenture = async (input: CreateVentureInput, creatorId: string) => {
  const existingCode = await prisma.venture.findUnique({ where: { code: input.code } });
  if (existingCode) throw new AppError('CONFLICT', 'Venture code already exists', 409);

  const slug = await generateUniqueSlug(input.name, 'venture');

  return prisma.$transaction(async (tx) => {
    const venture = await tx.venture.create({
      data: {
        name: input.name,
        slug,
        code: input.code.toUpperCase(),
        type: input.type,
        address: input.address,
        gstin: input.gstin,
        pan: input.pan,
        logo: input.logo,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        currency: input.currency,
        timezone: input.timezone,
        financialYearStart: input.financialYearStart,
        status: input.status,
      },
    });

    // Create default warehouse for new venture
    await tx.warehouse.create({
      data: {
        ventureId: venture.id,
        name: `${venture.name} Main Warehouse`,
        code: `${venture.code}-WH01`,
        type: 'MAIN',
        isDefault: true,
      },
    });

    // Associate creator with venture
    await tx.ventureUser.create({
      data: {
        ventureId: venture.id,
        userId: creatorId,
        isDefault: true,
      },
    });

    return venture;
  });
};

export const updateVenture = async (id: string, input: UpdateVentureInput) => {
  const venture = await prisma.venture.findUnique({ where: { id, deletedAt: null } });
  if (!venture) throw new AppError('NOT_FOUND', 'Venture not found', 404);

  return prisma.venture.update({
    where: { id },
    data: input,
  });
};

export const deleteVenture = async (id: string) => {
  const venture = await prisma.venture.findUnique({ where: { id, deletedAt: null } });
  if (!venture) throw new AppError('NOT_FOUND', 'Venture not found', 404);

  await prisma.venture.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};

export const addUserToVenture = async (ventureId: string, input: AddUserToVentureInput) => {
  return prisma.ventureUser.upsert({
    where: { ventureId_userId: { ventureId, userId: input.userId } },
    create: {
      ventureId,
      userId: input.userId,
      roleId: input.roleId,
      isDefault: input.isDefault,
    },
    update: {
      roleId: input.roleId,
      isDefault: input.isDefault,
    },
  });
};

export const removeUserFromVenture = async (ventureId: string, userId: string) => {
  await prisma.ventureUser.delete({
    where: { ventureId_userId: { ventureId, userId } },
  });
};
