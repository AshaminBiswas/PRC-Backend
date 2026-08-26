import prisma, { readPrisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { buildPagination, getPaginationParams } from '../../utils/response';
import { Prisma, StockMovementType, TransferStatus } from '@prisma/client';
import { eventBus } from '../../events/eventBus';
import type {
  ListBranchesQuery,
  CreateBranchInput,
  UpdateBranchInput,
  ListSuppliersQuery,
  CreateSupplierInput,
  UpdateSupplierInput,
  ListInventoryQuery,
  CreatePurchaseInput,
  ListPurchasesQuery,
  CreateStockTransferInput,
  ListStockTransfersQuery,
  CreateStockAdjustmentInput,
  ListStockMovementsQuery,
} from './inventory.schema';

// ─── Denormalized Product.stock Synchronization Helper ───────────────────────

export const syncProductStock = async (productId: string, tx?: Prisma.TransactionClient): Promise<number> => {
  const db = tx || prisma;
  const aggregates = await db.inventory.aggregate({
    where: { productId },
    _sum: { quantity: true },
  });

  const totalStock = aggregates._sum.quantity || 0;
  await db.product.update({
    where: { id: productId },
    data: { stock: totalStock },
  });

  return totalStock;
};

// ─── 1. Branches Service ─────────────────────────────────────────────────────

export const listBranches = async (query: ListBranchesQuery) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: Prisma.BranchWhereInput = {
    deletedAt: null,
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { code: { contains: query.search, mode: 'insensitive' } },
            { city: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    readPrisma.branch.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: { inventories: true },
        },
      },
    }),
    readPrisma.branch.count({ where }),
  ]);

  return { data, pagination: buildPagination(page, limit, total) };
};

export const getBranchById = async (id: string) => {
  const branch = await readPrisma.branch.findFirst({
    where: { id, deletedAt: null },
    include: {
      _count: {
        select: { inventories: true, purchases: true },
      },
    },
  });

  if (!branch) throw new AppError('NOT_FOUND', 'Branch not found', 404);
  return branch;
};

export const createBranch = async (input: CreateBranchInput) => {
  const existing = await prisma.branch.findUnique({
    where: { code: input.code.toUpperCase() },
  });

  if (existing) {
    if (existing.deletedAt) {
      // Re-activate
      return prisma.branch.update({
        where: { id: existing.id },
        data: { ...input, code: input.code.toUpperCase(), deletedAt: null, isActive: true },
      });
    }
    throw new AppError('CONFLICT', `Branch code '${input.code}' already exists`, 409);
  }

  const branch = await prisma.branch.create({
    data: {
      name: input.name,
      code: input.code.toUpperCase(),
      address: input.address,
      city: input.city,
      state: input.state,
      isActive: input.isActive ?? true,
    },
  });

  // Backfill 0-inventory rows for all active products for the new branch
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, reorderLevel: true },
  });

  if (products.length > 0) {
    await prisma.inventory.createMany({
      data: products.map((p) => ({
        productId: p.id,
        branchId: branch.id,
        quantity: 0,
        reservedQuantity: 0,
        reorderLevel: p.reorderLevel || 10,
      })),
      skipDuplicates: true,
    });
  }

  return branch;
};

export const updateBranch = async (id: string, input: UpdateBranchInput) => {
  await getBranchById(id);

  if (input.code) {
    const existing = await prisma.branch.findFirst({
      where: { code: input.code.toUpperCase(), id: { not: id } },
    });
    if (existing) throw new AppError('CONFLICT', `Branch code '${input.code}' is already used`, 409);
  }

  return prisma.branch.update({
    where: { id },
    data: {
      ...input,
      ...(input.code ? { code: input.code.toUpperCase() } : {}),
    },
  });
};

// ─── 2. Suppliers / Vendors Service ──────────────────────────────────────────

export const listSuppliers = async (query: ListSuppliersQuery) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: Prisma.SupplierWhereInput = {
    deletedAt: null,
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { contactPerson: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search, mode: 'insensitive' } },
            { gstNumber: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    readPrisma.supplier.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { purchases: true },
        },
      },
    }),
    readPrisma.supplier.count({ where }),
  ]);

  return { data, pagination: buildPagination(page, limit, total) };
};

