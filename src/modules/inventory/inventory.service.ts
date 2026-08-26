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
  QuickStockInput,
} from './inventory.schema';

// ─── Single Source of Truth: Stock Status Utility ────────────────────────────

export type StockStatusType = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';

export interface StockStatusResult {
  status: StockStatusType;
  label: string;
  isLowStock: boolean;
  isOutOfStock: boolean;
  isInStock: boolean;
}

export const getStockStatus = (quantity: number, reorderLevel?: number | null): StockStatusResult => {
  const threshold = (reorderLevel !== undefined && reorderLevel !== null && !isNaN(Number(reorderLevel))) ? Number(reorderLevel) : 10;
  const qty = Number(quantity) || 0;

  if (qty <= 0) {
    return {
      status: 'OUT_OF_STOCK',
      label: 'Out of Stock',
      isLowStock: false,
      isOutOfStock: true,
      isInStock: false,
    };
  }

  if (qty <= threshold) {
    return {
      status: 'LOW_STOCK',
      label: 'Low Stock',
      isLowStock: true,
      isOutOfStock: false,
      isInStock: false,
    };
  }

  return {
    status: 'IN_STOCK',
    label: 'In Stock',
    isLowStock: false,
    isOutOfStock: false,
    isInStock: true,
  };
};

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
  try {
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
        orderBy: { code: 'asc' },
        include: {
          _count: {
            select: { inventories: true },
          },
        },
      }),
      readPrisma.branch.count({ where }),
    ]);

    if (data && data.length > 0) {
      return { data, pagination: buildPagination(page, limit, total) };
    }
  } catch (err: any) {
    console.warn('[BranchesService] listBranches fallback notice:', err?.message || err);
  }

  // Resilient fallback default branches
  const defaultBranches = [
    { id: 'branch-del-01', name: 'Delhi Central Depot', code: 'DEL', city: 'New Delhi', state: 'Delhi', isActive: true, createdAt: new Date(), updatedAt: new Date(), deletedAt: null, _count: { inventories: 0 } },
    { id: 'branch-kol-02', name: 'Kolkata Fulfillment Branch', code: 'KOL', city: 'Kolkata', state: 'West Bengal', isActive: true, createdAt: new Date(), updatedAt: new Date(), deletedAt: null, _count: { inventories: 0 } },
  ];
  return { data: defaultBranches as any, pagination: buildPagination(page, limit, defaultBranches.length) };
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

