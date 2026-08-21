import { PrismaClient } from '@prisma/client';
import { env } from './env';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  readPrisma?: PrismaClient;
};

const prismaLogConfig: any =
  process.env.PRISMA_LOG_QUERIES === 'true' ? ['query', 'error', 'warn'] : ['error'];

export const writePrisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: prismaLogConfig,
  });

export const readPrisma =
  globalForPrisma.readPrisma ||
  (env.database.readUrl
    ? new PrismaClient({
        datasources: { db: { url: env.database.readUrl } },
        log: prismaLogConfig,
      })
    : writePrisma);

globalForPrisma.prisma = writePrisma;
globalForPrisma.readPrisma = readPrisma;

export const prisma = writePrisma;

const PO_AUTO_HEAL_STATEMENTS = [
  // ─── QUOTATION AUTO-HEAL STATEMENTS ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'QuoteStatus') THEN
      CREATE TYPE "QuoteStatus" AS ENUM ('PENDING','UNDER_REVIEW','APPROVED','REJECTED','CONVERTED','EXPIRED');
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='customerProposedAdvancePercent') THEN
      ALTER TABLE "quotes" RENAME COLUMN "customerProposedAdvancePercent" TO "customer_proposed_advance_percent";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='customerEditCount') THEN
      ALTER TABLE "quotes" RENAME COLUMN "customerEditCount" TO "customer_edit_count";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='customerEditRemark') THEN
      ALTER TABLE "quotes" RENAME COLUMN "customerEditRemark" TO "customer_edit_remark";
    END IF;
  END $$`,

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

  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "advance_percentage" DECIMAL(5,2)`,

  // ─── PO SUBMISSIONS ENUMS ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PoSourceType') THEN
      CREATE TYPE "PoSourceType" AS ENUM ('FORM', 'PDF_UPLOAD');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PoSubmissionStatus') THEN
      CREATE TYPE "PoSubmissionStatus" AS ENUM (
        'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED',
        'REJECTED', 'APPROVED', 'ACKNOWLEDGED', 'FULFILLMENT'
      );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LineItemSource') THEN
      CREATE TYPE "LineItemSource" AS ENUM ('CUSTOMER_ENTERED', 'ADMIN_MAPPED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PoSubmissionAction') THEN
      CREATE TYPE "PoSubmissionAction" AS ENUM (
        'SUBMITTED', 'VIEWED', 'UNDER_REVIEW', 'MAPPED_LINE_ITEM',
        'CHANGES_REQUESTED', 'CUSTOMER_RESUBMITTED', 'APPROVED',
        'REJECTED', 'ACKNOWLEDGED', 'ASSIGNED', 'INTERNAL_NOTE'
      );
    END IF;
  END $$`,

  // ─── PO SUBMISSIONS TABLE ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='po_submissions') THEN
      CREATE TABLE "po_submissions" (
        "id"                     TEXT NOT NULL,
        "submission_number"      TEXT NOT NULL,
        "customer_id"            TEXT NOT NULL,
        "source_type"            "PoSourceType" NOT NULL DEFAULT 'FORM',
        "status"                 "PoSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
        "customer_po_number"     TEXT NOT NULL,
        "customer_po_date"       TIMESTAMP(3),
        "stated_total"           DECIMAL(12,2),
        "mapped_total"           DECIMAL(12,2),
        "currency"               TEXT NOT NULL DEFAULT 'INR',
        "expected_delivery_date" TIMESTAMP(3),
        "reviewed_by"            TEXT,
        "assigned_to"            TEXT,
        "approved_by"            TEXT,
        "approved_at"            TIMESTAMP(3),
        "rejection_reason"       TEXT,
        "change_request_reason"  TEXT,
        "bill_to_address"        JSONB,
        "ship_to_address"        JSONB,
        "payment_terms"          TEXT,
        "customer_note"          TEXT,
        "submitted_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "po_submissions_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX "po_submissions_submission_number_key" ON "po_submissions"("submission_number");
      CREATE INDEX "po_submissions_customer_id_idx" ON "po_submissions"("customer_id");
      CREATE INDEX "po_submissions_status_idx" ON "po_submissions"("status");
      CREATE INDEX "po_submissions_source_type_idx" ON "po_submissions"("source_type");
      CREATE INDEX "po_submissions_customer_po_number_idx" ON "po_submissions"("customer_po_number");
      CREATE INDEX "po_submissions_assigned_to_idx" ON "po_submissions"("assigned_to");
      CREATE INDEX "po_submissions_submitted_at_idx" ON "po_submissions"("submitted_at");
    END IF;
  END $$`,

  // ─── PO SUBMISSION LINE ITEMS TABLE ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='po_submission_line_items') THEN
      CREATE TABLE "po_submission_line_items" (
        "id"            TEXT NOT NULL,
        "submission_id" TEXT NOT NULL,
        "sl_no"         INTEGER NOT NULL DEFAULT 1,
        "product_id"    TEXT,
        "variant_id"    TEXT,
        "description"   TEXT NOT NULL,
        "sku"           TEXT,
        "unit"          TEXT NOT NULL DEFAULT 'PCS',
        "quantity"      INTEGER NOT NULL,
        "unit_price"    DECIMAL(12,2) NOT NULL,
        "tax_rate"      DECIMAL(5,2),
        "tax_amount"    DECIMAL(12,2),
        "line_total"    DECIMAL(12,2) NOT NULL,
        "source"        "LineItemSource" NOT NULL DEFAULT 'CUSTOMER_ENTERED',
        "sort_order"    INTEGER NOT NULL DEFAULT 0,
        "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "po_submission_line_items_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX "po_submission_line_items_submission_id_idx" ON "po_submission_line_items"("submission_id");
      CREATE INDEX "po_submission_line_items_product_id_idx" ON "po_submission_line_items"("product_id");
    END IF;
  END $$`,

  // ─── PO SUBMISSION ATTACHMENTS TABLE ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='po_submission_attachments') THEN
      CREATE TABLE "po_submission_attachments" (
        "id"                 TEXT NOT NULL,
        "submission_id"      TEXT NOT NULL,
        "file_storage_key"   TEXT NOT NULL,
        "original_file_name" TEXT NOT NULL,
        "file_size_bytes"    INTEGER NOT NULL,
        "mime_type"          TEXT NOT NULL,
        "checksum"           TEXT,
        "uploaded_by"        TEXT NOT NULL,
        "uploaded_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "po_submission_attachments_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX "po_submission_attachments_submission_id_idx" ON "po_submission_attachments"("submission_id");
    END IF;
  END $$`,

  // ─── PO SUBMISSION LOGS TABLE ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='po_submission_logs') THEN
      CREATE TABLE "po_submission_logs" (
        "id"            TEXT NOT NULL,
        "submission_id" TEXT NOT NULL,
        "actor_id"      TEXT,
        "action"        "PoSubmissionAction" NOT NULL,
        "from_status"   "PoSubmissionStatus",
        "to_status"     "PoSubmissionStatus",
        "comment"       TEXT,
        "is_internal"   BOOLEAN NOT NULL DEFAULT false,
        "metadata"      JSONB,
        "ip_address"    TEXT,
        "timestamp"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "po_submission_logs_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX "po_submission_logs_submission_id_idx" ON "po_submission_logs"("submission_id");
      CREATE INDEX "po_submission_logs_actor_id_idx" ON "po_submission_logs"("actor_id");
      CREATE INDEX "po_submission_logs_action_idx" ON "po_submission_logs"("action");
    END IF;
  END $$`,

  // ─── PO ACKNOWLEDGEMENTS TABLE ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='po_acknowledgements') THEN
      CREATE TABLE "po_acknowledgements" (
        "id"               TEXT NOT NULL,
        "submission_id"    TEXT NOT NULL,
        "ack_number"       TEXT NOT NULL,
        "file_storage_key" TEXT NOT NULL,
        "issued_by"        TEXT NOT NULL,
        "issued_by_name"   TEXT,
        "issued_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "po_acknowledgements_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX "po_acknowledgements_submission_id_key" ON "po_acknowledgements"("submission_id");
      CREATE UNIQUE INDEX "po_acknowledgements_ack_number_key" ON "po_acknowledgements"("ack_number");
    END IF;
  END $$`,

  // ─── PO SUBMISSION SEQUENCES TABLE ───
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='po_submission_sequences') THEN
      CREATE TABLE "po_submission_sequences" (
        "id"             TEXT NOT NULL,
        "prefix"         TEXT NOT NULL DEFAULT 'POS',
        "financial_year" TEXT NOT NULL,
        "next_number"    INTEGER NOT NULL DEFAULT 1,
        "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "po_submission_sequences_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX "po_submission_sequences_prefix_fy_key" ON "po_submission_sequences"("prefix", "financial_year");
    END IF;
  END $$`,

  // ─── LINK B2B_PURCHASE_ORDERS TO PO_SUBMISSIONS ───
  `DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='b2b_purchase_orders') THEN
      ALTER TABLE "b2b_purchase_orders" ALTER COLUMN "quotation_id" DROP NOT NULL;
      ALTER TABLE "b2b_purchase_orders" ALTER COLUMN "quotation_number" DROP NOT NULL;
      ALTER TABLE "b2b_purchase_orders" ADD COLUMN IF NOT EXISTS "po_submission_id" TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS "b2b_purchase_orders_po_submission_id_key" ON "b2b_purchase_orders"("po_submission_id");
    END IF;
  END $$`,

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
];

export const autoHealDatabaseSchema = async () => {
  try {
    // 1. Ensure mustChangePassword column exists on users table
    await writePrisma.$executeRawUnsafe(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
    `);

    // 2. Ensure b2b_customer_prices table exists
    await writePrisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "b2b_customer_prices" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "productId" TEXT NOT NULL,
        "price" DECIMAL(12,2) NOT NULL,
        "minQuantity" INTEGER NOT NULL DEFAULT 1,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "b2b_customer_prices_pkey" PRIMARY KEY ("id")
      );
    `);

    // 3. Create missing indexes
    await writePrisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "b2b_customer_prices_userId_productId_key" ON "b2b_customer_prices"("userId", "productId");
    `);
    await writePrisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "b2b_customer_prices_userId_idx" ON "b2b_customer_prices"("userId");
    `);
    await writePrisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "b2b_customer_prices_productId_idx" ON "b2b_customer_prices"("productId");
    `);

    // 4. Run PO module schema auto-healing statements
    for (const sql of PO_AUTO_HEAL_STATEMENTS) {
      try {
        await writePrisma.$executeRawUnsafe(sql);
      } catch (e: any) {
        // Non-fatal warning
      }
    }

    console.log('[Database] Schema auto-heal completed successfully.');
  } catch (err: any) {
    console.warn('[Database] Schema auto-heal notice:', err?.message || err);
  }
};

export const connectDatabases = async () => {
  await writePrisma.$connect();
  if (readPrisma !== writePrisma) {
    await readPrisma.$connect();
  }
  await autoHealDatabaseSchema();
};

export const disconnectDatabases = async () => {
  await writePrisma.$disconnect();
  if (readPrisma !== writePrisma) {
    await readPrisma.$disconnect();
  }
  const { disconnectShardClients } = await import('./sharding');
  await disconnectShardClients();
  const { disconnectRedis } = await import('./redis');
  await disconnectRedis();
};

export default writePrisma;