export const getSupplierById = async (id: string) => {
  const supplier = await readPrisma.supplier.findFirst({
    where: { id, deletedAt: null },
    include: {
      purchases: {
        take: 10,
        orderBy: { purchaseDate: 'desc' },
        include: { branch: { select: { id: true, name: true, code: true } } },
      },
    },
  });

  if (!supplier) throw new AppError('NOT_FOUND', 'Supplier not found', 404);
  return supplier;
};

export const createSupplier = async (input: CreateSupplierInput) => {
  return prisma.supplier.create({
    data: {
      name: input.name,
      contactPerson: input.contactPerson,
      phone: input.phone,
      email: input.email || null,
      address: input.address,
      gstNumber: input.gstNumber || null,
      isActive: input.isActive ?? true,
    },
  });
};

export const updateSupplier = async (id: string, input: UpdateSupplierInput) => {
  await getSupplierById(id);
  return prisma.supplier.update({
    where: { id },
    data: {
      ...input,
      ...(input.email !== undefined ? { email: input.email || null } : {}),
      ...(input.gstNumber !== undefined ? { gstNumber: input.gstNumber || null } : {}),
    },
  });
};

export const deleteSupplier = async (id: string) => {
  await getSupplierById(id);
  return prisma.supplier.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
};

// ─── 3. Inventory Stock Service ──────────────────────────────────────────────

export const listInventory = async (query: ListInventoryQuery) => {
  const { page, limit, skip } = getPaginationParams(query);

  const where: Prisma.InventoryWhereInput = {
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.productId ? { productId: query.productId } : {}),
    product: {
      deletedAt: null,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
  };

  const [rawInventory, total] = await Promise.all([
    readPrisma.inventory.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
            salePrice: true,
            thumbnail: true,
            reorderLevel: true,
            status: true,
            category: { select: { id: true, name: true } },
          },
        },
        branch: {
          select: { id: true, name: true, code: true, city: true },
        },
      },
    }),
    readPrisma.inventory.count({ where }),
  ]);

  // Apply in-memory lowStock filter if requested
  const data = query.lowStock
    ? rawInventory.filter((item) => item.quantity <= (item.reorderLevel || item.product.reorderLevel || 10))
    : rawInventory;

  return {
    data,
    pagination: buildPagination(page, limit, query.lowStock ? data.length : total),
  };
};

export const getProductInventory = async (productId: string) => {
  const product = await readPrisma.product.findUnique({
    where: { id: productId, deletedAt: null },
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
      stock: true,
      reorderLevel: true,
      thumbnail: true,
    },
  });

  if (!product) throw new AppError('NOT_FOUND', 'Product not found', 404);

  const branchInventories = await readPrisma.inventory.findMany({
    where: { productId },
    include: {
      branch: { select: { id: true, name: true, code: true, city: true, isActive: true } },
    },
    orderBy: { branch: { code: 'asc' } },
  });

  const totalAvailable = branchInventories.reduce((acc, curr) => acc + curr.quantity, 0);
  const totalReserved = branchInventories.reduce((acc, curr) => acc + curr.reservedQuantity, 0);

  return {
    product,
    totalAvailable,
    totalReserved,
    branches: branchInventories,
  };
};

// ─── 4. Purchases (Stock-In) Service ─────────────────────────────────────────

export const listPurchases = async (query: ListPurchasesQuery) => {
  const { page, limit, skip } = getPaginationParams(query);

  const where: Prisma.PurchaseWhereInput = {
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    ...(query.from || query.to
      ? {
          purchaseDate: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
            { supplier: { name: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    readPrisma.purchase.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [query.sortBy]: query.sortOrder },
      include: {
        supplier: { select: { id: true, name: true, contactPerson: true, phone: true } },
        branch: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, thumbnail: true } },
          },
        },
      },
    }),
    readPrisma.purchase.count({ where }),
  ]);

  return { data, pagination: buildPagination(page, limit, total) };
};

export const getPurchaseById = async (id: string) => {
  const purchase = await readPrisma.purchase.findUnique({
    where: { id },
    include: {
      supplier: true,
      branch: true,
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true, price: true, thumbnail: true } },
        },
      },
    },
  });

  if (!purchase) throw new AppError('NOT_FOUND', 'Purchase record not found', 404);
  return purchase;
};

