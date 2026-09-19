import prisma from '../../config/database';
import { supabase } from '../../config/supabase';
import { AppError } from '../../middleware/error.middleware';
import type {
  CreateUpExpenseInput,
  UpdateUpExpenseInput,
  ListUpExpensesQuery,
  CreateUpCategoryInput,
  UpdateUpCategoryInput,
  ReconcileCashInput,
} from './up.schema';

// ─── 1. Authorization & Allow-List Service ────────────────────────────────────

export const checkAccess = async (user: { id: string; roleSlug?: string; roles?: string[] }) => {
  const allRoles = [user.roleSlug || '', ...(user.roles || [])].map((r) =>
    r.toLowerCase().replace(/[-_]/g, '')
  );
  const isSuper = allRoles.some((r) =>
    ['superadmin', 'super-admin', 'super_admin'].includes(r)
  );

  if (isSuper) {
    return { hasAccess: true, isSuperAdmin: true };
  }

  const access = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id FROM "up_expense_access" WHERE "admin_id"::text = $1 AND "revoked_at" IS NULL LIMIT 1;`,
    user.id
  );

  return { hasAccess: access.length > 0, isSuperAdmin: false };
};

export const listAccessUsers = async () => {
  // Query all system administrators / staff from users table
  const admins = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      u.id,
      u.email,
      u."firstName",
      u."lastName",
      u.phone,
      u.status,
      r.name as "roleName",
      r.slug as "roleSlug",
      a.id as "accessId",
      a."granted_at" as "grantedAt",
      a."revoked_at" as "revokedAt",
      gb."firstName" as "grantedByFirstName",
      gb."lastName" as "grantedByLastName"
    FROM "users" u
    JOIN "user_roles" ur ON ur."userId" = u.id
    JOIN "roles" r ON r.id = ur."roleId"
    LEFT JOIN (
      SELECT DISTINCT ON ("admin_id") *
      FROM "up_expense_access"
      ORDER BY "admin_id", "granted_at" DESC
    ) a ON a."admin_id"::text = u.id
    LEFT JOIN "users" gb ON gb.id = a."granted_by"::text
    WHERE u."deletedAt" IS NULL
      AND LOWER(r.slug) NOT IN ('customer', 'retail-customer')
    ORDER BY u."firstName" ASC;
  `);

  return admins.map((adm) => {
    const isSuper = ['super-admin', 'super_admin', 'superadmin'].includes(
      (adm.roleSlug || '').toLowerCase()
    );
    const hasActiveAccess = isSuper || (Boolean(adm.accessId) && !adm.revokedAt);

    return {
      adminId: adm.id,
      name: `${adm.firstName || ''} ${adm.lastName || ''}`.trim() || adm.email,
      email: adm.email,
      phone: adm.phone,
      role: adm.roleName || adm.roleSlug,
      roleSlug: adm.roleSlug,
      isSuperAdmin: isSuper,
      upAccessStatus: isSuper ? 'SUPER_ADMIN' : adm.revokedAt ? 'REVOKED' : adm.accessId ? 'ACTIVE' : 'NONE',
      hasAccess: hasActiveAccess,
      grantedAt: adm.grantedAt,
      revokedAt: adm.revokedAt,
      grantedBy: adm.grantedByFirstName ? `${adm.grantedByFirstName} ${adm.grantedByLastName || ''}`.trim() : null,
    };
  });
};

export const grantAccess = async (superAdminId: string, targetAdminId: string) => {
  const target = await prisma.user.findUnique({
    where: { id: targetAdminId, deletedAt: null },
  });

  if (!target) {
    throw new AppError('NOT_FOUND', 'Target administrator account not found', 404);
  }

  // Soft-revoke any existing record first to maintain single active row
  await prisma.$executeRawUnsafe(
    `UPDATE "up_expense_access" SET "revoked_at" = CURRENT_TIMESTAMP WHERE "admin_id"::text = $1 AND "revoked_at" IS NULL;`,
    targetAdminId
  );

  // Insert new active grant record
  await prisma.$executeRawUnsafe(
    `INSERT INTO "up_expense_access" ("id", "admin_id", "granted_by", "granted_at")
     VALUES (gen_random_uuid(), $1::uuid, $2::uuid, CURRENT_TIMESTAMP);`,
    targetAdminId,
    superAdminId
  );

  return { success: true, message: `UP access granted to ${target.firstName} ${target.lastName || ''}` };
};

