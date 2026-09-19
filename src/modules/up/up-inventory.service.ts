import prisma, { readPrisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { buildPagination } from '../../utils/response';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const generateDocNumber = (prefix: string) => {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${year}-${rand}`;
};

// ─── 1. Dashboard & Floor Analytics ──────────────────────────────────────────

export const getInventoryDashboard = async (branchId?: string) => {
  try {
    const defaultBranch = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, name, code FROM "branches" WHERE "isActive" = true OR "is_active" = true ORDER BY "createdAt" ASC LIMIT 1;`
    );
    const activeBranchId = branchId || defaultBranch[0]?.id;

    // Total products & master metrics
    const [prodMetrics] = await prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        COUNT(id)::int as "totalSku",
        COALESCE(SUM(stock), 0)::int as "totalStockUnits",
        COALESCE(SUM(stock * COALESCE("price", 0)), 0)::numeric as "estimatedValuation"
      FROM "products"
      WHERE ("deletedAt" IS NULL AND "deleted_at" IS NULL);
    `);

    // Branch inventory breakdown if table exists
    let branchStockUnits = prodMetrics?.totalStockUnits || 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    if (activeBranchId) {
      const invCounts = await prisma.$queryRawUnsafe<any[]>(`
        SELECT 
          COALESCE(SUM(quantity), 0)::int as "branchUnits",
          COUNT(CASE WHEN (quantity - COALESCE("reservedQuantity", 0)) <= 0 THEN 1 END)::int as "oos",
          COUNT(CASE WHEN (quantity - COALESCE("reservedQuantity", 0)) > 0 AND (quantity - COALESCE("reservedQuantity", 0)) <= COALESCE("reorderLevel", 10) THEN 1 END)::int as "low"
        FROM "inventories"
        WHERE ("branchId" = $1 OR "branch_id" = $1);
      `, activeBranchId).catch(() => []);

      if (invCounts && invCounts.length > 0) {
        branchStockUnits = invCounts[0].branchUnits;
        outOfStockCount = invCounts[0].oos;
        lowStockCount = invCounts[0].low;
      }
    }

    // Active production orders
    const prodOrdersCount = await prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END)::int as "inProgress",
        COUNT(CASE WHEN status = 'DRAFT' THEN 1 END)::int as "draft",
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::int as "completed"
      FROM "up_production_orders"
      WHERE ("branch_id" = $1 OR $1 IS NULL);
    `, activeBranchId || null).catch(() => [{ inProgress: 0, draft: 0, completed: 0 }]);

    // Today's Damaged and Scrap counts
    const todayDamage = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COALESCE(SUM(quantity), 0)::int as "damagedUnits"
      FROM "up_damaged_stock"
      WHERE ("branch_id" = $1 OR $1 IS NULL)
        AND DATE("created_at") = CURRENT_DATE;
    `, activeBranchId || null).catch(() => [{ damagedUnits: 0 }]);

    const todayScrap = await prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        COALESCE(SUM(quantity), 0)::numeric as "scrapQty",
        COALESCE(SUM("estimated_loss_paise"), 0)::bigint as "scrapLossPaise"
      FROM "up_scrap_logs"
      WHERE ("branch_id" = $1 OR $1 IS NULL)
        AND DATE("created_at") = CURRENT_DATE;
    `, activeBranchId || null).catch(() => [{ scrapQty: 0, scrapLossPaise: 0 }]);

    // Recent stock movements
    const recentMovements = await prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        sm.id,
        sm.type,
        sm.quantity,
        sm."previousQty" as "previousQty",
        sm."newQty" as "newQty",
        sm.notes,
        sm."createdAt" as "createdAt",
        p.name as "productName",
        p.sku as "sku"
      FROM "stock_movements" sm
      LEFT JOIN "products" p ON (p.id = sm."productId" OR p.id = sm."product_id")
      WHERE (sm."branchId" = $1 OR sm."branch_id" = $1 OR $1 IS NULL)
      ORDER BY sm."createdAt" DESC
      LIMIT 10;
    `, activeBranchId || null).catch(() => []);

    return {
      branchId: activeBranchId,
      branchName: defaultBranch[0]?.name || 'Factory Main',
      totalSku: Number(prodMetrics?.totalSku || 0),
      totalStockUnits: Number(branchStockUnits),
      estimatedValuation: Number(prodMetrics?.estimatedValuation || 0),
      lowStockCount: Number(lowStockCount),
      outOfStockCount: Number(outOfStockCount),
      productionOrders: {
        inProgress: Number(prodOrdersCount[0]?.inProgress || 0),
        draft: Number(prodOrdersCount[0]?.draft || 0),
        completed: Number(prodOrdersCount[0]?.completed || 0),
      },
      todayFloorMetrics: {
        damagedUnits: Number(todayDamage[0]?.damagedUnits || 0),
        scrapQty: Number(todayScrap[0]?.scrapQty || 0),
        scrapLossRupees: Number(todayScrap[0]?.scrapLossPaise || 0) / 100,
      },
      recentMovements,
    };
  } catch (err: any) {
    console.error('[getInventoryDashboard] Error:', err);
    throw new AppError('INTERNAL_ERROR', `Failed to aggregate factory dashboard: ${err?.message}`, 500);
  }
};

// ─── 2. Instant SKU Search Dock (<100ms) ─────────────────────────────────────

export const searchSKU = async (search: string, branchId?: string) => {
  if (!search || !search.trim()) return [];

  const queryTerm = `%${search.trim()}%`;
  try {
    const defaultBranch = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM "branches" WHERE "isActive" = true OR "is_active" = true ORDER BY "createdAt" ASC LIMIT 1;`
    );
    const targetBranchId = branchId || defaultBranch[0]?.id || 'branch-del-01';

    const results = await prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.price,
        p."salesPrice" as "salesPrice",
        p.finish,
        p.colour,
        p.dimensions,
        p.stock as "catalogStock",
        c.name as "categoryName",
        COALESCE(i.quantity, p.stock, 0)::int as "onHand",
        COALESCE(i."reservedQuantity", 0)::int as "reservedQuantity",
        GREATEST(0, (COALESCE(i.quantity, p.stock, 0) - COALESCE(i."reservedQuantity", 0)))::int as "availableQuantity",
        COALESCE(i."reorderLevel", 10)::int as "reorderLevel"
      FROM "products" p
      LEFT JOIN "categories" c ON c.id = p."categoryId"
      LEFT JOIN "inventories" i ON (i."productId" = p.id AND (i."branchId" = $2 OR i."branch_id" = $2))
      WHERE (p."deletedAt" IS NULL AND p."deleted_at" IS NULL)
        AND (
          p.sku ILIKE $1 
          OR p.name ILIKE $1 
          OR p.barcode ILIKE $1
        )
      ORDER BY 
        CASE WHEN p.sku ILIKE $1 THEN 1 ELSE 2 END,
        p.name ASC
      LIMIT 25;
    `, queryTerm, targetBranchId);

    return results.map((r) => {
      const available = Number(r.availableQuantity || 0);
      const reorder = Number(r.reorderLevel || 10);
      let status = 'IN_STOCK';
      if (available <= 0) status = 'OUT_OF_STOCK';
      else if (available <= reorder) status = 'LOW_STOCK';

      return {
        ...r,
        onHand: Number(r.onHand || 0),
        reservedQuantity: Number(r.reservedQuantity || 0),
        availableQuantity: available,
        reorderLevel: reorder,
        status,
      };
    });
  } catch (err: any) {
    console.error('[searchSKU] Error:', err);
    throw new AppError('INTERNAL_ERROR', `Failed to search SKU: ${err?.message}`, 500);
  }
};

// ─── 3. Current Stock Listing ────────────────────────────────────────────────

export const getStockList = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  branchId?: string;
  category?: string;
  stockStatus?: string;
  itemType?: string; // 'ALL' | 'RAW_MATERIAL' | 'FINISHED_GOOD'
}) => {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 25));
  const offset = (page - 1) * limit;

  try {
    const defaultBranch = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM "branches" WHERE "isActive" = true OR "is_active" = true ORDER BY "createdAt" ASC LIMIT 1;`
    );
    const targetBranchId = params.branchId || defaultBranch[0]?.id || 'branch-del-01';

    const conditions: string[] = ['(p."deletedAt" IS NULL AND p."deleted_at" IS NULL)'];
    const values: any[] = [targetBranchId];

    if (params.search && params.search.trim()) {
      values.push(`%${params.search.trim()}%`);
      conditions.push(`(p.sku ILIKE $${values.length} OR p.name ILIKE $${values.length})`);
    }

    if (params.category && params.category.trim() && params.category !== 'ALL') {
      values.push(params.category.trim());
      conditions.push(`(c.name ILIKE $${values.length} OR c.id = $${values.length})`);
    }

    const whereSql = conditions.join(' AND ');

    // Query items
    values.push(limit);
    const limitParam = `$${values.length}`;
    values.push(offset);
    const offsetParam = `$${values.length}`;

    const items = await prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.price,
        p."salesPrice" as "salesPrice",
        p.finish,
        p.colour,
        p.dimensions,
        c.name as "categoryName",
        b.id as "bomId",
        COALESCE(i.quantity, p.stock, 0)::int as "onHand",
        COALESCE(i."reservedQuantity", 0)::int as "reservedQuantity",
        GREATEST(0, (COALESCE(i.quantity, p.stock, 0) - COALESCE(i."reservedQuantity", 0)))::int as "availableQuantity",
        COALESCE(i."reorderLevel", 10)::int as "reorderLevel"
      FROM "products" p
      LEFT JOIN "categories" c ON c.id = p."categoryId"
      LEFT JOIN "up_boms" b ON (b.product_id = p.id AND b.is_active = true)
      LEFT JOIN "inventories" i ON (i."productId" = p.id AND (i."branchId" = $1 OR i."branch_id" = $1))
      WHERE ${whereSql}
      ORDER BY p.name ASC
      LIMIT ${limitParam} OFFSET ${offsetParam};
    `, ...values);

    // Count
    const countValues = values.slice(0, values.length - 2);
    const countRes = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(p.id)::int as total
      FROM "products" p
      LEFT JOIN "categories" c ON c.id = p."categoryId"
      WHERE ${whereSql};
    `, ...countValues);

    const total = Number(countRes[0]?.total || 0);

    const enriched = items.map((r) => {
      const available = Number(r.availableQuantity || 0);
      const reorder = Number(r.reorderLevel || 10);
      let status = 'IN_STOCK';
      if (available <= 0) status = 'OUT_OF_STOCK';
      else if (available <= reorder) status = 'LOW_STOCK';

      // Item type classification: if it has a BOM, it is a Finished Good; otherwise Raw Material or Part
      const isFinishedGood = Boolean(r.bomId);
      const itemType = isFinishedGood ? 'FINISHED_GOOD' : 'RAW_MATERIAL';

      return {
        ...r,
        onHand: Number(r.onHand || 0),
        reservedQuantity: Number(r.reservedQuantity || 0),
        availableQuantity: available,
        reorderLevel: reorder,
        status,
        itemType,
      };
    });

    return {
      data: enriched,
      pagination: buildPagination(page, limit, total),
    };
  } catch (err: any) {
    console.error('[getStockList] Error:', err);
    throw new AppError('INTERNAL_ERROR', `Failed to fetch stock list: ${err?.message}`, 500);
  }
};

