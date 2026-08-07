import prisma from '../../../config/database';
import { AppError } from '../../../middleware/error.middleware';
import { buildPagination, getPaginationParams } from '../../../utils/response';
import type { CreateSupplierInput, UpdateSupplierInput } from './suppliers.schema';

export const listSuppliers = async (ventureId: string, query: any) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: any = { deletedAt: null };

  if (ventureId) where.ventureId = ventureId;

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { code: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.status) where.status = query.status;

  const [suppliers, totalItems] = await Promise.all([
    prisma.supplier.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { purchaseOrders: true } },
      },
    }),
    prisma.supplier.count({ where }),
  ]);

  return { data: suppliers, pagination: buildPagination(page, limit, totalItems) };
};

export const getSupplierById = async (id: string) => {
  const supplier = await prisma.supplier.findUnique({
    where: { id, deletedAt: null },
    include: {
      _count: { select: { purchaseOrders: true, purchaseReturns: true, purchasePayments: true } },
    },
  });

  if (!supplier) throw new AppError('NOT_FOUND', 'Supplier not found', 404);
  return supplier;
};

export const createSupplier = async (ventureId: string, input: CreateSupplierInput) => {
  const existingCode = await prisma.supplier.findUnique({ where: { code: input.code } });
  if (existingCode) throw new AppError('CONFLICT', 'Supplier code already exists', 409);

  return prisma.supplier.create({
    data: {
      ...input,
      ventureId,
      code: input.code.toUpperCase(),
    },
  });
};

export const updateSupplier = async (id: string, input: UpdateSupplierInput) => {
  const supplier = await prisma.supplier.findUnique({ where: { id, deletedAt: null } });
  if (!supplier) throw new AppError('NOT_FOUND', 'Supplier not found', 404);

  return prisma.supplier.update({
    where: { id },
    data: input,
  });
};

export const deleteSupplier = async (id: string) => {
  const supplier = await prisma.supplier.findUnique({ where: { id, deletedAt: null } });
  if (!supplier) throw new AppError('NOT_FOUND', 'Supplier not found', 404);

  await prisma.supplier.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};

export const getSupplierLedger = async (supplierId: string, query: any) => {
  const { page, limit, skip } = getPaginationParams(query);

  const [ledgers, totalItems] = await Promise.all([
    prisma.supplierLedger.findMany({
      where: { supplierId },
      skip,
      take: limit,
      orderBy: { entryDate: 'desc' },
    }),
    prisma.supplierLedger.count({ where: { supplierId } }),
  ]);

  return { data: ledgers, pagination: buildPagination(page, limit, totalItems) };
};

export const getSupplierPurchaseHistory = async (supplierId: string, query: any) => {
  const { page, limit, skip } = getPaginationParams(query);

  const [orders, totalItems] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { supplierId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { inventoryProduct: { include: { product: true } } } } },
    }),
    prisma.purchaseOrder.count({ where: { supplierId } }),
  ]);

  return { data: orders, pagination: buildPagination(page, limit, totalItems) };
};

export const getSupplierPaymentHistory = async (supplierId: string, query: any) => {
  const { page, limit, skip } = getPaginationParams(query);

  const [payments, totalItems] = await Promise.all([
    prisma.purchasePayment.findMany({
      where: { supplierId },
      skip,
      take: limit,
      orderBy: { paidAt: 'desc' },
    }),
    prisma.purchasePayment.count({ where: { supplierId } }),
  ]);

  return { data: payments, pagination: buildPagination(page, limit, totalItems) };
};

export const getSupplierOutstanding = async (supplierId: string) => {
  const latestLedger = await prisma.supplierLedger.findFirst({
    where: { supplierId },
    orderBy: { createdAt: 'desc' },
  });

  return {
    supplierId,
    outstandingBalance: latestLedger ? Number(latestLedger.balance) : 0,
    lastEntryDate: latestLedger?.entryDate || null,
  };
};