export const revokeAccess = async (superAdminId: string, targetAdminId: string) => {
  await prisma.$executeRawUnsafe(
    `UPDATE "up_expense_access"
     SET "revoked_at" = CURRENT_TIMESTAMP
     WHERE "admin_id"::text = $1 AND "revoked_at" IS NULL;`,
    targetAdminId
  );

  return { success: true, message: 'UP access revoked successfully' };
};

// ─── 2. Categories Management ─────────────────────────────────────────────────

export const listCategories = async (includeInactive: boolean = false) => {
  const whereClause = includeInactive ? '' : 'WHERE "active" = true';
  const categories = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      c.id,
      c.name,
      c.active,
      c.sort_order as "sortOrder",
      c.created_at as "createdAt",
      c.updated_at as "updatedAt",
      COUNT(e.id)::int as "expenseCount"
    FROM "up_expense_categories" c
    LEFT JOIN "up_expenses" e ON e."category_id" = c.id AND e."deleted_at" IS NULL
    ${whereClause}
    GROUP BY c.id
    ORDER BY c.sort_order ASC, c.name ASC;
  `);

  return categories;
};

export const createCategory = async (userId: string, input: CreateUpCategoryInput) => {
  const existing = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id FROM "up_expense_categories" WHERE LOWER(name) = LOWER($1) LIMIT 1;`,
    input.name.trim()
  );

  if (existing.length > 0) {
    throw new AppError('CONFLICT', `Category '${input.name}' already exists`, 409);
  }

  const result = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO "up_expense_categories" ("id", "name", "active", "sort_order", "created_by", "created_at", "updated_at")
     VALUES (gen_random_uuid(), $1, true, $2, $3::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     RETURNING *;`,
    input.name.trim(),
    input.sortOrder || 0,
    userId
  );

  return result[0];
};

export const updateCategory = async (userId: string, id: string, input: UpdateUpCategoryInput) => {
  const existing = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "up_expense_categories" WHERE id = $1::uuid LIMIT 1;`,
    id
  );

  if (existing.length === 0) {
    throw new AppError('NOT_FOUND', 'Category not found', 404);
  }

  const fields: string[] = ['"updated_at" = CURRENT_TIMESTAMP'];
  const values: any[] = [id];
  let idx = 2;

  if (input.name !== undefined) {
    fields.push(`"name" = $${idx++}`);
    values.push(input.name.trim());
  }
  if (input.active !== undefined) {
    fields.push(`"active" = $${idx++}`);
    values.push(input.active);
  }
  if (input.sortOrder !== undefined) {
    fields.push(`"sort_order" = $${idx++}`);
    values.push(input.sortOrder);
  }

  const updated = await prisma.$queryRawUnsafe<any[]>(
    `UPDATE "up_expense_categories" SET ${fields.join(', ')} WHERE id = $1::uuid RETURNING *;`,
    ...values
  );

  return updated[0];
};

// ─── 3. Expenses CRUD & Transactional Audit ───────────────────────────────────