// ─── 4. Factory Floor Atomic Operations ──────────────────────────────────────

/**
 * 1-Tap Receive Material (Raw Material / Procurement Inflow)
 */
export const receiveMaterial = async (
  userId: string,
  data: {
    productId: string;
    branchId: string;
    quantity: number;
    unitCost?: number;
    supplierName?: string;
    invoiceNumber?: string;
    notes?: string;
  }
) => {
  const qty = Math.floor(Number(data.quantity));
  if (qty <= 0) throw new AppError('BAD_REQUEST', 'Quantity must be greater than 0', 400);

  return await prisma.$transaction(async (tx) => {
    // 1. Get current inventory
    const existingInv = await tx.$queryRawUnsafe<any[]>(`
      SELECT id, quantity FROM "inventories" 
      WHERE ("productId" = $1 OR "product_id" = $1)
        AND ("branchId" = $2 OR "branch_id" = $2)
      LIMIT 1;
    `, data.productId, data.branchId);

    let prevQty = 0;
    let newQty = qty;

    if (existingInv.length > 0) {
      prevQty = Number(existingInv[0].quantity || 0);
      newQty = prevQty + qty;
      await tx.$executeRawUnsafe(`
        UPDATE "inventories" 
        SET quantity = $1, "updatedAt" = CURRENT_TIMESTAMP, "updated_at" = CURRENT_TIMESTAMP
        WHERE id = $2;
      `, newQty, existingInv[0].id);
    } else {
      await tx.$executeRawUnsafe(`
        INSERT INTO "inventories" (id, "productId", "product_id", "branchId", "branch_id", quantity, "reservedQuantity", "reserved_quantity", "reorderLevel", "reorder_level")
        VALUES (gen_random_uuid(), $1, $1, $2, $2, $3, 0, 0, 10, 10);
      `, data.productId, data.branchId, qty);
    }

    // 2. Update master product stock
    await tx.$executeRawUnsafe(`
      UPDATE "products" 
      SET stock = COALESCE(stock, 0) + $1, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $2;
    `, qty, data.productId);

    // 3. Log immutable movement
    const noteText = `Received on factory floor. ${data.supplierName ? `Supplier: ${data.supplierName}. ` : ''}${data.invoiceNumber ? `Invoice: ${data.invoiceNumber}. ` : ''}${data.notes || ''}`.trim();

    await tx.$executeRawUnsafe(`
      INSERT INTO "stock_movements" (
        id, "productId", "product_id", "branchId", "branch_id", type, quantity,
        "previousQty", "previous_qty", "newQty", "new_qty",
        "referenceType", "reference_type", "referenceId", "reference_id",
        notes, "performedById", "performed_by_id", "createdAt", "created_at"
      ) VALUES (
        gen_random_uuid(), $1, $1, $2, $2, 'PURCHASE_IN', $3,
        $4, $4, $5, $5,
        'FLOOR_RECEIPT', 'FLOOR_RECEIPT', $6, $6,
        $7, $8, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      );
    `, data.productId, data.branchId, qty, prevQty, newQty, data.invoiceNumber || null, noteText, userId);

    return { success: true, prevQty, newQty, quantityReceived: qty };
  });
};

