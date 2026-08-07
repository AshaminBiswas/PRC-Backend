import prisma from '../../../config/database';
import { AppError } from '../../../middleware/error.middleware';
import { buildPagination, getPaginationParams } from '../../../utils/response';
import type { CreateWarehouseInput, UpdateWarehouseInput } from './warehouses.schema';

export const listWarehouses = async (ventureId: string, query: { page?: number; limit?: number; search?: string; status?: string }) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: any = { deletedAt: null };

  if (ventureId) where.ventureId = ventureId;

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { code: { contains: query.search, mode: 'insensitive' } },
      { city: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.status) where.status = query.status;

  const [warehouses, totalItems] = await Promise.all([
    prisma.warehouse.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
      include: {
        venture: { select: { id: true, name: true, code: true } },
        _count: { select: { stocks: true, posStores: true } },
      },
    }),
    prisma.warehouse.count({ where }),
  ]);

  return { data: warehouses, pagination: buildPagination(page, limit, totalItems) };
};

export const getWarehouseById = async (id: string) => {
  const warehouse = await prisma.warehouse.findUnique({
    where: { id, deletedAt: null },
    include: {
      venture: true,
      _count: { select: { stocks: true, dispatches: true, posStores: true } },
    },
  });

  if (!warehouse) throw new AppError('NOT_FOUND', 'Warehouse not found', 404);
  return warehouse;
};

export const createWarehouse = async (ventureId: string, input: CreateWarehouseInput) => {
  const existingCode = await prisma.warehouse.findUnique({ where: { code: input.code } });
  if (existingCode) throw new AppError('CONFLICT', 'Warehouse code already exists', 409);

  return prisma.warehouse.create({
    data: {
      ...input,
      ventureId,
      code: input.code.toUpperCase(),
    },
  });
};

export const updateWarehouse = async (id: string, input: UpdateWarehouseInput) => {
  const warehouse = await prisma.warehouse.findUnique({ where: { id, deletedAt: null } });
  if (!warehouse) throw new AppError('NOT_FOUND', 'Warehouse not found', 404);

  return prisma.warehouse.update({
    where: { id },
    data: input,
  });
};

export const deleteWarehouse = async (id: string) => {
  const warehouse = await prisma.warehouse.findUnique({ where: { id, deletedAt: null } });
  if (!warehouse) throw new AppError('NOT_FOUND', 'Warehouse not found', 404);

  await prisma.warehouse.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};

export const getWarehouseProducts = async (warehouseId: string, query: { page?: number; limit?: number; search?: string }) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: any = { warehouseId, quantity: { gt: 0 } };

  if (query.search) {
    where.inventoryProduct = {
      OR: [
        { sku: { contains: query.search, mode: 'insensitive' } },
        { product: { name: { contains: query.search, mode: 'insensitive' } } },
      ],
    };
  }

  const [stocks, totalItems] = await Promise.all([
    prisma.inventoryStock.findMany({
      where,
      skip,
      take: limit,
      include: {
        inventoryProduct: {
          include: {
            product: { select: { id: true, name: true, slug: true, thumbnail: true } },
          },
        },
      },
    }),
    prisma.inventoryStock.count({ where }),
  ]);

  return { data: stocks, pagination: buildPagination(page, limit, totalItems) };
};
