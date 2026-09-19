/**
 * fix-db.js — Startup database patcher for Render/Production
 *
 * Uses Prisma's $executeRawUnsafe to safely patch the production database
 * before the Express server starts. Idempotent — safe to run on every deploy.
 *
 * Fixes: camelCase → snake_case column renames on quotes & quote_items tables.
 */

'use strict';

const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

// Load compiled Prisma client from dist
let PrismaClient;
try {
  PrismaClient = require(path.join(__dirname, '../../node_modules/@prisma/client')).PrismaClient;
} catch (e) {
  console.error('[fix-db] Could not load @prisma/client:', e.message);
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.log('[fix-db] No DATABASE_URL — skipping DB patch.');
  process.exit(0);
}

const prisma = new PrismaClient();

const STATEMENTS = [
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_secret" TEXT;`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_backup_codes" TEXT[] DEFAULT ARRAY[]::TEXT[];`,
  `ALTER TABLE "expense_float_top_ups" ADD COLUMN IF NOT EXISTS "receipt_attachment" TEXT;`,
  `ALTER TABLE "expense_entries" ADD COLUMN IF NOT EXISTS "paid_by" TEXT;`,

  // ─── PRODUCT SCAN LIFECYCLES (PACKING & RECEIVING 2-STAGE VERIFICATION) ───
  `CREATE TABLE IF NOT EXISTS "product_scan_lifecycles" (
    "id"                  TEXT NOT NULL PRIMARY KEY,
    "sku"                 TEXT NOT NULL,
    "tracking_code"       TEXT NOT NULL,
    "order_id"            TEXT,
    "order_item_id"       TEXT,
    "status"              TEXT NOT NULL DEFAULT 'PENDING_PACK',
    "scan_count"          INTEGER NOT NULL DEFAULT 0,
    "packed_at"           TIMESTAMP(3),
    "packed_by"           TEXT,
    "packed_by_name"      TEXT,
    "packed_device_id"    TEXT,
    "packed_branch_id"    TEXT,
    "packed_notes"        TEXT,
    "received_at"         TIMESTAMP(3),
    "received_by"         TEXT,
    "received_by_name"    TEXT,
    "received_device_id"  TEXT,
    "received_branch_id"  TEXT,
    "received_notes"      TEXT,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE INDEX IF NOT EXISTS "product_scan_lifecycles_sku_idx" ON "product_scan_lifecycles"("sku");`,
  `CREATE INDEX IF NOT EXISTS "product_scan_lifecycles_tracking_code_idx" ON "product_scan_lifecycles"("tracking_code");`,
  `CREATE INDEX IF NOT EXISTS "product_scan_lifecycles_status_idx" ON "product_scan_lifecycles"("status");`,
  `CREATE INDEX IF NOT EXISTS "product_scan_lifecycles_order_id_idx" ON "product_scan_lifecycles"("order_id");`,

  // ─── DAILY CASH EXPENSE TRACKER MODULE TABLES & TYPES ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExpensePaymentMode') THEN
      CREATE TYPE "ExpensePaymentMode" AS ENUM ('CASH', 'UPI', 'BANK_TRANSFER');
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExpenseStatus') THEN
      CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
    END IF;
  END $$`,

  `CREATE TABLE IF NOT EXISTS "expense_categories" (
    "id"                   TEXT NOT NULL PRIMARY KEY,
    "name"                 TEXT NOT NULL UNIQUE,
    "description"          TEXT,
    "monthly_budget_limit" INTEGER,
    "is_active"            BOOLEAN NOT NULL DEFAULT true,
    "is_deleted"           BOOLEAN NOT NULL DEFAULT false,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "expense_categories_active_deleted_idx" ON "expense_categories"("is_active", "is_deleted")`,

  `CREATE TABLE IF NOT EXISTS "expense_entries" (
    "id"                 TEXT NOT NULL PRIMARY KEY,
    "entry_number"       TEXT NOT NULL UNIQUE,
    "date"               DATE NOT NULL,
    "time"               VARCHAR(10) NOT NULL,
    "amount"             INTEGER NOT NULL,
    "category_id"        TEXT NOT NULL,
    "sub_category"       TEXT,
    "payment_mode"       "ExpensePaymentMode" NOT NULL DEFAULT 'CASH',
    "description"        TEXT NOT NULL,
    "paid_to"            TEXT NOT NULL,
    "paid_by"            TEXT,
    "receipt_attachment" TEXT,
    "branch_id"          TEXT NOT NULL,
    "department_id"      TEXT,
    "employee_id"        TEXT,
    "added_by_id"        TEXT NOT NULL,
    "status"             "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by_id"     TEXT,
    "approved_at"        TIMESTAMP(3),
    "rejection_reason"   TEXT,
    "is_void"            BOOLEAN NOT NULL DEFAULT false,
    "void_reason"        TEXT,
    "voided_by_id"       TEXT,
    "voided_at"          TIMESTAMP(3),
    "client_temp_id"     TEXT UNIQUE,
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "expense_entries_branch_date_idx" ON "expense_entries"("branch_id", "date")`,
  `CREATE INDEX IF NOT EXISTS "expense_entries_branch_status_idx" ON "expense_entries"("branch_id", "status")`,
  `CREATE INDEX IF NOT EXISTS "expense_entries_category_idx" ON "expense_entries"("category_id")`,
  `CREATE INDEX IF NOT EXISTS "expense_entries_added_by_idx" ON "expense_entries"("added_by_id")`,
  `CREATE INDEX IF NOT EXISTS "expense_entries_date_idx" ON "expense_entries"("date")`,
  `CREATE INDEX IF NOT EXISTS "expense_entries_is_void_idx" ON "expense_entries"("is_void")`,
  `CREATE INDEX IF NOT EXISTS "expense_entries_status_idx" ON "expense_entries"("status")`,
  `CREATE INDEX IF NOT EXISTS "expense_entries_status_void_idx" ON "expense_entries"("status", "is_void")`,
  `CREATE INDEX IF NOT EXISTS "expense_entries_client_temp_id_idx" ON "expense_entries"("client_temp_id")`,

  `CREATE TABLE IF NOT EXISTS "expense_daily_ledgers" (
    "id"                    TEXT NOT NULL PRIMARY KEY,
    "branch_id"             TEXT NOT NULL,
    "date"                  DATE NOT NULL,
    "opening_balance"       INTEGER NOT NULL DEFAULT 0,
    "cash_received"         INTEGER NOT NULL DEFAULT 0,
    "total_expenses"        INTEGER NOT NULL DEFAULT 0,
    "closing_balance"       INTEGER NOT NULL DEFAULT 0,
    "physical_cash_counted" INTEGER,
    "variance"              INTEGER,
    "is_reconciled"         BOOLEAN NOT NULL DEFAULT false,
    "reconciled_by_id"      TEXT,
    "reconciled_at"         TIMESTAMP(3),
    "reconciliation_notes"  TEXT,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expense_daily_ledgers_branch_date_key" UNIQUE ("branch_id", "date")
  )`,
  `CREATE INDEX IF NOT EXISTS "expense_daily_ledgers_date_idx" ON "expense_daily_ledgers"("date")`,
  `CREATE INDEX IF NOT EXISTS "expense_daily_ledgers_branch_reconciled_idx" ON "expense_daily_ledgers"("branch_id", "is_reconciled")`,

  `CREATE TABLE IF NOT EXISTS "expense_float_top_ups" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "branch_id"    TEXT NOT NULL,
    "date"         DATE NOT NULL,
    "amount"       INTEGER NOT NULL,
    "source"       TEXT NOT NULL,
    "reference_no" TEXT,
    "notes"        TEXT,
    "receipt_attachment" TEXT,
    "added_by_id"  TEXT NOT NULL,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "expense_float_top_ups_branch_date_idx" ON "expense_float_top_ups"("branch_id", "date")`,
  `CREATE INDEX IF NOT EXISTS "expense_float_top_ups_branch_created_idx" ON "expense_float_top_ups"("branch_id", "created_at" DESC)`,

  `CREATE TABLE IF NOT EXISTS "branch_cash_balances" (
    "branch_id"          TEXT NOT NULL PRIMARY KEY,
    "current_balance"    INTEGER NOT NULL DEFAULT 0,
    "last_entry_at"      TIMESTAMP(3),
    "last_reconciled_at" TIMESTAMP(3),
    "updated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "expense_daily_rollups" (
    "id"                     TEXT NOT NULL PRIMARY KEY,
    "branch_id"              TEXT NOT NULL,
    "date"                   DATE NOT NULL,
    "category_id"            TEXT NOT NULL,
    "total_amount"           INTEGER NOT NULL DEFAULT 0,
    "entry_count"            INTEGER NOT NULL DEFAULT 0,
    "payment_mode_breakdown" JSONB,
    "updated_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expense_daily_rollups_branch_date_category_key" UNIQUE ("branch_id", "date", "category_id")
  )`,
  `CREATE INDEX IF NOT EXISTS "expense_daily_rollups_date_idx" ON "expense_daily_rollups"("date")`,
  `CREATE INDEX IF NOT EXISTS "expense_daily_rollups_branch_date_idx" ON "expense_daily_rollups"("branch_id", "date")`,

  `CREATE TABLE IF NOT EXISTS "expense_monthly_rollups" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "branch_id"    TEXT NOT NULL,
    "year"         INTEGER NOT NULL,
    "month"        INTEGER NOT NULL,
    "category_id"  TEXT NOT NULL,
    "total_amount" INTEGER NOT NULL DEFAULT 0,
    "entry_count"  INTEGER NOT NULL DEFAULT 0,
    "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expense_monthly_rollups_branch_ym_category_key" UNIQUE ("branch_id", "year", "month", "category_id")
  )`,
  `CREATE INDEX IF NOT EXISTS "expense_monthly_rollups_ym_idx" ON "expense_monthly_rollups"("year", "month")`,
  `CREATE INDEX IF NOT EXISTS "expense_monthly_rollups_branch_ym_idx" ON "expense_monthly_rollups"("branch_id", "year", "month")`,

  `CREATE TABLE IF NOT EXISTS "expense_audit_logs" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "expense_id"      TEXT,
    "action"          TEXT NOT NULL,
    "performed_by_id" TEXT NOT NULL,
    "changes"         JSONB,
    "reason"          TEXT,
    "ip_address"      TEXT,
    "user_agent"      TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "expense_audit_logs_expense_idx" ON "expense_audit_logs"("expense_id")`,
  `CREATE INDEX IF NOT EXISTS "expense_audit_logs_performer_idx" ON "expense_audit_logs"("performed_by_id")`,
  `CREATE INDEX IF NOT EXISTS "expense_audit_logs_action_idx" ON "expense_audit_logs"("action")`,

  `CREATE TABLE IF NOT EXISTS "expense_sequences" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "prefix"      TEXT NOT NULL UNIQUE,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "expense_settings" (
    "id"                      TEXT NOT NULL PRIMARY KEY,
    "branch_id"               TEXT UNIQUE,
    "auto_approval_threshold" INTEGER NOT NULL DEFAULT 200000,
    "require_receipt_above"   INTEGER,
    "alert_negative_balance"  BOOLEAN NOT NULL DEFAULT true,
    "fiscal_year_start_month" INTEGER NOT NULL DEFAULT 4,
    "updated_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  // ─── DEDICATED PROFORMA INVOICES MODULE TABLES & TYPES (TOP PRIORITY) ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProformaInvoiceStatus') THEN
      CREATE TYPE "ProformaInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'SENT', 'APPROVED', 'ACCEPTED', 'ADVANCE_RECEIVED', 'CONVERTED_TO_INVOICE', 'CANCELLED', 'EXPIRED');
    END IF;
  END $$`,

  `CREATE TABLE IF NOT EXISTS "proforma_invoices" (
    "id"                       TEXT NOT NULL,
    "pi_number"                TEXT NOT NULL,
    "financial_year"           TEXT NOT NULL,
    "sequence_no"              INTEGER NOT NULL DEFAULT 1,
    "status"                   "ProformaInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "quote_id"                 TEXT,
    "quote_number"             TEXT,
    "po_id"                    TEXT,
    "po_number"                TEXT,
    "customer_po_number"       TEXT,
    "order_id"                 TEXT,
    "customer_id"              TEXT,
    "customer_name"            TEXT NOT NULL,
    "company_name"             TEXT,
    "customer_email"           TEXT NOT NULL,
    "customer_phone"           TEXT,
    "gstin"                    VARCHAR(15),
    "pan"                      TEXT,
    "billing_address"          TEXT,
    "shipping_address"         TEXT,
    "place_of_supply"          TEXT,
    "subtotal"                 DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxable_amount"           DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cgst"                     DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sgst"                     DECIMAL(12,2) NOT NULL DEFAULT 0,
    "igst"                     DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cess"                     DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount"                 DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shipping_cost"            DECIMAL(12,2) NOT NULL DEFAULT 0,
    "round_off"                DECIMAL(6,2) NOT NULL DEFAULT 0,
    "grand_total"              DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency"                 TEXT NOT NULL DEFAULT 'INR',
    "advance_percentage"       DECIMAL(5,2) NOT NULL DEFAULT 30,
    "advance_amount"           DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance_due"              DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payment_terms"            TEXT,
    "delivery_timeline"        TEXT,
    "valid_until"              TIMESTAMP(3),
    "verification_token"       TEXT NOT NULL,
    "verification_id"          TEXT NOT NULL,
    "document_hash"            TEXT NOT NULL,
    "digital_signature"        TEXT,
    "signed_by"                TEXT,
    "signed_at"                TIMESTAMP(3),
    "qr_code_data_url"         TEXT,
    "pdf_path"                 TEXT,
    "notes"                    TEXT,
    "terms_and_conditions"     TEXT,
    "bank_details"             JSONB,
    "converted_invoice_id"     TEXT,
    "converted_invoice_number" TEXT,
    "converted_at"             TIMESTAMP(3),
    "created_by"               TEXT,
    "updated_by"               TEXT,
    "approved_by"              TEXT,
    "approved_at"              TIMESTAMP(3),
    "sent_at"                  TIMESTAMP(3),
    "cancelled_at"             TIMESTAMP(3),
    "cancelled_reason"         TEXT,
    "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"               TIMESTAMP(3),
    CONSTRAINT "proforma_invoices_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "proforma_invoices_pi_number_key" ON "proforma_invoices"("pi_number")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "proforma_invoices_verification_token_key" ON "proforma_invoices"("verification_token")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "proforma_invoices_verification_id_key" ON "proforma_invoices"("verification_id")`,
  `CREATE INDEX IF NOT EXISTS "proforma_invoices_financial_year_idx" ON "proforma_invoices"("financial_year")`,
  `CREATE INDEX IF NOT EXISTS "proforma_invoices_status_idx" ON "proforma_invoices"("status")`,
  `CREATE INDEX IF NOT EXISTS "proforma_invoices_customer_id_idx" ON "proforma_invoices"("customer_id")`,
  `CREATE INDEX IF NOT EXISTS "proforma_invoices_quote_number_idx" ON "proforma_invoices"("quote_number")`,
  `CREATE INDEX IF NOT EXISTS "proforma_invoices_po_number_idx" ON "proforma_invoices"("po_number")`,

  // Idempotent column additions for Follow-up & Reminder counters
  `ALTER TABLE "proforma_invoices" ADD COLUMN IF NOT EXISTS "reminder_count" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "proforma_invoices" ADD COLUMN IF NOT EXISTS "email_reminder_count" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "proforma_invoices" ADD COLUMN IF NOT EXISTS "whatsapp_reminder_count" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "proforma_invoices" ADD COLUMN IF NOT EXISTS "last_reminder_at" TIMESTAMP(3)`,
  `ALTER TABLE "proforma_invoices" ADD COLUMN IF NOT EXISTS "last_whatsapp_at" TIMESTAMP(3)`,
  `ALTER TABLE "proforma_invoices" ADD COLUMN IF NOT EXISTS "last_email_at" TIMESTAMP(3)`,

  `CREATE TABLE IF NOT EXISTS "proforma_invoice_items" (
    "id"                   TEXT NOT NULL,
    "proforma_invoice_id"  TEXT NOT NULL,
    "product_id"           TEXT,
    "sku"                  TEXT NOT NULL,
    "product_name"         TEXT NOT NULL,
    "description"          TEXT,
    "hsn_code"             TEXT,
    "unit"                 TEXT NOT NULL DEFAULT 'PCS',
    "quantity"             DECIMAL(10,2) NOT NULL,
    "unit_rate"            DECIMAL(12,2) NOT NULL,
    "discount_percent"     DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxable_amount"       DECIMAL(12,2) NOT NULL,
    "cgst_rate"            DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgst_amount"          DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sgst_rate"            DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sgst_amount"          DECIMAL(12,2) NOT NULL DEFAULT 0,
    "igst_rate"            DECIMAL(5,2) NOT NULL DEFAULT 0,
    "igst_amount"          DECIMAL(12,2) NOT NULL DEFAULT 0,
    "line_total"           DECIMAL(12,2) NOT NULL,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "proforma_invoice_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "proforma_invoice_items_proforma_invoice_id_fkey" FOREIGN KEY ("proforma_invoice_id") REFERENCES "proforma_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS "proforma_invoice_items_proforma_invoice_id_idx" ON "proforma_invoice_items"("proforma_invoice_id")`,
  `CREATE INDEX IF NOT EXISTS "proforma_invoice_items_sku_idx" ON "proforma_invoice_items"("sku")`,
  `CREATE INDEX IF NOT EXISTS "proforma_invoice_items_hsn_code_idx" ON "proforma_invoice_items"("hsn_code")`,

  `CREATE TABLE IF NOT EXISTS "proforma_invoice_history" (
    "id"                   TEXT NOT NULL,
    "proforma_invoice_id"  TEXT NOT NULL,
    "action"               TEXT NOT NULL,
    "performed_by"         TEXT,
    "details"              TEXT,
    "metadata"             JSONB,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "proforma_invoice_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "proforma_invoice_history_proforma_invoice_id_fkey" FOREIGN KEY ("proforma_invoice_id") REFERENCES "proforma_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS "proforma_invoice_history_proforma_invoice_id_idx" ON "proforma_invoice_history"("proforma_invoice_id")`,
  `CREATE INDEX IF NOT EXISTS "proforma_invoice_history_action_idx" ON "proforma_invoice_history"("action")`,

  `CREATE TABLE IF NOT EXISTS "proforma_invoice_sequences" (
    "id"             TEXT NOT NULL,
    "financial_year" TEXT NOT NULL,
    "branch_code"    TEXT NOT NULL DEFAULT 'MAIN',
    "next_number"    INTEGER NOT NULL DEFAULT 1,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "proforma_invoice_sequences_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "proforma_invoice_sequences_financial_year_branch_code_key" ON "proforma_invoice_sequences"("financial_year", "branch_code")`,

  // ─── PO Management & Inbound Email Tables & Types ────────────────────────
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PoClassification') THEN
      CREATE TYPE "PoClassification" AS ENUM ('PO_DETECTED', 'POSSIBLE_PO', 'GENERAL_EMAIL');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PoSource') THEN
      CREATE TYPE "PoSource" AS ENUM ('EMAIL', 'QUOTATION', 'PO_FORM', 'CUSTOM_PDF_UPLOAD');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PoStatus') THEN
      CREATE TYPE "PoStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'PROCESSING', 'WAITING_FOR_CUSTOMER', 'COMPLETED', 'CANCELLED', 'ON_HOLD');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PoPriority') THEN
      CREATE TYPE "PoPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmailDirection') THEN
      CREATE TYPE "EmailDirection" AS ENUM ('INCOMING', 'OUTGOING');
    END IF;
  END $$`,

  `CREATE TABLE IF NOT EXISTS "po_submissions" (
    "id" TEXT NOT NULL,
    "po_submission_id" TEXT,
    "source" "PoSource" NOT NULL DEFAULT 'EMAIL',
    "classification" "PoClassification" NOT NULL DEFAULT 'PO_DETECTED',
    "confidence_score" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "customer_po_number" TEXT,
    "customer_name" TEXT,
    "company_name" TEXT,
    "customer_email" TEXT NOT NULL,
    "customer_phone" TEXT,
    "subject" TEXT NOT NULL,
    "preview_text" TEXT,
    "status" "PoStatus" NOT NULL DEFAULT 'NEW',
    "priority" "PoPriority" NOT NULL DEFAULT 'MEDIUM',
    "assigned_user_id" TEXT,
    "assigned_department" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "po_submissions_pkey" PRIMARY KEY ("id")
  )`,
  `ALTER TABLE "po_submissions" ADD COLUMN IF NOT EXISTS "po_submission_id" TEXT`,
  `ALTER TABLE "po_submissions" ADD COLUMN IF NOT EXISTS "source" "PoSource" NOT NULL DEFAULT 'EMAIL'`,
  `ALTER TABLE "po_submissions" ADD COLUMN IF NOT EXISTS "classification" "PoClassification" NOT NULL DEFAULT 'PO_DETECTED'`,
  `ALTER TABLE "po_submissions" ADD COLUMN IF NOT EXISTS "confidence_score" DOUBLE PRECISION NOT NULL DEFAULT 1.0`,
  `ALTER TABLE "po_submissions" ADD COLUMN IF NOT EXISTS "customer_po_number" TEXT`,
  `ALTER TABLE "po_submissions" ADD COLUMN IF NOT EXISTS "customer_name" TEXT`,
  `ALTER TABLE "po_submissions" ADD COLUMN IF NOT EXISTS "company_name" TEXT`,
  `ALTER TABLE "po_submissions" ADD COLUMN IF NOT EXISTS "customer_email" TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE "po_submissions" ADD COLUMN IF NOT EXISTS "customer_phone" TEXT`,
  `ALTER TABLE "po_submissions" ADD COLUMN IF NOT EXISTS "subject" TEXT NOT NULL DEFAULT 'No Subject'`,
  `ALTER TABLE "po_submissions" ADD COLUMN IF NOT EXISTS "preview_text" TEXT`,
  `ALTER TABLE "po_submissions" ADD COLUMN IF NOT EXISTS "status" "PoStatus" NOT NULL DEFAULT 'NEW'`,
  `ALTER TABLE "po_submissions" ADD COLUMN IF NOT EXISTS "priority" "PoPriority" NOT NULL DEFAULT 'MEDIUM'`,
  `ALTER TABLE "po_submissions" ADD COLUMN IF NOT EXISTS "assigned_user_id" TEXT`,
  `ALTER TABLE "po_submissions" ADD COLUMN IF NOT EXISTS "assigned_department" TEXT`,
  `ALTER TABLE "po_submissions" ADD COLUMN IF NOT EXISTS "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "po_submissions" ADD COLUMN IF NOT EXISTS "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "po_submissions" ADD COLUMN IF NOT EXISTS "metadata" JSONB`,
  `ALTER TABLE "po_submissions" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "po_submissions" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "po_submissions" ALTER COLUMN "status" TYPE "PoStatus" USING "status"::TEXT::"PoStatus"`,
  `ALTER TABLE "po_submissions" ALTER COLUMN "status" SET DEFAULT 'NEW'::"PoStatus"`,
  `ALTER TABLE "po_submissions" ALTER COLUMN "source" TYPE "PoSource" USING "source"::TEXT::"PoSource"`,
  `ALTER TABLE "po_submissions" ALTER COLUMN "source" SET DEFAULT 'EMAIL'::"PoSource"`,
  `ALTER TABLE "po_submissions" ALTER COLUMN "classification" TYPE "PoClassification" USING "classification"::TEXT::"PoClassification"`,
  `ALTER TABLE "po_submissions" ALTER COLUMN "classification" SET DEFAULT 'PO_DETECTED'::"PoClassification"`,
  `ALTER TABLE "po_submissions" ALTER COLUMN "priority" TYPE "PoPriority" USING "priority"::TEXT::"PoPriority"`,
  `ALTER TABLE "po_submissions" ALTER COLUMN "priority" SET DEFAULT 'MEDIUM'::"PoPriority"`,
  `DO $$ 
  DECLARE
    col record;
  BEGIN
    FOR col IN 
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'po_submissions' 
        AND is_nullable = 'NO'
        AND column_name NOT IN ('id', 'customer_email', 'subject', 'created_at', 'updated_at')
    LOOP
      EXECUTE format('ALTER TABLE "po_submissions" ALTER COLUMN %I DROP NOT NULL', col.column_name);
    END LOOP;
  END $$`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "po_submissions_po_submission_id_key" ON "po_submissions"("po_submission_id")`,
  `CREATE INDEX IF NOT EXISTS "po_submissions_customer_po_number_idx" ON "po_submissions"("customer_po_number")`,
  `CREATE INDEX IF NOT EXISTS "po_submissions_customer_email_idx" ON "po_submissions"("customer_email")`,
  `CREATE INDEX IF NOT EXISTS "po_submissions_classification_idx" ON "po_submissions"("classification")`,
  `CREATE INDEX IF NOT EXISTS "po_submissions_status_idx" ON "po_submissions"("status")`,
  `CREATE INDEX IF NOT EXISTS "po_submissions_priority_idx" ON "po_submissions"("priority")`,
  `CREATE INDEX IF NOT EXISTS "po_submissions_assigned_user_id_idx" ON "po_submissions"("assigned_user_id")`,
  `CREATE INDEX IF NOT EXISTS "po_submissions_received_at_idx" ON "po_submissions"("received_at")`,
  `CREATE INDEX IF NOT EXISTS "po_submissions_last_activity_at_idx" ON "po_submissions"("last_activity_at")`,

  `CREATE TABLE IF NOT EXISTS "po_email_messages" (
    "id" TEXT NOT NULL,
    "po_submission_id" TEXT,
    "message_id" TEXT NOT NULL,
    "provider_email_id" TEXT,
    "thread_id" TEXT,
    "in_reply_to" TEXT,
    "references" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "direction" "EmailDirection" NOT NULL DEFAULT 'INCOMING',
    "sender_name" TEXT,
    "sender_email" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "cc" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "bcc" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "subject" TEXT NOT NULL,
    "plain_text_body" TEXT,
    "html_body" TEXT,
    "raw_headers" JSONB,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "po_email_messages_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "po_email_messages_message_id_key" ON "po_email_messages"("message_id")`,
  `CREATE INDEX IF NOT EXISTS "po_email_messages_po_submission_id_idx" ON "po_email_messages"("po_submission_id")`,
  `CREATE INDEX IF NOT EXISTS "po_email_messages_thread_id_idx" ON "po_email_messages"("thread_id")`,
  `CREATE INDEX IF NOT EXISTS "po_email_messages_sender_email_idx" ON "po_email_messages"("sender_email")`,
  `CREATE INDEX IF NOT EXISTS "po_email_messages_received_at_idx" ON "po_email_messages"("received_at")`,

  `CREATE TABLE IF NOT EXISTS "po_email_attachments" (
    "id" TEXT NOT NULL,
    "po_submission_id" TEXT,
    "email_message_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "storage_url" TEXT NOT NULL,
    "extracted_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "po_email_attachments_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "po_email_attachments_po_submission_id_idx" ON "po_email_attachments"("po_submission_id")`,
  `CREATE INDEX IF NOT EXISTS "po_email_attachments_email_message_id_idx" ON "po_email_attachments"("email_message_id")`,

  `CREATE TABLE IF NOT EXISTS "po_internal_notes" (
    "id" TEXT NOT NULL,
    "po_submission_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "po_internal_notes_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "po_internal_notes_po_submission_id_idx" ON "po_internal_notes"("po_submission_id")`,
  `CREATE INDEX IF NOT EXISTS "po_internal_notes_user_id_idx" ON "po_internal_notes"("user_id")`,

  `CREATE TABLE IF NOT EXISTS "po_activity_logs" (
    "id" TEXT NOT NULL,
    "po_submission_id" TEXT NOT NULL,
    "activity_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "previous_value" TEXT,
    "new_value" TEXT,
    "performed_by_user_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "po_activity_logs_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "po_activity_logs_po_submission_id_idx" ON "po_activity_logs"("po_submission_id")`,
  `CREATE INDEX IF NOT EXISTS "po_activity_logs_activity_type_idx" ON "po_activity_logs"("activity_type")`,
  `CREATE INDEX IF NOT EXISTS "po_activity_logs_created_at_idx" ON "po_activity_logs"("created_at")`,

  `CREATE TABLE IF NOT EXISTS "po_sequences" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "po_sequences_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "po_sequences_year_key" ON "po_sequences"("year")`,

  // ─── Projects table for Our Clients & Completed Projects ───────────────────
  `CREATE TABLE IF NOT EXISTS "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "location" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "region" TEXT,
    "is_pan_india" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT NOT NULL DEFAULT 'Commercial',
    "description" TEXT,
    "completion_year" TEXT,
    "products_used" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "video_url" TEXT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "projects_status_is_featured_idx" ON "projects"("status", "is_featured")`,
  `CREATE INDEX IF NOT EXISTS "projects_city_idx" ON "projects"("city")`,
  `CREATE INDEX IF NOT EXISTS "projects_category_idx" ON "projects"("category")`,
  `CREATE INDEX IF NOT EXISTS "projects_is_pan_india_idx" ON "projects"("is_pan_india")`,

  // ─── Coupons table missing columns ────────────────────────────────────────
  `ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "applicable_product_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`,
  `ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "applicable_category_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`,

  // ─── Add 2FA columns and B2B advance payment to users table ───────────────
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_enabled"      BOOLEAN   NOT NULL DEFAULT false`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_secret"       TEXT`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_backup_codes" TEXT[]    NOT NULL DEFAULT ARRAY[]::TEXT[]`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "b2b_advance_percentage"  DECIMAL(5,2) DEFAULT 70.00`,
  // Ensure the default is always present on the column (idempotent — safe to run multiple times)
  `ALTER TABLE "users" ALTER COLUMN "two_factor_backup_codes" SET DEFAULT ARRAY[]::TEXT[]`,
  `UPDATE "users" SET "two_factor_backup_codes" = ARRAY[]::TEXT[] WHERE "two_factor_backup_codes" IS NULL`,

  // Create QuoteStatus enum if it doesn't exist
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'QuoteStatus') THEN
      CREATE TYPE "QuoteStatus" AS ENUM ('PENDING','UNDER_REVIEW','APPROVED','REJECTED','CONVERTED','EXPIRED');
    END IF;
  END $$`,

  // Rename camelCase columns on quotes table
  `DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='quoteNumber') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='quote_number') THEN
      ALTER TABLE "quotes" RENAME COLUMN "quoteNumber" TO "quote_number";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='createdAt') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='created_at') THEN
      ALTER TABLE "quotes" RENAME COLUMN "createdAt" TO "created_at";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='updatedAt') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='updated_at') THEN
      ALTER TABLE "quotes" RENAME COLUMN "updatedAt" TO "updated_at";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='userId') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='user_id') THEN
      ALTER TABLE "quotes" RENAME COLUMN "userId" TO "user_id";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='discountTotal') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='discount_total') THEN
      ALTER TABLE "quotes" RENAME COLUMN "discountTotal" TO "discount_total";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='taxTotal') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='tax_total') THEN
      ALTER TABLE "quotes" RENAME COLUMN "taxTotal" TO "tax_total";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='grandTotal') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='grand_total') THEN
      ALTER TABLE "quotes" RENAME COLUMN "grandTotal" TO "grand_total";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='adminNotes') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='admin_notes') THEN
      ALTER TABLE "quotes" RENAME COLUMN "adminNotes" TO "admin_notes";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='validUntil') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='valid_until') THEN
      ALTER TABLE "quotes" RENAME COLUMN "validUntil" TO "valid_until";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='convertedOrderId') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='converted_order_id') THEN
      ALTER TABLE "quotes" RENAME COLUMN "convertedOrderId" TO "converted_order_id";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='customerProposedAdvancePercent') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='customer_proposed_advance_percent') THEN
      ALTER TABLE "quotes" RENAME COLUMN "customerProposedAdvancePercent" TO "customer_proposed_advance_percent";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='customerEditCount') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='customer_edit_count') THEN
      ALTER TABLE "quotes" RENAME COLUMN "customerEditCount" TO "customer_edit_count";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='customerEditRemark') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='customer_edit_remark') THEN
      ALTER TABLE "quotes" RENAME COLUMN "customerEditRemark" TO "customer_edit_remark";
    END IF;
  END $$`,

  // Add all missing snake_case columns to quotes
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "quote_number"                      TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "reference_no"                      TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "financial_year"                    TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "sequence_no"                       INTEGER`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "project_name"                      TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "first_name"                        TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "last_name"                         TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "company_name"                      TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "gst_no"                            TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "email"                             TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "phone"                             TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "user_id"                           TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "status_reason"                     TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "basic_price"                       DECIMAL(12,2)`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "gst_amount"                        DECIMAL(12,2)`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "shipping_cost"                     DECIMAL(12,2)`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "subtotal"                          DECIMAL(12,2)`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "discount_total"                    DECIMAL(12,2)`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "tax_total"                         DECIMAL(12,2)`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "grand_total"                       DECIMAL(12,2)`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "advance_percentage"                DECIMAL(5,2)`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "customer_proposed_advance_percent"  DECIMAL(5,2)`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "customer_edit_count"               INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "customer_edit_remark"              TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "admin_notes"                       TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "terms_accepted"                    BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "customer_response"                 TEXT NOT NULL DEFAULT 'pending'`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "customer_response_notes"           TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "customer_response_at"              TIMESTAMP(3)`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "access_token"                      TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "digital_signature"                 TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "signed_by"                         TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "signed_at"                         TIMESTAMP(3)`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "qr_code_data"                      TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "valid_until"                       TIMESTAMP(3)`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "converted_order_id"                TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "is_deleted"                        BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "deleted_at"                        TIMESTAMP(3)`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "created_at"                        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "updated_at"                        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,

  // Rename camelCase columns on quote_items table
  `DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_items' AND column_name='quoteId') THEN
      ALTER TABLE "quote_items" RENAME COLUMN "quoteId" TO "quote_id";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_items' AND column_name='productId') THEN
      ALTER TABLE "quote_items" RENAME COLUMN "productId" TO "product_id";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_items' AND column_name='variantId') THEN
      ALTER TABLE "quote_items" RENAME COLUMN "variantId" TO "variant_id";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_items' AND column_name='requestedPrice') THEN
      ALTER TABLE "quote_items" RENAME COLUMN "requestedPrice" TO "requested_price";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_items' AND column_name='createdAt') THEN
      ALTER TABLE "quote_items" RENAME COLUMN "createdAt" TO "created_at";
    END IF;
  END $$`,

  // Add missing columns to quote_items
  `ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "quote_id"              TEXT`,
  `ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "sl_no"                 INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "product_id"            TEXT`,
  `ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "product_name_snapshot" TEXT`,
  `ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "variant_id"            TEXT`,
  `ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "unit"                  TEXT NOT NULL DEFAULT 'PCS'`,
  `ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "rate"                  DECIMAL(12,2)`,
  `ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "amount"                DECIMAL(12,2)`,
  `ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "requested_price"       DECIMAL(12,2)`,
  `ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "offered_price"         DECIMAL(12,2)`,
  `ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "total"                 DECIMAL(12,2)`,
  `ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,

  // Create quote_sequences table if missing
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='quote_sequences') THEN
      CREATE TABLE "quote_sequences" (
        "id"             TEXT NOT NULL,
        "financial_year" TEXT NOT NULL,
        "next_number"    INTEGER NOT NULL DEFAULT 1,
        "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "quote_sequences_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX "quote_sequences_financial_year_key" ON "quote_sequences"("financial_year");
    END IF;
  END $$`,

  // Create quote_activity_logs table if missing
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='quote_activity_logs') THEN
      CREATE TABLE "quote_activity_logs" (
        "id"          TEXT NOT NULL,
        "quote_id"    TEXT NOT NULL,
        "changed_by"  TEXT,
        "change_type" TEXT NOT NULL,
        "old_value"   JSONB,
        "new_value"   JSONB,
        "note"        TEXT,
        "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "quote_activity_logs_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX "quote_activity_logs_quote_id_idx" ON "quote_activity_logs"("quote_id");
    END IF;
  END $$`,

  // Create quotation_revisions table if missing
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='quotation_revisions') THEN
      CREATE TABLE "quotation_revisions" (
        "id"              TEXT NOT NULL,
        "quote_id"        TEXT NOT NULL,
        "changed_by"      TEXT NOT NULL,
        "changed_by_id"   TEXT,
        "previous_values" JSONB NOT NULL,
        "new_values"      JSONB NOT NULL,
        "remark"          TEXT NOT NULL,
        "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "quotation_revisions_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX "quotation_revisions_quote_id_idx" ON "quotation_revisions"("quote_id");
    END IF;
  END $$`,

  // Safe unique indexes on quotes
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='quotes' AND indexname='quotes_quote_number_key') THEN
      CREATE UNIQUE INDEX "quotes_quote_number_key" ON "quotes"("quote_number") WHERE "quote_number" IS NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='quotes' AND indexname='quotes_reference_no_key') THEN
      CREATE UNIQUE INDEX "quotes_reference_no_key" ON "quotes"("reference_no") WHERE "reference_no" IS NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='quotes' AND indexname='quotes_access_token_key') THEN
      CREATE UNIQUE INDEX "quotes_access_token_key" ON "quotes"("access_token") WHERE "access_token" IS NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='quotes' AND indexname='quotes_user_id_idx') THEN
      CREATE INDEX "quotes_user_id_idx" ON "quotes"("user_id");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='quotes' AND indexname='quotes_status_idx') THEN
      CREATE INDEX "quotes_status_idx" ON "quotes"("status");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='quotes' AND indexname='quotes_is_deleted_idx') THEN
      CREATE INDEX "quotes_is_deleted_idx" ON "quotes"("is_deleted");
    END IF;
  END $$`,

  // ─── PO MODULE ENUMS ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'B2BPoStatus') THEN
      CREATE TYPE "B2BPoStatus" AS ENUM (
        'DRAFT', 'SUBMITTED', 'VALIDATION_FAILED', 'AWAITING_ADVANCE_PAYMENT',
        'PAYMENT_RECEIPT_SUBMITTED', 'PAYMENT_ACKNOWLEDGED', 'PAYMENT_VERIFIED',
        'PACKING_LIST_GENERATED', 'DISPATCHED', 'INVOICE_GENERATION_FAILED', 'INVOICED',
        'REJECTED', 'CANCELLED'
      );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentReceiptStatus') THEN
      CREATE TYPE "PaymentReceiptStatus" AS ENUM ('PENDING_REVIEW', 'REJECTED', 'ACKNOWLEDGED', 'VERIFIED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PoNotificationType') THEN
      CREATE TYPE "PoNotificationType" AS ENUM (
        'PO_SUBMITTED', 'ADVANCE_PAYMENT_REQUESTED', 'RECEIPT_UPLOADED',
        'PAYMENT_ACKNOWLEDGED', 'PAYMENT_VERIFIED', 'PACKING_LIST_READY', 'INVOICE_READY',
        'PO_REJECTED', 'RECEIPT_REJECTED'
      );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PoNotificationStatus') THEN
      CREATE TYPE "PoNotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');
    END IF;
  END $$`,

  // ─── B2B PURCHASE ORDERS TABLE ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='b2b_purchase_orders') THEN
      CREATE TABLE "b2b_purchase_orders" (
        "id"                           TEXT NOT NULL,
        "po_number"                    TEXT NOT NULL,
        "quotation_id"                 TEXT NOT NULL,
        "quotation_number"             TEXT NOT NULL,
        "customer_id"                  TEXT NOT NULL,
        "status"                       "B2BPoStatus" NOT NULL DEFAULT 'SUBMITTED',
        "customer_po_reference_number" TEXT,
        "billing_address"              JSONB NOT NULL,
        "delivery_address"             JSONB NOT NULL,
        "delivery_instructions"        TEXT,
        "requested_delivery_date"      TIMESTAMP(3),
        "subtotal"                     DECIMAL(12,2) NOT NULL,
        "tax_total"                    DECIMAL(12,2) NOT NULL,
        "discount_total"               DECIMAL(12,2) NOT NULL DEFAULT 0,
        "shipping_cost"                DECIMAL(12,2) NOT NULL DEFAULT 0,
        "total_amount"                 DECIMAL(12,2) NOT NULL,
        "currency"                     TEXT NOT NULL DEFAULT 'INR',
        "advance_percentage"           DECIMAL(5,2) NOT NULL DEFAULT 30,
        "advance_amount"               DECIMAL(12,2) NOT NULL,
        "balance_amount"               DECIMAL(12,2) NOT NULL,
        "validation_errors"            JSONB,
        "submitted_at"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "validated_at"                 TIMESTAMP(3),
        "rejected_at"                  TIMESTAMP(3),
        "rejection_reason"             TEXT,
        "created_by"                   TEXT,
        "created_at"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "b2b_purchase_orders_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX "b2b_purchase_orders_po_number_key" ON "b2b_purchase_orders"("po_number");
      CREATE UNIQUE INDEX "b2b_purchase_orders_quotation_id_key" ON "b2b_purchase_orders"("quotation_id");
      CREATE INDEX "b2b_purchase_orders_customer_id_idx" ON "b2b_purchase_orders"("customer_id");
      CREATE INDEX "b2b_purchase_orders_status_idx" ON "b2b_purchase_orders"("status");
      CREATE INDEX "b2b_purchase_orders_created_at_idx" ON "b2b_purchase_orders"("created_at");
    END IF;
  END $$`,

  // ─── B2B PURCHASE ORDER ITEMS TABLE ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='b2b_purchase_order_items') THEN
      CREATE TABLE "b2b_purchase_order_items" (
        "id"                 TEXT NOT NULL,
        "purchase_order_id"  TEXT NOT NULL,
        "sl_no"              INTEGER NOT NULL DEFAULT 1,
        "product_id"         TEXT NOT NULL,
        "product_name"       TEXT NOT NULL,
        "sku"                TEXT,
        "variant_id"         TEXT,
        "unit"               TEXT NOT NULL DEFAULT 'PCS',
        "quantity"           INTEGER NOT NULL,
        "rate"               DECIMAL(12,2) NOT NULL,
        "amount"             DECIMAL(12,2) NOT NULL,
        "tax_rate"           DECIMAL(5,2),
        "tax_amount"         DECIMAL(12,2),
        "total"              DECIMAL(12,2) NOT NULL,
        "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "b2b_purchase_order_items_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX "b2b_purchase_order_items_purchase_order_id_idx" ON "b2b_purchase_order_items"("purchase_order_id");
      CREATE INDEX "b2b_purchase_order_items_product_id_idx" ON "b2b_purchase_order_items"("product_id");
    END IF;
  END $$`,

  // ─── PAYMENT RECEIPTS TABLE ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='payment_receipts') THEN
      CREATE TABLE "payment_receipts" (
        "id"                 TEXT NOT NULL,
        "purchase_order_id"  TEXT NOT NULL,
        "status"             "PaymentReceiptStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
        "file_storage_key"   TEXT NOT NULL,
        "original_file_name" TEXT NOT NULL,
        "file_size_bytes"    INTEGER NOT NULL,
        "mime_type"          TEXT NOT NULL,
        "file_hash"          TEXT NOT NULL,
        "uploaded_by"        TEXT NOT NULL,
        "uploaded_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "version"            INTEGER NOT NULL DEFAULT 1,
        "amount_received"    DECIMAL(12,2),
        "payment_date"       TIMESTAMP(3),
        "payment_reference"  TEXT,
        "payment_method"     TEXT,
        "remarks"            TEXT,
        "acknowledged_by"    TEXT,
        "acknowledged_at"    TIMESTAMP(3),
        "verified_by"        TEXT,
        "verified_at"        TIMESTAMP(3),
        "verification_notes" TEXT,
        "rejected_by"        TEXT,
        "rejected_at"        TIMESTAMP(3),
        "rejection_reason"   TEXT,
        "is_deleted"         BOOLEAN NOT NULL DEFAULT false,
        "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX "payment_receipts_purchase_order_id_idx" ON "payment_receipts"("purchase_order_id");
      CREATE INDEX "payment_receipts_status_idx" ON "payment_receipts"("status");
    END IF;
  END $$`,

  // ─── PAYMENT RECEIPT HISTORIES TABLE ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='payment_receipt_histories') THEN
      CREATE TABLE "payment_receipt_histories" (
        "id"                 TEXT NOT NULL,
        "receipt_id"         TEXT NOT NULL,
        "purchase_order_id"  TEXT NOT NULL,
        "file_storage_key"   TEXT NOT NULL,
        "original_file_name" TEXT NOT NULL,
        "file_size_bytes"    INTEGER NOT NULL,
        "mime_type"          TEXT NOT NULL,
        "file_hash"          TEXT NOT NULL,
        "version"            INTEGER NOT NULL,
        "uploaded_by"        TEXT NOT NULL,
        "uploaded_at"        TIMESTAMP(3) NOT NULL,
        "archived_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "payment_receipt_histories_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX "payment_receipt_histories_receipt_id_idx" ON "payment_receipt_histories"("receipt_id");
      CREATE INDEX "payment_receipt_histories_purchase_order_id_idx" ON "payment_receipt_histories"("purchase_order_id");
    END IF;
  END $$`,

  // ─── PACKING LISTS TABLE ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='packing_lists') THEN
      CREATE TABLE "packing_lists" (
        "id"                TEXT NOT NULL,
        "purchase_order_id" TEXT NOT NULL,
        "quotation_number"  TEXT NOT NULL,
        "po_number"         TEXT NOT NULL,
        "file_storage_key"  TEXT NOT NULL,
        "file_hash"         TEXT,
        "total_packages"    INTEGER NOT NULL DEFAULT 1,
        "total_quantity"    INTEGER NOT NULL DEFAULT 0,
        "qr_code_data"      TEXT,
        "notes"             TEXT,
        "generated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "packing_lists_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX "packing_lists_purchase_order_id_key" ON "packing_lists"("purchase_order_id");
      CREATE INDEX "packing_lists_po_number_idx" ON "packing_lists"("po_number");
    END IF;
  END $$`,

  // ─── PO DISPATCHES TABLE ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='po_dispatches') THEN
      CREATE TABLE "po_dispatches" (
        "id"                 TEXT NOT NULL,
        "purchase_order_id"  TEXT NOT NULL,
        "dispatched_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "dispatched_by"      TEXT NOT NULL,
        "dispatched_by_name" TEXT,
        "carrier_name"       TEXT NOT NULL,
        "tracking_number"    TEXT,
        "dispatch_notes"     TEXT,
        "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "po_dispatches_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX "po_dispatches_purchase_order_id_key" ON "po_dispatches"("purchase_order_id");
    END IF;
  END $$`,

  // ─── B2B PO INVOICES TABLE ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='b2b_po_invoices') THEN
      CREATE TABLE "b2b_po_invoices" (
        "id"                     TEXT NOT NULL,
        "purchase_order_id"      TEXT NOT NULL,
        "quotation_number"       TEXT NOT NULL,
        "po_number"              TEXT NOT NULL,
        "invoice_number"         TEXT NOT NULL,
        "source"                 TEXT NOT NULL DEFAULT 'INTERNAL_ADAPTER',
        "external_invoice_id"    TEXT,
        "pdf_storage_key_or_url" TEXT,
        "amount_invoiced"        DECIMAL(12,2) NOT NULL,
        "amount_paid_advance"    DECIMAL(12,2) NOT NULL,
        "balance_due"            DECIMAL(12,2) NOT NULL,
        "status"                 TEXT NOT NULL DEFAULT 'GENERATED',
        "error_details"          JSONB,
        "file_hash"              TEXT,
        "verification_token"     TEXT,
        "generated_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "b2b_po_invoices_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX "b2b_po_invoices_purchase_order_id_key" ON "b2b_po_invoices"("purchase_order_id");
      CREATE UNIQUE INDEX "b2b_po_invoices_invoice_number_key" ON "b2b_po_invoices"("invoice_number");
    END IF;
  END $$`,

  // ─── PO AUDIT LOGS TABLE ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='po_audit_logs') THEN
      CREATE TABLE "po_audit_logs" (
        "id"                TEXT NOT NULL,
        "purchase_order_id" TEXT NOT NULL,
        "entity_type"       TEXT NOT NULL DEFAULT 'PURCHASE_ORDER',
        "action"            TEXT NOT NULL,
        "from_status"       TEXT,
        "to_status"         TEXT,
        "performed_by"      TEXT,
        "performed_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "metadata"          JSONB,
        "ip_address"        TEXT,
        CONSTRAINT "po_audit_logs_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX "po_audit_logs_purchase_order_id_idx" ON "po_audit_logs"("purchase_order_id");
    END IF;
  END $$`,

  // ─── PO NOTIFICATION LOGS TABLE ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='po_notification_logs') THEN
      CREATE TABLE "po_notification_logs" (
        "id"                  TEXT NOT NULL,
        "purchase_order_id"   TEXT NOT NULL,
        "type"                "PoNotificationType" NOT NULL,
        "recipient"           TEXT NOT NULL,
        "status"              "PoNotificationStatus" NOT NULL DEFAULT 'QUEUED',
        "provider_message_id" TEXT,
        "error"               TEXT,
        "attempts"            INTEGER NOT NULL DEFAULT 1,
        "sent_at"             TIMESTAMP(3),
        "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "po_notification_logs_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX "po_notification_logs_purchase_order_id_idx" ON "po_notification_logs"("purchase_order_id");
    END IF;
  END $$`,

  // ─── ADDRESSES TABLE & ENUM ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AddressType') THEN
      CREATE TYPE "AddressType" AS ENUM ('BILLING', 'SHIPPING');
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='addresses') THEN
      CREATE TABLE "addresses" (
        "id"           TEXT NOT NULL,
        "userId"       TEXT NOT NULL,
        "type"         "AddressType" NOT NULL DEFAULT 'SHIPPING',
        "label"        TEXT DEFAULT 'Home',
        "addressLine1" TEXT NOT NULL,
        "addressLine2" TEXT,
        "city"         TEXT NOT NULL,
        "state"        TEXT NOT NULL,
        "postalCode"   TEXT NOT NULL,
        "country"      TEXT NOT NULL DEFAULT 'India',
        "phone"        TEXT,
        "email"        TEXT,
        "alt_phone"    TEXT,
        "has_whatsapp" BOOLEAN NOT NULL DEFAULT false,
        "latitude"     DOUBLE PRECISION,
        "longitude"    DOUBLE PRECISION,
        "isDefault"    BOOLEAN NOT NULL DEFAULT false,
        "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX IF NOT EXISTS "addresses_userId_idx" ON "addresses"("userId");
    ELSE
      ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "label" TEXT DEFAULT 'Home';
      ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "phone" TEXT;
      ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "email" TEXT;
      ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "alt_phone" TEXT;
      ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "has_whatsapp" BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
      ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
    END IF;
  END $$`,

  // ─── SAVED ADDRESSES TABLE ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='saved_addresses') THEN
      CREATE TABLE "saved_addresses" (
        "id"                  TEXT NOT NULL,
        "customer_id"         TEXT NOT NULL,
        "label"               TEXT DEFAULT 'Default',
        "attention_to"        TEXT NOT NULL,
        "company_name"        TEXT,
        "address_line1"       TEXT NOT NULL,
        "address_line2"       TEXT,
        "city"                TEXT NOT NULL,
        "state"               TEXT NOT NULL,
        "postal_code"         TEXT NOT NULL,
        "country"             TEXT NOT NULL DEFAULT 'IN',
        "phone"               TEXT NOT NULL,
        "email"               TEXT NOT NULL,
        "is_default_billing"  BOOLEAN NOT NULL DEFAULT false,
        "is_default_delivery" BOOLEAN NOT NULL DEFAULT false,
        "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "saved_addresses_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX "saved_addresses_customer_id_idx" ON "saved_addresses"("customer_id");
    END IF;
  END $$`,

  // ─── B2B PO SEQUENCES TABLE ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='b2b_po_sequences') THEN
      CREATE TABLE "b2b_po_sequences" (
        "id"             TEXT NOT NULL,
        "financial_year" TEXT NOT NULL,
        "next_number"    INTEGER NOT NULL DEFAULT 1,
        "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "b2b_po_sequences_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX "b2b_po_sequences_financial_year_key" ON "b2b_po_sequences"("financial_year");
    END IF;
  END $$`,

  // ─── ADVANCE PAYMENT SETTINGS TABLE ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='advance_payment_settings') THEN
      CREATE TABLE "advance_payment_settings" (
        "id"                    TEXT NOT NULL,
        "default_percentage"    DECIMAL(5,2) NOT NULL DEFAULT 30,
        "min_percentage"        DECIMAL(5,2) NOT NULL DEFAULT 10,
        "max_percentage"        DECIMAL(5,2) NOT NULL DEFAULT 100,
        "allow_per_po_override" BOOLEAN NOT NULL DEFAULT true,
        "updated_by"            TEXT,
        "updated_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "advance_payment_settings_pkey" PRIMARY KEY ("id")
      );
    END IF;
  END $$`,

  `ALTER TABLE "advance_payment_settings" ADD COLUMN IF NOT EXISTS "allow_per_po_override" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "advance_payment_settings" ADD COLUMN IF NOT EXISTS "default_percentage"    DECIMAL(5,2) NOT NULL DEFAULT 30`,
  `ALTER TABLE "advance_payment_settings" ADD COLUMN IF NOT EXISTS "min_percentage"        DECIMAL(5,2) NOT NULL DEFAULT 10`,
  `ALTER TABLE "advance_payment_settings" ADD COLUMN IF NOT EXISTS "max_percentage"        DECIMAL(5,2) NOT NULL DEFAULT 100`,

  // ─── BANK ACCOUNT SETTINGS TABLE ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='bank_account_settings') THEN
      CREATE TABLE "bank_account_settings" (
        "id"                     TEXT NOT NULL,
        "account_holder_name"    TEXT NOT NULL,
        "bank_name"              TEXT NOT NULL,
        "account_number"         TEXT NOT NULL,
        "ifsc_or_routing_number" TEXT NOT NULL,
        "swift_code"             TEXT,
        "branch"                 TEXT,
        "currency"               TEXT NOT NULL DEFAULT 'INR',
        "is_active"              BOOLEAN NOT NULL DEFAULT true,
        "updated_by"             TEXT,
        "updated_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "bank_account_settings_pkey" PRIMARY KEY ("id")
      );
    END IF;
  END $$`,

  `ALTER TABLE "bank_account_settings" ADD COLUMN IF NOT EXISTS "account_holder_name"    TEXT`,
  `ALTER TABLE "bank_account_settings" ADD COLUMN IF NOT EXISTS "bank_name"              TEXT`,
  `ALTER TABLE "bank_account_settings" ADD COLUMN IF NOT EXISTS "account_number"         TEXT`,
  `ALTER TABLE "bank_account_settings" ADD COLUMN IF NOT EXISTS "ifsc_or_routing_number" TEXT`,
  `ALTER TABLE "bank_account_settings" ADD COLUMN IF NOT EXISTS "is_active"              BOOLEAN NOT NULL DEFAULT true`,

  // ─── Column-level healing for all PO tables ───
  `ALTER TABLE "b2b_po_invoices" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMP(3)`,
  `ALTER TABLE "b2b_po_invoices" ADD COLUMN IF NOT EXISTS "file_hash" TEXT`,
  `ALTER TABLE "b2b_po_invoices" ADD COLUMN IF NOT EXISTS "verification_token" TEXT`,
  `ALTER TABLE "b2b_po_invoices" ADD COLUMN IF NOT EXISTS "external_invoice_id" TEXT`,
  `ALTER TABLE "b2b_po_invoices" ADD COLUMN IF NOT EXISTS "pdf_storage_key_or_url" TEXT DEFAULT ''`,
  `ALTER TABLE "b2b_po_invoices" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'INTERNAL'`,
  `ALTER TABLE "b2b_po_invoices" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'GENERATED'`,

  `ALTER TABLE "payment_receipts" ADD COLUMN IF NOT EXISTS "amount_received" DECIMAL(12,2)`,
  `ALTER TABLE "payment_receipts" ADD COLUMN IF NOT EXISTS "payment_date" TIMESTAMP(3)`,
  `ALTER TABLE "payment_receipts" ADD COLUMN IF NOT EXISTS "payment_reference" TEXT`,
  `ALTER TABLE "payment_receipts" ADD COLUMN IF NOT EXISTS "payment_method" TEXT`,
  `ALTER TABLE "payment_receipts" ADD COLUMN IF NOT EXISTS "remarks" TEXT`,
  `ALTER TABLE "payment_receipts" ADD COLUMN IF NOT EXISTS "acknowledged_by" TEXT`,
  `ALTER TABLE "payment_receipts" ADD COLUMN IF NOT EXISTS "acknowledged_at" TIMESTAMP(3)`,
  `ALTER TABLE "payment_receipts" ADD COLUMN IF NOT EXISTS "verified_by" TEXT`,
  `ALTER TABLE "payment_receipts" ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMP(3)`,
  `ALTER TABLE "payment_receipts" ADD COLUMN IF NOT EXISTS "verification_notes" TEXT`,
  `ALTER TABLE "payment_receipts" ADD COLUMN IF NOT EXISTS "rejected_by" TEXT`,
  `ALTER TABLE "payment_receipts" ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP(3)`,
  `ALTER TABLE "payment_receipts" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT`,
  `ALTER TABLE "payment_receipts" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false`,

  `ALTER TABLE "packing_lists" ADD COLUMN IF NOT EXISTS "file_hash" TEXT`,
  `ALTER TABLE "packing_lists" ADD COLUMN IF NOT EXISTS "total_packages" INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE "packing_lists" ADD COLUMN IF NOT EXISTS "total_quantity" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "packing_lists" ADD COLUMN IF NOT EXISTS "qr_code_data" TEXT`,
  `ALTER TABLE "packing_lists" ADD COLUMN IF NOT EXISTS "notes" TEXT`,

  `ALTER TABLE "po_dispatches" ADD COLUMN IF NOT EXISTS "dispatched_by_name" TEXT`,
  `ALTER TABLE "po_dispatches" ADD COLUMN IF NOT EXISTS "tracking_number" TEXT`,
  `ALTER TABLE "po_dispatches" ADD COLUMN IF NOT EXISTS "dispatch_notes" TEXT`,

  `ALTER TABLE "b2b_purchase_orders" ADD COLUMN IF NOT EXISTS "customer_po_reference_number" TEXT`,
  `ALTER TABLE "b2b_purchase_orders" ADD COLUMN IF NOT EXISTS "delivery_instructions" TEXT`,
  `ALTER TABLE "b2b_purchase_orders" ADD COLUMN IF NOT EXISTS "requested_delivery_date" TIMESTAMP(3)`,
  `ALTER TABLE "b2b_purchase_orders" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT`,
  `ALTER TABLE "b2b_purchase_orders" ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP(3)`,
  `ALTER TABLE "b2b_purchase_orders" ADD COLUMN IF NOT EXISTS "validated_at" TIMESTAMP(3)`,
  `ALTER TABLE "b2b_purchase_orders" ADD COLUMN IF NOT EXISTS "validation_notes" TEXT`,
  `ALTER TABLE "b2b_purchase_orders" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false`,

  // ─── USER B2B ADVANCE PERCENTAGE ───
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "b2b_advance_percentage" DECIMAL(5,2)`,

  // ─── ENUM EXTENSIONS FOR B2BPoStatus ───
  `DO $$ BEGIN
    ALTER TYPE "B2BPoStatus" ADD VALUE IF NOT EXISTS 'PI_GENERATED';
    ALTER TYPE "B2BPoStatus" ADD VALUE IF NOT EXISTS 'TAX_INVOICE_GENERATED';
    ALTER TYPE "B2BPoStatus" ADD VALUE IF NOT EXISTS 'EWAY_BILL_GENERATED';
    ALTER TYPE "B2BPoStatus" ADD VALUE IF NOT EXISTS 'ISSUE_LIST_GENERATED';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,

  // ─── B2B PROFORMA INVOICES TABLE ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='b2b_proforma_invoices') THEN
      CREATE TABLE "b2b_proforma_invoices" (
        "id"                      TEXT NOT NULL,
        "purchase_order_id"       TEXT NOT NULL,
        "quotation_number"        TEXT,
        "po_number"               TEXT NOT NULL,
        "pi_number"               TEXT NOT NULL,
        "pdf_storage_key_or_url"  TEXT NOT NULL,
        "subtotal"                DECIMAL(12,2) NOT NULL,
        "tax_total"               DECIMAL(12,2) NOT NULL,
        "discount_total"          DECIMAL(12,2) NOT NULL DEFAULT 0,
        "shipping_cost"           DECIMAL(12,2) NOT NULL DEFAULT 0,
        "grand_total"             DECIMAL(12,2) NOT NULL,
        "advance_amount_required" DECIMAL(12,2) NOT NULL,
        "balance_due"             DECIMAL(12,2) NOT NULL,
        "valid_until"             TIMESTAMP(3),
        "file_hash"               TEXT,
        "verification_token"      TEXT,
        "generated_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "b2b_proforma_invoices_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX "b2b_proforma_invoices_purchase_order_id_key" ON "b2b_proforma_invoices"("purchase_order_id");
      CREATE UNIQUE INDEX "b2b_proforma_invoices_pi_number_key" ON "b2b_proforma_invoices"("pi_number");
      CREATE INDEX "b2b_proforma_invoices_po_number_idx" ON "b2b_proforma_invoices"("po_number");
    END IF;
  END $$`,

  // ─── DEDICATED PROFORMA INVOICES MODULE TABLES & TYPES ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProformaInvoiceStatus') THEN
      CREATE TYPE "ProformaInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'SENT', 'APPROVED', 'ACCEPTED', 'ADVANCE_RECEIVED', 'CONVERTED_TO_INVOICE', 'CANCELLED', 'EXPIRED');
    END IF;
  END $$`,

  `CREATE TABLE IF NOT EXISTS "proforma_invoices" (
    "id"                       TEXT NOT NULL,
    "pi_number"                TEXT NOT NULL,
    "financial_year"           TEXT NOT NULL,
    "sequence_no"              INTEGER NOT NULL DEFAULT 1,
    "status"                   "ProformaInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "quote_id"                 TEXT,
    "quote_number"             TEXT,
    "po_id"                    TEXT,
    "po_number"                TEXT,
    "customer_po_number"       TEXT,
    "order_id"                 TEXT,
    "customer_id"              TEXT,
    "customer_name"            TEXT NOT NULL,
    "company_name"             TEXT,
    "customer_email"           TEXT NOT NULL,
    "customer_phone"           TEXT,
    "gstin"                    VARCHAR(15),
    "pan"                      TEXT,
    "billing_address"          TEXT,
    "shipping_address"         TEXT,
    "place_of_supply"          TEXT,
    "subtotal"                 DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxable_amount"           DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cgst"                     DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sgst"                     DECIMAL(12,2) NOT NULL DEFAULT 0,
    "igst"                     DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cess"                     DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount"                 DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shipping_cost"            DECIMAL(12,2) NOT NULL DEFAULT 0,
    "round_off"                DECIMAL(6,2) NOT NULL DEFAULT 0,
    "grand_total"              DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency"                 TEXT NOT NULL DEFAULT 'INR',
    "advance_percentage"       DECIMAL(5,2) NOT NULL DEFAULT 30,
    "advance_amount"           DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance_due"              DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payment_terms"            TEXT,
    "delivery_timeline"        TEXT,
    "valid_until"              TIMESTAMP(3),
    "verification_token"       TEXT NOT NULL,
    "verification_id"          TEXT NOT NULL,
    "document_hash"            TEXT NOT NULL,
    "digital_signature"        TEXT,
    "signed_by"                TEXT,
    "signed_at"                TIMESTAMP(3),
    "qr_code_data_url"         TEXT,
    "pdf_path"                 TEXT,
    "notes"                    TEXT,
    "terms_and_conditions"     TEXT,
    "bank_details"             JSONB,
    "converted_invoice_id"     TEXT,
    "converted_invoice_number" TEXT,
    "converted_at"             TIMESTAMP(3),
    "created_by"               TEXT,
    "updated_by"               TEXT,
    "approved_by"              TEXT,
    "approved_at"              TIMESTAMP(3),
    "sent_at"                  TIMESTAMP(3),
    "cancelled_at"             TIMESTAMP(3),
    "cancelled_reason"         TEXT,
    "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"               TIMESTAMP(3),
    CONSTRAINT "proforma_invoices_pkey" PRIMARY KEY ("id")
  );`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "proforma_invoices_pi_number_key" ON "proforma_invoices"("pi_number");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "proforma_invoices_verification_token_key" ON "proforma_invoices"("verification_token");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "proforma_invoices_verification_id_key" ON "proforma_invoices"("verification_id");`,
  `CREATE INDEX IF NOT EXISTS "proforma_invoices_financial_year_idx" ON "proforma_invoices"("financial_year");`,
  `CREATE INDEX IF NOT EXISTS "proforma_invoices_status_idx" ON "proforma_invoices"("status");`,
  `CREATE INDEX IF NOT EXISTS "proforma_invoices_customer_id_idx" ON "proforma_invoices"("customer_id");`,
  `CREATE INDEX IF NOT EXISTS "proforma_invoices_quote_number_idx" ON "proforma_invoices"("quote_number");`,
  `CREATE INDEX IF NOT EXISTS "proforma_invoices_po_number_idx" ON "proforma_invoices"("po_number");`,

  `CREATE TABLE IF NOT EXISTS "proforma_invoice_items" (
    "id"                   TEXT NOT NULL,
    "proforma_invoice_id"  TEXT NOT NULL,
    "product_id"           TEXT,
    "sku"                  TEXT NOT NULL,
    "product_name"         TEXT NOT NULL,
    "description"          TEXT,
    "hsn_code"             TEXT,
    "unit"                 TEXT NOT NULL DEFAULT 'PCS',
    "quantity"             DECIMAL(10,2) NOT NULL,
    "unit_rate"            DECIMAL(12,2) NOT NULL,
    "discount_percent"     DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxable_amount"       DECIMAL(12,2) NOT NULL,
    "cgst_rate"            DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgst_amount"          DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sgst_rate"            DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sgst_amount"          DECIMAL(12,2) NOT NULL DEFAULT 0,
    "igst_rate"            DECIMAL(5,2) NOT NULL DEFAULT 0,
    "igst_amount"          DECIMAL(12,2) NOT NULL DEFAULT 0,
    "line_total"           DECIMAL(12,2) NOT NULL,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "proforma_invoice_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "proforma_invoice_items_proforma_invoice_id_fkey" FOREIGN KEY ("proforma_invoice_id") REFERENCES "proforma_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,

  `CREATE INDEX IF NOT EXISTS "proforma_invoice_items_proforma_invoice_id_idx" ON "proforma_invoice_items"("proforma_invoice_id");`,
  `CREATE INDEX IF NOT EXISTS "proforma_invoice_items_sku_idx" ON "proforma_invoice_items"("sku");`,
  `CREATE INDEX IF NOT EXISTS "proforma_invoice_items_hsn_code_idx" ON "proforma_invoice_items"("hsn_code");`,

  `CREATE TABLE IF NOT EXISTS "proforma_invoice_history" (
    "id"                   TEXT NOT NULL,
    "proforma_invoice_id"  TEXT NOT NULL,
    "action"               TEXT NOT NULL,
    "performed_by"         TEXT,
    "details"              TEXT,
    "metadata"             JSONB,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "proforma_invoice_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "proforma_invoice_history_proforma_invoice_id_fkey" FOREIGN KEY ("proforma_invoice_id") REFERENCES "proforma_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,

  `CREATE INDEX IF NOT EXISTS "proforma_invoice_history_proforma_invoice_id_idx" ON "proforma_invoice_history"("proforma_invoice_id");`,
  `CREATE INDEX IF NOT EXISTS "proforma_invoice_history_action_idx" ON "proforma_invoice_history"("action");`,

  `CREATE TABLE IF NOT EXISTS "proforma_invoice_sequences" (
    "id"             TEXT NOT NULL,
    "financial_year" TEXT NOT NULL,
    "branch_code"    TEXT NOT NULL DEFAULT 'MAIN',
    "next_number"    INTEGER NOT NULL DEFAULT 1,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "proforma_invoice_sequences_pkey" PRIMARY KEY ("id")
  );`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "proforma_invoice_sequences_financial_year_branch_code_key" ON "proforma_invoice_sequences"("financial_year", "branch_code");`,

  // ─── B2B EWAY BILLS TABLE ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='b2b_eway_bills') THEN
      CREATE TABLE "b2b_eway_bills" (
        "id"                      TEXT NOT NULL,
        "purchase_order_id"       TEXT NOT NULL,
        "po_number"               TEXT NOT NULL,
        "eway_bill_number"        TEXT NOT NULL,
        "eway_bill_date"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "valid_from"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "valid_until"             TIMESTAMP(3),
        "vehicle_number"          TEXT,
        "transporter_id"          TEXT,
        "transporter_name"        TEXT,
        "transporter_doc_no"      TEXT,
        "from_pincode"            TEXT,
        "to_pincode"              TEXT,
        "approx_distance_km"      INTEGER,
        "iris_response"           JSONB,
        "qr_code_data"            TEXT,
        "pdf_storage_key_or_url"  TEXT,
        "status"                  TEXT NOT NULL DEFAULT 'GENERATED',
        "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "b2b_eway_bills_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX "b2b_eway_bills_purchase_order_id_key" ON "b2b_eway_bills"("purchase_order_id");
      CREATE UNIQUE INDEX "b2b_eway_bills_eway_bill_number_key" ON "b2b_eway_bills"("eway_bill_number");
      CREATE INDEX "b2b_eway_bills_po_number_idx" ON "b2b_eway_bills"("po_number");
    END IF;
  END $$`,

  // ─── B2B ISSUE LISTS TABLE ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='b2b_issue_lists') THEN
      CREATE TABLE "b2b_issue_lists" (
        "id"                      TEXT NOT NULL,
        "purchase_order_id"       TEXT NOT NULL,
        "po_number"               TEXT NOT NULL,
        "issue_number"            TEXT NOT NULL,
        "issued_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "issued_by"               TEXT NOT NULL,
        "issued_by_name"          TEXT,
        "received_by_name"        TEXT,
        "carrier_name"            TEXT,
        "vehicle_number"          TEXT,
        "eway_bill_ref"           TEXT,
        "total_quantity"          INTEGER NOT NULL DEFAULT 0,
        "total_value"             DECIMAL(12,2) NOT NULL,
        "pdf_storage_key_or_url"  TEXT NOT NULL,
        "file_hash"               TEXT,
        "notes"                   TEXT,
        "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "b2b_issue_lists_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX "b2b_issue_lists_purchase_order_id_key" ON "b2b_issue_lists"("purchase_order_id");
      CREATE UNIQUE INDEX "b2b_issue_lists_issue_number_key" ON "b2b_issue_lists"("issue_number");
      CREATE INDEX "b2b_issue_lists_po_number_idx" ON "b2b_issue_lists"("po_number");
    END IF;
  END $$`,

  // Add applicable_product_ids & applicable_category_ids to coupons if missing
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupons' AND column_name='applicable_product_ids') THEN
      ALTER TABLE "coupons" ADD COLUMN "applicable_product_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupons' AND column_name='applicable_category_ids') THEN
      ALTER TABLE "coupons" ADD COLUMN "applicable_category_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
    END IF;
  END $$`,

  // ─── Production Admin Audit Logs Table ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='admin_audit_logs') THEN
      CREATE TABLE "admin_audit_logs" (
        "id"           TEXT NOT NULL,
        "user_id"      TEXT NOT NULL,
        "admin_email"  TEXT NOT NULL,
        "admin_name"   TEXT,
        "admin_role"   TEXT,
        "action"       TEXT NOT NULL,
        "entity"       TEXT NOT NULL,
        "entity_id"    TEXT,
        "entity_name"  TEXT,
        "details"      TEXT,
        "severity"     TEXT NOT NULL DEFAULT 'INFO',
        "metadata"     JSONB,
        "ip_address"   TEXT,
        "user_agent"   TEXT,
        "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX "admin_audit_logs_user_id_idx" ON "admin_audit_logs"("user_id", "created_at" DESC);
      CREATE INDEX "admin_audit_logs_action_idx" ON "admin_audit_logs"("action");
      CREATE INDEX "admin_audit_logs_entity_idx" ON "admin_audit_logs"("entity");
      CREATE INDEX "admin_audit_logs_severity_idx" ON "admin_audit_logs"("severity");
      CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at" DESC);
    END IF;
  END $$`,

  // ─── Multi-Branch Inventory Enums & Tables ─────────────────────────────────
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StockMovementType') THEN
      CREATE TYPE "StockMovementType" AS ENUM (
        'PURCHASE_IN', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'SALE_OUT', 'DAMAGE', 'RETURN_IN'
      );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransferStatus') THEN
      CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');
    END IF;
  END $$`,

  // Branches table
  `CREATE TABLE IF NOT EXISTS "branches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL UNIQUE,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3)
  )`,
  `ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)`,
  `CREATE INDEX IF NOT EXISTS "branches_code_idx" ON "branches"("code")`,
  `CREATE INDEX IF NOT EXISTS "branches_is_active_idx" ON "branches"("isActive")`,

  // Suppliers table
  `CREATE TABLE IF NOT EXISTS "suppliers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "contact_person" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "gstNumber" TEXT,
    "gst_number" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3)
  )`,
  `ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "contactPerson" TEXT`,
  `ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "gstNumber" TEXT`,
  `ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)`,
  `CREATE INDEX IF NOT EXISTS "suppliers_name_idx" ON "suppliers"("name")`,
  `CREATE INDEX IF NOT EXISTS "suppliers_is_active_idx" ON "suppliers"("isActive")`,

  // Inventories table
  `CREATE TABLE IF NOT EXISTS "inventories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 10,
    "reorder_level" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventories_productId_branchId_key" UNIQUE ("productId", "branchId")
  )`,
  `ALTER TABLE "inventories" ADD COLUMN IF NOT EXISTS "productId" TEXT`,
  `ALTER TABLE "inventories" ADD COLUMN IF NOT EXISTS "branchId" TEXT`,
  `ALTER TABLE "inventories" ADD COLUMN IF NOT EXISTS "reservedQuantity" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "inventories" ADD COLUMN IF NOT EXISTS "reorderLevel" INTEGER NOT NULL DEFAULT 10`,
  `ALTER TABLE "inventories" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `CREATE INDEX IF NOT EXISTS "inventories_productId_idx" ON "inventories"("productId")`,
  `CREATE INDEX IF NOT EXISTS "inventories_branchId_idx" ON "inventories"("branchId")`,

  // Purchases table
  `CREATE TABLE IF NOT EXISTS "purchases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchId" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "invoice_number" TEXT,
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purchase_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "branchId" TEXT`,
  `ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "supplierId" TEXT`,
  `ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT`,
  `ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0`,
  `ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "createdById" TEXT`,
  `ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `CREATE INDEX IF NOT EXISTS "purchases_branchId_idx" ON "purchases"("branchId")`,
  `CREATE INDEX IF NOT EXISTS "purchases_supplierId_idx" ON "purchases"("supplierId")`,

  // Purchase Items table
  `CREATE TABLE IF NOT EXISTS "purchase_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseId" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPurchasePrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unit_purchase_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_price" DECIMAL(12,2) NOT NULL DEFAULT 0
  )`,
  `ALTER TABLE "purchase_items" ADD COLUMN IF NOT EXISTS "purchaseId" TEXT`,
  `ALTER TABLE "purchase_items" ADD COLUMN IF NOT EXISTS "productId" TEXT`,
  `ALTER TABLE "purchase_items" ADD COLUMN IF NOT EXISTS "unitPurchasePrice" DECIMAL(12,2) NOT NULL DEFAULT 0`,
  `ALTER TABLE "purchase_items" ADD COLUMN IF NOT EXISTS "totalPrice" DECIMAL(12,2) NOT NULL DEFAULT 0`,
  `CREATE INDEX IF NOT EXISTS "purchase_items_purchaseId_idx" ON "purchase_items"("purchaseId")`,
  `CREATE INDEX IF NOT EXISTS "purchase_items_productId_idx" ON "purchase_items"("productId")`,

  // Stock Transfers table
  `CREATE TABLE IF NOT EXISTS "stock_transfers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromBranchId" TEXT NOT NULL,
    "from_branch_id" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "to_branch_id" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "approvedById" TEXT,
    "approved_by_id" TEXT,
    "receivedById" TEXT,
    "received_by_id" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),
    "dispatched_at" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "received_at" TIMESTAMP(3)
  )`,
  `ALTER TABLE "stock_transfers" ADD COLUMN IF NOT EXISTS "fromBranchId" TEXT`,
  `ALTER TABLE "stock_transfers" ADD COLUMN IF NOT EXISTS "toBranchId" TEXT`,
  `ALTER TABLE "stock_transfers" ADD COLUMN IF NOT EXISTS "requestedById" TEXT`,
  `ALTER TABLE "stock_transfers" ADD COLUMN IF NOT EXISTS "approvedById" TEXT`,
  `ALTER TABLE "stock_transfers" ADD COLUMN IF NOT EXISTS "receivedById" TEXT`,
  `ALTER TABLE "stock_transfers" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "stock_transfers" ADD COLUMN IF NOT EXISTS "dispatchedAt" TIMESTAMP(3)`,
  `ALTER TABLE "stock_transfers" ADD COLUMN IF NOT EXISTS "receivedAt" TIMESTAMP(3)`,
  `CREATE INDEX IF NOT EXISTS "stock_transfers_fromBranchId_idx" ON "stock_transfers"("fromBranchId")`,
  `CREATE INDEX IF NOT EXISTS "stock_transfers_toBranchId_idx" ON "stock_transfers"("toBranchId")`,

  // Stock Transfer Items table
  `CREATE TABLE IF NOT EXISTS "stock_transfer_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transferId" TEXT NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL
  )`,
  `ALTER TABLE "stock_transfer_items" ADD COLUMN IF NOT EXISTS "transferId" TEXT`,
  `ALTER TABLE "stock_transfer_items" ADD COLUMN IF NOT EXISTS "productId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "stock_transfer_items_transferId_idx" ON "stock_transfer_items"("transferId")`,
  `CREATE INDEX IF NOT EXISTS "stock_transfer_items_productId_idx" ON "stock_transfer_items"("productId")`,

  // Stock Movements ledger table
  `CREATE TABLE IF NOT EXISTS "stock_movements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previousQty" INTEGER NOT NULL DEFAULT 0,
    "previous_qty" INTEGER NOT NULL DEFAULT 0,
    "newQty" INTEGER NOT NULL DEFAULT 0,
    "new_qty" INTEGER NOT NULL DEFAULT 0,
    "referenceType" TEXT,
    "reference_type" TEXT,
    "referenceId" TEXT,
    "reference_id" TEXT,
    "notes" TEXT,
    "performedById" TEXT NOT NULL,
    "performed_by_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "productId" TEXT`,
  `ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "branchId" TEXT`,
  `ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "previousQty" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "newQty" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "referenceType" TEXT`,
  `ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "referenceId" TEXT`,
  `ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "performedById" TEXT`,
  `ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `CREATE INDEX IF NOT EXISTS "stock_movements_product_branch_idx" ON "stock_movements"("productId", "branchId")`,

  // Seed Default Branches (Delhi HQ & Kolkata)
  `INSERT INTO "branches" ("id", "name", "code", "address", "city", "state", "isActive", "is_active", "createdAt", "created_at", "updatedAt", "updated_at")
   VALUES
     ('b1000000-0000-0000-0000-000000000001', 'Delhi HQ', 'DEL', 'Pacific Hardware HQ, Mayapuri Industrial Area Phase II', 'New Delhi', 'Delhi', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
     ('b2000000-0000-0000-0000-000000000002', 'Kolkata Branch', 'KOL', 'PRC Hardware Depot, Topsia Road', 'Kolkata', 'West Bengal', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
   ON CONFLICT ("code") DO UPDATE SET
     "name" = EXCLUDED."name",
     "address" = EXCLUDED."address",
     "city" = EXCLUDED."city",
     "state" = EXCLUDED."state",
     "isActive" = true,
     "is_active" = true`,

  // Backfill Inventory records for all existing products across Delhi HQ and Kolkata
  `DO $$
  DECLARE
    del_id TEXT := 'b1000000-0000-0000-0000-000000000001';
    kol_id TEXT := 'b2000000-0000-0000-0000-000000000002';
  BEGIN
    INSERT INTO "inventories" ("id", "productId", "product_id", "branchId", "branch_id", "quantity", "reservedQuantity", "reserved_quantity", "reorderLevel", "reorder_level", "updatedAt", "updated_at")
    SELECT
      md5(random()::text || clock_timestamp()::text)::text,
      p."id",
      p."id",
      del_id,
      del_id,
      COALESCE(p."stock", 0),
      0,
      0,
      COALESCE(p."reorderLevel", 10),
      COALESCE(p."reorderLevel", 10),
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM "products" p
    ON CONFLICT ("productId", "branchId") DO NOTHING;

    INSERT INTO "inventories" ("id", "productId", "product_id", "branchId", "branch_id", "quantity", "reservedQuantity", "reserved_quantity", "reorderLevel", "reorder_level", "updatedAt", "updated_at")
    SELECT
      md5(random()::text || clock_timestamp()::text)::text,
      p."id",
      p."id",
      kol_id,
      kol_id,
      0,
      0,
      0,
      COALESCE(p."reorderLevel", 10),
      COALESCE(p."reorderLevel", 10),
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM "products" p
    ON CONFLICT ("productId", "branchId") DO NOTHING;
  END $$`,
  // ─── Inventory tables columns & bidirectional sync triggers ───────────────
  `ALTER TABLE "inventories" ALTER COLUMN "product_id" DROP NOT NULL`,
  `ALTER TABLE "inventories" ALTER COLUMN "branch_id" DROP NOT NULL`,
  `ALTER TABLE "inventories" ALTER COLUMN "reserved_quantity" DROP NOT NULL`,
  `ALTER TABLE "inventories" ALTER COLUMN "reorder_level" DROP NOT NULL`,
  `ALTER TABLE "inventories" ALTER COLUMN "updated_at" DROP NOT NULL`,
  `ALTER TABLE "inventories" ADD COLUMN IF NOT EXISTS "productId" TEXT`,
  `ALTER TABLE "inventories" ADD COLUMN IF NOT EXISTS "branchId" TEXT`,
  `ALTER TABLE "inventories" ADD COLUMN IF NOT EXISTS "reservedQuantity" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "inventories" ADD COLUMN IF NOT EXISTS "reorderLevel" INTEGER NOT NULL DEFAULT 10`,
  `ALTER TABLE "inventories" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `CREATE OR REPLACE FUNCTION sync_inventories_columns() RETURNS TRIGGER AS $$
   BEGIN
     NEW."productId" := COALESCE(NEW."productId", NEW.product_id);
     NEW."product_id" := COALESCE(NEW.product_id, NEW."productId");
     NEW."branchId" := COALESCE(NEW."branchId", NEW.branch_id);
     NEW."branch_id" := COALESCE(NEW.branch_id, NEW."branchId");
     NEW."reservedQuantity" := COALESCE(NEW."reservedQuantity", NEW.reserved_quantity, 0);
     NEW."reserved_quantity" := COALESCE(NEW.reserved_quantity, NEW."reservedQuantity", 0);
     NEW."reorderLevel" := COALESCE(NEW."reorderLevel", NEW.reorder_level, 10);
     NEW."reorder_level" := COALESCE(NEW.reorder_level, NEW."reorderLevel", 10);
     NEW."updatedAt" := COALESCE(NEW."updatedAt", NEW.updated_at, NOW());
     NEW."updated_at" := COALESCE(NEW.updated_at, NEW."updatedAt", NOW());
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;`,
  `DROP TRIGGER IF EXISTS trg_sync_inventories ON "inventories"`,
  `CREATE TRIGGER trg_sync_inventories BEFORE INSERT OR UPDATE ON "inventories" FOR EACH ROW EXECUTE FUNCTION sync_inventories_columns()`,

  `ALTER TABLE "purchase_items" ALTER COLUMN "purchase_id" DROP NOT NULL`,
  `ALTER TABLE "purchase_items" ALTER COLUMN "product_id" DROP NOT NULL`,
  `ALTER TABLE "purchase_items" ALTER COLUMN "unit_purchase_price" DROP NOT NULL`,
  `ALTER TABLE "purchase_items" ALTER COLUMN "total_price" DROP NOT NULL`,
  `ALTER TABLE "purchase_items" ADD COLUMN IF NOT EXISTS "purchaseId" TEXT`,
  `ALTER TABLE "purchase_items" ADD COLUMN IF NOT EXISTS "productId" TEXT`,
  `ALTER TABLE "purchase_items" ADD COLUMN IF NOT EXISTS "unitPurchasePrice" DECIMAL(12,2)`,
  `ALTER TABLE "purchase_items" ADD COLUMN IF NOT EXISTS "totalPrice" DECIMAL(12,2)`,
  `CREATE OR REPLACE FUNCTION sync_purchase_items_columns() RETURNS TRIGGER AS $$
   BEGIN
     NEW."purchaseId" := COALESCE(NEW."purchaseId", NEW.purchase_id);
     NEW."purchase_id" := COALESCE(NEW.purchase_id, NEW."purchaseId");
     NEW."productId" := COALESCE(NEW."productId", NEW.product_id);
     NEW."product_id" := COALESCE(NEW.product_id, NEW."productId");
     NEW."unitPurchasePrice" := COALESCE(NEW."unitPurchasePrice", NEW.unit_purchase_price, 0);
     NEW."unit_purchase_price" := COALESCE(NEW.unit_purchase_price, NEW."unitPurchasePrice", 0);
     NEW."totalPrice" := COALESCE(NEW."totalPrice", NEW.total_price, 0);
     NEW."total_price" := COALESCE(NEW.total_price, NEW."totalPrice", 0);
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;`,
  `DROP TRIGGER IF EXISTS trg_sync_purchase_items ON "purchase_items"`,
  `CREATE TRIGGER trg_sync_purchase_items BEFORE INSERT OR UPDATE ON "purchase_items" FOR EACH ROW EXECUTE FUNCTION sync_purchase_items_columns()`,

  `ALTER TABLE "purchases" ALTER COLUMN "branch_id" DROP NOT NULL`,
  `ALTER TABLE "purchases" ALTER COLUMN "supplier_id" DROP NOT NULL`,
  `ALTER TABLE "purchases" ALTER COLUMN "purchase_date" DROP NOT NULL`,
  `ALTER TABLE "purchases" ALTER COLUMN "total_amount" DROP NOT NULL`,
  `ALTER TABLE "purchases" ALTER COLUMN "created_by_id" DROP NOT NULL`,
  `ALTER TABLE "purchases" ALTER COLUMN "created_at" DROP NOT NULL`,
  `ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "branchId" TEXT`,
  `ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "supplierId" TEXT`,
  `ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT`,
  `ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "purchaseDate" TIMESTAMP(3)`,
  `ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "totalAmount" DECIMAL(12,2)`,
  `ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "createdById" TEXT`,
  `ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `CREATE OR REPLACE FUNCTION sync_purchases_columns() RETURNS TRIGGER AS $$
   BEGIN
     NEW."branchId" := COALESCE(NEW."branchId", NEW.branch_id);
     NEW."branch_id" := COALESCE(NEW.branch_id, NEW."branchId");
     NEW."supplierId" := COALESCE(NEW."supplierId", NEW.supplier_id);
     NEW."supplier_id" := COALESCE(NEW.supplier_id, NEW."supplierId");
     NEW."invoiceNumber" := COALESCE(NEW."invoiceNumber", NEW.invoice_number);
     NEW."invoice_number" := COALESCE(NEW.invoice_number, NEW."invoiceNumber");
     NEW."purchaseDate" := COALESCE(NEW."purchaseDate", NEW.purchase_date, NOW());
     NEW."purchase_date" := COALESCE(NEW.purchase_date, NEW."purchaseDate", NOW());
     NEW."totalAmount" := COALESCE(NEW."totalAmount", NEW.total_amount, 0);
     NEW."total_amount" := COALESCE(NEW.total_amount, NEW."totalAmount", 0);
     NEW."createdById" := COALESCE(NEW."createdById", NEW.created_by_id, 'system');
     NEW."created_by_id" := COALESCE(NEW.created_by_id, NEW."createdById", 'system');
     NEW."createdAt" := COALESCE(NEW."createdAt", NEW.created_at, NOW());
     NEW."created_at" := COALESCE(NEW.created_at, NEW."createdAt", NOW());
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;`,
  `DROP TRIGGER IF EXISTS trg_sync_purchases ON "purchases"`,
  `CREATE TRIGGER trg_sync_purchases BEFORE INSERT OR UPDATE ON "purchases" FOR EACH ROW EXECUTE FUNCTION sync_purchases_columns()`,

  `ALTER TABLE "stock_movements" ALTER COLUMN "product_id" DROP NOT NULL`,
  `ALTER TABLE "stock_movements" ALTER COLUMN "branch_id" DROP NOT NULL`,
  `ALTER TABLE "stock_movements" ALTER COLUMN "previous_qty" DROP NOT NULL`,
  `ALTER TABLE "stock_movements" ALTER COLUMN "new_qty" DROP NOT NULL`,
  `ALTER TABLE "stock_movements" ALTER COLUMN "performed_by_id" DROP NOT NULL`,
  `ALTER TABLE "stock_movements" ALTER COLUMN "created_at" DROP NOT NULL`,
  `ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "productId" TEXT`,
  `ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "branchId" TEXT`,
  `ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "previousQty" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "newQty" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "referenceType" TEXT`,
  `ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "referenceId" TEXT`,
  `ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "performedById" TEXT`,
  `ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `CREATE OR REPLACE FUNCTION sync_stock_movements_columns() RETURNS TRIGGER AS $$
   BEGIN
     NEW."productId" := COALESCE(NEW."productId", NEW.product_id);
     NEW."product_id" := COALESCE(NEW.product_id, NEW."productId");
     NEW."branchId" := COALESCE(NEW."branchId", NEW.branch_id);
     NEW."branch_id" := COALESCE(NEW.branch_id, NEW."branchId");
     NEW."previousQty" := COALESCE(NEW."previousQty", NEW.previous_qty, 0);
     NEW."previous_qty" := COALESCE(NEW.previous_qty, NEW."previousQty", 0);
     NEW."newQty" := COALESCE(NEW."newQty", NEW.new_qty, 0);
     NEW."new_qty" := COALESCE(NEW.new_qty, NEW."newQty", 0);
     NEW."referenceType" := COALESCE(NEW."referenceType", NEW.reference_type);
     NEW."reference_type" := COALESCE(NEW.reference_type, NEW."referenceType");
     NEW."referenceId" := COALESCE(NEW."referenceId", NEW.reference_id);
     NEW."reference_id" := COALESCE(NEW.reference_id, NEW."referenceId");
     NEW."performedById" := COALESCE(NEW."performedById", NEW.performed_by_id, 'system');
     NEW."performed_by_id" := COALESCE(NEW.performed_by_id, NEW."performedById", 'system');
     NEW."createdAt" := COALESCE(NEW."createdAt", NEW.created_at, NOW());
     NEW."created_at" := COALESCE(NEW.created_at, NEW."createdAt", NOW());
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;`,
  `DROP TRIGGER IF EXISTS trg_sync_stock_movements ON "stock_movements"`,
  `CREATE TRIGGER trg_sync_stock_movements BEFORE INSERT OR UPDATE ON "stock_movements" FOR EACH ROW EXECUTE FUNCTION sync_stock_movements_columns()`,

  `ALTER TABLE "stock_transfers" ALTER COLUMN "from_branch_id" DROP NOT NULL`,
  `ALTER TABLE "stock_transfers" ALTER COLUMN "to_branch_id" DROP NOT NULL`,
  `ALTER TABLE "stock_transfers" ALTER COLUMN "requested_by_id" DROP NOT NULL`,
  `ALTER TABLE "stock_transfers" ALTER COLUMN "created_at" DROP NOT NULL`,
  `ALTER TABLE "stock_transfers" ADD COLUMN IF NOT EXISTS "fromBranchId" TEXT`,
  `ALTER TABLE "stock_transfers" ADD COLUMN IF NOT EXISTS "toBranchId" TEXT`,
  `ALTER TABLE "stock_transfers" ADD COLUMN IF NOT EXISTS "requestedById" TEXT`,
  `ALTER TABLE "stock_transfers" ADD COLUMN IF NOT EXISTS "approvedById" TEXT`,
  `ALTER TABLE "stock_transfers" ADD COLUMN IF NOT EXISTS "receivedById" TEXT`,
  `ALTER TABLE "stock_transfers" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "stock_transfers" ADD COLUMN IF NOT EXISTS "dispatchedAt" TIMESTAMP(3)`,
  `ALTER TABLE "stock_transfers" ADD COLUMN IF NOT EXISTS "receivedAt" TIMESTAMP(3)`,
  `CREATE OR REPLACE FUNCTION sync_stock_transfers_columns() RETURNS TRIGGER AS $$
   BEGIN
     NEW."fromBranchId" := COALESCE(NEW."fromBranchId", NEW.from_branch_id);
     NEW."from_branch_id" := COALESCE(NEW.from_branch_id, NEW."fromBranchId");
     NEW."toBranchId" := COALESCE(NEW."toBranchId", NEW.to_branch_id);
     NEW."to_branch_id" := COALESCE(NEW.to_branch_id, NEW."toBranchId");
     NEW."requestedById" := COALESCE(NEW."requestedById", NEW.requested_by_id, 'system');
     NEW."requested_by_id" := COALESCE(NEW.requested_by_id, NEW."requestedById", 'system');
     NEW."approvedById" := COALESCE(NEW."approvedById", NEW.approved_by_id);
     NEW."approved_by_id" := COALESCE(NEW.approved_by_id, NEW."approvedById");
     NEW."receivedById" := COALESCE(NEW."receivedById", NEW.received_by_id);
     NEW."received_by_id" := COALESCE(NEW.received_by_id, NEW."receivedById");
     NEW."createdAt" := COALESCE(NEW."createdAt", NEW.created_at, NOW());
     NEW."created_at" := COALESCE(NEW.created_at, NEW."createdAt", NOW());
     NEW."dispatchedAt" := COALESCE(NEW."dispatchedAt", NEW.dispatched_at);
     NEW."dispatched_at" := COALESCE(NEW.dispatched_at, NEW."dispatchedAt");
     NEW."receivedAt" := COALESCE(NEW."receivedAt", NEW.received_at);
     NEW."received_at" := COALESCE(NEW.received_at, NEW."receivedAt");
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;`,
  `DROP TRIGGER IF EXISTS trg_sync_stock_transfers ON "stock_transfers"`,
  `CREATE TRIGGER trg_sync_stock_transfers BEFORE INSERT OR UPDATE ON "stock_transfers" FOR EACH ROW EXECUTE FUNCTION sync_stock_transfers_columns()`,

  `ALTER TABLE "stock_transfer_items" ALTER COLUMN "transfer_id" DROP NOT NULL`,
  `ALTER TABLE "stock_transfer_items" ALTER COLUMN "product_id" DROP NOT NULL`,
  `ALTER TABLE "stock_transfer_items" ADD COLUMN IF NOT EXISTS "transferId" TEXT`,
  `ALTER TABLE "stock_transfer_items" ADD COLUMN IF NOT EXISTS "productId" TEXT`,
  `CREATE OR REPLACE FUNCTION sync_stock_transfer_items_columns() RETURNS TRIGGER AS $$
   BEGIN
     NEW."transferId" := COALESCE(NEW."transferId", NEW.transfer_id);
     NEW."transfer_id" := COALESCE(NEW.transfer_id, NEW."transferId");
     NEW."productId" := COALESCE(NEW."productId", NEW.product_id);
     NEW."product_id" := COALESCE(NEW.product_id, NEW."productId");
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;`,
  `DROP TRIGGER IF EXISTS trg_sync_stock_transfer_items ON "stock_transfer_items"`,
  `CREATE TRIGGER trg_sync_stock_transfer_items BEFORE INSERT OR UPDATE ON "stock_transfer_items" FOR EACH ROW EXECUTE FUNCTION sync_stock_transfer_items_columns()`,

  `ALTER TABLE "suppliers" ALTER COLUMN "is_active" DROP NOT NULL`,
  `ALTER TABLE "suppliers" ALTER COLUMN "created_at" DROP NOT NULL`,
  `ALTER TABLE "suppliers" ALTER COLUMN "updated_at" DROP NOT NULL`,
  `ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "contactPerson" TEXT`,
  `ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "gstNumber" TEXT`,
  `ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)`,
  `CREATE OR REPLACE FUNCTION sync_suppliers_columns() RETURNS TRIGGER AS $$
   BEGIN
     NEW."contactPerson" := COALESCE(NEW."contactPerson", NEW.contact_person);
     NEW."contact_person" := COALESCE(NEW.contact_person, NEW."contactPerson");
     NEW."gstNumber" := COALESCE(NEW."gstNumber", NEW.gst_number);
     NEW."gst_number" := COALESCE(NEW.gst_number, NEW."gstNumber");
     NEW."isActive" := COALESCE(NEW."isActive", NEW.is_active, true);
     NEW."is_active" := COALESCE(NEW.is_active, NEW."isActive", true);
     NEW."createdAt" := COALESCE(NEW."createdAt", NEW.created_at, NOW());
     NEW."created_at" := COALESCE(NEW.created_at, NEW."createdAt", NOW());
     NEW."updatedAt" := COALESCE(NEW."updatedAt", NEW.updated_at, NOW());
     NEW."updated_at" := COALESCE(NEW.updated_at, NEW."updatedAt", NOW());
     NEW."deletedAt" := COALESCE(NEW."deletedAt", NEW.deleted_at);
     NEW."deleted_at" := COALESCE(NEW.deleted_at, NEW."deletedAt");
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;`,
  `DROP TRIGGER IF EXISTS trg_sync_suppliers ON "suppliers"`,
  `CREATE TRIGGER trg_sync_suppliers BEFORE INSERT OR UPDATE ON "suppliers" FOR EACH ROW EXECUTE FUNCTION sync_suppliers_columns()`,

  `ALTER TABLE "branches" ALTER COLUMN "is_active" DROP NOT NULL`,
  `ALTER TABLE "branches" ALTER COLUMN "created_at" DROP NOT NULL`,
  `ALTER TABLE "branches" ALTER COLUMN "updated_at" DROP NOT NULL`,
  `ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)`,
  `CREATE OR REPLACE FUNCTION sync_branches_columns() RETURNS TRIGGER AS $$
   BEGIN
     NEW."isActive" := COALESCE(NEW."isActive", NEW.is_active, true);
     NEW."is_active" := COALESCE(NEW.is_active, NEW."isActive", true);
     NEW."createdAt" := COALESCE(NEW."createdAt", NEW.created_at, NOW());
     NEW."created_at" := COALESCE(NEW.created_at, NEW."createdAt", NOW());
     NEW."updatedAt" := COALESCE(NEW."updatedAt", NEW.updated_at, NOW());
     NEW."updated_at" := COALESCE(NEW.updated_at, NEW."updatedAt", NOW());
     NEW."deletedAt" := COALESCE(NEW."deletedAt", NEW.deleted_at);
     NEW."deleted_at" := COALESCE(NEW.deleted_at, NEW."deletedAt");
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;`,
  `DROP TRIGGER IF EXISTS trg_sync_branches ON "branches"`,
  `CREATE TRIGGER trg_sync_branches BEFORE INSERT OR UPDATE ON "branches" FOR EACH ROW EXECUTE FUNCTION sync_branches_columns()`,

  // ─── Materials Master Table & Product Material/Pairing Columns ────────────
  `CREATE TABLE IF NOT EXISTS "materials" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT UNIQUE NOT NULL,
    "slug" TEXT UNIQUE NOT NULL,
    "shortName" TEXT,
    "short_name" TEXT,
    "gradeBadge" TEXT,
    "grade_badge" TEXT,
    "description" TEXT,
    "tagline" TEXT,
    "specs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3)
  )`,
  `CREATE INDEX IF NOT EXISTS "materials_slug_idx" ON "materials"("slug")`,
  `CREATE INDEX IF NOT EXISTS "materials_isActive_idx" ON "materials"("isActive")`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "material_id" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "materialId" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "frequently_paired_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "frequentlyPairedIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`,
  `CREATE INDEX IF NOT EXISTS "products_material_id_idx" ON "products"("material_id")`,

  // Seed default 4 materials if table empty
  `INSERT INTO "materials" ("id", "name", "slug", "shortName", "short_name", "gradeBadge", "grade_badge", "description", "tagline", "specs", "isActive", "is_active", "position")
   SELECT 'mat-001', '304 Grade Stainless Steel', '304-grade-stainless-steel', 'SS 304', 'SS 304', 'Architectural Grade', 'Architectural Grade',
          'Engineered with 18% Chromium and 8% Nickel composition for outstanding tensile strength, oxidation resistance, and hygienic durability in commercial restrooms and luxury interior fittings.',
          'Architectural Grade Stainless Steel', ARRAY['18/8 Austenitic Stainless Steel', 'High Corrosion Resistance', 'Satin & Brushed Finish Ready', 'IS / ASTM A240 Certified']::TEXT[], true, true, 1
   WHERE NOT EXISTS (SELECT 1 FROM "materials" WHERE "slug" IN ('304-grade-stainless-steel', '304-grade-steel'))`,
  `INSERT INTO "materials" ("id", "name", "slug", "shortName", "short_name", "gradeBadge", "grade_badge", "description", "tagline", "specs", "isActive", "is_active", "position")
   SELECT 'mat-002', '316 Grade Stainless Steel', '316-grade-stainless-steel', 'SS 316', 'SS 316', 'Marine Grade', 'Marine Grade',
          'Enhanced with 2-3% Molybdenum for supreme chloride and saline pitting immunity. The ultimate specification for coastal infrastructure, swimming pool cubicles, and heavy-traffic industrial environments.',
          'Marine Grade Corrosion-Proof Steel', ARRAY['2-3% Molybdenum Alloy', 'Marine & Chloride Immune', 'Extreme Tensile Toughness', 'Zero-Rust Lifetime Guarantee']::TEXT[], true, true, 2
   WHERE NOT EXISTS (SELECT 1 FROM "materials" WHERE "slug" IN ('316-grade-stainless-steel', '316-grade-steel'))`,
  `INSERT INTO "materials" ("id", "name", "slug", "shortName", "short_name", "gradeBadge", "grade_badge", "description", "tagline", "specs", "isActive", "is_active", "position")
   SELECT 'mat-003', 'Architectural Aluminium', 'architectural-aluminium', 'Aluminium', 'Aluminium', 'Lightweight High-Strength', 'Lightweight High-Strength',
          'High-grade 6063-T6 extruded architectural aluminium delivering maximum rigidity with featherweight efficiency. Ideal for smooth-glide sliding door track assemblies and frame channels.',
          'Precision Extruded Structural Alloys', ARRAY['Grade 6063-T6 Alloy', 'Anodized & Powder-Coated', 'Ultra-Smooth Sliding Glide', '100% Recyclable & Non-Magnetic']::TEXT[], true, true, 3
   WHERE NOT EXISTS (SELECT 1 FROM "materials" WHERE "slug" IN ('architectural-aluminium', 'aluminium'))`,
  `INSERT INTO "materials" ("id", "name", "slug", "shortName", "short_name", "gradeBadge", "grade_badge", "description", "tagline", "specs", "isActive", "is_active", "position")
   SELECT 'mat-004', 'Nylon Polyamide 6', 'nylon-polyamide-6', 'Polyamide 6', 'Polyamide 6', 'High-Impact Polymer', 'High-Impact Polymer',
          'High-impact engineered thermoplastic polymer designed for self-lubricating, vibration-absorbing, and electrical-insulating applications.',
          'Engineered High-Durability Polymer', ARRAY['Virgin Polyamide 6 Resin', 'High Impact Shock Absorption', 'Self-Lubricating & Non-Marking', 'Anti-Static & Chemical Safe']::TEXT[], true, true, 4
   WHERE NOT EXISTS (SELECT 1 FROM "materials" WHERE "slug" = 'nylon-polyamide-6')`,

  // ─── CUBICLE INSTALLER PAYMENT TRACKING MODULE TABLES ──────────────────────
  `CREATE SEQUENCE IF NOT EXISTS ppsi_bill_seq START WITH 1 INCREMENT BY 1;`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InstallerPaymentStatus') THEN
      CREATE TYPE "InstallerPaymentStatus" AS ENUM ('PARTIAL', 'CLEARED');
    END IF;
  END $$`,

  `CREATE TABLE IF NOT EXISTS "cubicle_models" (
    "id"                 TEXT NOT NULL,
    "model_name"         TEXT NOT NULL,
    "installation_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_active"          BOOLEAN NOT NULL DEFAULT true,
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cubicle_models_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cubicle_models_model_name_key" UNIQUE ("model_name")
  )`,

  `CREATE TABLE IF NOT EXISTS "installer_bills" (
    "id"               TEXT NOT NULL,
    "bill_no"          TEXT NOT NULL,
    "installer_name"   TEXT NOT NULL,
    "installer_email"  TEXT NOT NULL,
    "install_date"     TIMESTAMP(3) NOT NULL,
    "is_ncr"           BOOLEAN NOT NULL DEFAULT false,
    "travel_expenses"  DECIMAL(10,2) NOT NULL DEFAULT 0,
    "site_address"     TEXT NOT NULL,
    "site_pin"         VARCHAR(6) NOT NULL,
    "subtotal"         DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total"            DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount_paid"      DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance_due"      DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payment_status"   "InstallerPaymentStatus" NOT NULL DEFAULT 'PARTIAL',
    "payment_date"     TIMESTAMP(3),
    "notes"            TEXT,
    "email_sent"       BOOLEAN NOT NULL DEFAULT false,
    "email_sent_at"    TIMESTAMP(3),
    "email_status"     TEXT,
    "email_error"      TEXT,
    "created_by_id"    TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"       TIMESTAMP(3),
    CONSTRAINT "installer_bills_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "installer_bills_bill_no_key" UNIQUE ("bill_no")
  )`,

  `CREATE TABLE IF NOT EXISTS "installer_bill_items" (
    "id"                 TEXT NOT NULL,
    "bill_id"            TEXT NOT NULL,
    "model_id"           TEXT NOT NULL,
    "model_name"         TEXT NOT NULL,
    "quantity"           INTEGER NOT NULL DEFAULT 1,
    "installation_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "line_total"         DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "installer_bill_items_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "installer_bill_payments" (
    "id"               TEXT NOT NULL,
    "bill_id"          TEXT NOT NULL,
    "amount"           DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payment_date"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_mode"     TEXT,
    "reference_note"   TEXT,
    "recorded_by_id"   TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "installer_bill_payments_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "installer_bill_sequences" (
    "id"          TEXT NOT NULL,
    "prefix"      TEXT NOT NULL DEFAULT 'PPSI',
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "installer_bill_sequences_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "installer_bill_sequences_prefix_key" UNIQUE ("prefix")
  )`,

  `CREATE INDEX IF NOT EXISTS "cubicle_models_is_active_idx" ON "cubicle_models"("is_active")`,
  `CREATE INDEX IF NOT EXISTS "installer_bills_bill_no_idx" ON "installer_bills"("bill_no")`,
  `CREATE INDEX IF NOT EXISTS "installer_bills_installer_email_idx" ON "installer_bills"("installer_email")`,
  `CREATE INDEX IF NOT EXISTS "installer_bills_payment_status_idx" ON "installer_bills"("payment_status")`,
  `CREATE INDEX IF NOT EXISTS "installer_bills_install_date_idx" ON "installer_bills"("install_date")`,
  `CREATE INDEX IF NOT EXISTS "installer_bills_created_at_idx" ON "installer_bills"("created_at")`,
  `CREATE INDEX IF NOT EXISTS "installer_bill_items_bill_id_idx" ON "installer_bill_items"("bill_id")`,
  `CREATE INDEX IF NOT EXISTS "installer_bill_items_model_id_idx" ON "installer_bill_items"("model_id")`,
  `CREATE INDEX IF NOT EXISTS "installer_bill_payments_bill_id_idx" ON "installer_bill_payments"("bill_id")`,


  // ─── Cubicle Installers Directory (Master) ─────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "cubicle_installers" (
    "id"         TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "email"      TEXT NOT NULL,
    "phone"      TEXT,
    "is_active"  BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cubicle_installers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cubicle_installers_email_key" UNIQUE ("email")
  )`,

  `ALTER TABLE "installer_bills" ADD COLUMN IF NOT EXISTS "installer_id" TEXT`,
  `ALTER TABLE "cubicle_models" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'CUBICLE'`,
  `CREATE INDEX IF NOT EXISTS "cubicle_models_category_idx" ON "cubicle_models"("category")`,
  `ALTER TABLE "installer_bill_items" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'CUBICLE'`,
  `CREATE INDEX IF NOT EXISTS "installer_bill_items_category_idx" ON "installer_bill_items"("category")`,
  `ALTER TABLE "installer_bills" ADD COLUMN IF NOT EXISTS "cubicle_quantity" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "installer_bills" ADD COLUMN IF NOT EXISTS "cubicle_total" DECIMAL(12,2) NOT NULL DEFAULT 0.00`,
  `ALTER TABLE "installer_bills" ADD COLUMN IF NOT EXISTS "ump_quantity" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "installer_bills" ADD COLUMN IF NOT EXISTS "ump_rate" DECIMAL(10,2) NOT NULL DEFAULT 0.00`,
  `ALTER TABLE "installer_bills" ALTER COLUMN "ump_rate" SET DEFAULT 0.00`,
  `ALTER TABLE "installer_bills" ADD COLUMN IF NOT EXISTS "ump_total" DECIMAL(12,2) NOT NULL DEFAULT 0.00`,
  `ALTER TABLE "installer_bills" ADD COLUMN IF NOT EXISTS "locker_quantity" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "installer_bills" ADD COLUMN IF NOT EXISTS "locker_total" DECIMAL(12,2) NOT NULL DEFAULT 0.00`,
  `ALTER TABLE "installer_bills" ADD COLUMN IF NOT EXISTS "deduction_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00`,
  `ALTER TABLE "installer_bills" ADD COLUMN IF NOT EXISTS "deduction_reason" TEXT`,
  `CREATE INDEX IF NOT EXISTS "cubicle_installers_is_active_idx" ON "cubicle_installers"("is_active")`,
  `CREATE INDEX IF NOT EXISTS "cubicle_installers_email_idx" ON "cubicle_installers"("email")`,
  `CREATE INDEX IF NOT EXISTS "installer_bills_installer_id_idx" ON "installer_bills"("installer_id")`,
  `UPDATE "cubicle_models" SET "category" = 'UMP' WHERE ("model_name" ILIKE '%ump%' OR "model_name" ILIKE '%upm%') AND "category" != 'UMP'`,
  `UPDATE "cubicle_models" SET "category" = 'UMP' WHERE ("model_name" ILIKE '%ump%' OR "model_name" ILIKE '%upm%') AND "category" != 'UMP'`,
  `UPDATE "cubicle_models" SET "category" = 'LOCKER' WHERE "model_name" ILIKE '%locker%' AND "category" != 'LOCKER'`,

  // ─── EMPLOYEE MANAGEMENT & PAYROLL MODULE ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmployeeStatus') THEN
      CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TERMINATED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GovernmentIdType') THEN
      CREATE TYPE "GovernmentIdType" AS ENUM ('AADHAAR', 'PAN', 'VOTER_ID');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceStatus') THEN
      CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'DOUBLE_DUTY', 'CL', 'EL', 'UL', 'HALF_DAY', 'LEAVE');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PayrollStatus') THEN
      CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'FINALIZED', 'PAID');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LeaveType') THEN
      CREATE TYPE "LeaveType" AS ENUM ('CL', 'EL');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LeaveTransactionType') THEN
      CREATE TYPE "LeaveTransactionType" AS ENUM ('ACCRUAL', 'USAGE', 'ADJUSTMENT');
    END IF;
  END $$`,

  // Create employees table
  `CREATE TABLE IF NOT EXISTS "employees" (
    "id"                   TEXT NOT NULL PRIMARY KEY,
    "employee_id"          TEXT NOT NULL UNIQUE,
    "name"                 TEXT NOT NULL,
    "email"                TEXT NOT NULL UNIQUE,
    "phone"                TEXT NOT NULL,
    "address"              TEXT NOT NULL,
    "government_id_type"   "GovernmentIdType" NOT NULL,
    "government_id_number" TEXT NOT NULL,
    "bank_account_number"  TEXT,
    "bank_ifsc"            TEXT,
    "bank_name"            TEXT,
    "bank_account_holder"  TEXT,
    "designation"          TEXT NOT NULL,
    "department"           TEXT NOT NULL,
    "responsibilities"     TEXT,
    "monthly_ctc"          DECIMAL(12, 2) NOT NULL,
    "joining_date"         TIMESTAMP(3) NOT NULL,
    "status"               "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "cl_balance"           DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    "el_balance"           DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "employees_employee_id_idx" ON "employees"("employee_id")`,
  `CREATE INDEX IF NOT EXISTS "employees_email_idx" ON "employees"("email")`,
  `CREATE INDEX IF NOT EXISTS "employees_department_idx" ON "employees"("department")`,
  `CREATE INDEX IF NOT EXISTS "employees_status_idx" ON "employees"("status")`,

  // Create employee_attendances table
  `CREATE TABLE IF NOT EXISTS "employee_attendances" (
    "id"                 TEXT NOT NULL PRIMARY KEY,
    "employee_id"        TEXT NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
    "date"               DATE NOT NULL,
    "status"             "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "is_sunday"          BOOLEAN NOT NULL DEFAULT FALSE,
    "is_sunday_override" BOOLEAN NOT NULL DEFAULT FALSE,
    "overtime_hours"     DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    "notes"              TEXT,
    "marked_by_id"       TEXT,
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_attendances_employee_date_unique" UNIQUE ("employee_id", "date")
  )`,
  `CREATE INDEX IF NOT EXISTS "employee_attendances_employee_id_idx" ON "employee_attendances"("employee_id")`,
  `CREATE INDEX IF NOT EXISTS "employee_attendances_date_idx" ON "employee_attendances"("date")`,
  `CREATE INDEX IF NOT EXISTS "employee_attendances_status_idx" ON "employee_attendances"("status")`,

  // Create employee_leave_ledgers table
  `CREATE TABLE IF NOT EXISTS "employee_leave_ledgers" (
    "id"               TEXT NOT NULL PRIMARY KEY,
    "employee_id"      TEXT NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
    "leave_type"       "LeaveType" NOT NULL,
    "transaction_type" "LeaveTransactionType" NOT NULL,
    "amount"           DECIMAL(5, 2) NOT NULL,
    "balance_after"    DECIMAL(5, 2) NOT NULL,
    "month"            INTEGER NOT NULL,
    "year"             INTEGER NOT NULL,
    "reason"           TEXT,
    "recorded_by_id"   TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "employee_leave_ledgers_employee_id_idx" ON "employee_leave_ledgers"("employee_id")`,
  `CREATE INDEX IF NOT EXISTS "employee_leave_ledgers_year_month_idx" ON "employee_leave_ledgers"("year", "month")`,

  // Create employee_payroll_runs table
  `CREATE TABLE IF NOT EXISTS "employee_payroll_runs" (
    "id"                  TEXT NOT NULL PRIMARY KEY,
    "employee_id"         TEXT NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
    "month"               INTEGER NOT NULL,
    "year"                INTEGER NOT NULL,
    "monthly_ctc"         DECIMAL(12, 2) NOT NULL,
    "total_calendar_days" INTEGER NOT NULL,
    "sundays_count"       INTEGER NOT NULL,
    "approved_sundays"    INTEGER NOT NULL DEFAULT 0,
    "payable_days"        DECIMAL(6, 2) NOT NULL,
    "per_day_rate"        DECIMAL(12, 2) NOT NULL,
    "present_days"        DECIMAL(6, 2) NOT NULL,
    "cl_days"             DECIMAL(6, 2) NOT NULL,
    "el_days"             DECIMAL(6, 2) NOT NULL,
    "half_days"           DECIMAL(6, 2) NOT NULL,
    "unpaid_days"         DECIMAL(6, 2) NOT NULL,
    "paid_days"           DECIMAL(6, 2) NOT NULL,
    "overtime_hours"      DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
    "overtime_rate"       DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    "overtime_pay"        DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    "gross_salary"        DECIMAL(12, 2) NOT NULL,
    "advance_deduction"   DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    "other_deductions"    DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    "deduction_summary"   JSONB,
    "net_salary"          DECIMAL(12, 2) NOT NULL,
    "status"              "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "paid_at"             TIMESTAMP(3),
    "payment_mode"        TEXT,
    "payment_reference"   TEXT,
    "payment_notes"       TEXT,
    "email_sent"          BOOLEAN NOT NULL DEFAULT FALSE,
    "email_sent_at"       TIMESTAMP(3),
    "email_status"        TEXT,
    "email_error"         TEXT,
    "created_by_id"       TEXT,
    "finalized_by_id"     TEXT,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_payroll_runs_employee_year_month_unique" UNIQUE ("employee_id", "year", "month")
  )`,
  `CREATE INDEX IF NOT EXISTS "employee_payroll_runs_employee_id_idx" ON "employee_payroll_runs"("employee_id")`,
  `CREATE INDEX IF NOT EXISTS "employee_payroll_runs_year_month_idx" ON "employee_payroll_runs"("year", "month")`,
  `CREATE INDEX IF NOT EXISTS "employee_payroll_runs_status_idx" ON "employee_payroll_runs"("status")`,

  // Create employee_advances table
  `CREATE TABLE IF NOT EXISTS "employee_advances" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "employee_id"    TEXT NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
    "amount"         DECIMAL(12, 2) NOT NULL,
    "reason"         TEXT NOT NULL,
    "recovery_month" INTEGER NOT NULL,
    "recovery_year"  INTEGER NOT NULL,
    "is_recovered"   BOOLEAN NOT NULL DEFAULT FALSE,
    "recovered_at"   TIMESTAMP(3),
    "payroll_run_id" TEXT REFERENCES "employee_payroll_runs"("id") ON DELETE SET NULL,
    "created_by_id"  TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "employee_advances_employee_id_idx" ON "employee_advances"("employee_id")`,
  `CREATE INDEX IF NOT EXISTS "employee_advances_recovery_idx" ON "employee_advances"("recovery_year", "recovery_month")`,
  `CREATE INDEX IF NOT EXISTS "employee_advances_is_recovered_idx" ON "employee_advances"("is_recovered")`,

  // Create employee_deductions table
  `CREATE TABLE IF NOT EXISTS "employee_deductions" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "employee_id"    TEXT NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
    "amount"         DECIMAL(12, 2) NOT NULL,
    "reason"         TEXT NOT NULL,
    "apply_month"    INTEGER NOT NULL,
    "apply_year"     INTEGER NOT NULL,
    "is_applied"     BOOLEAN NOT NULL DEFAULT FALSE,
    "applied_at"     TIMESTAMP(3),
    "payroll_run_id" TEXT REFERENCES "employee_payroll_runs"("id") ON DELETE SET NULL,
    "created_by_id"  TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "employee_deductions_employee_id_idx" ON "employee_deductions"("employee_id")`,
  `CREATE INDEX IF NOT EXISTS "employee_deductions_apply_idx" ON "employee_deductions"("apply_year", "apply_month")`,
  `CREATE INDEX IF NOT EXISTS "employee_deductions_is_applied_idx" ON "employee_deductions"("is_applied")`,

  // Create employee_id_sequences table
  `CREATE TABLE IF NOT EXISTS "employee_id_sequences" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "year_month"  TEXT NOT NULL UNIQUE,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `ALTER TABLE "employee_advances" ADD COLUMN IF NOT EXISTS "advance_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "employees" ALTER COLUMN "bank_account_number" DROP NOT NULL`,
  `ALTER TABLE "employees" ALTER COLUMN "bank_ifsc" DROP NOT NULL`,
  `ALTER TABLE "employees" ALTER COLUMN "bank_name" DROP NOT NULL`,
  `ALTER TABLE "employees" ALTER COLUMN "bank_account_holder" DROP NOT NULL`,

  // ─── B2B ORDER MANAGEMENT PIPELINE ──────────────────────────────────────────
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'B2bOrderStatus') THEN
      CREATE TYPE "B2bOrderStatus" AS ENUM ('pending_approval', 'confirmed', 'processing', 'ready', 'completed', 'rejected', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'B2bOrderSource') THEN
      CREATE TYPE "B2bOrderSource" AS ENUM ('admin_created', 'customer_frontend');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StockReservationStatus') THEN
      CREATE TYPE "StockReservationStatus" AS ENUM ('active', 'released', 'consumed');
    END IF;
  END $$`,
  `ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'B2B_ORDER'`,
  `ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'B2B_ADJUSTMENT'`,
  `ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'B2B_CANCELLATION'`,
  `ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'DOUBLE_DUTY'`,

  `CREATE TABLE IF NOT EXISTS "b2b_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_number" TEXT NOT NULL UNIQUE,
    "customer_id" TEXT NOT NULL REFERENCES "users"("id"),
    "branch_id" TEXT NOT NULL REFERENCES "branches"("id"),
    "source" "B2bOrderSource" NOT NULL,
    "status" "B2bOrderStatus" NOT NULL DEFAULT 'pending_approval',
    "source_quotation_id" TEXT REFERENCES "quotes"("id") ON DELETE SET NULL,
    "source_po_id" TEXT REFERENCES "po_submissions"("id") ON DELETE SET NULL,
    "payment_status" TEXT NOT NULL DEFAULT 'pending',
    "payment_method" TEXT NOT NULL DEFAULT 'bank_transfer',
    "paid_amount" NUMERIC(12, 2) NOT NULL DEFAULT 0,
    "due_amount" NUMERIC(12, 2) NOT NULL DEFAULT 0,
    "subtotal" NUMERIC(12, 2) NOT NULL DEFAULT 0,
    "discount_total" NUMERIC(12, 2) NOT NULL DEFAULT 0,
    "tax_total" NUMERIC(12, 2) NOT NULL DEFAULT 0,
    "grand_total" NUMERIC(12, 2) NOT NULL DEFAULT 0,
    "client_request_id" TEXT NOT NULL UNIQUE,
    "created_by" TEXT NOT NULL REFERENCES "users"("id"),
    "created_by_type" TEXT NOT NULL DEFAULT 'customer',
    "approved_by" TEXT REFERENCES "users"("id"),
    "approved_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" TEXT REFERENCES "users"("id"),
    "cancellation_reason" TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS "b2b_order_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL REFERENCES "b2b_orders"("id") ON DELETE CASCADE,
    "product_id" TEXT NOT NULL REFERENCES "products"("id"),
    "sku" TEXT NOT NULL,
    "quantity" NUMERIC(12, 2) NOT NULL,
    "unit_price" NUMERIC(12, 2) NOT NULL,
    "discount" NUMERIC(12, 2) NOT NULL DEFAULT 0,
    "tax" NUMERIC(12, 2) NOT NULL DEFAULT 0,
    "line_total" NUMERIC(12, 2) NOT NULL,
    "configuration" JSONB,
    "is_removed" BOOLEAN NOT NULL DEFAULT false,
    "removed_at" TIMESTAMP(3),
    "removed_by" TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS "stock_reservations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL REFERENCES "b2b_orders"("id") ON DELETE CASCADE,
    "order_item_id" TEXT NOT NULL REFERENCES "b2b_order_items"("id") ON DELETE CASCADE,
    "product_id" TEXT NOT NULL REFERENCES "products"("id"),
    "branch_id" TEXT NOT NULL REFERENCES "branches"("id"),
    "quantity" NUMERIC(12, 2) NOT NULL,
    "status" "StockReservationStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3),
    "consumed_at" TIMESTAMP(3)
  )`,

  `CREATE TABLE IF NOT EXISTS "b2b_order_sequences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "financial_year" TEXT NOT NULL UNIQUE,
    "next_number" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE INDEX IF NOT EXISTS "b2b_orders_customer_id_idx" ON "b2b_orders"("customer_id")`,
  `CREATE INDEX IF NOT EXISTS "b2b_orders_branch_id_idx" ON "b2b_orders"("branch_id")`,
  `CREATE INDEX IF NOT EXISTS "b2b_orders_status_idx" ON "b2b_orders"("status")`,
  `CREATE INDEX IF NOT EXISTS "b2b_orders_created_at_idx" ON "b2b_orders"("created_at")`,
  `CREATE INDEX IF NOT EXISTS "b2b_orders_source_idx" ON "b2b_orders"("source")`,
  `CREATE INDEX IF NOT EXISTS "b2b_order_items_order_id_idx" ON "b2b_order_items"("order_id")`,
  `CREATE INDEX IF NOT EXISTS "b2b_order_items_product_id_idx" ON "b2b_order_items"("product_id")`,
  `CREATE INDEX IF NOT EXISTS "stock_reservations_branch_prod_status_idx" ON "stock_reservations"("branch_id", "product_id", "status")`,
  `CREATE INDEX IF NOT EXISTS "stock_reservations_order_id_idx" ON "stock_reservations"("order_id")`,
  `CREATE INDEX IF NOT EXISTS "stock_reservations_order_item_id_idx" ON "stock_reservations"("order_item_id")`,

  `CREATE OR REPLACE FUNCTION submit_b2b_order(p_payload jsonb)
  RETURNS jsonb
  LANGUAGE plpgsql
  AS $$
  DECLARE
    v_client_request_id TEXT;
    v_customer_id TEXT;
    v_branch_id TEXT;
    v_source TEXT;
    v_created_by TEXT;
    v_created_by_type TEXT;
    v_order_number TEXT;
    v_source_quote_id TEXT;
    v_source_po_id TEXT;
    v_payment_method TEXT;
    v_subtotal NUMERIC(12,2);
    v_discount_total NUMERIC(12,2);
    v_tax_total NUMERIC(12,2);
    v_grand_total NUMERIC(12,2);
    v_order_id TEXT;
    v_existing_order jsonb;
    v_customer RECORD;
    v_branch RECORD;
    v_item jsonb;
    v_item_id TEXT;
    v_product_id TEXT;
    v_sku TEXT;
    v_qty NUMERIC(12,2);
    v_unit_price NUMERIC(12,2);
    v_discount NUMERIC(12,2);
    v_tax NUMERIC(12,2);
    v_line_total NUMERIC(12,2);
    v_config jsonb;
    v_inv RECORD;
    v_created_order jsonb;
  BEGIN
    v_client_request_id := p_payload->>'client_request_id';
    IF v_client_request_id IS NULL OR v_client_request_id = '' THEN
      RAISE EXCEPTION 'MISSING_CLIENT_REQUEST_ID:client_request_id is required' USING ERRCODE = 'P0001';
    END IF;

    SELECT json_build_object(
      'id', o.id,
      'order_number', o.order_number,
      'status', o.status,
      'client_request_id', o.client_request_id
    )::jsonb INTO v_existing_order
    FROM "b2b_orders" o
    WHERE o.client_request_id = v_client_request_id;

    IF v_existing_order IS NOT NULL THEN
      RETURN v_existing_order;
    END IF;

    v_customer_id := p_payload->>'customer_id';
    v_branch_id := p_payload->>'branch_id';
    v_source := COALESCE(p_payload->>'source', 'customer_frontend');
    v_created_by := COALESCE(p_payload->>'created_by', v_customer_id);
    v_created_by_type := COALESCE(p_payload->>'created_by_type', 'customer');
    v_order_number := p_payload->>'order_number';
    v_source_quote_id := p_payload->>'source_quotation_id';
    v_source_po_id := p_payload->>'source_po_id';
    v_payment_method := COALESCE(p_payload->>'payment_method', 'bank_transfer');
    v_subtotal := COALESCE((p_payload->>'subtotal')::numeric, 0);
    v_discount_total := COALESCE((p_payload->>'discount_total')::numeric, 0);
    v_tax_total := COALESCE((p_payload->>'tax_total')::numeric, 0);
    v_grand_total := COALESCE((p_payload->>'grand_total')::numeric, 0);

    SELECT id, "companyName", gstin INTO v_customer
    FROM "users"
    WHERE id = v_customer_id AND "deletedAt" IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'CUSTOMER_NOT_FOUND:Customer account not found' USING ERRCODE = 'P0001';
    END IF;

    IF (v_customer."companyName" IS NULL OR TRIM(v_customer."companyName") = '')
       AND (v_customer.gstin IS NULL OR TRIM(v_customer.gstin) = '') THEN
      RAISE EXCEPTION 'CUSTOMER_NOT_B2B:Customer is not registered as a B2B partner' USING ERRCODE = 'P0001';
    END IF;

    SELECT id, "isActive" INTO v_branch
    FROM "branches"
    WHERE id = v_branch_id AND "deletedAt" IS NULL;

    IF NOT FOUND OR NOT v_branch."isActive" THEN
      RAISE EXCEPTION 'INVALID_BRANCH:Fulfilment branch is invalid or inactive' USING ERRCODE = 'P0001';
    END IF;

    v_order_id := gen_random_uuid()::text;

    INSERT INTO "b2b_orders" (
      "id", "order_number", "customer_id", "branch_id", "source", "status",
      "source_quotation_id", "source_po_id", "payment_status", "payment_method",
      "paid_amount", "due_amount", "subtotal", "discount_total", "tax_total",
      "grand_total", "client_request_id", "created_by", "created_by_type",
      "created_at", "updated_at"
    ) VALUES (
      v_order_id, v_order_number, v_customer_id, v_branch_id, v_source::"B2bOrderSource",
      'pending_approval'::"B2bOrderStatus", v_source_quote_id, v_source_po_id,
      'pending', v_payment_method, 0, v_grand_total, v_subtotal, v_discount_total,
      v_tax_total, v_grand_total, v_client_request_id, v_created_by, v_created_by_type,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
    LOOP
      v_product_id := v_item->>'product_id';
      v_sku := v_item->>'sku';
      v_qty := (v_item->>'quantity')::numeric;
      v_unit_price := (v_item->>'unit_price')::numeric;
      v_discount := COALESCE((v_item->>'discount')::numeric, 0);
      v_tax := COALESCE((v_item->>'tax')::numeric, 0);
      v_line_total := (v_item->>'line_total')::numeric;
      v_config := v_item->'configuration';

      IF v_qty <= 0 THEN
        RAISE EXCEPTION 'INVALID_QUANTITY:Item quantity must be greater than 0' USING ERRCODE = 'P0001';
      END IF;

      SELECT id, quantity, "reservedQuantity" INTO v_inv
      FROM "inventories"
      WHERE ("productId" = v_product_id OR product_id = v_product_id)
        AND ("branchId" = v_branch_id OR branch_id = v_branch_id)
      FOR UPDATE;

      IF NOT FOUND THEN
        -- Auto-initialize inventory row from catalog master stock if product exists
        DECLARE
          v_catalog_product RECORD;
        BEGIN
          SELECT id, stock, sku INTO v_catalog_product
          FROM "products"
          WHERE id = v_product_id AND "deletedAt" IS NULL;

          IF NOT FOUND OR COALESCE(v_catalog_product.stock, 0) < v_qty THEN
            RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_sku USING ERRCODE = 'P0001';
          END IF;

          -- Auto-create the branch inventory row from catalog stock (both column aliases)
          INSERT INTO "inventories" (
            "id", "productId", "product_id", "branchId", "branch_id",
            "quantity", "reservedQuantity", "reserved_quantity",
            "reorderLevel", "reorder_level", "updatedAt", "updated_at"
          ) VALUES (
            gen_random_uuid()::text, v_product_id, v_product_id, v_branch_id, v_branch_id,
            v_catalog_product.stock, 0, 0, 10, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT ("productId", "branchId") DO NOTHING;

          -- Re-fetch the newly created inventory row with lock
          SELECT id, quantity, "reservedQuantity" INTO v_inv
          FROM "inventories"
          WHERE ("productId" = v_product_id OR product_id = v_product_id)
            AND ("branchId" = v_branch_id OR branch_id = v_branch_id)
          FOR UPDATE;

          IF NOT FOUND THEN
            RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_sku USING ERRCODE = 'P0001';
          END IF;
        END;
      END IF;

      IF (v_inv.quantity - COALESCE(v_inv."reservedQuantity", 0)) < v_qty THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_sku USING ERRCODE = 'P0001';
      END IF;

      UPDATE "inventories"
      SET "reservedQuantity" = COALESCE("reservedQuantity", 0) + v_qty,
          reserved_quantity = COALESCE(reserved_quantity, 0) + v_qty,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = v_inv.id;

      v_item_id := gen_random_uuid()::text;
      INSERT INTO "b2b_order_items" (
        "id", "order_id", "product_id", "sku", "quantity", "unit_price",
        "discount", "tax", "line_total", "configuration"
      ) VALUES (
        v_item_id, v_order_id, v_product_id, v_sku, v_qty, v_unit_price,
        v_discount, v_tax, v_line_total, v_config
      );

      INSERT INTO "stock_reservations" (
        "id", "order_id", "order_item_id", "product_id", "branch_id",
        "quantity", "status", "created_at"
      ) VALUES (
        gen_random_uuid()::text, v_order_id, v_item_id, v_product_id, v_branch_id,
        v_qty, 'active'::"StockReservationStatus", CURRENT_TIMESTAMP
      );
    END LOOP;

    SELECT json_build_object(
      'id', o.id,
      'order_number', o.order_number,
      'status', o.status,
      'client_request_id', o.client_request_id,
      'grand_total', o.grand_total,
      'created_at', o.created_at
    )::jsonb INTO v_created_order
    FROM "b2b_orders" o
    WHERE o.id = v_order_id;

    RETURN v_created_order;
  END;
  $$`,

  `CREATE OR REPLACE FUNCTION approve_b2b_order(p_order_id text, p_admin_id text)
  RETURNS jsonb
  LANGUAGE plpgsql
  AS $$
  DECLARE
    v_order RECORD;
    v_res RECORD;
    v_inv RECORD;
    v_old_stock INTEGER;
    v_new_stock INTEGER;
    v_result jsonb;
  BEGIN
    SELECT * INTO v_order
    FROM "b2b_orders"
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ORDER_NOT_FOUND:B2B order not found' USING ERRCODE = 'P0001';
    END IF;

    IF v_order.status = 'confirmed' THEN
      SELECT json_build_object('id', o.id, 'status', o.status, 'order_number', o.order_number)::jsonb
      INTO v_result FROM "b2b_orders" o WHERE o.id = p_order_id;
      RETURN v_result;
    END IF;

    IF v_order.status != 'pending_approval' THEN
      RAISE EXCEPTION 'INVALID_STATUS:Order cannot be approved in status %', v_order.status USING ERRCODE = 'P0001';
    END IF;

    FOR v_res IN
      SELECT r.id, r.order_item_id, r.product_id, r.branch_id, r.quantity, i.sku
      FROM "stock_reservations" r
      JOIN "b2b_order_items" i ON i.id = r.order_item_id
      WHERE r.order_id = p_order_id AND r.status = 'active'
      FOR UPDATE OF r
    LOOP
      SELECT id, quantity, "reservedQuantity" INTO v_inv
      FROM "inventories"
      WHERE ("productId" = v_res.product_id OR product_id = v_res.product_id)
        AND ("branchId" = v_res.branch_id OR branch_id = v_res.branch_id)
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'STOCK_CHANGED_SINCE_SUBMISSION:Inventory not found for SKU %', v_res.sku USING ERRCODE = 'P0001';
      END IF;

      IF v_inv.quantity < v_res.quantity THEN
        RAISE EXCEPTION 'STOCK_CHANGED_SINCE_SUBMISSION:Insufficient stock for SKU %', v_res.sku USING ERRCODE = 'P0001';
      END IF;

      v_old_stock := v_inv.quantity;
      v_new_stock := v_old_stock - v_res.quantity::integer;

      UPDATE "inventories"
      SET quantity = v_new_stock,
          "reservedQuantity" = GREATEST(0, COALESCE("reservedQuantity", 0) - v_res.quantity::integer),
          reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - v_res.quantity::integer),
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = v_inv.id;

      UPDATE "stock_reservations"
      SET status = 'consumed'::"StockReservationStatus",
          consumed_at = CURRENT_TIMESTAMP
      WHERE id = v_res.id;

      INSERT INTO "stock_movements" (
        "id", "productId", "product_id", "branchId", "branch_id",
        "type", "quantity", "previousQty", "previous_qty",
        "newQty", "new_qty", "referenceType", "reference_type",
        "referenceId", "reference_id", "performedById", "performed_by_id",
        "notes", "createdAt", "created_at"
      ) VALUES (
        gen_random_uuid()::text, v_res.product_id, v_res.product_id,
        v_res.branch_id, v_res.branch_id, 'B2B_ORDER'::"StockMovementType",
        v_res.quantity::integer, v_old_stock, v_old_stock, v_new_stock, v_new_stock,
        'B2B_ORDER', 'B2B_ORDER', p_order_id, p_order_id,
        p_admin_id, p_admin_id, 'B2B Order Confirmation (' || v_order.order_number || ')',
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      );
    END LOOP;

    UPDATE "b2b_orders"
    SET status = 'confirmed'::"B2bOrderStatus",
        approved_by = p_admin_id,
        approved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_order_id;

    SELECT json_build_object(
      'id', o.id,
      'order_number', o.order_number,
      'status', o.status,
      'approved_by', o.approved_by,
      'approved_at', o.approved_at
    )::jsonb INTO v_result
    FROM "b2b_orders" o
    WHERE o.id = p_order_id;

    RETURN v_result;
  END;
  $$`,

  `CREATE OR REPLACE FUNCTION reject_b2b_order(p_order_id text, p_admin_id text, p_reason text)
  RETURNS jsonb
  LANGUAGE plpgsql
  AS $$
  DECLARE
    v_order RECORD;
    v_res RECORD;
    v_result jsonb;
  BEGIN
    SELECT * INTO v_order
    FROM "b2b_orders"
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ORDER_NOT_FOUND:B2B order not found' USING ERRCODE = 'P0001';
    END IF;

    IF v_order.status = 'rejected' THEN
      SELECT json_build_object('id', o.id, 'status', o.status, 'order_number', o.order_number)::jsonb
      INTO v_result FROM "b2b_orders" o WHERE o.id = p_order_id;
      RETURN v_result;
    END IF;

    IF v_order.status != 'pending_approval' THEN
      RAISE EXCEPTION 'INVALID_STATUS:Order cannot be rejected in status %', v_order.status USING ERRCODE = 'P0001';
    END IF;

    FOR v_res IN
      SELECT id, product_id, branch_id, quantity
      FROM "stock_reservations"
      WHERE order_id = p_order_id AND status = 'active'
      FOR UPDATE
    LOOP
      UPDATE "inventories"
      SET "reservedQuantity" = GREATEST(0, COALESCE("reservedQuantity", 0) - v_res.quantity::integer),
          reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - v_res.quantity::integer),
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE ("productId" = v_res.product_id OR product_id = v_res.product_id)
        AND ("branchId" = v_res.branch_id OR branch_id = v_res.branch_id);

      UPDATE "stock_reservations"
      SET status = 'released'::"StockReservationStatus",
          released_at = CURRENT_TIMESTAMP
      WHERE id = v_res.id;
    END LOOP;

    UPDATE "b2b_orders"
    SET status = 'rejected'::"B2bOrderStatus",
        rejected_reason = p_reason,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_order_id;

    SELECT json_build_object(
      'id', o.id,
      'order_number', o.order_number,
      'status', o.status,
      'rejected_reason', o.rejected_reason
    )::jsonb INTO v_result
    FROM "b2b_orders" o
    WHERE o.id = p_order_id;

    RETURN v_result;
  END;
  $$`,

  // ─── UP Daily Cash Expense Module (Factory-Specific Ledger) ───────────────────
  `CREATE TABLE IF NOT EXISTS "up_expense_categories" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL UNIQUE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,

  `CREATE TABLE IF NOT EXISTS "up_expenses" (
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
  );`,

  `CREATE TABLE IF NOT EXISTS "up_expense_access" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "admin_id" UUID NOT NULL,
    "granted_by" UUID NOT NULL,
    "granted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ
  );`,

  `CREATE TABLE IF NOT EXISTS "up_expense_audit" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "expense_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "changed_by" UUID NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,

  `CREATE TABLE IF NOT EXISTS "up_cash_days" (
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
  );`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "idx_up_expense_access_active" ON "up_expense_access"("admin_id") WHERE "revoked_at" IS NULL;`,
  `CREATE INDEX IF NOT EXISTS "idx_up_expenses_date" ON "up_expenses"("expense_date");`,
  `CREATE INDEX IF NOT EXISTS "idx_up_expenses_category" ON "up_expenses"("category_id");`,
  `CREATE INDEX IF NOT EXISTS "idx_up_expenses_created_by" ON "up_expenses"("created_by");`,
  `CREATE INDEX IF NOT EXISTS "idx_up_expenses_date_category" ON "up_expenses"("expense_date", "category_id");`,
  `CREATE INDEX IF NOT EXISTS "idx_up_expenses_verified" ON "up_expenses"("verified");`,
  `CREATE INDEX IF NOT EXISTS "idx_up_expenses_deleted_at" ON "up_expenses"("deleted_at");`,
  `CREATE INDEX IF NOT EXISTS "idx_up_cash_days_date" ON "up_cash_days"("cash_date");`,
  `CREATE INDEX IF NOT EXISTS "idx_up_expense_audit_expense" ON "up_expense_audit"("expense_id");`,

  `INSERT INTO "up_expense_categories" ("id", "name", "active", "sort_order")
   VALUES
     (gen_random_uuid(), 'Raw Material Purchase', true, 1),
     (gen_random_uuid(), 'Wages / Labor', true, 2),
     (gen_random_uuid(), 'Utilities', true, 3),
     (gen_random_uuid(), 'Transport & Logistics', true, 4),
     (gen_random_uuid(), 'Machine Maintenance', true, 5),
     (gen_random_uuid(), 'Miscellaneous', true, 6)
   ON CONFLICT ("name") DO NOTHING;`,

  `CREATE OR REPLACE FUNCTION public.has_up_access()
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

     SELECT EXISTS (
       SELECT 1 FROM "user_roles" ur
       JOIN "roles" r ON r.id = ur."roleId"
       WHERE ur."userId" = v_user_id
         AND LOWER(REPLACE(REPLACE(r.slug, '-', ''), '_', '')) IN ('superadmin')
     ) INTO v_is_super;

     IF v_is_super THEN
       RETURN true;
     END IF;

     SELECT EXISTS (
       SELECT 1 FROM "up_expense_access"
       WHERE "admin_id"::text = v_user_id AND "revoked_at" IS NULL
     ) INTO v_has_access;

     RETURN v_has_access;
   END;
   $$;`,

  `ALTER TABLE "up_expenses" ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE "up_expense_categories" ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE "up_expense_access" ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE "up_expense_audit" ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE "up_cash_days" ENABLE ROW LEVEL SECURITY;`,

  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'up_expenses' AND policyname = 'up_expenses_access_policy') THEN
       CREATE POLICY up_expenses_access_policy ON "up_expenses"
         FOR ALL USING (public.has_up_access());
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'up_expense_categories' AND policyname = 'up_expense_categories_access_policy') THEN
       CREATE POLICY up_expense_categories_access_policy ON "up_expense_categories"
         FOR ALL USING (public.has_up_access());
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'up_expense_access' AND policyname = 'up_expense_access_policy') THEN
       CREATE POLICY up_expense_access_policy ON "up_expense_access"
         FOR ALL USING (public.has_up_access());
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'up_expense_audit' AND policyname = 'up_expense_audit_policy') THEN
       CREATE POLICY up_expense_audit_policy ON "up_expense_audit"
         FOR ALL USING (public.has_up_access());
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'up_cash_days' AND policyname = 'up_cash_days_access_policy') THEN
       CREATE POLICY up_cash_days_access_policy ON "up_cash_days"
         FOR ALL USING (public.has_up_access());
     END IF;
   END $$;`,
];

async function run() {
  const timeoutTimer = setTimeout(() => {
    console.warn('[fix-db] Pre-start safety timeout reached (15s). Handing off immediately to Express server...');
    if (require.main === module) {
      process.exit(0);
    }
  }, 15000);

  try {
    await prisma.$connect();

    // 1. Ensure patch tracking table exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_applied_schema_patches" (
        "patch_hash" TEXT PRIMARY KEY,
        "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Fetch already-applied patch hashes in a single fast query
    const existingRows = await prisma.$queryRawUnsafe(`SELECT patch_hash FROM "_applied_schema_patches";`);
    const appliedSet = new Set(existingRows.map((r) => r.patch_hash));

    console.log(`[fix-db] Connected. Tracking ${STATEMENTS.length} patches (${appliedSet.size} previously cached)...`);

    let appliedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < STATEMENTS.length; i++) {
      const stmt = STATEMENTS[i].trim();
      const hash = crypto.createHash('sha256').update(stmt).digest('hex');

      if (appliedSet.has(hash)) {
        skippedCount++;
        continue;
      }

      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (stmtErr) {
        console.warn(`[fix-db] Statement ${i + 1} notice:`, stmtErr?.message || stmtErr);
      }

      // Record this patch as applied so subsequent boots skip it instantly
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "_applied_schema_patches" ("patch_hash") VALUES ($1) ON CONFLICT DO NOTHING;`,
          hash
        );
        appliedSet.add(hash);
      } catch {}

      appliedCount++;
    }

    console.log(`[fix-db] ✅ Schema verification completed: ${appliedCount} applied, ${skippedCount} cached.`);

    // ─── Self-Healing: Verify & Upsert Platform Permissions Catalog ───────────
    try {
      const { seedAllPermissions } = require('./seed-all-permissions');
      await seedAllPermissions();
    } catch (permErr) {
      console.warn('[fix-db] Permissions verification non-fatal notice:', permErr?.message || permErr);
    }
  } catch (err) {
    console.warn('[fix-db] Schema patch non-fatal notice:', err?.message || err);
  } finally {
    clearTimeout(timeoutTimer);
    try {
      await prisma.$disconnect();
    } catch {}
    if (require.main === module) {
      process.exit(0);
    }
  }
}

module.exports = { run, runFixDb: run };

if (require.main === module) {
  run();
}

