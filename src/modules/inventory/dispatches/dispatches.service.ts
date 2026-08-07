import prisma from '../../../config/database';
import { AppError } from '../../../middleware/error.middleware';
import { buildPagination, getPaginationParams } from '../../../utils/response';
import { generateDocNumber } from '../shared/inventory.helpers';
import { DispatchStatus } from '@prisma/client';
import type { CreateDispatchInput, UpdateDispatchStatusInput } from './dispatches.schema';

export const listDispatches = async (ventureId: string, query: any) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: any = { ventureId };

  if (query.status) where.status = query.status;
  if (query.warehouseId) where.warehouseId = query.warehouseId;
  if (query.search) {
    where.OR = [
      { dispatchNumber: { contains: query.search, mode: 'insensitive' } },
      { trackingNumber: { contains: query.search, mode: 'insensitive' } },
      { courierName: { contains: query.search, mode: 'insensitive' } },
      { driverName: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [dispatches, totalItems] = await Promise.all([
    prisma.dispatch.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        items: { include: { inventoryProduct: { include: { product: { select: { name: true } } } } } },
      },
    }),
    prisma.dispatch.count({ where }),
  ]);

  return { data: dispatches, pagination: buildPagination(page, limit, totalItems) };
};

export const getDispatchById = async (id: string) => {
  const dispatch = await prisma.dispatch.findUnique({
    where: { id },
    include: {
      warehouse: true,
      items: { include: { inventoryProduct: { include: { product: true } } } },
    },
  });

  if (!dispatch) throw new AppError('NOT_FOUND', 'Dispatch order not found', 404);
  return dispatch;
};

export const createDispatch = async (ventureId: string, input: CreateDispatchInput, userId: string) => {
  const dispatchNumber = generateDocNumber('DSP');

  return prisma.dispatch.create({
    data: {
      ventureId,
      orderId: input.orderId,
      posSaleId: input.posSaleId,
      warehouseId: input.warehouseId,
      dispatchNumber,
      status: DispatchStatus.PENDING,
      courierName: input.courierName,
      courierCode: input.courierCode,
      trackingNumber: input.trackingNumber,
      vehicleNumber: input.vehicleNumber,
      vehicleType: input.vehicleType,
      driverName: input.driverName,
      driverPhone: input.driverPhone,
      notes: input.notes,
      createdBy: userId,
      items: {
        create: input.items.map((item) => ({
          inventoryProductId: item.inventoryProductId,
          orderedQty: item.orderedQty,
          dispatchedQty: item.dispatchedQty,
        })),
      },
    },
    include: { items: true },
  });
};

export const updateDispatchStatus = async (id: string, input: UpdateDispatchStatusInput) => {
  const dispatch = await prisma.dispatch.findUnique({ where: { id } });
  if (!dispatch) throw new AppError('NOT_FOUND', 'Dispatch order not found', 404);

  const updateData: any = {
    status: input.status,
    ...(input.courierName && { courierName: input.courierName }),
    ...(input.trackingNumber && { trackingNumber: input.trackingNumber }),
    ...(input.vehicleNumber && { vehicleNumber: input.vehicleNumber }),
    ...(input.driverName && { driverName: input.driverName }),
    ...(input.driverPhone && { driverPhone: input.driverPhone }),
    ...(input.notes && { notes: input.notes }),
  };

  if (input.status === DispatchStatus.PACKED) updateData.packedAt = new Date();
  if (input.status === DispatchStatus.SHIPPED) updateData.shippedAt = new Date();
  if (input.status === DispatchStatus.DELIVERED) updateData.deliveredAt = new Date();
  if (input.status === DispatchStatus.CANCELLED) updateData.cancelledAt = new Date();

  return prisma.dispatch.update({
    where: { id },
    data: updateData,
  });
};

export const getDispatchTimeline = async (id: string) => {
  const dispatch = await getDispatchById(id);

  return {
    dispatchId: dispatch.id,
    dispatchNumber: dispatch.dispatchNumber,
    currentStatus: dispatch.status,
    timeline: [
      { status: 'CREATED', timestamp: dispatch.createdAt },
      { status: 'PACKED', timestamp: dispatch.packedAt },
      { status: 'SHIPPED', timestamp: dispatch.shippedAt },
      { status: 'DELIVERED', timestamp: dispatch.deliveredAt },
      { status: 'CANCELLED', timestamp: dispatch.cancelledAt },
    ].filter((t) => t.timestamp !== null),
  };
};
