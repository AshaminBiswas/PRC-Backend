import prisma from '../../../config/database';
import { AppError } from '../../../middleware/error.middleware';
import { buildPagination, getPaginationParams } from '../../../utils/response';
import { generateDocNumber } from '../shared/inventory.helpers';
import { recordStockMovement } from '../movement/movement.service';
import { TransferStatus, StockMovementType } from '@prisma/client';
import type { CreateStockTransferInput } from './transfers.schema';

export const listTransfers = async (ventureId: string, query: any) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: any = { ventureId };

  if (query.status) where.status = query.status;

  const [transfers, totalItems] = await Promise.all([
    prisma.stockTransfer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        fromWarehouse: { select: { id: true, name: true, code: true } },
        toWarehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            inventoryProduct: { include: { product: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.stockTransfer.count({ where }),
  ]);

  return { data: transfers, pagination: buildPagination(page, limit, totalItems) };
};

export const getTransferById = async (id: string) => {
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id },
    include: {
      fromWarehouse: true,
      toWarehouse: true,
      fromVentureRef: { select: { id: true, name: true } },
      toVentureRef: { select: { id: true, name: true } },
      items: { include: { inventoryProduct: { include: { product: true } } } },
    },
  });

  if (!transfer) throw new AppError('NOT_FOUND', 'Stock transfer not found', 404);
  return transfer;
};

export const createTransfer = async (ventureId: string, input: CreateStockTransferInput, userId: string) => {
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new AppError('BAD_REQUEST', 'Source and destination warehouses cannot be the same', 400);
  }

  const transferNumber = generateDocNumber('TRF');

  return prisma.stockTransfer.create({
    data: {
      ventureId,
      fromWarehouseId: input.fromWarehouseId,
      toWarehouseId: input.toWarehouseId,
      fromVentureId: input.fromVentureId || ventureId,
      toVentureId: input.toVentureId || ventureId,
      transferType: input.transferType,
      transferNumber,
      status: TransferStatus.REQUESTED,
      requestedBy: userId,
      notes: input.notes,
      items: {
        create: input.items.map((item) => ({
          inventoryProductId: item.inventoryProductId,
          requestedQty: item.requestedQty,
          notes: item.notes,
        })),
      },
    },
    include: { items: true },
  });
};

export const updateTransferStatus = async (
  id: string,
  newStatus: TransferStatus,
  userId: string,
  notes?: string
) => {
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!transfer) throw new AppError('NOT_FOUND', 'Stock transfer not found', 404);

  // Workflow logic
  if (newStatus === TransferStatus.COMPLETED && transfer.status === TransferStatus.IN_TRANSIT) {
    // Process stock movement: deduct from source WH, add to target WH
    return prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        const qty = item.dispatchedQty || item.requestedQty;

        // Deduct from source warehouse
        await recordStockMovement(
          {
            ventureId: transfer.ventureId,
            inventoryProductId: item.inventoryProductId,
            warehouseId: transfer.fromWarehouseId,
            qtyChanged: -qty,
            movementType: StockMovementType.TRANSFER_OUT,
            channel: 'SYSTEM',
            referenceType: 'TRANSFER',
            referenceId: transfer.id,
            createdBy: userId,
            reason: `Transfer to ${transfer.toWarehouseId}`,
          },
          tx
        );

        // Add to destination warehouse
        await recordStockMovement(
          {
            ventureId: transfer.toVentureId || transfer.ventureId,
            inventoryProductId: item.inventoryProductId,
            warehouseId: transfer.toWarehouseId,
            qtyChanged: qty,
            movementType: StockMovementType.TRANSFER_IN,
            channel: 'SYSTEM',
            referenceType: 'TRANSFER',
            referenceId: transfer.id,
            createdBy: userId,
            reason: `Transfer from ${transfer.fromWarehouseId}`,
          },
          tx
        );
      }

      return tx.stockTransfer.update({
        where: { id },
        data: {
          status: TransferStatus.COMPLETED,
          receivedBy: userId,
          receivedAt: new Date(),
          notes: notes || transfer.notes,
        },
      });
    });
  }

  const updateData: any = { status: newStatus };
  if (notes) updateData.notes = notes;
  if (newStatus === TransferStatus.IN_TRANSIT) {
    updateData.dispatchedBy = userId;
    updateData.dispatchedAt = new Date();
  }

  return prisma.stockTransfer.update({
    where: { id },
    data: updateData,
  });
};