/**
 * 1-Tap Issue Material (Dispatched to Shopfloor / Assembly)
 */
export const issueMaterial = async (
  userId: string,
  data: {
    productId: string;
    branchId: string;
    quantity: number;
    productionOrderId?: string;
    notes?: string;
  }
) => {
  const qty = Math.floor(Number(data.quantity));
  if (qty <= 0) throw new AppError('BAD_REQUEST', 'Quantity must be greater than 0', 400);

  return await prisma.$transaction(async (tx) => {
    // Check available stock
    const existingInv = await tx.$queryRawUnsafe<any[]>(`
      SELECT id, quantity, COALESCE("reservedQuantity", 0) as reserved
      FROM "inventories"
      WHERE ("productId" = $1 OR "product_id" = $1)
        AND ("branchId" = $2 OR "branch_id" = $2)
      LIMIT 1;
    `, data.productId, data.branchId);

    const prevQty = Number(existingInv[0]?.quantity || 0);
    const reserved = Number(existingInv[0]?.reserved || 0);
    const available = prevQty - reserved;

    if (available < qty) {
      throw new AppError('INSUFFICIENT_STOCK', `Insufficient available stock. Current available: ${available} units, requested: ${qty}`, 400);
    }

    const newQty = prevQty - qty;

    // Deduct from inventory
    await tx.$executeRawUnsafe(`
      UPDATE "inventories" 
      SET quantity = $1, "updatedAt" = CURRENT_TIMESTAMP, "updated_at" = CURRENT_TIMESTAMP
      WHERE id = $2;
    `, newQty, existingInv[0].id);

    // Deduct from master product
    await tx.$executeRawUnsafe(`
      UPDATE "products" 
      SET stock = GREATEST(0, COALESCE(stock, 0) - $1), "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $2;
    `, qty, data.productId);

    // Log movement
    const noteText = `Issued to factory floor / production. ${data.productionOrderId ? `Order: ${data.productionOrderId}. ` : ''}${data.notes || ''}`.trim();

    await tx.$executeRawUnsafe(`
      INSERT INTO "stock_movements" (
        id, "productId", "product_id", "branchId", "branch_id", type, quantity,
        "previousQty", "previous_qty", "newQty", "new_qty",
        "referenceType", "reference_type", "referenceId", "reference_id",
        notes, "performedById", "performed_by_id", "createdAt", "created_at"
      ) VALUES (
        gen_random_uuid(), $1, $1, $2, $2, 'ADJUSTMENT_OUT', $3,
        $4, $4, $5, $5,
        'PRODUCTION_ISSUE', 'PRODUCTION_ISSUE', $6, $6,
        $7, $8, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      );
    `, data.productId, data.branchId, qty, prevQty, newQty, data.productionOrderId || null, noteText, userId);

    return { success: true, prevQty, newQty, quantityIssued: qty };
  });
};

