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
  // ─── DEDICATED PROFORMA INVOICES MODULE TABLES & TYPES (TOP PRIORITY) ───
  `DO $ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProformaInvoiceStatus') THEN
      CREATE TYPE "ProformaInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'SENT', 'APPROVED', 'ACCEPTED', 'ADVANCE_RECEIVED', 'CONVERTED_TO_INVOICE', 'CANCELLED', 'EXPIRED');
    END IF;
  END $`,

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
];

async function run() {
  const timeoutTimer = setTimeout(() => {
    console.warn('[fix-db] Timeout reached (60s). Proceeding directly to server startup...');
    process.exit(0);
  }, 60000);


  try {
    await prisma.$connect();
    console.log(`[fix-db] Connected. Verifying ${STATEMENTS.length} schema patches...`);
    
    // Execute all statements sequentially to prevent PostgreSQL concurrent lock/deadlock errors
    for (let i = 0; i < STATEMENTS.length; i++) {
      try {
        await prisma.$executeRawUnsafe(STATEMENTS[i]);
      } catch (stmtErr) {
        console.warn(`[fix-db] Statement ${i + 1} failed:`, stmtErr?.message || stmtErr);
      }
    }
    console.log('[fix-db] ✅ Schema verification completed.');
  } catch (err) {
    console.warn('[fix-db] Schema patch non-fatal notice:', err?.message || err);
  } finally {
    clearTimeout(timeoutTimer);
    try {
      await prisma.$disconnect();
    } catch {}
    process.exit(0);
  }
}

run();