export const listExpenses = async (query: ListUpExpensesQuery) => {
  const page = Number(query.page || 1);
  const limit = Math.min(200, Number(query.limit || 25));
  const offset = (page - 1) * limit;

  const conditions: string[] = ['e."deleted_at" IS NULL'];
  const values: any[] = [];
  let paramIdx = 1;

  if (query.startDate) {
    conditions.push(`e."expense_date" >= $${paramIdx++}::date`);
    values.push(query.startDate);
  }
  if (query.endDate) {
    conditions.push(`e."expense_date" <= $${paramIdx++}::date`);
    values.push(query.endDate);
  }
  if (query.categoryId) {
    conditions.push(`e."category_id" = $${paramIdx++}::uuid`);
    values.push(query.categoryId);
  }
  if (query.paymentMode) {
    conditions.push(`LOWER(e."payment_mode") = LOWER($${paramIdx++})`);
    values.push(query.paymentMode);
  }
  if (query.verified && query.verified !== 'all') {
    conditions.push(`e."verified" = $${paramIdx++}::boolean`);
    values.push(query.verified === 'true');
  }
  if (query.search && query.search.trim()) {
    conditions.push(`(e."paid_to" ILIKE $${paramIdx} OR e."note" ILIKE $${paramIdx})`);
    values.push(`%${query.search.trim()}%`);
    paramIdx++;
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 1. Data query
  const items = await prisma.$queryRawUnsafe<any[]>(
    `SELECT
       e.id,
       e.expense_date as "expenseDate",
       e.amount::numeric as amount,
       e.category_id as "categoryId",
       c.name as "categoryName",
       e.payment_mode as "paymentMode",
       e.paid_to as "paidTo",
       e.note,
       e.receipt_path as "receiptPath",
       e.verified,
       e.verified_by as "verifiedBy",
       e.verified_at as "verifiedAt",
       vb."firstName" as "verifiedByFirstName",
       vb."lastName" as "verifiedByLastName",
       e.created_by as "createdBy",
       cb."firstName" as "createdByFirstName",
       cb."lastName" as "createdByLastName",
       e.created_at as "createdAt",
       e.updated_at as "updatedAt"
     FROM "up_expenses" e
     JOIN "up_expense_categories" c ON c.id = e.category_id
     LEFT JOIN "users" cb ON cb.id = e.created_by::text
     LEFT JOIN "users" vb ON vb.id = e.verified_by::text
     ${whereSql}
     ORDER BY e.expense_date DESC, e.created_at DESC
     LIMIT ${limit} OFFSET ${offset};`,
    ...values
  );

  // 2. Count query
  const countResult = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(e.id)::int as total, COALESCE(SUM(e.amount), 0)::numeric as "totalAmount"
     FROM "up_expenses" e
     ${whereSql};`,
    ...values
  );

  const total = countResult[0]?.total || 0;
  const totalAmount = Number(countResult[0]?.totalAmount || 0);

  return {
    items: items.map((i) => ({
      ...i,
      amount: Number(i.amount),
      verifiedByName: i.verifiedByFirstName ? `${i.verifiedByFirstName} ${i.verifiedByLastName || ''}`.trim() : null,
      createdByName: i.createdByFirstName ? `${i.createdByFirstName} ${i.createdByLastName || ''}`.trim() : null,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      totalAmount,
    },
  };
};

export const getExpenseById = async (id: string) => {
  const expenses = await prisma.$queryRawUnsafe<any[]>(
    `SELECT
       e.id,
       e.expense_date as "expenseDate",
       e.amount::numeric as amount,
       e.category_id as "categoryId",
       c.name as "categoryName",
       e.payment_mode as "paymentMode",
       e.paid_to as "paidTo",
       e.note,
       e.receipt_path as "receiptPath",
       e.verified,
       e.verified_by as "verifiedBy",
       e.verified_at as "verifiedAt",
       vb."firstName" as "verifiedByFirstName",
       vb."lastName" as "verifiedByLastName",
       e.created_by as "createdBy",
       cb."firstName" as "createdByFirstName",
       cb."lastName" as "createdByLastName",
       e.created_at as "createdAt",
       e.updated_at as "updatedAt"
     FROM "up_expenses" e
     JOIN "up_expense_categories" c ON c.id = e.category_id
     LEFT JOIN "users" cb ON cb.id = e.created_by::text
     LEFT JOIN "users" vb ON vb.id = e.verified_by::text
     WHERE e.id = $1::uuid AND e.deleted_at IS NULL
     LIMIT 1;`,
    id
  );

  if (expenses.length === 0) {
    throw new AppError('NOT_FOUND', 'Expense record not found', 404);
  }

  const exp = expenses[0];
  return {
    ...exp,
    amount: Number(exp.amount),
    verifiedByName: exp.verifiedByFirstName ? `${exp.verifiedByFirstName} ${exp.verifiedByLastName || ''}`.trim() : null,
    createdByName: exp.createdByFirstName ? `${exp.createdByFirstName} ${exp.createdByLastName || ''}`.trim() : null,
  };
};

export const createExpense = async (userId: string, input: CreateUpExpenseInput) => {
  // Validate category is active
  const category = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, name FROM "up_expense_categories" WHERE id = $1::uuid AND "active" = true LIMIT 1;`,
    input.categoryId
  );

  if (category.length === 0) {
    throw new AppError('BAD_REQUEST', 'Selected category is inactive or invalid', 400);
  }

  const amount = Number(input.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new AppError('BAD_REQUEST', 'Amount must be greater than zero', 400);
  }

  // Atomic creation of expense and audit record
  const result = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<any[]>(
      `INSERT INTO "up_expenses" (
         "id", "expense_date", "amount", "category_id", "payment_mode",
         "paid_to", "note", "receipt_path", "verified", "created_by",
         "created_at", "updated_at"
       ) VALUES (
         gen_random_uuid(), $1::date, $2::numeric, $3::uuid, $4,
         $5, $6, $7, false, $8::uuid,
         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
       ) RETURNING *;`,
      input.expenseDate,
      amount,
      input.categoryId,
      input.paymentMode || 'cash',
      input.paidTo.trim(),
      input.note?.trim() || null,
      input.receiptPath || null,
      userId
    );

    const newExpense = rows[0];

    // Audit log
    await tx.$executeRawUnsafe(
      `INSERT INTO "up_expense_audit" ("id", "expense_id", "action", "changed_by", "after_json", "created_at")
       VALUES (gen_random_uuid(), $1::uuid, 'CREATE', $2::uuid, $3::jsonb, CURRENT_TIMESTAMP);`,
      newExpense.id,
      userId,
      JSON.stringify(newExpense)
    );

    return newExpense;
  });

  return getExpenseById(result.id);
};

