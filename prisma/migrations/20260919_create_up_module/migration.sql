-- Migration: 20260919_create_up_module
-- Description: Creates the private "UP" Daily Cash Expense Module schema, RLS, audit log, cash days, and indexes

-- 1. UP Expense Categories
CREATE TABLE IF NOT EXISTS "up_expense_categories" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL UNIQUE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. UP Expenses
CREATE TABLE IF NOT EXISTS "up_expenses" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "expense_date" DATE NOT NULL,
    "amount" NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    "category_id" UUID NOT NULL REFERENCES "up_expense_categories"("id") ON DELETE RESTRICT,
    "payment_mode" TEXT NOT NULL DEFAULT 'cash',
    "paid_to" TEXT NOT NULL,
    "note" TEXT,
    "receipt_path" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_by" UUID,
    "verified_at" TIMESTAMPTZ,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ
);

-- 3. UP Expense Access Allow-List
CREATE TABLE IF NOT EXISTS "up_expense_access" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "admin_id" UUID NOT NULL,
    "granted_by" UUID NOT NULL,
    "granted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ
);

-- 4. UP Expense Audit Log (Immutable)
CREATE TABLE IF NOT EXISTS "up_expense_audit" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "expense_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "changed_by" UUID NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. UP Daily Cash Reconciliation
CREATE TABLE IF NOT EXISTS "up_cash_days" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "cash_date" DATE NOT NULL UNIQUE,
    "opening_balance" NUMERIC(14, 2) NOT NULL DEFAULT 0,
    "closing_balance" NUMERIC(14, 2),
    "expected_closing_balance" NUMERIC(14, 2),
    "difference" NUMERIC(14, 2),
    "notes" TEXT,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "closed_by" UUID,
    "closed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "idx_up_expense_access_active" ON "up_expense_access"("admin_id") WHERE "revoked_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_up_expenses_date" ON "up_expenses"("expense_date");
CREATE INDEX IF NOT EXISTS "idx_up_expenses_category" ON "up_expenses"("category_id");
CREATE INDEX IF NOT EXISTS "idx_up_expenses_created_by" ON "up_expenses"("created_by");
CREATE INDEX IF NOT EXISTS "idx_up_expenses_date_category" ON "up_expenses"("expense_date", "category_id");
CREATE INDEX IF NOT EXISTS "idx_up_expenses_verified" ON "up_expenses"("verified");
CREATE INDEX IF NOT EXISTS "idx_up_expenses_deleted_at" ON "up_expenses"("deleted_at");
CREATE INDEX IF NOT EXISTS "idx_up_cash_days_date" ON "up_cash_days"("cash_date");
CREATE INDEX IF NOT EXISTS "idx_up_expense_audit_expense" ON "up_expense_audit"("expense_id");

-- Seed Default Categories
INSERT INTO "up_expense_categories" ("id", "name", "active", "sort_order")
VALUES
    (gen_random_uuid(), 'Raw Material Purchase', true, 1),
    (gen_random_uuid(), 'Wages / Labor', true, 2),
    (gen_random_uuid(), 'Utilities', true, 3),
    (gen_random_uuid(), 'Transport & Logistics', true, 4),
    (gen_random_uuid(), 'Machine Maintenance', true, 5),
    (gen_random_uuid(), 'Miscellaneous', true, 6)
ON CONFLICT ("name") DO NOTHING;

-- PostgreSQL Row Level Security (RLS) Helper Function
CREATE OR REPLACE FUNCTION public.has_up_access()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id text;
    v_is_super boolean;
    v_has_access boolean;
BEGIN
    v_user_id := auth.uid()::text;
    IF v_user_id IS NULL THEN
        RETURN false;
    END IF;

    -- Check if Super Admin
    SELECT EXISTS (
        SELECT 1 FROM "user_roles" ur
        JOIN "roles" r ON r.id = ur."roleId"
        WHERE ur."userId" = v_user_id
          AND LOWER(REPLACE(REPLACE(r.slug, '-', ''), '_', '')) IN ('superadmin')
    ) INTO v_is_super;

    IF v_is_super THEN
        RETURN true;
    END IF;

    -- Check active allow-list record
    SELECT EXISTS (
        SELECT 1 FROM "up_expense_access"
        WHERE "admin_id"::text = v_user_id AND "revoked_at" IS NULL
    ) INTO v_has_access;

    RETURN v_has_access;
END;
$$;

-- Enable RLS on UP tables
ALTER TABLE "up_expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "up_expense_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "up_expense_access" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "up_expense_audit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "up_cash_days" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'up_expenses' AND policyname = 'up_expenses_access_policy') THEN
        CREATE POLICY up_expenses_access_policy ON "up_expenses" FOR ALL USING (public.has_up_access());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'up_expense_categories' AND policyname = 'up_expense_categories_access_policy') THEN
        CREATE POLICY up_expense_categories_access_policy ON "up_expense_categories" FOR ALL USING (public.has_up_access());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'up_expense_access' AND policyname = 'up_expense_access_policy') THEN
        CREATE POLICY up_expense_access_policy ON "up_expense_access" FOR ALL USING (public.has_up_access());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'up_expense_audit' AND policyname = 'up_expense_audit_policy') THEN
        CREATE POLICY up_expense_audit_policy ON "up_expense_audit" FOR ALL USING (public.has_up_access());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'up_cash_days' AND policyname = 'up_cash_days_access_policy') THEN
        CREATE POLICY up_cash_days_access_policy ON "up_cash_days" FOR ALL USING (public.has_up_access());
    END IF;
END $$;
