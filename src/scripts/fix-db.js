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
  // Create QuoteStatus enum if it doesn't exist
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'QuoteStatus') THEN
      CREATE TYPE "QuoteStatus" AS ENUM ('PENDING','UNDER_REVIEW','APPROVED','REJECTED','CONVERTED','EXPIRED');
    END IF;
  END $$`,

  // Rename camelCase columns on quotes table
  `DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='quoteNumber') THEN
      ALTER TABLE "quotes" RENAME COLUMN "quoteNumber" TO "quote_number";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='createdAt') THEN
      ALTER TABLE "quotes" RENAME COLUMN "createdAt" TO "created_at";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='updatedAt') THEN
      ALTER TABLE "quotes" RENAME COLUMN "updatedAt" TO "updated_at";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='userId') THEN
      ALTER TABLE "quotes" RENAME COLUMN "userId" TO "user_id";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='discountTotal') THEN
      ALTER TABLE "quotes" RENAME COLUMN "discountTotal" TO "discount_total";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='taxTotal') THEN
      ALTER TABLE "quotes" RENAME COLUMN "taxTotal" TO "tax_total";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='grandTotal') THEN
      ALTER TABLE "quotes" RENAME COLUMN "grandTotal" TO "grand_total";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='adminNotes') THEN
      ALTER TABLE "quotes" RENAME COLUMN "adminNotes" TO "admin_notes";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='validUntil') THEN
      ALTER TABLE "quotes" RENAME COLUMN "validUntil" TO "valid_until";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='convertedOrderId') THEN
      ALTER TABLE "quotes" RENAME COLUMN "convertedOrderId" TO "converted_order_id";
    END IF;
  END $$`,

  // Add all missing snake_case columns to quotes
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "quote_number"            TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "reference_no"            TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "financial_year"          TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "sequence_no"             INTEGER`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "project_name"            TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "first_name"              TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "last_name"               TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "company_name"            TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "gst_no"                  TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "email"                   TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "phone"                   TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "user_id"                 TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "status_reason"           TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "basic_price"             DECIMAL(12,2)`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "gst_amount"              DECIMAL(12,2)`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "shipping_cost"           DECIMAL(12,2)`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "subtotal"                DECIMAL(12,2)`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "discount_total"          DECIMAL(12,2)`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "tax_total"               DECIMAL(12,2)`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "grand_total"             DECIMAL(12,2)`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "admin_notes"             TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "terms_accepted"          BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "customer_response"       TEXT NOT NULL DEFAULT 'pending'`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "customer_response_notes" TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "customer_response_at"    TIMESTAMP(3)`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "access_token"            TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "digital_signature"       TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "signed_by"               TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "signed_at"               TIMESTAMP(3)`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "qr_code_data"            TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "valid_until"             TIMESTAMP(3)`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "converted_order_id"      TEXT`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "is_deleted"              BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "deleted_at"              TIMESTAMP(3)`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "updated_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,

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
        "id"                         TEXT NOT NULL,
        "default_percentage"         DECIMAL(5,2) NOT NULL DEFAULT 30,
        "min_percentage"             DECIMAL(5,2) NOT NULL DEFAULT 10,
        "max_percentage"             DECIMAL(5,2) NOT NULL DEFAULT 100,
        "allow_custom_per_customer"  BOOLEAN NOT NULL DEFAULT false,
        "updated_by"                 TEXT,
        "created_at"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "advance_payment_settings_pkey" PRIMARY KEY ("id")
      );
    END IF;
  END $$`,

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
        "upi_id"                 TEXT,
        "qr_code_image_url"      TEXT,
        "currency"               TEXT NOT NULL DEFAULT 'INR',
        "is_active"              BOOLEAN NOT NULL DEFAULT true,
        "updated_by"             TEXT,
        "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "bank_account_settings_pkey" PRIMARY KEY ("id")
      );
    END IF;
  END $$`,
];

async function run() {
  let failed = 0;
  try {
    await prisma.$connect();
    console.log('[fix-db] Connected. Running', STATEMENTS.length, 'patch statements...');
    for (let i = 0; i < STATEMENTS.length; i++) {
      try {
        await prisma.$executeRawUnsafe(STATEMENTS[i]);
      } catch (err) {
        console.warn(`[fix-db] Statement ${i + 1} warning (non-fatal):`, err.message);
        failed++;
      }
    }
    if (failed === 0) {
      console.log('[fix-db] ✅ All patches applied successfully.');
    } else {
      console.log(`[fix-db] ⚠️  ${STATEMENTS.length - failed}/${STATEMENTS.length} patches applied (${failed} warnings).`);
    }
  } catch (err) {
    console.error('[fix-db] ❌ Fatal error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