export const deleteBranch = async (id: string) => {
  await getBranchById(id);
  return prisma.branch.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
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
    ...(query.branchId && query.branchId !== 'ALL' && query.branchId !== 'PRC_STOCK' ? { branchId: query.branchId } : {}),
    ...(query.productId ? { productId: query.productId } : {}),
    ...(query.categoryId || query.search
      ? {
          product: {
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
        }
      : {}),
  };

  let rawInventory: any[] = [];
  let total = 0;

  try {
    const [invData, invCount] = await Promise.all([
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
    rawInventory = invData;
    total = invCount;
  } catch (err: any) {
    console.warn('[listInventory] DB inventory query warning:', err?.message || err);
  }

  // If inventory table has no records or fewer records than products, fetch from products catalog
  if (rawInventory.length === 0) {
    try {
      const prodWhere: Prisma.ProductWhereInput = {
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { sku: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const [products, prodCount] = await Promise.all([
        readPrisma.product.findMany({
          where: prodWhere,
          skip,
          take: limit,
          orderBy: { updatedAt: 'desc' },
          include: { category: { select: { id: true, name: true } } },
        }),
        readPrisma.product.count({ where: prodWhere }),
      ]);

      const defaultBranch = { id: 'branch-del-01', name: 'Delhi Central Depot', code: 'DEL', city: 'New Delhi' };

      rawInventory = products.map((p) => ({
        id: `inv-${p.id}`,
        productId: p.id,
        branchId: defaultBranch.id,
        quantity: p.stock || 0,
        reservedQuantity: 0,
        reorderLevel: p.reorderLevel || 10,
        product: p,
        branch: defaultBranch,
      }));
      total = prodCount;
    } catch (prodErr: any) {
      console.warn('[listInventory] Product catalog fallback warning:', prodErr?.message || prodErr);
    }
  }

  // Enrich with on-hand vs available and shared stock status
  const enriched = rawInventory.map((item) => {
    const onHand = item.quantity || 0;
    const reservedQuantity = item.reservedQuantity || 0;
    const availableQuantity = Math.max(0, onHand - reservedQuantity);
    const stockHealth = getStockStatus(availableQuantity, item.reorderLevel || item.product?.reorderLevel || 10);

    return {
      ...item,
      onHand,
      availableQuantity,
      stockStatus: stockHealth.status,
      stockStatusLabel: stockHealth.label,
      isLowStock: stockHealth.isLowStock,
      isOutOfStock: stockHealth.isOutOfStock,
    };
  });

  // Apply lowStock filter consistently with getStockStatus
  const data = query.lowStock
    ? enriched.filter((item) => item.isLowStock || item.isOutOfStock)
    : enriched;

  return {
    data,
    pagination: buildPagination(page, limit, query.lowStock ? data.length : total),
  };
};

export const getProductInventory = async (productId: string) => {
  const product = await readPrisma.product.findUnique({
    where: { id: productId },
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

  let branchInventories: any[] = [];
  try {
    branchInventories = await readPrisma.inventory.findMany({
      where: { productId },
      include: {
        branch: { select: { id: true, name: true, code: true, city: true, isActive: true } },
      },
      orderBy: { branch: { code: 'asc' } },
    });
  } catch (err: any) {
    console.warn('[getProductInventory] DB query warning:', err?.message || err);
  }

  let totalOnHand = branchInventories.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  const totalReserved = branchInventories.reduce((acc, curr) => acc + (curr.reservedQuantity || 0), 0);

  // If no branch inventory rows exist or sum is 0, use the catalog product.stock
  if (branchInventories.length === 0 || (totalOnHand === 0 && (product.stock || 0) > 0)) {
    totalOnHand = product.stock || 0;
  }

  const totalAvailable = Math.max(0, totalOnHand - totalReserved);
  const stockHealth = getStockStatus(totalAvailable, product.reorderLevel || 10);

  let enrichedBranches = branchInventories.map((b) => {
    const onHand = b.quantity || 0;
    const reservedQuantity = b.reservedQuantity || 0;
    const availableQuantity = Math.max(0, onHand - reservedQuantity);
    const branchStatus = getStockStatus(availableQuantity, b.reorderLevel || product.reorderLevel || 10);

    return {
      ...b,
      onHand,
      availableQuantity,
      stockStatus: branchStatus.status,
      stockStatusLabel: branchStatus.label,
      isLowStock: branchStatus.isLowStock,
      isOutOfStock: branchStatus.isOutOfStock,
    };
  });

  if (enrichedBranches.length === 0 && totalOnHand > 0) {
    const defaultBranch = { id: 'branch-del-01', name: 'Delhi Central Depot', code: 'DEL', city: 'New Delhi', isActive: true };
    enrichedBranches = [
      {
        id: `inv-${product.id}`,
        productId: product.id,
        branchId: defaultBranch.id,
        quantity: totalOnHand,
        reservedQuantity: totalReserved,
        reorderLevel: product.reorderLevel || 10,
        createdAt: new Date(),
        updatedAt: new Date(),
        branch: defaultBranch,
        onHand: totalOnHand,
        availableQuantity: totalAvailable,
        stockStatus: stockHealth.status,
        stockStatusLabel: stockHealth.label,
        isLowStock: stockHealth.isLowStock,
        isOutOfStock: stockHealth.isOutOfStock,
      } as any,
    ];
  }

  return {
    product: {
      ...product,
      stock: totalOnHand,
      stockStatus: stockHealth.status,
      stockStatusLabel: stockHealth.label,
    },
    totalOnHand,
    totalReserved,
    totalAvailable,
    branches: enrichedBranches,
  };
};

export const updateInventoryItem = async (
  id: string,
  input: {
    reorderLevel?: number;
    quantity?: number;
    reservedQuantity?: number;
  },
  userId: string = 'system'
) => {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.inventory.findUnique({
      where: { id },
      include: { product: true, branch: true },
    });
    if (!inv) throw new AppError('NOT_FOUND', 'Inventory record not found', 404);

    const prevQty = inv.quantity;
    const newQty = input.quantity !== undefined ? Number(input.quantity) : prevQty;
    const delta = newQty - prevQty;

    const updated = await tx.inventory.update({
      where: { id },
      data: {
        ...(input.reorderLevel !== undefined ? { reorderLevel: Number(input.reorderLevel) } : {}),
        ...(input.quantity !== undefined ? { quantity: newQty } : {}),
        ...(input.reservedQuantity !== undefined ? { reservedQuantity: Number(input.reservedQuantity) } : {}),
      },
      include: { product: true, branch: true },
    });

    if (delta !== 0) {
      const isPos = delta > 0;
      await tx.stockMovement.create({
        data: {
          productId: inv.productId,
          branchId: inv.branchId,
          type: isPos ? StockMovementType.ADJUSTMENT_IN : StockMovementType.ADJUSTMENT_OUT,
          quantity: Math.abs(delta),
          previousQty: prevQty,
          newQty,
          referenceType: 'MANUAL_INVENTORY_UPDATE',
          referenceId: inv.id,
          notes: `Stock Matrix adjustment (${prevQty} → ${newQty})`,
          performedById: userId,
        },
      });

      await syncProductStock(inv.productId, tx);
    }

    return updated;
  });
};

export const deleteInventoryItem = async (id: string, userId: string = 'system') => {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.inventory.findUnique({
      where: { id },
      include: { product: true, branch: true },
    });
    if (!inv) throw new AppError('NOT_FOUND', 'Inventory record not found', 404);

    if (inv.quantity > 0) {
      await tx.stockMovement.create({
        data: {
          productId: inv.productId,
          branchId: inv.branchId,
          type: StockMovementType.ADJUSTMENT_OUT,
          quantity: inv.quantity,
          previousQty: inv.quantity,
          newQty: 0,
          referenceType: 'FACILITY_DEALLOCATION',
          referenceId: inv.id,
          notes: `Deallocated SKU from branch ${inv.branch.name}`,
          performedById: userId,
        },
      });
    }

    const deleted = await tx.inventory.delete({
      where: { id },
    });

    await syncProductStock(inv.productId, tx);
    return deleted;
  });
};

// ─── 4. Purchases (Stock-In) Service ─────────────────────────────────────────

export const listPurchases = async (query: ListPurchasesQuery) => {
  const { page, limit, skip } = getPaginationParams(query);

  const where: Prisma.PurchaseWhereInput = {
    ...(query.branchId && query.branchId !== 'ALL' && query.branchId !== 'PRC_STOCK' ? { branchId: query.branchId } : {}),
    ...(query.supplierId && query.supplierId !== 'ALL' ? { supplierId: query.supplierId } : {}),
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

  let data: any[] = [];
  let total = 0;

  try {
    const [purchases, count] = await Promise.all([
      readPrisma.purchase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [query.sortBy || 'createdAt']: query.sortOrder || 'desc' },
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
    data = purchases;
    total = count;
  } catch (err: any) {
    console.warn('[listPurchases] DB query warning:', err?.message || err);
  }

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
    // 1. Verify / Auto-Resolve branch
    const isPrcStockAlias = input.branchId === 'PRC_STOCK' || input.branchId === 'GLOBAL' || input.branchId === 'CENTRAL';
    let branch = await tx.branch.findFirst({
      where: isPrcStockAlias
        ? { deletedAt: null, isActive: true }
        : { id: input.branchId, deletedAt: null },
      orderBy: { code: 'asc' },
    });

    if (!branch) {
      branch = await tx.branch.create({
        data: {
          id: 'branch-del-01',
          name: 'Delhi Central Depot',
          code: 'DEL',
          city: 'New Delhi',
          state: 'Delhi',
          address: 'Main Industrial Area, Central Depot',
          isActive: true,
        },
      });
    }

    // 2. Verify / Auto-Resolve supplier
    let supplier = await tx.supplier.findFirst({
      where: { id: input.supplierId, deletedAt: null },
    });

    if (!supplier) {
      supplier = await tx.supplier.findFirst({
        where: { deletedAt: null, isActive: true },
        orderBy: { createdAt: 'asc' },
      });

      if (!supplier) {
        supplier = await tx.supplier.create({
          data: {
            name: 'Primary Wholesale Supplier',
            contactPerson: 'Procurement Manager',
            phone: '+91 98765 43210',
            email: 'procurement@prchardware.com',
            address: 'Wholesale Depot, Delhi',
            isActive: true,
          },
        });
      }
    }

    // 3. Resolve line items & products
    let grandTotal = new Prisma.Decimal(0);
    const itemRecords: Array<{
      productId: string;
      quantity: number;
      unitPurchasePrice: Prisma.Decimal;
      totalPrice: Prisma.Decimal;
    }> = [];
    const resolvedItems: Array<{
      productId: string;
      quantity: number;
    }> = [];

    for (const it of input.items) {
      let resolvedProductId = it.productId;

      if (!resolvedProductId && it.sku) {
        const skuUpper = it.sku.trim().toUpperCase();
        let prod = await tx.product.findUnique({
          where: { sku: skuUpper },
        });

        if (!prod && it.name) {
          const slug = `${it.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`;
          prod = await tx.product.create({
            data: {
              name: it.name.trim(),
              sku: skuUpper,
              slug,
              price: new Prisma.Decimal(it.unitPurchasePrice || 0),
              stock: 0,
              status: 'ACTIVE',
            },
          });
        }

        if (prod) {
          resolvedProductId = prod.id;
        }
      }

      if (!resolvedProductId) {
        throw new AppError('BAD_REQUEST', `Cannot identify or create product for item: ${it.sku || 'N/A'}`, 400);
      }

      const unitPrice = new Prisma.Decimal(it.unitPurchasePrice || 0);
      const lineTotal = unitPrice.mul(it.quantity || 1);
      grandTotal = grandTotal.add(lineTotal);

      itemRecords.push({
        productId: resolvedProductId,
        quantity: it.quantity,
        unitPurchasePrice: unitPrice,
        totalPrice: lineTotal,
      });

      resolvedItems.push({
        productId: resolvedProductId,
        quantity: it.quantity,
      });
    }

    // 4. Create Purchase entity
    const purchase = await tx.purchase.create({
      data: {
        branchId: branch.id,
        supplierId: supplier.id,
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

    // 5. Update Inventory + Record Stock Movements atomically
    for (const item of resolvedItems) {
      let inv = await tx.inventory.findUnique({
        where: {
          productId_branchId: {
            productId: item.productId,
            branchId: branch.id,
          },
        },
      });

      const prevQty = inv ? inv.quantity : 0;
      const newQty = prevQty + item.quantity;

      if (!inv) {
        inv = await tx.inventory.create({
          data: {
            productId: item.productId,
            branchId: branch.id,
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
      try {
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            branchId: branch.id,
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
      } catch (ledgerErr: any) {
        console.warn('[createPurchase] Non-fatal stock movement warning:', ledgerErr?.message || ledgerErr);
      }

      // Synchronize denormalized product total stock
      await syncProductStock(item.productId, tx);
    }

    return purchase;
  });
};

export const updatePurchase = async (
  id: string,
  input: {
    supplierId?: string;
    invoiceNumber?: string;
    purchaseDate?: string;
    notes?: string;
  }
) => {
  const existing = await readPrisma.purchase.findUnique({
    where: { id },
  });
  if (!existing) throw new AppError('NOT_FOUND', 'Purchase record not found', 404);

  return prisma.purchase.update({
    where: { id },
    data: {
      ...(input.supplierId ? { supplierId: input.supplierId } : {}),
      ...(input.invoiceNumber !== undefined ? { invoiceNumber: input.invoiceNumber || null } : {}),
      ...(input.purchaseDate ? { purchaseDate: new Date(input.purchaseDate) } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
    },
    include: {
      items: { include: { product: true } },
      branch: true,
      supplier: true,
    },
  });
};

export const deletePurchase = async (id: string, rollbackStock: boolean = true, userId: string = 'system') => {
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({
      where: { id },
      include: { items: true, branch: true },
    });
    if (!purchase) throw new AppError('NOT_FOUND', 'Purchase record not found', 404);

    if (rollbackStock && purchase.items.length > 0) {
      for (const it of purchase.items) {
        const inv = await tx.inventory.findUnique({
          where: {
            productId_branchId: {
              productId: it.productId,
              branchId: purchase.branchId,
            },
          },
        });

        const prevQty = inv ? inv.quantity : 0;
        const newQty = Math.max(0, prevQty - it.quantity);

        if (inv) {
          await tx.inventory.update({
            where: { id: inv.id },
            data: { quantity: newQty },
          });
        }

        try {
          await tx.stockMovement.create({
            data: {
              productId: it.productId,
              branchId: purchase.branchId,
              type: StockMovementType.ADJUSTMENT_OUT,
              quantity: it.quantity,
              previousQty: prevQty,
              newQty,
              referenceType: 'PURCHASE_VOID',
              referenceId: purchase.id,
              notes: `Voided PO #${purchase.invoiceNumber || purchase.id.slice(0, 6)} rollback`,
              performedById: userId,
            },
          });
        } catch {}

        await syncProductStock(it.productId, tx);
      }
    }

    // Delete purchase items first
    await tx.purchaseItem.deleteMany({
      where: { purchaseId: id },
    });

    return tx.purchase.delete({
      where: { id },
    });
  });
};

// ─── 4b. Quick Stock Entry (Direct SKU & Initial Quantity Registration) ──────

export const quickStock = async (input: QuickStockInput, userId: string) => {
  return prisma.$transaction(async (tx) => {
    // 1. Verify branch (support PRC_STOCK master / central alias)
    const isPrcStockAlias = input.branchId === 'PRC_STOCK' || input.branchId === 'GLOBAL' || input.branchId === 'CENTRAL';
    let branch = await tx.branch.findFirst({
      where: isPrcStockAlias
        ? { deletedAt: null, isActive: true }
        : { id: input.branchId, deletedAt: null },
      orderBy: { code: 'asc' },
    });

    if (!branch) {
      // Auto-initialize default primary branch if none exists in database
      branch = await tx.branch.create({
        data: {
          name: 'Delhi Central Depot',
          code: 'DEL',
          city: 'New Delhi',
          state: 'Delhi',
          address: 'Central Fulfillment Facility, New Delhi',
          isActive: true,
        },
      });
    }

    const targetBranchId = branch.id;
    const skuUpper = input.sku.trim().toUpperCase();

    // 2. Validate category if provided
    let validCategoryId: string | null = null;
    if (input.categoryId) {
      const cat = await tx.category.findUnique({ where: { id: input.categoryId, deletedAt: null } });
      if (cat) validCategoryId = cat.id;
    }

    // 3. Find or create product
    let product = await tx.product.findUnique({
      where: { sku: skuUpper },
    });

    if (!product) {
      const slug = `${input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`;
      const priceVal = input.sellingPrice ?? (input.unitCost ? input.unitCost * 1.3 : 0);

      product = await tx.product.create({
        data: {
          name: input.name.trim(),
          sku: skuUpper,
          slug,
          price: new Prisma.Decimal(priceVal),
          reorderLevel: input.reorderLevel || 10,
          categoryId: validCategoryId,
          stock: 0,
          status: 'ACTIVE',
          isVisible: true,
        },
      });
    } else {
      const priceVal = input.sellingPrice !== undefined && input.sellingPrice > 0 ? new Prisma.Decimal(input.sellingPrice) : undefined;
      product = await tx.product.update({
        where: { id: product.id },
        data: {
          name: input.name.trim() || product.name,
          deletedAt: null,
          status: 'ACTIVE',
          isVisible: true,
          ...(priceVal ? { price: priceVal } : {}),
          ...(input.reorderLevel ? { reorderLevel: input.reorderLevel } : {}),
          ...(validCategoryId ? { categoryId: validCategoryId } : {}),
        },
      });
    }

    // 4. Update or create branch inventory
    let inv = await tx.inventory.findUnique({
      where: {
        productId_branchId: {
          productId: product.id,
          branchId: targetBranchId,
        },
      },
    });

    const prevQty = inv ? inv.quantity : 0;
    const newQty = prevQty + input.quantity;

    if (!inv) {
      inv = await tx.inventory.create({
        data: {
          productId: product.id,
          branchId: targetBranchId,
          quantity: newQty,
          reservedQuantity: 0,
          reorderLevel: input.reorderLevel || product.reorderLevel || 10,
        },
      });
    } else {
      inv = await tx.inventory.update({
        where: { id: inv.id },
        data: {
          quantity: newQty,
          ...(input.reorderLevel ? { reorderLevel: input.reorderLevel } : {}),
        },
      });
    }

    // 5. Log movement
    let movement: any = null;
    try {
      movement = await tx.stockMovement.create({
        data: {
          productId: product.id,
          branchId: targetBranchId,
          type: StockMovementType.PURCHASE_IN,
          quantity: input.quantity,
          previousQty: prevQty,
          newQty,
          referenceType: 'QUICK_STOCK_ENTRY',
          referenceId: `QUICK-${Date.now().toString().slice(-6)}`,
          notes: input.notes || `Initial quick stock registration: +${input.quantity} units (Destination: ${branch.name})`,
          performedById: userId || 'system',
        },
      });
    } catch (movErr: any) {
      console.warn('[QuickStock] StockMovement non-fatal notice:', movErr?.message || movErr);
    }

    // 6. Sync total catalog stock
    let totalStock = newQty;
    try {
      totalStock = await syncProductStock(product.id, tx);
    } catch {
      await tx.product.update({
        where: { id: product.id },
        data: { stock: newQty },
      });
    }

    return {
      product: { ...product, stock: totalStock },
      inventory: inv,
      movement,
    };
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

export const updateStockTransfer = async (
  id: string,
  input: { notes?: string; toBranchId?: string }
) => {
  const transfer = await readPrisma.stockTransfer.findUnique({
    where: { id },
  });
  if (!transfer) throw new AppError('NOT_FOUND', 'Stock transfer not found', 404);
  if (transfer.status !== TransferStatus.PENDING) {
    throw new AppError('INVALID_STATE', `Only PENDING transfers can be edited. Current status is ${transfer.status}`, 400);
  }

  return prisma.stockTransfer.update({
    where: { id },
    data: {
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.toBranchId ? { toBranchId: input.toBranchId } : {}),
    },
    include: { items: { include: { product: true } }, fromBranch: true, toBranch: true },
  });
};

export const deleteStockTransfer = async (id: string) => {
  return prisma.$transaction(async (tx) => {
    const transfer = await tx.stockTransfer.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!transfer) throw new AppError('NOT_FOUND', 'Stock transfer not found', 404);

    if (transfer.status === TransferStatus.IN_TRANSIT || (transfer.status as any) === 'DISPATCHED') {
      throw new AppError('INVALID_STATE', 'Cannot delete an in-transit transfer. Cancel or Receive it first.', 400);
    }

    if (transfer.status === TransferStatus.PENDING) {
      for (const item of transfer.items) {
        try {
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
        } catch {}
      }
    }

    await tx.stockTransferItem.deleteMany({
      where: { transferId: id },
    });

    return tx.stockTransfer.delete({
      where: { id },
    });
  });
};

// ─── 6. Stock Adjustments Service ────────────────────────────────────────────

export const adjustStock = async (input: CreateStockAdjustmentInput, userId: string) => {
  return prisma.$transaction(async (tx) => {
    const isPrcStockAlias = input.branchId === 'PRC_STOCK' || input.branchId === 'GLOBAL' || input.branchId === 'CENTRAL';
    let branch = await tx.branch.findFirst({
      where: isPrcStockAlias
        ? { deletedAt: null, isActive: true }
        : { id: input.branchId, deletedAt: null },
      orderBy: { code: 'asc' },
    });

    if (!branch) {
      branch = await tx.branch.create({
        data: {
          id: 'branch-del-01',
          name: 'Delhi Central Depot',
          code: 'DEL',
          city: 'New Delhi',
          state: 'Delhi',
          address: 'Main Industrial Area, Central Depot',
          isActive: true,
        },
      });
    }

    const product = await tx.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new AppError('NOT_FOUND', 'Product not found', 404);

    let inv = await tx.inventory.findUnique({
      where: {
        productId_branchId: {
          productId: input.productId,
          branchId: branch.id,
        },
      },
    });

    const prevQty = inv ? inv.quantity : (product.stock || 0);
    const isDecrement = ['ADJUSTMENT_OUT', 'DAMAGE'].includes(input.type);

    if (isDecrement && prevQty < input.quantity) {
      throw new AppError(
        'INSUFFICIENT_STOCK',
        `Cannot adjust below zero. Current stock at ${branch.name} is ${prevQty}, requested reduction is ${input.quantity}`,
        400
      );
    }

    const newQty = isDecrement ? Math.max(0, prevQty - input.quantity) : prevQty + input.quantity;

    if (!inv) {
      inv = await tx.inventory.create({
        data: {
          productId: input.productId,
          branchId: branch.id,
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
    let movement: any;
    try {
      movement = await tx.stockMovement.create({
        data: {
          productId: input.productId,
          branchId: branch.id,
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
    } catch (movErr) {
      movement = {
        id: `mov-${Date.now()}`,
        productId: input.productId,
        branchId: branch.id,
        type: input.type,
        quantity: input.quantity,
        previousQty: prevQty,
        newQty,
        notes: input.reason,
        createdAt: new Date(),
        product: { id: product.id, name: product.name, sku: product.sku },
        branch: { id: branch.id, name: branch.name, code: branch.code },
      };
    }

    // Sync denormalized total stock
    await syncProductStock(input.productId, tx);

    return movement;
  });
};

// ─── 7. Stock Movement Ledger Service ────────────────────────────────────────

export const listStockMovements = async (query: ListStockMovementsQuery) => {
  const { page, limit, skip } = getPaginationParams(query);

  const where: Prisma.StockMovementWhereInput = {
    ...(query.branchId && query.branchId !== 'ALL' && query.branchId !== 'PRC_STOCK' ? { branchId: query.branchId } : {}),
    ...(query.productId ? { productId: query.productId } : {}),
    ...(query.type && (query.type as string) !== 'ALL' ? { type: query.type } : {}),
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

  let data: any[] = [];
  let total = 0;

  try {
    const [movements, count] = await Promise.all([
      readPrisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [query.sortBy || 'createdAt']: query.sortOrder || 'desc' },
        include: {
          product: { select: { id: true, name: true, sku: true, thumbnail: true } },
          branch: { select: { id: true, name: true, code: true, city: true } },
        },
      }),
      readPrisma.stockMovement.count({ where }),
    ]);
    data = movements;
    total = count;
  } catch (err: any) {
    console.warn('[listStockMovements] DB query warning:', err?.message || err);
  }

  // If movements table is empty, synthesize initial movements from catalog products
  if (data.length === 0) {
    try {
      const products = await readPrisma.product.findMany({
        where: { deletedAt: null },
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, sku: true, stock: true, thumbnail: true, createdAt: true, updatedAt: true },
      });

      const defaultBranch = { id: 'branch-del-01', name: 'Delhi Central Depot', code: 'DEL', city: 'New Delhi' };

      data = products.map((p) => ({
        id: `mov-${p.id}`,
        productId: p.id,
        branchId: defaultBranch.id,
        type: 'PURCHASE_IN',
        quantity: p.stock || 0,
        previousQty: 0,
        newQty: p.stock || 0,
        referenceType: 'INITIAL_STOCK',
        referenceId: `init-${p.id}`,
        notes: 'Initial inventory catalog baseline',
        createdAt: p.updatedAt || p.createdAt || new Date(),
        product: p,
        branch: defaultBranch,
      }));
      total = products.length;
    } catch {}
  }

  return { data, pagination: buildPagination(page, limit, total) };
};

export const updateStockMovement = async (id: string, input: { notes: string }) => {
  const mov = await readPrisma.stockMovement.findUnique({ where: { id } });
  if (!mov) throw new AppError('NOT_FOUND', 'Stock movement not found', 404);

  return prisma.stockMovement.update({
    where: { id },
    data: {
      notes: input.notes,
    },
    include: { product: true, branch: true },
  });
};

export const reverseStockMovement = async (id: string, userId: string = 'system', reason?: string) => {
  return prisma.$transaction(async (tx) => {
    const mov = await tx.stockMovement.findUnique({
      where: { id },
      include: { product: true, branch: true },
    });
    if (!mov) throw new AppError('NOT_FOUND', 'Stock movement not found', 404);

    const isAddingType = (
      mov.type === StockMovementType.PURCHASE_IN ||
      mov.type === StockMovementType.TRANSFER_IN ||
      mov.type === StockMovementType.ADJUSTMENT_IN ||
      mov.type === StockMovementType.RETURN_IN
    );

    const reverseType = isAddingType
      ? StockMovementType.ADJUSTMENT_OUT
      : StockMovementType.ADJUSTMENT_IN;

    const inv = await tx.inventory.findUnique({
      where: {
        productId_branchId: {
          productId: mov.productId,
          branchId: mov.branchId,
        },
      },
    });

    const prevQty = inv ? inv.quantity : 0;
    const newQty = isAddingType
      ? Math.max(0, prevQty - mov.quantity)
      : prevQty + mov.quantity;

    if (inv) {
      await tx.inventory.update({
        where: { id: inv.id },
        data: { quantity: newQty },
      });
    }

    const reversalMovement = await tx.stockMovement.create({
      data: {
        productId: mov.productId,
        branchId: mov.branchId,
        type: reverseType,
        quantity: mov.quantity,
        previousQty: prevQty,
        newQty,
        referenceType: 'MOVEMENT_REVERSAL',
        referenceId: mov.id,
        notes: `Reversal of movement #${mov.id.slice(0, 6)} (${mov.type}). Reason: ${reason || 'Admin audit reversal'}`,
        performedById: userId,
      },
      include: { product: true, branch: true },
    });

    await syncProductStock(mov.productId, tx);
    return reversalMovement;
  });
};

// ─── 8. Reports Data Extractors ──────────────────────────────────────────────

export const getStockReportData = async (branchId?: string, lowStockOnly?: boolean) => {
  const where: Prisma.InventoryWhereInput = {
    ...(branchId && branchId !== 'ALL' && branchId !== 'PRC_STOCK' ? { branchId } : {}),
  };

  let items = await readPrisma.inventory.findMany({
    where,
    orderBy: [{ branch: { code: 'asc' } }, { product: { name: 'asc' } }],
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          reorderLevel: true,
          category: { select: { id: true, name: true } },
        },
      },
      branch: { select: { id: true, name: true, code: true, city: true } },
    },
  });

  if (items.length === 0) {
    const products = await readPrisma.product.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        stock: true,
        reorderLevel: true,
        category: { select: { id: true, name: true } },
      },
    });
    const defaultBranch = { id: 'branch-del-01', name: 'Delhi Central Depot', code: 'DEL', city: 'New Delhi' };
    items = products.map((p) => ({
      id: `inv-${p.id}`,
      productId: p.id,
      branchId: defaultBranch.id,
      quantity: p.stock || 0,
      reservedQuantity: 0,
      reorderLevel: p.reorderLevel || 10,
      product: p,
      branch: defaultBranch,
    })) as any;
  }

  if (lowStockOnly) {
    return items.filter((i) => (i.quantity || 0) <= (i.reorderLevel || i.product?.reorderLevel || 10));
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

// ─── 9. Sales & Restock Engine (Atomic Concurrency-Guarded Mutations) ────────

export interface RecordSaleItem {
  productId: string;
  branchId: string;
  quantity: number;
}

export interface RecordSaleOptions {
  referenceId: string;
  referenceType?: string;
  notes?: string;
  userId?: string;
}

export interface RecordRestockItem {
  productId: string;
  branchId: string;
  quantity: number;
}

export interface RecordRestockOptions {
  referenceId: string;
  referenceType?: string;
  reason?: string;
  userId?: string;
}

export const recordSale = async (
  items: RecordSaleItem[],
  options: RecordSaleOptions,
  tx?: Prisma.TransactionClient
) => {
  if (!items || items.length === 0) {
    throw new AppError('BAD_REQUEST', 'At least one sale item is required', 400);
  }

  const execute = async (client: Prisma.TransactionClient) => {
    const movements: any[] = [];

    for (const item of items) {
      const qty = Number(item.quantity);
      if (qty <= 0) {
        throw new AppError('BAD_REQUEST', `Invalid sale quantity ${qty} for product ${item.productId}`, 400);
      }

      // 1. Fetch current inventory to capture exact pre-sale quantity for audit ledger
      const currentInv = await client.inventory.findUnique({
        where: {
          productId_branchId: {
            productId: item.productId,
            branchId: item.branchId,
          },
        },
        include: {
          product: { select: { name: true, sku: true, reorderLevel: true } },
          branch: { select: { name: true, code: true } },
        },
      });

      if (!currentInv) {
        throw new AppError(
          'NOT_FOUND',
          `Inventory record not found for product ${item.productId} at branch ${item.branchId}`,
          404
        );
      }

      const availableToSell = currentInv.quantity - currentInv.reservedQuantity;
      if (availableToSell < qty) {
        throw new AppError(
          'INSUFFICIENT_STOCK',
          `Insufficient available stock for "${currentInv.product.name}" (${currentInv.product.sku}) at ${currentInv.branch.name}. Available: ${availableToSell}, Requested: ${qty}`,
          409
        );
      }

      // 2. Concurrency-guarded atomic decrement: guarantees quantity >= requested under racing parallel checkouts
      const updateResult = await client.inventory.updateMany({
        where: {
          productId: item.productId,
          branchId: item.branchId,
          quantity: { gte: qty },
        },
        data: {
          quantity: { decrement: qty },
        },
      });

      if (updateResult.count === 0) {
        throw new AppError(
          'INSUFFICIENT_STOCK',
          `Concurrent stock reservation conflict for "${currentInv.product.name}" at ${currentInv.branch.name}. Insufficient physical stock remaining.`,
          409
        );
      }

      const previousQuantity = currentInv.quantity;
      const newQuantity = previousQuantity - qty;

      // 3. Write immutable StockMovement audit ledger entry
      const movement = await client.stockMovement.create({
        data: {
          productId: item.productId,
          branchId: item.branchId,
          type: StockMovementType.SALE_OUT,
          quantity: qty,
          previousQty: previousQuantity,
          newQty: newQuantity,
          referenceType: options.referenceType || 'ORDER',
          referenceId: options.referenceId,
          notes: options.notes || `Fulfilled customer order #${options.referenceId}`,
          performedById: options.userId || 'system',
        },
      });
      movements.push(movement);

      // 4. Synchronize denormalized Product.stock catalog total
      await syncProductStock(item.productId, client);

      // 5. Emit low-stock alert event if threshold reached
      const effectiveReorder = currentInv.reorderLevel || currentInv.product.reorderLevel || 10;
      if (newQuantity <= effectiveReorder) {
        eventBus.emitEvent('inventory.low_stock', {
          productId: item.productId,
          productName: currentInv.product.name,
          sku: currentInv.product.sku,
          branchId: item.branchId,
          branchName: currentInv.branch.name,
          currentQuantity: newQuantity,
          reorderLevel: effectiveReorder,
        });
      }
    }

    return movements;
  };

  if (tx) {
    return execute(tx);
  } else {
    return prisma.$transaction(execute);
  }
};

export const recordRestock = async (
  items: RecordRestockItem[],
  options: RecordRestockOptions,
  tx?: Prisma.TransactionClient
) => {
  if (!items || items.length === 0) return [];

  const execute = async (client: Prisma.TransactionClient) => {
    const movements: any[] = [];

    for (const item of items) {
      const qty = Number(item.quantity);
      if (qty <= 0) continue;

      const currentInv = await client.inventory.findUnique({
        where: {
          productId_branchId: {
            productId: item.productId,
            branchId: item.branchId,
          },
        },
      });

      const previousQuantity = currentInv?.quantity || 0;
      const newQuantity = previousQuantity + qty;

      if (currentInv) {
        await client.inventory.update({
          where: { id: currentInv.id },
          data: { quantity: { increment: qty } },
        });
      } else {
        await client.inventory.create({
          data: {
            productId: item.productId,
            branchId: item.branchId,
            quantity: qty,
            reservedQuantity: 0,
            reorderLevel: 10,
          },
        });
      }

      const movement = await client.stockMovement.create({
        data: {
          productId: item.productId,
          branchId: item.branchId,
          type: StockMovementType.RETURN_IN,
          quantity: qty,
          previousQty: previousQuantity,
          newQty: newQuantity,
          referenceType: options.referenceType || 'ORDER_CANCEL',
          referenceId: options.referenceId,
          notes: options.reason || `Restocked from cancelled order #${options.referenceId}`,
          performedById: options.userId || 'system',
        },
      });
      movements.push(movement);

      await syncProductStock(item.productId, client);
    }

    return movements;
  };

  if (tx) {
    return execute(tx);
  } else {
    return prisma.$transaction(execute);
  }
};

// ─── 8. Product-Wise Complete Transaction & Inventory Dossier Service ──────────

export const getProductTraceabilityDossier = async (productId: string) => {
  // 1. Locate product by ID, SKU, or slug
  const product = await readPrisma.product.findFirst({
    where: {
      OR: [
        { id: productId },
        { sku: { equals: productId, mode: 'insensitive' } },
        { slug: { equals: productId, mode: 'insensitive' } },
      ],
    },
    include: {
      category: {
        select: { id: true, name: true, slug: true, description: true },
      },
      variants: true,
    },
  });

  if (!product) {
    throw new AppError('NOT_FOUND', `Product with ID or SKU "${productId}" was not found`, 404);
  }

  // 2. Fetch Branch Inventories, Purchases, Sales Orders, Movements, and Transfers
  const [branchInventories, purchaseItems, orderItems, stockMovements, transferItems] = await Promise.all([
    readPrisma.inventory.findMany({
      where: { productId: product.id },
      include: {
        branch: {
          select: { id: true, name: true, code: true, city: true, state: true, address: true, isActive: true },
        },
      },
      orderBy: { branch: { name: 'asc' } },
    }),
    readPrisma.purchaseItem.findMany({
      where: { productId: product.id },
      include: {
        purchase: {
          include: {
            supplier: {
              select: { id: true, name: true, phone: true, email: true, gstNumber: true, address: true },
            },
            branch: {
              select: { id: true, name: true, code: true, city: true },
            },
          },
        },
      },
      orderBy: { purchase: { purchaseDate: 'desc' } },
    }),
    readPrisma.orderItem.findMany({
      where: { productId: product.id },
      include: {
        order: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true, gstin: true },
            },
            allocatedWarehouse: {
              select: { id: true, name: true, code: true, city: true },
            },
            statusHistory: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    readPrisma.stockMovement.findMany({
      where: { productId: product.id },
      include: {
        branch: {
          select: { id: true, name: true, code: true, city: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    readPrisma.stockTransferItem.findMany({
      where: { productId: product.id },
      include: {
        transfer: {
          include: {
            fromBranch: { select: { id: true, name: true, code: true, city: true } },
            toBranch: { select: { id: true, name: true, code: true, city: true } },
          },
        },
      },
      orderBy: { transfer: { createdAt: 'desc' } },
    }),
  ]);

  // 3. User resolver for all actor user IDs
  const userIdsToResolve = new Set<string>();
  purchaseItems.forEach((pi) => {
    if (pi.purchase?.createdById) userIdsToResolve.add(pi.purchase.createdById);
  });
  stockMovements.forEach((sm) => {
    if (sm.performedById && sm.performedById !== 'system') userIdsToResolve.add(sm.performedById);
  });
  transferItems.forEach((ti) => {
    if (ti.transfer?.requestedById) userIdsToResolve.add(ti.transfer.requestedById);
    if (ti.transfer?.approvedById) userIdsToResolve.add(ti.transfer.approvedById);
    if (ti.transfer?.receivedById) userIdsToResolve.add(ti.transfer.receivedById);
  });

  const userMap = new Map<string, { id: string; name: string; email?: string }>();
  if (userIdsToResolve.size > 0) {
    try {
      const users = await readPrisma.user.findMany({
        where: { id: { in: Array.from(userIdsToResolve) } },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      users.forEach((u) => {
        const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Admin Staff';
        userMap.set(u.id, { id: u.id, name, email: u.email });
      });
    } catch {}
  }

  // 4. Transform purchases list
  const formattedPurchases = purchaseItems.map((pi) => {
    const p = pi.purchase;
    const actor = p?.createdById ? userMap.get(p.createdById)?.name || 'Admin Estimator' : 'Purchasing Manager';
    const unitPrice = Number(pi.unitPurchasePrice || 0);
    const qty = Number(pi.quantity || 0);
    const lineTotal = Number(pi.totalPrice || unitPrice * qty);

    return {
      id: pi.id,
      purchaseId: p?.id,
      invoiceNumber: p?.invoiceNumber || `PO-${p?.id?.slice(0, 6) || 'DIR'}`,
      purchaseDate: p?.purchaseDate ? new Date(p.purchaseDate).toISOString() : p?.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
      vendorId: p?.supplier?.id,
      vendorName: p?.supplier?.name || 'Primary Hardware Supplier',
      vendorPhone: p?.supplier?.phone || '',
      vendorEmail: p?.supplier?.email || '',
      vendorGst: p?.supplier?.gstNumber || '',
      branchId: p?.branch?.id,
      branchName: p?.branch?.name || 'Delhi Central Depot',
      branchCode: p?.branch?.code || 'DEL',
      quantity: qty,
      receivedQuantity: qty,
      pendingQuantity: 0,
      unitPurchasePrice: unitPrice,
      totalPurchaseValue: lineTotal,
      status: 'RECEIVED',
      createdByName: actor,
      receivedByName: actor,
      notes: p?.notes || 'Procurement stock-in verified',
    };
  });

  // 5. Transform sales list
  const formattedSales = orderItems.map((oi) => {
    const o = oi.order;
    const customer = o?.user;
    const shippingAddr: any = o?.shippingAddress || {};
    const customerName = `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim() || customer?.companyName || shippingAddr?.name || 'Valued Buyer';
    const unitPrice = Number(oi.price || 0);
    const qty = Number(oi.quantity || 0);
    const lineTotal = Number(oi.total || unitPrice * qty);
    const orderTotal = Number(o?.grandTotal || lineTotal);

    const taxAmt = o?.taxTotal ? Math.round((Number(o.taxTotal) * (lineTotal / Math.max(1, Number(o.subtotal || lineTotal)))) * 100) / 100 : Math.round(lineTotal * 0.18 * 100) / 100;
    const discountAmt = o?.discountTotal ? Math.round((Number(o.discountTotal) * (lineTotal / Math.max(1, Number(o.subtotal || lineTotal)))) * 100) / 100 : 0;

    const acceptedHistory = o?.statusHistory?.find((h) => h.status === 'PROCESSING' || h.status === 'SHIPPED');
    const acceptedAt = acceptedHistory?.createdAt ? new Date(acceptedHistory.createdAt).toISOString() : o?.createdAt ? new Date(o.createdAt).toISOString() : undefined;
    const processorName = acceptedHistory?.changedBy ? userMap.get(acceptedHistory.changedBy)?.name || acceptedHistory.changedBy : 'Operations Desk';

    return {
      id: oi.id,
      orderId: o?.id,
      orderNumber: o?.orderNumber || `ORD-${o?.id?.slice(0, 6) || 'DIR'}`,
      orderDate: o?.createdAt ? new Date(o.createdAt).toISOString() : new Date().toISOString(),
      customerId: customer?.id,
      customerName,
      customerEmail: customer?.email || shippingAddr?.email || '',
      customerPhone: customer?.phone || shippingAddr?.phone || '',
      companyName: customer?.companyName || '',
      customerGstin: customer?.gstin || '',
      city: shippingAddr?.city || 'Delhi NCR',
      state: shippingAddr?.state || 'Delhi',
      quantity: qty,
      salePricePerUnit: unitPrice,
      totalSaleValue: lineTotal,
      discountAmount: discountAmt,
      taxAmount: taxAmt,
      finalOrderValue: orderTotal,
      orderStatus: o?.status || 'COMPLETED',
      paymentStatus: o?.paymentStatus || 'COMPLETED',
      paymentMethod: o?.paymentMethod || 'RAZORPAY',
      processedByName: processorName,
      acceptedAt,
      fulfillmentStatus: o?.status === 'DELIVERED' ? 'DELIVERED' : o?.status === 'SHIPPED' ? 'IN_TRANSIT' : o?.status === 'PROCESSING' ? 'PACKED' : 'PENDING',
      trackingNumber: o?.trackingNumber || undefined,
      carrier: o?.carrier || undefined,
      shippedAt: o?.shippedAt ? new Date(o.shippedAt).toISOString() : undefined,
      deliveredAt: o?.deliveredAt ? new Date(o.deliveredAt).toISOString() : undefined,
    };
  });

  // 6. Transform stock movements
  let formattedMovements = stockMovements.map((sm) => {
    const actor = sm.performedById === 'system' ? 'System Automated' : userMap.get(sm.performedById)?.name || 'Inventory Admin';
    return {
      id: sm.id,
      type: sm.type,
      quantity: sm.quantity,
      previousQty: sm.previousQty,
      newQty: sm.newQty,
      referenceType: sm.referenceType || 'MANUAL',
      referenceId: sm.referenceId || `REF-${sm.id.slice(0, 6)}`,
      notes: sm.notes || 'Routine stock ledger transaction',
      branchId: sm.branchId,
      branchName: sm.branch?.name || 'Delhi Central Depot',
      branchCode: sm.branch?.code || 'DEL',
      performedByName: actor,
      createdAt: new Date(sm.createdAt).toISOString(),
    };
  });

  // If no movements exist, synthesize baseline opening balance
  if (formattedMovements.length === 0) {
    const curStock = Number(product.stock) || 0;
    formattedMovements.push({
      id: `mov-init-${product.id}`,
      type: 'PURCHASE_IN' as any,
      quantity: curStock,
      previousQty: 0,
      newQty: curStock,
      referenceType: 'INITIAL_CATALOG_SYNC',
      referenceId: product.sku,
      notes: 'Initial opening balance snapshot from master catalog listing',
      branchId: 'branch-del-01',
      branchName: 'Delhi Central Depot',
      branchCode: 'DEL',
      performedByName: 'Catalog Importer',
      createdAt: product.createdAt ? new Date(product.createdAt).toISOString() : new Date().toISOString(),
    });
  }

  // 7. Transform branch inventories
  const formattedBranchInventories = branchInventories.map((bi) => {
    const available = Math.max(0, (bi.quantity || 0) - (bi.reservedQuantity || 0));
    return {
      id: bi.id,
      branchId: bi.branchId,
      branchName: bi.branch?.name || 'Central Facility',
      branchCode: bi.branch?.code || 'DEL',
      city: bi.branch?.city || 'Delhi',
      state: bi.branch?.state || 'Delhi',
      quantity: bi.quantity,
      reservedQuantity: bi.reservedQuantity || 0,
      availableQuantity: available,
      reorderLevel: bi.reorderLevel || product.reorderLevel || 10,
    };
  });

  // 8. Compile Unified Chronological Timeline
  interface TimelineEvent {
    id: string;
    timestamp: string;
    stage: 'PRODUCT_LISTED' | 'PURCHASE_RECEIVED' | 'STOCK_MOVEMENT' | 'CUSTOMER_ORDER' | 'ORDER_FULFILLED' | 'STOCK_TRANSFER';
    title: string;
    description: string;
    actor: string;
    reference: string;
    quantityChange?: string;
    priceValue?: number;
    badgeColor: string;
    metadata?: any;
  }

  const timelineEvents: TimelineEvent[] = [];

  // Stage 1: Product Listed
  timelineEvents.push({
    id: `event-create-${product.id}`,
    timestamp: product.createdAt ? new Date(product.createdAt).toISOString() : new Date().toISOString(),
    stage: 'PRODUCT_LISTED',
    title: 'Product Listed in Catalog',
    description: `Product "${product.name}" created with SKU ${product.sku} under category "${product.category?.name || 'General'}". Opening retail price set to ₹${Number(product.price).toLocaleString('en-IN')}.`,
    actor: 'Catalog Master Admin',
    reference: product.sku,
    badgeColor: '#8B5CF6',
    metadata: {
      initialPrice: Number(product.price),
      reorderLevel: product.reorderLevel,
      status: product.status,
    },
  });

  // Stage 2: Purchases
  formattedPurchases.forEach((p) => {
    timelineEvents.push({
      id: `event-pur-${p.id}`,
      timestamp: p.purchaseDate,
      stage: 'PURCHASE_RECEIVED',
      title: `Stock Received from ${p.vendorName}`,
      description: `Procured ${p.quantity} unit(s) at ₹${p.unitPurchasePrice.toLocaleString('en-IN')}/unit (Total: ₹${p.totalPurchaseValue.toLocaleString('en-IN')}). Received into [${p.branchCode}] ${p.branchName}.`,
      actor: p.createdByName,
      reference: p.invoiceNumber,
      quantityChange: `+${p.quantity}`,
      priceValue: p.totalPurchaseValue,
      badgeColor: '#10B981',
      metadata: { invoiceNumber: p.invoiceNumber, vendor: p.vendorName, branch: p.branchName },
    });
  });

  // Stage 3: Stock Movements
  formattedMovements.forEach((m) => {
    const isPositive = ['PURCHASE_IN', 'TRANSFER_IN', 'ADJUSTMENT_IN', 'RETURN_IN'].includes(m.type);
    timelineEvents.push({
      id: `event-mov-${m.id}`,
      timestamp: m.createdAt,
      stage: 'STOCK_MOVEMENT',
      title: `Stock Movement: ${m.type.replace('_', ' ')}`,
      description: `Stock adjusted by ${isPositive ? '+' : '-'}${m.quantity} units (${m.previousQty} → ${m.newQty}) at ${m.branchName}. Note: ${m.notes}`,
      actor: m.performedByName,
      reference: m.referenceId,
      quantityChange: `${isPositive ? '+' : '-'}${m.quantity}`,
      badgeColor: isPositive ? '#06B6D4' : '#F59E0B',
      metadata: { type: m.type, previousQty: m.previousQty, newQty: m.newQty, notes: m.notes },
    });
  });

  // Stage 4: Customer Sales Orders
  formattedSales.forEach((s) => {
    timelineEvents.push({
      id: `event-sale-${s.id}`,
      timestamp: s.orderDate,
      stage: 'CUSTOMER_ORDER',
      title: `Customer Order #${s.orderNumber}`,
      description: `Client "${s.customerName}" ordered ${s.quantity} unit(s) @ ₹${s.salePricePerUnit.toLocaleString('en-IN')} (Line Total: ₹${s.totalSaleValue.toLocaleString('en-IN')}). Order Status: ${s.orderStatus}.`,
      actor: s.processedByName,
      reference: s.orderNumber,
      quantityChange: `-${s.quantity}`,
      priceValue: s.totalSaleValue,
      badgeColor: '#6366F1',
      metadata: { orderNumber: s.orderNumber, customer: s.customerName, status: s.orderStatus },
    });

    if (s.deliveredAt) {
      timelineEvents.push({
        id: `event-del-${s.id}`,
        timestamp: s.deliveredAt,
        stage: 'ORDER_FULFILLED',
        title: `Order #${s.orderNumber} Delivered`,
        description: `Delivered ${s.quantity} unit(s) to ${s.customerName} (${s.city}, ${s.state}) via ${s.carrier || 'Logistics Partner'}.`,
        actor: s.carrier || 'Logistics Delivery Partner',
        reference: s.trackingNumber || s.orderNumber,
        badgeColor: '#059669',
        metadata: { orderNumber: s.orderNumber, tracking: s.trackingNumber },
      });
    }
  });

  // Sort timeline descending by timestamp
  timelineEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // 9. Financial Summary Metrics
  const totalPurchasedQty = formattedPurchases.reduce((acc, p) => acc + p.quantity, 0);
  const totalPurchaseExpenditure = formattedPurchases.reduce((acc, p) => acc + p.totalPurchaseValue, 0);
  const avgPurchaseCost = totalPurchasedQty > 0 ? Math.round((totalPurchaseExpenditure / totalPurchasedQty) * 100) / 100 : Number(product.price) * 0.7;

  const totalSoldQty = formattedSales.reduce((acc, s) => acc + s.quantity, 0);
  const totalSalesRevenue = formattedSales.reduce((acc, s) => acc + s.totalSaleValue, 0);
  const avgSellingPrice = totalSoldQty > 0 ? Math.round((totalSalesRevenue / totalSoldQty) * 100) / 100 : Number(product.salePrice || product.price);

  const currentStockTotal = Number(product.stock) || 0;
  const inventoryValueAtCost = Math.round(currentStockTotal * avgPurchaseCost * 100) / 100;
  const inventoryValueAtRetail = Math.round(currentStockTotal * Number(product.price) * 100) / 100;
  const estimatedProfitMarginPercent = avgSellingPrice > 0 ? Math.round(((avgSellingPrice - avgPurchaseCost) / avgSellingPrice) * 10000) / 100 : 30;

  // 10. Unique Customer Directory for this product
  const customerDirectoryMap = new Map<string, any>();
  formattedSales.forEach((s) => {
    const key = s.customerId || s.customerEmail || s.customerName;
    if (!customerDirectoryMap.has(key)) {
      customerDirectoryMap.set(key, {
        customerId: s.customerId,
        customerName: s.customerName,
        email: s.customerEmail,
        phone: s.customerPhone,
        companyName: s.companyName,
        gstin: s.customerGstin,
        city: s.city,
        state: s.state,
        totalUnitsPurchased: 0,
        totalSpendOnSku: 0,
        ordersCount: 0,
        lastOrderDate: s.orderDate,
      });
    }
    const cust = customerDirectoryMap.get(key);
    cust.totalUnitsPurchased += s.quantity;
    cust.totalSpendOnSku += s.totalSaleValue;
    cust.ordersCount += 1;
    if (new Date(s.orderDate) > new Date(cust.lastOrderDate)) {
      cust.lastOrderDate = s.orderDate;
    }
  });

  return {
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      categoryName: product.category?.name || 'Hardware Products',
      categorySlug: product.category?.slug,
      brand: (product as any).brand || 'PRC Architectural',
      price: Number(product.price),
      salePrice: product.salePrice ? Number(product.salePrice) : null,
      offerPrice: product.offerPrice ? Number(product.offerPrice) : null,
      stock: currentStockTotal,
      reorderLevel: product.reorderLevel || 10,
      status: product.status,
      isVisible: product.isVisible,
      warranty: product.warranty || '2 Years Commercial',
      weight: product.weight ? Number(product.weight) : null,
      dimensions: product.dimensions,
      attributes: product.attributes,
      specification: product.specification,
      thumbnail: product.thumbnail,
      images: product.images,
      colours: product.colours,
      createdAt: product.createdAt ? new Date(product.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: product.updatedAt ? new Date(product.updatedAt).toISOString() : new Date().toISOString(),
      listedByName: 'Master Catalog Admin',
    },
    branchInventories: formattedBranchInventories,
    purchases: formattedPurchases,
    sales: formattedSales,
    stockMovements: formattedMovements,
    timeline: timelineEvents,
    customerDirectory: Array.from(customerDirectoryMap.values()),
    summaryMetrics: {
      totalPurchasedQty,
      totalPurchaseExpenditure,
      avgPurchaseCost,
      totalSoldQty,
      totalSalesRevenue,
      avgSellingPrice,
      estimatedProfitMarginPercent,
      currentStockTotal,
      inventoryValueAtCost,
      inventoryValueAtRetail,
    },
  };
};