export const createPurchase = async (input: CreatePurchaseInput, userId: string) => {
  return prisma.$transaction(async (tx) => {
    // 1. Verify branch and supplier
    const [branch, supplier] = await Promise.all([
      tx.branch.findUnique({ where: { id: input.branchId, deletedAt: null } }),
      tx.supplier.findUnique({ where: { id: input.supplierId, deletedAt: null } }),
    ]);

    if (!branch) throw new AppError('BAD_REQUEST', 'Invalid or inactive destination branch', 400);
    if (!supplier) throw new AppError('BAD_REQUEST', 'Invalid or inactive supplier', 400);

    // 2. Calculate total
    let grandTotal = new Prisma.Decimal(0);
    const itemRecords: Array<{
      productId: string;
      quantity: number;
      unitPurchasePrice: Prisma.Decimal;
      totalPrice: Prisma.Decimal;
    }> = [];

    for (const it of input.items) {
      const unitPrice = new Prisma.Decimal(it.unitPurchasePrice);
      const lineTotal = unitPrice.mul(it.quantity);
      grandTotal = grandTotal.add(lineTotal);

      itemRecords.push({
        productId: it.productId,
        quantity: it.quantity,
        unitPurchasePrice: unitPrice,
        totalPrice: lineTotal,
      });
    }

    // 3. Create Purchase entity
    const purchase = await tx.purchase.create({
      data: {
        branchId: input.branchId,
        supplierId: input.supplierId,
        invoiceNumber: input.invoiceNumber || null,
        purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : new Date(),
        totalAmount: grandTotal,
        notes: input.notes || null,
        createdById: userId,
        items: {
          create: itemRecords,
        },
      },
      include: {
        items: { include: { product: true } },
        branch: true,
        supplier: true,
      },
    });

    // 4. Update Inventory + Record Stock Movements atomically
    for (const item of input.items) {
      // Find or create inventory row
      let inv = await tx.inventory.findUnique({
        where: {
          productId_branchId: {
            productId: item.productId,
            branchId: input.branchId,
          },
        },
      });

      const prevQty = inv ? inv.quantity : 0;
      const newQty = prevQty + item.quantity;

      if (!inv) {
        inv = await tx.inventory.create({
          data: {
            productId: item.productId,
            branchId: input.branchId,
            quantity: newQty,
            reservedQuantity: 0,
            reorderLevel: 10,
          },
        });
      } else {
        await tx.inventory.update({
          where: { id: inv.id },
          data: { quantity: newQty },
        });
      }

      // Write immutable stock ledger record
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          branchId: input.branchId,
          type: StockMovementType.PURCHASE_IN,
          quantity: item.quantity,
          previousQty: prevQty,
          newQty,
          referenceType: 'PURCHASE',
          referenceId: purchase.id,
          notes: `Purchased from ${supplier.name}. Inv: ${input.invoiceNumber || 'N/A'}`,
          performedById: userId,
        },
      });

      // Synchronize denormalized product total stock
      await syncProductStock(item.productId, tx);
    }

    return purchase;
  });
};

// ─── 5. Stock Transfers (Branch to Branch) Service ───────────────────────────

export const listStockTransfers = async (query: ListStockTransfersQuery) => {
  const { page, limit, skip } = getPaginationParams(query);

  const where: Prisma.StockTransferWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.branchId
      ? {
          OR: [{ fromBranchId: query.branchId }, { toBranchId: query.branchId }],
        }
      : {}),
    ...(query.fromBranchId ? { fromBranchId: query.fromBranchId } : {}),
    ...(query.toBranchId ? { toBranchId: query.toBranchId } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    readPrisma.stockTransfer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [query.sortBy]: query.sortOrder },
      include: {
        fromBranch: { select: { id: true, name: true, code: true, city: true } },
        toBranch: { select: { id: true, name: true, code: true, city: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, thumbnail: true } },
          },
        },
      },
    }),
    readPrisma.stockTransfer.count({ where }),
  ]);

  return { data, pagination: buildPagination(page, limit, total) };
};

export const getStockTransferById = async (id: string) => {
  const transfer = await readPrisma.stockTransfer.findUnique({
    where: { id },
    include: {
      fromBranch: true,
      toBranch: true,
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true, price: true, thumbnail: true } },
        },
      },
    },
  });

  if (!transfer) throw new AppError('NOT_FOUND', 'Stock transfer not found', 404);
  return transfer;
};