/**
 * 1-Tap Inter-Branch / Facility Transfer
 */
export const transferStock = async (
  userId: string,
  data: {
    productId: string;
    fromBranchId: string;
    toBranchId: string;
    quantity: number;
    notes?: string;
  }
) => {
  const qty = Math.floor(Number(data.quantity));
  if (qty <= 0) throw new AppError('BAD_REQUEST', 'Quantity must be greater than 0', 400);
  if (data.fromBranchId === data.toBranchId) {
    throw new AppError('BAD_REQUEST', 'Source and destination branches cannot be the same', 400);
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Check fromBranch
    const sourceInv = await tx.$queryRawUnsafe<any[]>(`
      SELECT id, quantity, COALESCE("reservedQuantity", 0) as reserved
      FROM "inventories"
      WHERE ("productId" = $1 OR "product_id" = $1)
        AND ("branchId" = $2 OR "branch_id" = $2)
      LIMIT 1;
    `, data.productId, data.fromBranchId);

    const fromPrevQty = Number(sourceInv[0]?.quantity || 0);
    const fromReserved = Number(sourceInv[0]?.reserved || 0);
    if ((fromPrevQty - fromReserved) < qty) {
      throw new AppError('INSUFFICIENT_STOCK', `Insufficient stock in source facility. Available: ${fromPrevQty - fromReserved}`, 400);
    }

    const fromNewQty = fromPrevQty - qty;
    await tx.$executeRawUnsafe(`
      UPDATE "inventories" SET quantity = $1 WHERE id = $2;
    `, fromNewQty, sourceInv[0].id);

    // 2. Add to toBranch
    const destInv = await tx.$queryRawUnsafe<any[]>(`
      SELECT id, quantity FROM "inventories"
      WHERE ("productId" = $1 OR "product_id" = $1)
        AND ("branchId" = $2 OR "branch_id" = $2)
      LIMIT 1;
    `, data.productId, data.toBranchId);

    let toPrevQty = 0;
    let toNewQty = qty;

    if (destInv.length > 0) {
      toPrevQty = Number(destInv[0].quantity || 0);
      toNewQty = toPrevQty + qty;
      await tx.$executeRawUnsafe(`
        UPDATE "inventories" SET quantity = $1 WHERE id = $2;
      `, toNewQty, destInv[0].id);
    } else {
      await tx.$executeRawUnsafe(`
        INSERT INTO "inventories" (id, "productId", "product_id", "branchId", "branch_id", quantity, "reservedQuantity", "reserved_quantity", "reorderLevel", "reorder_level")
        VALUES (gen_random_uuid(), $1, $1, $2, $2, $3, 0, 0, 10, 10);
      `, data.productId, data.toBranchId, qty);
    }

    // 3. Log movements
    await tx.$executeRawUnsafe(`
      INSERT INTO "stock_movements" (
        id, "productId", "product_id", "branchId", "branch_id", type, quantity,
        "previousQty", "previous_qty", "newQty", "new_qty",
        "referenceType", "reference_type", notes, "performedById", "performed_by_id"
      ) VALUES 
      (gen_random_uuid(), $1, $1, $2, $2, 'TRANSFER_OUT', $3, $4, $4, $5, $5, 'TRANSFER', 'TRANSFER', $6, $7, $7),
      (gen_random_uuid(), $1, $1, $8, $8, 'TRANSFER_IN', $3, $9, $9, $10, $10, 'TRANSFER', 'TRANSFER', $6, $7, $7);
    `, data.productId, data.fromBranchId, qty, fromPrevQty, fromNewQty, data.notes || 'Factory floor transfer', userId, data.toBranchId, toPrevQty, toNewQty);

    return { success: true, transferred: qty };
  });
};

/**
 * Report Damaged / Defective Stock (Write-off with photo)
 */