export const updateExpense = async (userId: string, id: string, input: UpdateUpExpenseInput) => {
  const current = await getExpenseById(id);

  if (input.categoryId) {
    const category = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM "up_expense_categories" WHERE id = $1::uuid LIMIT 1;`,
      input.categoryId
    );
    if (category.length === 0) {
      throw new AppError('BAD_REQUEST', 'Invalid category specified', 400);
    }
  }

  const fields: string[] = ['"updated_at" = CURRENT_TIMESTAMP'];
  const values: any[] = [id];
  let idx = 2;

  if (input.expenseDate !== undefined) {
    fields.push(`"expense_date" = $${idx++}::date`);
    values.push(input.expenseDate);
  }
  if (input.amount !== undefined) {
    const amt = Number(input.amount);
    if (isNaN(amt) || amt <= 0) throw new AppError('BAD_REQUEST', 'Amount must be greater than zero', 400);
    fields.push(`"amount" = $${idx++}::numeric`);
    values.push(amt);
  }
  if (input.categoryId !== undefined) {
    fields.push(`"category_id" = $${idx++}::uuid`);
    values.push(input.categoryId);
  }
  if (input.paymentMode !== undefined) {
    fields.push(`"payment_mode" = $${idx++}`);
    values.push(input.paymentMode);
  }
  if (input.paidTo !== undefined) {
    fields.push(`"paid_to" = $${idx++}`);
    values.push(input.paidTo.trim());
  }
  if (input.note !== undefined) {
    fields.push(`"note" = $${idx++}`);
    values.push(input.note?.trim() || null);
  }
  if (input.receiptPath !== undefined) {
    fields.push(`"receipt_path" = $${idx++}`);
    values.push(input.receiptPath);
  }

  await prisma.$transaction(async (tx) => {
    const updatedRows = await tx.$queryRawUnsafe<any[]>(
      `UPDATE "up_expenses" SET ${fields.join(', ')} WHERE id = $1::uuid AND "deleted_at" IS NULL RETURNING *;`,
      ...values
    );

    if (updatedRows.length === 0) {
      throw new AppError('NOT_FOUND', 'Expense record not found or already deleted', 404);
    }

    const updated = updatedRows[0];

    // Audit log
    await tx.$executeRawUnsafe(
      `INSERT INTO "up_expense_audit" ("id", "expense_id", "action", "changed_by", "before_json", "after_json", "created_at")
       VALUES (gen_random_uuid(), $1::uuid, 'UPDATE', $2::uuid, $3::jsonb, $4::jsonb, CURRENT_TIMESTAMP);`,
      id,
      userId,
      JSON.stringify(current),
      JSON.stringify(updated)
    );
  });

  return getExpenseById(id);
};

export const deleteExpense = async (userId: string, id: string) => {
  const current = await getExpenseById(id);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `UPDATE "up_expenses" SET "deleted_at" = CURRENT_TIMESTAMP WHERE id = $1::uuid;`,
      id
    );

    await tx.$executeRawUnsafe(
      `INSERT INTO "up_expense_audit" ("id", "expense_id", "action", "changed_by", "before_json", "created_at")
       VALUES (gen_random_uuid(), $1::uuid, 'DELETE', $2::uuid, $3::jsonb, CURRENT_TIMESTAMP);`,
      id,
      userId,
      JSON.stringify(current)
    );
  });

  return { success: true, message: 'Expense record deleted successfully' };
};

export const verifyExpense = async (superAdminId: string, id: string, verified: boolean) => {
  const current = await getExpenseById(id);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `UPDATE "up_expenses"
       SET "verified" = $1::boolean,
           "verified_by" = CASE WHEN $1::boolean THEN $2::uuid ELSE NULL END,
           "verified_at" = CASE WHEN $1::boolean THEN CURRENT_TIMESTAMP ELSE NULL END,
           "updated_at" = CURRENT_TIMESTAMP
       WHERE id = $3::uuid;`,
      verified,
      superAdminId,
      id
    );

    await tx.$executeRawUnsafe(
      `INSERT INTO "up_expense_audit" ("id", "expense_id", "action", "changed_by", "before_json", "after_json", "created_at")
       VALUES (gen_random_uuid(), $1::uuid, $2, $3::uuid, $4::jsonb, $5::jsonb, CURRENT_TIMESTAMP);`,
      id,
      verified ? 'VERIFY' : 'UNVERIFY',
      superAdminId,
      JSON.stringify(current),
      JSON.stringify({ ...current, verified, verifiedBy: verified ? superAdminId : null })
    );
  });

  return getExpenseById(id);
};

export const getExpenseAudit = async (id: string) => {
  const audits = await prisma.$queryRawUnsafe<any[]>(
    `SELECT
       a.id,
       a.expense_id as "expenseId",
       a.action,
       a.changed_by as "changedBy",
       u."firstName" as "changedByFirstName",
       u."lastName" as "changedByLastName",
       a.before_json as "beforeJson",
       a.after_json as "afterJson",
       a.created_at as "createdAt"
     FROM "up_expense_audit" a
     LEFT JOIN "users" u ON u.id = a.changed_by::text
     WHERE a.expense_id = $1::uuid
     ORDER BY a.created_at DESC;`,
    id
  );

  return audits.map((a) => ({
    ...a,
    changedByName: a.changedByFirstName ? `${a.changedByFirstName} ${a.changedByLastName || ''}`.trim() : 'System',
  }));
};

// ─── 4. Dashboard Analytics & Aggregations ────────────────────────────────────

export const getDashboard = async (range: string = 'month', customStart?: string, customEnd?: string) => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Start & End of current month
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1)).toISOString().split('T')[0];
  const endOfMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).toISOString().split('T')[0];

  // Start & End of previous month
  const startOfPrevMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 1)).toISOString().split('T')[0];
  const endOfPrevMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).toISOString().split('T')[0];

  // Effective date range
  let rangeStart = startOfMonth;
  let rangeEnd = endOfMonth;

  if (range === 'year') {
    rangeStart = `${currentYear}-01-01`;
    rangeEnd = `${currentYear}-12-31`;
  } else if (range === 'today') {
    rangeStart = todayStr;
    rangeEnd = todayStr;
  } else if (range === 'custom' && customStart && customEnd) {
    rangeStart = customStart;
    rangeEnd = customEnd;
  }

  // 1. KPI Aggregations (Single round-trip)
  const kpis = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      COALESCE(SUM(CASE WHEN expense_date >= '${startOfMonth}'::date AND expense_date <= '${endOfMonth}'::date THEN amount ELSE 0 END), 0)::numeric as "currentMonthTotal",
      COALESCE(SUM(CASE WHEN expense_date = '${todayStr}'::date THEN amount ELSE 0 END), 0)::numeric as "todayTotal",
      COALESCE(SUM(CASE WHEN expense_date >= '${startOfPrevMonth}'::date AND expense_date <= '${endOfPrevMonth}'::date THEN amount ELSE 0 END), 0)::numeric as "previousMonthTotal",
      COALESCE(SUM(CASE WHEN expense_date >= '${rangeStart}'::date AND expense_date <= '${rangeEnd}'::date AND verified = true THEN amount ELSE 0 END), 0)::numeric as "verifiedTotal",
      COALESCE(SUM(CASE WHEN expense_date >= '${rangeStart}'::date AND expense_date <= '${rangeEnd}'::date AND verified = false THEN amount ELSE 0 END), 0)::numeric as "unverifiedTotal",
      COALESCE(SUM(CASE WHEN expense_date >= '${rangeStart}'::date AND expense_date <= '${rangeEnd}'::date THEN amount ELSE 0 END), 0)::numeric as "rangeTotal",
      COUNT(CASE WHEN expense_date >= '${rangeStart}'::date AND expense_date <= '${rangeEnd}'::date THEN id END)::int as "rangeCount",
      COALESCE(MAX(CASE WHEN expense_date >= '${rangeStart}'::date AND expense_date <= '${rangeEnd}'::date THEN amount ELSE 0 END), 0)::numeric as "highestExpense"
    FROM "up_expenses"
    WHERE "deleted_at" IS NULL;
  `);

  const kpiData = kpis[0] || {};
  const rangeTotal = Number(kpiData.rangeTotal || 0);
  const rangeCount = Number(kpiData.rangeCount || 0);

  // 2. Category Breakdown
  const categoryRows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      c.id,
      c.name,
      COALESCE(SUM(e.amount), 0)::numeric as total,
      COUNT(e.id)::int as count
    FROM "up_expense_categories" c
    LEFT JOIN "up_expenses" e ON e.category_id = c.id
      AND e.deleted_at IS NULL
      AND e.expense_date >= '${rangeStart}'::date
      AND e.expense_date <= '${rangeEnd}'::date
    WHERE c.active = true
    GROUP BY c.id, c.name
    ORDER BY total DESC;
  `);

  const categoryBreakdown = categoryRows.map((cat) => {
    const total = Number(cat.total || 0);
    const pct = rangeTotal > 0 ? Number(((total / rangeTotal) * 100).toFixed(1)) : 0;
    return {
      id: cat.id,
      name: cat.name,
      total,
      count: cat.count,
      percentage: pct,
    };
  });

  // 3. 30-Day Trend
  const trendRows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      expense_date as "date",
      COALESCE(SUM(amount), 0)::numeric as total,
      COUNT(id)::int as count
    FROM "up_expenses"
    WHERE deleted_at IS NULL
      AND expense_date >= (CURRENT_DATE - INTERVAL '30 days')
      AND expense_date <= CURRENT_DATE
    GROUP BY expense_date
    ORDER BY expense_date ASC;
  `);

  return {
    kpis: {
      currentMonthTotal: Number(kpiData.currentMonthTotal || 0),
      todayTotal: Number(kpiData.todayTotal || 0),
      previousMonthTotal: Number(kpiData.previousMonthTotal || 0),
      verifiedTotal: Number(kpiData.verifiedTotal || 0),
      unverifiedTotal: Number(kpiData.unverifiedTotal || 0),
      rangeTotal,
      transactionCount: rangeCount,
      highestExpense: Number(kpiData.highestExpense || 0),
      averageDailyExpense: rangeCount > 0 ? Number((rangeTotal / Math.max(1, 30)).toFixed(2)) : 0,
      topCategory: categoryBreakdown[0]?.name || 'None',
    },
    categoryBreakdown,
    trend: trendRows.map((t) => ({
      date: t.date.toISOString().split('T')[0],
      total: Number(t.total),
      count: t.count,
    })),
    range: {
      type: range,
      startDate: rangeStart,
      endDate: rangeEnd,
    },
  };
};