export const createStockTransfer = async (input: CreateStockTransferInput, userId: string) => {
  return prisma.$transaction(async (tx) => {
    // 1. Verify branches
    const [fromBranch, toBranch] = await Promise.all([
      tx.branch.findUnique({ where: { id: input.fromBranchId, deletedAt: null } }),
      tx.branch.findUnique({ where: { id: input.toBranchId, deletedAt: null } }),
    ]);

    if (!fromBranch || !toBranch) throw new AppError('BAD_REQUEST', 'Invalid source or destination branch', 400);

    // 2. Validate sufficient available stock at source branch
    for (const item of input.items) {
      const inv = await tx.inventory.findUnique({
        where: {
          productId_branchId: {
            productId: item.productId,
            branchId: input.fromBranchId,
          },
        },
        include: { product: { select: { name: true, sku: true } } },
      });

      const available = inv ? inv.quantity - inv.reservedQuantity : 0;
      if (available < item.quantity) {
        throw new AppError(
          'INSUFFICIENT_STOCK',
          `Insufficient stock for '${inv?.product?.name || item.productId}' at ${fromBranch.name}. Available: ${available}, Requested: ${item.quantity}`,
          400
        );
      }
    }

    // 3. Create transfer with PENDING status
    const transfer = await tx.stockTransfer.create({
      data: {
        fromBranchId: input.fromBranchId,
        toBranchId: input.toBranchId,
        status: TransferStatus.PENDING,
        requestedById: userId,
        notes: input.notes || null,
        items: {
          create: input.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        },
      },
      include: {
        items: { include: { product: true } },
        fromBranch: true,
        toBranch: true,
      },
    });

    // 4. Reserve quantity at source branch
    for (const item of input.items) {
      await tx.inventory.update({
        where: {
          productId_branchId: {
            productId: item.productId,
            branchId: input.fromBranchId,
          },
        },
        data: {
          reservedQuantity: { increment: item.quantity },
        },
      });
    }

    return transfer;
  });
};

export const dispatchStockTransfer = async (id: string, userId: string, notes?: string) => {
  return prisma.$transaction(async (tx) => {
    const transfer = await tx.stockTransfer.findUnique({
      where: { id },
      include: { items: true, fromBranch: true, toBranch: true },
    });

    if (!transfer) throw new AppError('NOT_FOUND', 'Stock transfer not found', 404);
    if (transfer.status !== TransferStatus.PENDING) {
      throw new AppError('INVALID_STATE', `Cannot dispatch transfer with status '${transfer.status}'. Must be PENDING.`, 400);
    }

    // Decrement source inventory & release reservedQuantity, write TRANSFER_OUT ledger
    for (const item of transfer.items) {
      const inv = await tx.inventory.findUnique({
        where: {
          productId_branchId: {
            productId: item.productId,
            branchId: transfer.fromBranchId,
          },
        },
      });

      if (!inv || inv.quantity < item.quantity) {
        throw new AppError('STOCK_MISMATCH', `Stock mismatch during transfer dispatch for product ID ${item.productId}`, 400);
      }

      const prevQty = inv.quantity;
      const newQty = prevQty - item.quantity;
      const newReserved = Math.max(0, inv.reservedQuantity - item.quantity);

      await tx.inventory.update({
        where: { id: inv.id },
        data: {
          quantity: newQty,
          reservedQuantity: newReserved,
        },
      });

      // Write TRANSFER_OUT ledger entry
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          branchId: transfer.fromBranchId,
          type: StockMovementType.TRANSFER_OUT,
          quantity: item.quantity,
          previousQty: prevQty,
          newQty,
          referenceType: 'TRANSFER',
          referenceId: transfer.id,
          notes: `Dispatched transfer to ${transfer.toBranch.name}. ${notes || ''}`.trim(),
          performedById: userId,
        },
      });

      await syncProductStock(item.productId, tx);
    }

    // Update transfer status
    return tx.stockTransfer.update({
      where: { id },
      data: {
        status: TransferStatus.IN_TRANSIT,
        dispatchedAt: new Date(),
        approvedById: userId,
        ...(notes ? { notes: `${transfer.notes ? transfer.notes + ' | ' : ''}Dispatch: ${notes}` } : {}),
      },
      include: { items: true, fromBranch: true, toBranch: true },
    });
  });
};