export const recordDamage = async (
  userId: string,
  data: {
    productId: string;
    branchId: string;
    quantity: number;
    reason: string;
    photoUrl?: string;
    actionTaken?: string;
    notes?: string;
  }
) => {
  const qty = Math.floor(Number(data.quantity));
  if (qty <= 0) throw new AppError('BAD_REQUEST', 'Quantity must be greater than 0', 400);
  if (!data.reason?.trim()) throw new AppError('BAD_REQUEST', 'Damage reason is mandatory', 400);

  const ticketNumber = generateDocNumber('UP-DMG');

  return await prisma.$transaction(async (tx) => {
    // Deduct from stock
    const inv = await tx.$queryRawUnsafe<any[]>(`
      SELECT id, quantity FROM "inventories"
      WHERE ("productId" = $1 OR "product_id" = $1)
        AND ("branchId" = $2 OR "branch_id" = $2)
      LIMIT 1;
    `, data.productId, data.branchId);

    const prevQty = Number(inv[0]?.quantity || 0);
    const newQty = Math.max(0, prevQty - qty);

    if (inv.length > 0) {
      await tx.$executeRawUnsafe(`
        UPDATE "inventories" SET quantity = $1 WHERE id = $2;
      `, newQty, inv[0].id);
    }

    await tx.$executeRawUnsafe(`
      UPDATE "products" SET stock = GREATEST(0, COALESCE(stock, 0) - $1) WHERE id = $2;
    `, qty, data.productId);

    // Save Damaged Stock record
    await tx.$executeRawUnsafe(`
      INSERT INTO "up_damaged_stock" (
        id, ticket_number, product_id, branch_id, quantity, reason, photo_url,
        action_taken, status, reported_by, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6,
        $7, 'CONFIRMED', $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      );
    `, ticketNumber, data.productId, data.branchId, qty, data.reason.trim(), data.photoUrl || null, data.actionTaken || 'WRITTEN_OFF', userId);

    // Log movement
    await tx.$executeRawUnsafe(`
      INSERT INTO "stock_movements" (
        id, "productId", "product_id", "branchId", "branch_id", type, quantity,
        "previousQty", "previous_qty", "newQty", "new_qty",
        "referenceType", "reference_type", "referenceId", "reference_id",
        notes, "performedById", "performed_by_id"
      ) VALUES (
        gen_random_uuid(), $1, $1, $2, $2, 'DAMAGE', $3,
        $4, $4, $5, $5,
        'DAMAGE_RECORD', 'DAMAGE_RECORD', $6, $6,
        $7, $8, $8
      );
    `, data.productId, data.branchId, qty, prevQty, newQty, ticketNumber, `Damaged write-off: ${data.reason}`, userId);

    return { success: true, ticketNumber, quantity: qty };
  });
};

/**
 * Record Scrap / Industrial Wastage
 */
export const recordScrap = async (
  userId: string,
  data: {
    materialName: string;
    productId?: string;
    productionOrderId?: string;
    branchId: string;
    quantity: number;
    unit?: string;
    reason: string;
    estimatedLossPaise?: number;
    recoveredValuePaise?: number;
  }
) => {
  const qty = Number(data.quantity);
  if (qty <= 0) throw new AppError('BAD_REQUEST', 'Scrap quantity must be greater than 0', 400);
  if (!data.materialName?.trim()) throw new AppError('BAD_REQUEST', 'Material name is required', 400);

  const scrapNumber = generateDocNumber('UP-SCRAP');

  return await prisma.$transaction(async (tx) => {
    // If productId provided, decrement stock
    if (data.productId) {
      const inv = await tx.$queryRawUnsafe<any[]>(`
        SELECT id, quantity FROM "inventories"
        WHERE ("productId" = $1 OR "product_id" = $1)
          AND ("branchId" = $2 OR "branch_id" = $2)
        LIMIT 1;
      `, data.productId, data.branchId);

      if (inv.length > 0) {
        const prevQty = Number(inv[0].quantity || 0);
        const newQty = Math.max(0, prevQty - Math.floor(qty));
        await tx.$executeRawUnsafe(`UPDATE "inventories" SET quantity = $1 WHERE id = $2;`, newQty, inv[0].id);
        await tx.$executeRawUnsafe(`UPDATE "products" SET stock = GREATEST(0, COALESCE(stock, 0) - $1) WHERE id = $2;`, Math.floor(qty), data.productId);
      }
    }

    // Save scrap log
    await tx.$executeRawUnsafe(`
      INSERT INTO "up_scrap_logs" (
        id, scrap_number, product_id, material_name, production_order_id,
        branch_id, quantity, unit, reason, estimated_loss_paise,
        recovered_value_paise, logged_by, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4,
        $5, $6, $7, $8, $9,
        $10, $11, CURRENT_TIMESTAMP
      );
    `, scrapNumber, data.productId || null, data.materialName.trim(), data.productionOrderId || null,
       data.branchId, qty, data.unit || 'kg', data.reason.trim(),
       data.estimatedLossPaise || 0, data.recoveredValuePaise || 0, userId);

    return { success: true, scrapNumber, quantity: qty };
  });
};

// ─── 5. Bill of Materials (BOM) Master ───────────────────────────────────────

export const listBoms = async () => {
  const boms = await prisma.$queryRawUnsafe<any[]>(`
    SELECT 
      b.id,
      b.name,
      b.product_id as "productId",
      b.sku,
      b.version,
      b.is_active as "isActive",
      b.notes,
      b.created_at as "createdAt",
      p.name as "productName",
      c.name as "categoryName",
      COUNT(bi.id)::int as "itemCount"
    FROM "up_boms" b
    LEFT JOIN "products" p ON p.id = b.product_id
    LEFT JOIN "categories" c ON c.id = p."categoryId"
    LEFT JOIN "up_bom_items" bi ON bi.bom_id = b.id
    GROUP BY b.id, p.name, c.name
    ORDER BY b.created_at DESC;
  `);

  return boms;
};

