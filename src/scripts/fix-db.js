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
