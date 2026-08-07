import prisma from '../../../config/database';
import { buildPagination, getPaginationParams } from '../../../utils/response';

export const getActivityLogs = async (ventureId: string, query: any) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: any = { ventureId };
  if (query.module) where.module = query.module;

  const [logs, totalItems] = await Promise.all([
    prisma.inventoryActivityLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.inventoryActivityLog.count({ where }),
  ]);

  return { data: logs, pagination: buildPagination(page, limit, totalItems) };
};

export const getStockActivityLogs = async (ventureId: string, query: any) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: any = { ventureId };

  if (query.movementType) where.movementType = query.movementType;

  const [movements, totalItems] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        inventoryProduct: { include: { product: { select: { name: true } } } },
        warehouse: { select: { name: true, code: true } },
      },
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return { data: movements, pagination: buildPagination(page, limit, totalItems) };
};

export const getAdjustmentHistory = async (ventureId: string, query: any) => {
  return getStockActivityLogs(ventureId, { ...query, movementType: 'ADJUSTMENT' });
};

export const getTransferHistory = async (ventureId: string, query: any) => {
  const { page, limit, skip } = getPaginationParams(query);

  const [transfers, totalItems] = await Promise.all([
    prisma.stockTransfer.findMany({
      where: { ventureId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { fromWarehouse: true, toWarehouse: true, items: true },
    }),
    prisma.stockTransfer.count({ where: { ventureId } }),
  ]);

  return { data: transfers, pagination: buildPagination(page, limit, totalItems) };
};