// ─── 5. Daily Cash Reconciliation Service ─────────────────────────────────────

export const getCashStatus = async (dateStr: string) => {
  // 1. Calculate today's cash expenses
  const expRes = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COALESCE(SUM(amount), 0)::numeric as "cashExpenses"
     FROM "up_expenses"
     WHERE expense_date = $1::date
       AND LOWER(payment_mode) = 'cash'
       AND deleted_at IS NULL;`,
    dateStr
  );
  const cashExpenses = Number(expRes[0]?.cashExpenses || 0);

  // 2. Fetch cash day record for date
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT
       cd.*,
       u."firstName" as "closedByFirstName",
       u."lastName" as "closedByLastName"
     FROM "up_cash_days" cd
     LEFT JOIN "users" u ON u.id = cd.closed_by::text
     WHERE cd.cash_date = $1::date
     LIMIT 1;`,
    dateStr
  );

  if (rows.length > 0) {
    const cd = rows[0];
    const opening = Number(cd.opening_balance || 0);
    const expected = Number(opening - cashExpenses);
    const actual = cd.closing_balance !== null ? Number(cd.closing_balance) : null;
    const diff = actual !== null ? Number(actual - expected) : null;

    return {
      cashDate: dateStr,
      openingBalance: opening,
      cashExpenses,
      expectedClosingBalance: expected,
      actualClosing: actual,
      difference: diff,
      notes: cd.notes,
      closed: Boolean(cd.closed),
      closedBy: cd.closedByFirstName ? `${cd.closedByFirstName} ${cd.closedByLastName || ''}`.trim() : null,
      closedAt: cd.closed_at,
    };
  }

  // 3. If no record yet, grab previous closed day's closing balance as default opening
  const prevClosed = await prisma.$queryRawUnsafe<any[]>(
    `SELECT closing_balance
     FROM "up_cash_days"
     WHERE cash_date < $1::date AND closed = true AND closing_balance IS NOT NULL
     ORDER BY cash_date DESC
     LIMIT 1;`,
    dateStr
  );

  const suggestedOpening = prevClosed.length > 0 ? Number(prevClosed[0].closing_balance) : 0;
  const expected = Number(suggestedOpening - cashExpenses);

  return {
    cashDate: dateStr,
    openingBalance: suggestedOpening,
    cashExpenses,
    expectedClosingBalance: expected,
    actualClosing: null,
    difference: null,
    notes: null,
    closed: false,
    closedBy: null,
    closedAt: null,
  };
};