export const getBomById = async (id: string) => {
  const bomRows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT 
      b.id,
      b.name,
      b.product_id as "productId",
      b.sku,
      b.version,
      b.is_active as "isActive",
      b.notes,
      b.created_at as "createdAt",
      p.name as "productName",
      p.stock as "productStock"
    FROM "up_boms" b
    LEFT JOIN "products" p ON p.id = b.product_id
    WHERE b.id::text = $1;
  `, id);

  if (bomRows.length === 0) throw new AppError('NOT_FOUND', 'BOM not found', 404);

  const items = await prisma.$queryRawUnsafe<any[]>(`
    SELECT 
      bi.id,
      bi.raw_material_id as "rawMaterialId",
      bi.raw_material_sku as "rawMaterialSku",
      bi.raw_material_name as "rawMaterialName",
      bi.quantity_required as "quantityRequired",
      bi.unit,
      bi.waste_percentage as "wastePercentage",
      bi.notes,
      p.stock as "currentStock"
    FROM "up_bom_items" bi
    LEFT JOIN "products" p ON p.id = bi.raw_material_id
    WHERE bi.bom_id::text = $1;
  `, id);

  return {
    ...bomRows[0],
    items,
  };
};

export const createBom = async (
  userId: string,
  data: {
    name: string;
    productId: string;
    sku?: string;
    version?: string;
    notes?: string;
    items: Array<{
      rawMaterialId: string;
      rawMaterialSku?: string;
      rawMaterialName?: string;
      quantityRequired: number;
      unit?: string;
      wastePercentage?: number;
      notes?: string;
    }>;
  }
) => {
  if (!data.name?.trim()) throw new AppError('BAD_REQUEST', 'BOM name is required', 400);
  if (!data.productId) throw new AppError('BAD_REQUEST', 'Finished product is required', 400);
  if (!data.items || data.items.length === 0) throw new AppError('BAD_REQUEST', 'At least one raw material component is required', 400);

  return await prisma.$transaction(async (tx) => {
    const [newBom] = await tx.$queryRawUnsafe<any[]>(`
      INSERT INTO "up_boms" (id, name, product_id, sku, version, is_active, notes, created_by, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, true, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id;
    `, data.name.trim(), data.productId, data.sku || null, data.version || '1.0', data.notes || null, userId);

    for (const item of data.items) {
      await tx.$executeRawUnsafe(`
        INSERT INTO "up_bom_items" (
          id, bom_id, raw_material_id, raw_material_sku, raw_material_name,
          quantity_required, unit, waste_percentage, notes
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4,
          $5, $6, $7, $8
        );
      `, newBom.id, item.rawMaterialId, item.rawMaterialSku || null, item.rawMaterialName || null,
         item.quantityRequired || 1, item.unit || 'pcs', item.wastePercentage || 0, item.notes || null);
    }

    return { success: true, id: newBom.id };
  });
};

// ─── 6. Production Orders & WIP ──────────────────────────────────────────────

export const listProductionOrders = async (params: {
  branchId?: string;
  status?: string;
}) => {
  const conditions: string[] = ['1=1'];
  const values: any[] = [];

  if (params.branchId) {
    values.push(params.branchId);
    conditions.push(`po.branch_id = $${values.length}`);
  }

  if (params.status && params.status !== 'ALL') {
    values.push(params.status);
    conditions.push(`po.status = $${values.length}`);
  }

  const whereSql = conditions.join(' AND ');

  const orders = await prisma.$queryRawUnsafe<any[]>(`
    SELECT 
      po.id,
      po.order_number as "orderNumber",
      po.bom_id as "bomId",
      po.product_id as "productId",
      po.branch_id as "branchId",
      po.planned_quantity as "plannedQuantity",
      po.produced_quantity as "producedQuantity",
      po.rejected_quantity as "rejectedQuantity",
      po.status,
      po.started_at as "startedAt",
      po.completed_at as "completedAt",
      po.notes,
      po.created_at as "createdAt",
      p.name as "productName",
      p.sku as "productSku",
      b.name as "bomName",
      br.name as "branchName"
    FROM "up_production_orders" po
    LEFT JOIN "products" p ON p.id = po.product_id
    LEFT JOIN "up_boms" b ON b.id = po.bom_id
    LEFT JOIN "branches" br ON br.id = po.branch_id
    WHERE ${whereSql}
    ORDER BY po.created_at DESC;
  `, ...values);

  return orders;
};

export const createProductionOrder = async (
  userId: string,
  data: {
    productId: string;
    bomId?: string;
    branchId: string;
    plannedQuantity: number;
    notes?: string;
  }
) => {
  const plannedQty = Math.floor(Number(data.plannedQuantity));
  if (plannedQty <= 0) throw new AppError('BAD_REQUEST', 'Planned quantity must be greater than 0', 400);

  const orderNumber = generateDocNumber('UP-PO');

  const [newOrder] = await prisma.$queryRawUnsafe<any[]>(`
    INSERT INTO "up_production_orders" (
      id, order_number, bom_id, product_id, branch_id, planned_quantity,
      status, notes, created_by, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), $1, $2, $3, $4, $5,
      'DRAFT', $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) RETURNING id, order_number as "orderNumber";
  `, orderNumber, data.bomId || null, data.productId, data.branchId, plannedQty, data.notes || null, userId);

  return newOrder;
};

export const startProductionOrder = async (id: string, userId: string) => {
  await prisma.$executeRawUnsafe(`
    UPDATE "up_production_orders"
    SET status = 'IN_PROGRESS', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id::text = $1;
  `, id);

  return { success: true };
};

export const completeProductionOrder = async (
  id: string,
  userId: string,
  data: {
    producedQuantity: number;
    rejectedQuantity?: number;
    notes?: string;
  }
) => {
  const producedQty = Math.floor(Number(data.producedQuantity));
  const rejectedQty = Math.floor(Number(data.rejectedQuantity || 0));

  return await prisma.$transaction(async (tx) => {
    // 1. Fetch order & BOM
    const orders = await tx.$queryRawUnsafe<any[]>(`
      SELECT id, order_number as "orderNumber", bom_id as "bomId", product_id as "productId", branch_id as "branchId"
      FROM "up_production_orders"
      WHERE id::text = $1;
    `, id);

    if (orders.length === 0) throw new AppError('NOT_FOUND', 'Production order not found', 404);
    const order = orders[0];

    // 2. If BOM exists, auto-deduct raw materials
    if (order.bomId) {
      const bomItems = await tx.$queryRawUnsafe<any[]>(`
        SELECT raw_material_id as "rawMaterialId", quantity_required as "qtyReq"
        FROM "up_bom_items"
        WHERE bom_id = $1;
      `, order.bomId);

      for (const item of bomItems) {
        const totalNeeded = Math.ceil(Number(item.qtyReq) * producedQty);
        await tx.$executeRawUnsafe(`
          UPDATE "inventories"
          SET quantity = GREATEST(0, quantity - $1), "updatedAt" = CURRENT_TIMESTAMP
          WHERE ("productId" = $2 OR "product_id" = $2)
            AND ("branchId" = $3 OR "branch_id" = $3);
        `, totalNeeded, item.rawMaterialId, order.branchId);

        await tx.$executeRawUnsafe(`
          UPDATE "products" SET stock = GREATEST(0, COALESCE(stock, 0) - $1) WHERE id = $2;
        `, totalNeeded, item.rawMaterialId);

        // Movement record for raw material consumption
        await tx.$executeRawUnsafe(`
          INSERT INTO "stock_movements" (
            id, "productId", "product_id", "branchId", "branch_id", type, quantity,
            notes, "performedById", "performed_by_id", "referenceType", "reference_type", "referenceId", "reference_id"
          ) VALUES (
            gen_random_uuid(), $1, $1, $2, $2, 'ADJUSTMENT_OUT', $3,
            $4, $5, $5, 'PRODUCTION_ORDER', 'PRODUCTION_ORDER', $6, $6
          );
        `, item.rawMaterialId, order.branchId, totalNeeded, `Consumed in production of ${order.orderNumber}`, userId, order.orderNumber);
      }
    }

    // 3. Add produced finished goods to stock
    const existingInv = await tx.$queryRawUnsafe<any[]>(`
      SELECT id, quantity FROM "inventories"
      WHERE ("productId" = $1 OR "product_id" = $1)
        AND ("branchId" = $2 OR "branch_id" = $2)
      LIMIT 1;
    `, order.productId, order.branchId);

    let prevQty = 0;
    let newQty = producedQty;

    if (existingInv.length > 0) {
      prevQty = Number(existingInv[0].quantity || 0);
      newQty = prevQty + producedQty;
      await tx.$executeRawUnsafe(`UPDATE "inventories" SET quantity = $1 WHERE id = $2;`, newQty, existingInv[0].id);
    } else {
      await tx.$executeRawUnsafe(`
        INSERT INTO "inventories" (id, "productId", "product_id", "branchId", "branch_id", quantity, "reservedQuantity", "reserved_quantity", "reorderLevel", "reorder_level")
        VALUES (gen_random_uuid(), $1, $1, $2, $2, $3, 0, 0, 10, 10);
      `, order.productId, order.branchId, producedQty);
    }

    await tx.$executeRawUnsafe(`
      UPDATE "products" SET stock = COALESCE(stock, 0) + $1 WHERE id = $2;
    `, producedQty, order.productId);

    // Movement record for finished goods production
    await tx.$executeRawUnsafe(`
      INSERT INTO "stock_movements" (
        id, "productId", "product_id", "branchId", "branch_id", type, quantity,
        "previousQty", "previous_qty", "newQty", "new_qty",
        notes, "performedById", "performed_by_id", "referenceType", "reference_type", "referenceId", "reference_id"
      ) VALUES (
        gen_random_uuid(), $1, $1, $2, $2, 'ADJUSTMENT_IN', $3,
        $4, $4, $5, $5,
        $6, $7, $7, 'PRODUCTION_ORDER', 'PRODUCTION_ORDER', $8, $8
      );
    `, order.productId, order.branchId, producedQty, prevQty, newQty,
       `Completed production order ${order.orderNumber}`, userId, order.orderNumber);

    // 4. Update order status
    await tx.$executeRawUnsafe(`
      UPDATE "up_production_orders"
      SET 
        status = 'COMPLETED',
        produced_quantity = $1,
        rejected_quantity = $2,
        completed_at = CURRENT_TIMESTAMP,
        notes = COALESCE($3, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4;
    `, producedQty, rejectedQty, data.notes || null, order.id);

    return { success: true, producedQuantity: producedQty, orderNumber: order.orderNumber };
  });
};

// ─── 7. Physical Inventory Count ─────────────────────────────────────────────

export const listPhysicalCounts = async (branchId?: string) => {
  return await prisma.$queryRawUnsafe<any[]>(`
    SELECT 
      pc.id,
      pc.count_number as "countNumber",
      pc.branch_id as "branchId",
      pc.status,
      pc.total_items_counted as "totalItemsCounted",
      pc.total_variance_units as "totalVarianceUnits",
      pc.notes,
      pc.performed_by as "performedBy",
      pc.created_at as "createdAt",
      br.name as "branchName"
    FROM "up_physical_counts" pc
    LEFT JOIN "branches" br ON br.id = pc.branch_id
    WHERE (pc.branch_id = $1 OR $1 IS NULL)
    ORDER BY pc.created_at DESC;
  `, branchId || null);
};

export const createPhysicalCount = async (
  userId: string,
  data: {
    branchId: string;
    notes?: string;
    items: Array<{
      productId: string;
      sku: string;
      name: string;
      systemQty: number;
      countedQty: number;
      notes?: string;
    }>;
  }
) => {
  if (!data.items || data.items.length === 0) {
    throw new AppError('BAD_REQUEST', 'At least one item must be counted', 400);
  }

  const countNumber = generateDocNumber('UP-PC');
  let totalVariance = 0;

  return await prisma.$transaction(async (tx) => {
    // Reconcile each item
    for (const item of data.items) {
      const diff = Number(item.countedQty) - Number(item.systemQty);
      totalVariance += Math.abs(diff);

      // Update inventory to counted quantity
      const inv = await tx.$queryRawUnsafe<any[]>(`
        SELECT id, quantity FROM "inventories"
        WHERE ("productId" = $1 OR "product_id" = $1)
          AND ("branchId" = $2 OR "branch_id" = $2)
        LIMIT 1;
      `, item.productId, data.branchId);

      if (inv.length > 0) {
        await tx.$executeRawUnsafe(`
          UPDATE "inventories" SET quantity = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2;
        `, item.countedQty, inv[0].id);
      } else {
        await tx.$executeRawUnsafe(`
          INSERT INTO "inventories" (id, "productId", "product_id", "branchId", "branch_id", quantity, "reservedQuantity", "reserved_quantity", "reorderLevel", "reorder_level")
          VALUES (gen_random_uuid(), $1, $1, $2, $2, $3, 0, 0, 10, 10);
        `, item.productId, data.branchId, item.countedQty);
      }

      // If there was a variance, log movement
      if (diff !== 0) {
        const movType = diff > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
        await tx.$executeRawUnsafe(`
          INSERT INTO "stock_movements" (
            id, "productId", "product_id", "branchId", "branch_id", type, quantity,
            "previousQty", "previous_qty", "newQty", "new_qty",
            notes, "performedById", "performed_by_id", "referenceType", "reference_type", "referenceId", "reference_id"
          ) VALUES (
            gen_random_uuid(), $1, $1, $2, $2, $3, $4,
            $5, $5, $6, $6,
            $7, $8, $8, 'PHYSICAL_COUNT', 'PHYSICAL_COUNT', $9, $9
          );
        `, item.productId, data.branchId, movType, Math.abs(diff), item.systemQty, item.countedQty,
           `Reconciled in physical audit ${countNumber}. Diff: ${diff}`, userId, countNumber);
      }
    }

    // Save count record
    await tx.$executeRawUnsafe(`
      INSERT INTO "up_physical_counts" (
        id, count_number, branch_id, status, items_json,
        total_items_counted, total_variance_units, notes, performed_by,
        created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, 'COMPLETED', $3::jsonb,
        $4, $5, $6, $7,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      );
    `, countNumber, data.branchId, JSON.stringify(data.items), data.items.length, totalVariance, data.notes || null, userId);

    return { success: true, countNumber, totalItemsCounted: data.items.length, totalVariance };
  });
};

// ─── 8. Inventory Reports & Valuation ────────────────────────────────────────

export const getInventoryReports = async (params: {
  branchId?: string;
  startDate?: string;
  endDate?: string;
}) => {
  const branchFilter = params.branchId ? `AND ("branchId" = '${params.branchId}' OR "branch_id" = '${params.branchId}')` : '';

  // Movement breakdown
  const movementBreakdown = await prisma.$queryRawUnsafe<any[]>(`
    SELECT 
      type,
      COUNT(id)::int as count,
      COALESCE(SUM(quantity), 0)::int as "totalUnits"
    FROM "stock_movements"
    WHERE 1=1 ${branchFilter}
    GROUP BY type
    ORDER BY "totalUnits" DESC;
  `).catch(() => []);

  // Damaged stock summary
  const damagedSummary = await prisma.$queryRawUnsafe<any[]>(`
    SELECT 
      reason,
      COUNT(id)::int as count,
      COALESCE(SUM(quantity), 0)::int as "totalUnits"
    FROM "up_damaged_stock"
    WHERE 1=1 ${params.branchId ? `AND branch_id = '${params.branchId}'` : ''}
    GROUP BY reason
    ORDER BY "totalUnits" DESC;
  `).catch(() => []);

  // Scrap summary
  const scrapSummary = await prisma.$queryRawUnsafe<any[]>(`
    SELECT 
      material_name as "materialName",
      COUNT(id)::int as count,
      COALESCE(SUM(quantity), 0)::numeric as "totalQuantity",
      COALESCE(SUM(estimated_loss_paise), 0)::bigint as "totalLossPaise"
    FROM "up_scrap_logs"
    WHERE 1=1 ${params.branchId ? `AND branch_id = '${params.branchId}'` : ''}
    GROUP BY material_name
    ORDER BY "totalQuantity" DESC;
  `).catch(() => []);

  return {
    movementBreakdown,
    damagedSummary,
    scrapSummary: scrapSummary.map((s) => ({
      ...s,
      totalLossRupees: Number(s.totalLossPaise || 0) / 100,
    })),
  };
};