export const receiveStockTransfer = async (id: string, userId: string, notes?: string) => {
  return prisma.$transaction(async (tx) => {
    const transfer = await tx.stockTransfer.findUnique({
      where: { id },
      include: { items: true, fromBranch: true, toBranch: true },
    });

    if (!transfer) throw new AppError('NOT_FOUND', 'Stock transfer not found', 404);
    if (transfer.status !== TransferStatus.IN_TRANSIT) {
      throw new AppError('INVALID_STATE', `Cannot receive transfer with status '${transfer.status}'. Must be IN_TRANSIT.`, 400);
    }

    // Increment destination inventory and write TRANSFER_IN ledger
    for (const item of transfer.items) {
      let inv = await tx.inventory.findUnique({
        where: {
          productId_branchId: {
            productId: item.productId,
            branchId: transfer.toBranchId,
          },
        },
      });

      const prevQty = inv ? inv.quantity : 0;
      const newQty = prevQty + item.quantity;

      if (!inv) {
        inv = await tx.inventory.create({
          data: {
            productId: item.productId,
            branchId: transfer.toBranchId,
            quantity: newQty,
            reservedQuantity: 0,
            reorderLevel: 10,
          },
        });
      } else {
        await tx.inventory.update({
          where: { id: inv.id },
          data: { quantity: newQty },
        });
      }

      // Write TRANSFER_IN ledger entry
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          branchId: transfer.toBranchId,
          type: StockMovementType.TRANSFER_IN,
          quantity: item.quantity,
          previousQty: prevQty,
          newQty,
          referenceType: 'TRANSFER',
          referenceId: transfer.id,
          notes: `Received transfer from ${transfer.fromBranch.name}. ${notes || ''}`.trim(),
          performedById: userId,
        },
      });

      await syncProductStock(item.productId, tx);
    }

    // Update transfer status
    return tx.stockTransfer.update({
      where: { id },
      data: {
        status: TransferStatus.RECEIVED,
        receivedAt: new Date(),
        receivedById: userId,
        ...(notes ? { notes: `${transfer.notes ? transfer.notes + ' | ' : ''}Receive: ${notes}` } : {}),
      },
      include: { items: true, fromBranch: true, toBranch: true },
    });
  });
};

export const cancelStockTransfer = async (id: string, userId: string, notes?: string) => {
  return prisma.$transaction(async (tx) => {
    const transfer = await tx.stockTransfer.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!transfer) throw new AppError('NOT_FOUND', 'Stock transfer not found', 404);
    if (transfer.status !== TransferStatus.PENDING) {
      throw new AppError('INVALID_STATE', `Cannot cancel transfer in '${transfer.status}' status. Only PENDING transfers can be cancelled.`, 400);
    }

    // Unreserve items at source branch
    for (const item of transfer.items) {
      await tx.inventory.update({
        where: {
          productId_branchId: {
            productId: item.productId,
            branchId: transfer.fromBranchId,
          },
        },
        data: {
          reservedQuantity: { decrement: item.quantity },
        },
      });
    }

    return tx.stockTransfer.update({
      where: { id },
      data: {
        status: TransferStatus.CANCELLED,
        ...(notes ? { notes: `${transfer.notes ? transfer.notes + ' | ' : ''}Cancelled: ${notes}` } : {}),
      },
      include: { items: true, fromBranch: true, toBranch: true },
    });
  });
};

// ─── 6. Stock Adjustments Service ────────────────────────────────────────────