export const reconcileCash = async (userId: string, input: ReconcileCashInput) => {
  const current = await getCashStatus(input.cashDate);

  if (current.closed) {
    throw new AppError('BAD_REQUEST', 'This cash day is already closed and locked', 400);
  }

  const opening = input.openingBalance !== undefined ? Number(input.openingBalance) : current.openingBalance;
  const actual = input.actualClosing !== undefined && input.actualClosing !== null ? Number(input.actualClosing) : current.actualClosing;
  const expected = Number(opening - current.cashExpenses);
  const diff = actual !== null ? Number(actual - expected) : null;
  const isClosing = Boolean(input.closed);

  const result = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO "up_cash_days" (
       "id", "cash_date", "opening_balance", "closing_balance",
       "expected_closing_balance", "difference", "notes", "closed",
       "closed_by", "closed_at", "created_at", "updated_at"
     ) VALUES (
       gen_random_uuid(), $1::date, $2::numeric, $3::numeric,
       $4::numeric, $5::numeric, $6, $7::boolean,
       CASE WHEN $7::boolean THEN $8::uuid ELSE NULL END,
       CASE WHEN $7::boolean THEN CURRENT_TIMESTAMP ELSE NULL END,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
     )
     ON CONFLICT ("cash_date") DO UPDATE
     SET "opening_balance" = EXCLUDED."opening_balance",
         "closing_balance" = EXCLUDED."closing_balance",
         "expected_closing_balance" = EXCLUDED."expected_closing_balance",
         "difference" = EXCLUDED."difference",
         "notes" = COALESCE(EXCLUDED."notes", "up_cash_days"."notes"),
         "closed" = EXCLUDED."closed",
         "closed_by" = EXCLUDED."closed_by",
         "closed_at" = EXCLUDED."closed_at",
         "updated_at" = CURRENT_TIMESTAMP
     RETURNING *;`,
    input.cashDate,
    opening,
    actual,
    expected,
    diff,
    input.notes ?? null,
    isClosing,
    userId
  );

  return getCashStatus(input.cashDate);
};

export const listCashDays = async (limit: number = 30) => {
  const days = await prisma.$queryRawUnsafe<any[]>(
    `SELECT
       cd.*,
       u."firstName" as "closedByFirstName",
       u."lastName" as "closedByLastName"
     FROM "up_cash_days" cd
     LEFT JOIN "users" u ON u.id = cd.closed_by::text
     ORDER BY cd.cash_date DESC
     LIMIT $1;`,
    limit
  );

  return days.map((d) => ({
    id: d.id,
    cashDate: d.cash_date.toISOString().split('T')[0],
    openingBalance: Number(d.opening_balance || 0),
    closingBalance: d.closing_balance !== null ? Number(d.closing_balance) : null,
    expectedClosingBalance: d.expected_closing_balance !== null ? Number(d.expected_closing_balance) : null,
    difference: d.difference !== null ? Number(d.difference) : null,
    notes: d.notes,
    closed: Boolean(d.closed),
    closedByName: d.closedByFirstName ? `${d.closedByFirstName} ${d.closedByLastName || ''}`.trim() : null,
    closedAt: d.closed_at,
  }));
};

// ─── 6. Receipt Storage & Signed URLs ─────────────────────────────────────────

export const uploadReceipt = async (expenseId: string, file: Express.Multer.File) => {
  const expense = await getExpenseById(expenseId);

  const ext = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
  const allowed = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
  if (!allowed.includes(ext)) {
    throw new AppError('BAD_REQUEST', 'Only JPG, PNG, WebP, or PDF files are supported', 400);
  }

  const d = new Date(expense.expenseDate);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const filePath = `${year}/${month}/${expenseId}/receipt-${Date.now()}.${ext}`;

  // Upload to Supabase private storage bucket 'up-expenses'
  const { error } = await supabase.storage.from('up-expenses').upload(filePath, file.buffer, {
    contentType: file.mimetype,
    upsert: true,
  });

  if (error) {
    console.warn('[UP Storage] Supabase bucket upload notice:', error.message);
  }

  // Update expense record with receiptPath
  await prisma.$executeRawUnsafe(
    `UPDATE "up_expenses" SET "receipt_path" = $1, "updated_at" = CURRENT_TIMESTAMP WHERE id = $2::uuid;`,
    filePath,
    expenseId
  );

  return { success: true, receiptPath: filePath };
};

export const getReceiptSignedUrl = async (expenseId: string) => {
  const expense = await getExpenseById(expenseId);
  if (!expense.receiptPath) {
    throw new AppError('NOT_FOUND', 'No receipt attached to this expense', 404);
  }

  // Generate short-lived signed URL (15 minutes = 900s)
  const { data, error } = await supabase.storage
    .from('up-expenses')
    .createSignedUrl(expense.receiptPath, 900);

  if (error || !data?.signedUrl) {
    // If bucket signed URL creation returns error, generate direct safe resource url
    return { signedUrl: `/api/admin/up/expenses/${expenseId}/receipt-file` };
  }

  return { signedUrl: data.signedUrl };
};

export const deleteReceipt = async (userId: string, expenseId: string) => {
  const current = await getExpenseById(expenseId);
  if (!current.receiptPath) {
    return { success: true, message: 'No receipt to remove' };
  }

  try {
    await supabase.storage.from('up-expenses').remove([current.receiptPath]);
  } catch (err) {
    console.warn('[UP Storage] Remove receipt notice:', err);
  }

  await prisma.$executeRawUnsafe(
    `UPDATE "up_expenses" SET "receipt_path" = NULL, "updated_at" = CURRENT_TIMESTAMP WHERE id = $1::uuid;`,
    expenseId
  );

  await prisma.$executeRawUnsafe(
    `INSERT INTO "up_expense_audit" ("id", "expense_id", "action", "changed_by", "before_json", "after_json", "created_at")
     VALUES (gen_random_uuid(), $1::uuid, 'UPDATE', $2::uuid, $3::jsonb, $4::jsonb, CURRENT_TIMESTAMP);`,
    expenseId,
    userId,
    JSON.stringify(current),
    JSON.stringify({ ...current, receiptPath: null })
  );

  return { success: true, message: 'Receipt removed successfully' };
};