export const adjustStock = async (input: CreateStockAdjustmentInput, userId: string) => {
  return prisma.$transaction(async (tx) => {
    const [branch, product] = await Promise.all([
      tx.branch.findUnique({ where: { id: input.branchId, deletedAt: null } }),
      tx.product.findUnique({ where: { id: input.productId, deletedAt: null } }),
    ]);

    if (!branch) throw new AppError('NOT_FOUND', 'Branch not found', 404);
    if (!product) throw new AppError('NOT_FOUND', 'Product not found', 404);

    let inv = await tx.inventory.findUnique({
      where: {
        productId_branchId: {
          productId: input.productId,
          branchId: input.branchId,
        },
      },
    });

    const prevQty = inv ? inv.quantity : 0;
    const isDecrement = ['ADJUSTMENT_OUT', 'DAMAGE'].includes(input.type);

    if (isDecrement && prevQty < input.quantity) {
      throw new AppError(
        'INSUFFICIENT_STOCK',
        `Cannot adjust below zero. Current stock at ${branch.name} is ${prevQty}, requested reduction is ${input.quantity}`,
        400
      );
    }

    const newQty = isDecrement ? prevQty - input.quantity : prevQty + input.quantity;

    if (!inv) {
      inv = await tx.inventory.create({
        data: {
          productId: input.productId,
          branchId: input.branchId,
          quantity: newQty,
          reservedQuantity: 0,
          reorderLevel: product.reorderLevel || 10,
        },
      });
    } else {
      await tx.inventory.update({
        where: { id: inv.id },
        data: { quantity: newQty },
      });
    }

    // Write immutable ledger entry
    const movement = await tx.stockMovement.create({
      data: {
        productId: input.productId,
        branchId: input.branchId,
        type: input.type as StockMovementType,
        quantity: input.quantity,
        previousQty: prevQty,
        newQty,
        referenceType: 'ADJUSTMENT',
        notes: input.reason,
        performedById: userId,
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    // Sync denormalized total stock
    await syncProductStock(input.productId, tx);

    // Low stock notification trigger
    if (newQty <= (inv.reorderLevel || 10)) {
      eventBus.emit('INVENTORY_LOW_STOCK', {
        productId: product.id,
        productName: product.name,
        branchId: branch.id,
        branchName: branch.name,
        currentQty: newQty,
        reorderLevel: inv.reorderLevel || 10,
      });
    }

    return movement;
  });
};

// ─── 7. Stock Movement Ledger Service ────────────────────────────────────────

export const listStockMovements = async (query: ListStockMovementsQuery) => {
  const { page, limit, skip } = getPaginationParams(query);

  const where: Prisma.StockMovementWhereInput = {
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.productId ? { productId: query.productId } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.referenceType ? { referenceType: query.referenceType } : {}),
    ...(query.referenceId ? { referenceId: query.referenceId } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    readPrisma.stockMovement.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [query.sortBy]: query.sortOrder },
      include: {
        product: { select: { id: true, name: true, sku: true, thumbnail: true } },
        branch: { select: { id: true, name: true, code: true, city: true } },
      },
    }),
    readPrisma.stockMovement.count({ where }),
  ]);

  return { data, pagination: buildPagination(page, limit, total) };
};

// ─── 8. Reports Data Extractors ──────────────────────────────────────────────

export const getStockReportData = async (branchId?: string, lowStockOnly?: boolean) => {
  const where: Prisma.InventoryWhereInput = {
    ...(branchId ? { branchId } : {}),
    product: { deletedAt: null },
  };

  const items = await readPrisma.inventory.findMany({
    where,
    orderBy: [{ branch: { code: 'asc' } }, { product: { name: 'asc' } }],
    include: {
      product: { select: { name: true, sku: true, price: true, reorderLevel: true } },
      branch: { select: { name: true, code: true, city: true } },
    },
  });

  if (lowStockOnly) {
    return items.filter((i) => i.quantity <= (i.reorderLevel || i.product.reorderLevel || 10));
  }
  return items;
};

export const getPurchasesReportData = async (branchId?: string, supplierId?: string, from?: string, to?: string) => {
  const where: Prisma.PurchaseWhereInput = {
    ...(branchId ? { branchId } : {}),
    ...(supplierId ? { supplierId } : {}),
    ...(from || to
      ? {
          purchaseDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };

  return readPrisma.purchase.findMany({
    where,
    orderBy: { purchaseDate: 'desc' },
    include: {
      supplier: true,
      branch: true,
      items: { include: { product: true } },
    },
  });
};

export const getMovementsReportData = async (branchId?: string, productId?: string, from?: string, to?: string) => {
  const where: Prisma.StockMovementWhereInput = {
    ...(branchId ? { branchId } : {}),
    ...(productId ? { productId } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };

  return readPrisma.stockMovement.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      product: { select: { name: true, sku: true } },
      branch: { select: { name: true, code: true } },
    },
  });
};
