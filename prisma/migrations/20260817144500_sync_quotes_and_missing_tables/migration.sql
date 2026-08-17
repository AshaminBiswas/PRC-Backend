-- ============================================================================
-- MIGRATION: 20260817144500_sync_quotes_and_missing_tables
-- Purpose: Safely sync Quote module (snake_case columns, FY reference, digital
--          signature, activity logs, sequence) and all missing auxiliary tables.
-- ============================================================================

-- ─── 1. CREATE MISSING ENUMS IF NOT EXISTS ───────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'QuoteStatus') THEN
        CREATE TYPE "QuoteStatus" AS ENUM (
            'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CONVERTED', 'EXPIRED'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceType') THEN
        CREATE TYPE "InvoiceType" AS ENUM (
            'TAX_INVOICE', 'PROFORMA_INVOICE', 'QUOTATION', 'DELIVERY_CHALLAN',
            'PACKING_SLIP', 'PURCHASE_ORDER', 'CREDIT_NOTE', 'DEBIT_NOTE', 'COMMERCIAL_INVOICE'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceStatus') THEN
        CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID', 'CANCELLED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AppointmentStatus') THEN
        CREATE TYPE "AppointmentStatus" AS ENUM (
            'PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW'
        );
    END IF;
END $$;

-- ─── 2. SAFE RENAME OF QUOTE & QUOTE_ITEM COLUMNS (CAMELCASE -> SNAKE_CASE) ──
DO $$
BEGIN
    -- quotes table column renames
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'quoteNumber') THEN
        ALTER TABLE "quotes" RENAME COLUMN "quoteNumber" TO "quote_number";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'userId') THEN
        ALTER TABLE "quotes" RENAME COLUMN "userId" TO "user_id";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'discountTotal') THEN
        ALTER TABLE "quotes" RENAME COLUMN "discountTotal" TO "discount_total";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'taxTotal') THEN
        ALTER TABLE "quotes" RENAME COLUMN "taxTotal" TO "tax_total";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'grandTotal') THEN
        ALTER TABLE "quotes" RENAME COLUMN "grandTotal" TO "grand_total";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'adminNotes') THEN
        ALTER TABLE "quotes" RENAME COLUMN "adminNotes" TO "admin_notes";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'validUntil') THEN
        ALTER TABLE "quotes" RENAME COLUMN "validUntil" TO "valid_until";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'convertedOrderId') THEN
        ALTER TABLE "quotes" RENAME COLUMN "convertedOrderId" TO "converted_order_id";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'createdAt') THEN
        ALTER TABLE "quotes" RENAME COLUMN "createdAt" TO "created_at";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'updatedAt') THEN
        ALTER TABLE "quotes" RENAME COLUMN "updatedAt" TO "updated_at";
    END IF;

    -- quote_items table column renames
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_items' AND column_name = 'quoteId') THEN
        ALTER TABLE "quote_items" RENAME COLUMN "quoteId" TO "quote_id";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_items' AND column_name = 'productId') THEN
        ALTER TABLE "quote_items" RENAME COLUMN "productId" TO "product_id";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_items' AND column_name = 'variantId') THEN
        ALTER TABLE "quote_items" RENAME COLUMN "variantId" TO "variant_id";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_items' AND column_name = 'requestedPrice') THEN
        ALTER TABLE "quote_items" RENAME COLUMN "requestedPrice" TO "requested_price";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_items' AND column_name = 'createdAt') THEN
        ALTER TABLE "quote_items" RENAME COLUMN "createdAt" TO "created_at";
    END IF;
END $$;

-- ─── 3. ENSURE QUOTES TABLE HAS ALL COLUMNS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS "quotes" (
    "id" TEXT NOT NULL,
    "quote_number" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "quote_number" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "reference_no" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "financial_year" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "sequence_no" INTEGER;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "project_name" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "first_name" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "last_name" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "company_name" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "gst_no" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "user_id" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "status" "QuoteStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "status_reason" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "basic_price" DECIMAL(12,2);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "gst_amount" DECIMAL(12,2);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "shipping_cost" DECIMAL(12,2);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL(12,2);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "discount_total" DECIMAL(12,2);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "tax_total" DECIMAL(12,2);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "grand_total" DECIMAL(12,2);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "notes" VARCHAR(500);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "admin_notes" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "terms_accepted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "customer_response" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "customer_response_notes" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "customer_response_at" TIMESTAMP(3);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "access_token" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "digital_signature" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "signed_by" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "signed_at" TIMESTAMP(3);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "qr_code_data" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "valid_until" TIMESTAMP(3);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "converted_order_id" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "quotes_quote_number_key" ON "quotes"("quote_number");
CREATE UNIQUE INDEX IF NOT EXISTS "quotes_reference_no_key" ON "quotes"("reference_no");
CREATE UNIQUE INDEX IF NOT EXISTS "quotes_access_token_key" ON "quotes"("access_token");
CREATE INDEX IF NOT EXISTS "quotes_user_id_idx" ON "quotes"("user_id");
CREATE INDEX IF NOT EXISTS "quotes_quote_number_idx" ON "quotes"("quote_number");
CREATE INDEX IF NOT EXISTS "quotes_reference_no_idx" ON "quotes"("reference_no");
CREATE INDEX IF NOT EXISTS "quotes_status_idx" ON "quotes"("status");
CREATE INDEX IF NOT EXISTS "quotes_email_idx" ON "quotes"("email");
CREATE INDEX IF NOT EXISTS "quotes_gst_no_idx" ON "quotes"("gst_no");
CREATE INDEX IF NOT EXISTS "quotes_phone_idx" ON "quotes"("phone");
CREATE INDEX IF NOT EXISTS "quotes_access_token_idx" ON "quotes"("access_token");
CREATE INDEX IF NOT EXISTS "quotes_is_deleted_idx" ON "quotes"("is_deleted");

-- ─── 4. ENSURE QUOTE_ITEMS TABLE HAS ALL COLUMNS ─────────────────────────────
CREATE TABLE IF NOT EXISTS "quote_items" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "quote_id" TEXT;
ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "sl_no" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "product_id" TEXT;
ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "product_name_snapshot" TEXT;
ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "variant_id" TEXT;
ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "unit" TEXT NOT NULL DEFAULT 'PCS';
ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "rate" DECIMAL(12,2);
ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "amount" DECIMAL(12,2);
ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "requested_price" DECIMAL(12,2);
ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "offered_price" DECIMAL(12,2);
ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "total" DECIMAL(12,2);
ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "quote_items_quote_id_idx" ON "quote_items"("quote_id");

-- ─── 5. QUOTE AUXILIARY TABLES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "quote_activity_logs" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "changed_by" TEXT,
    "change_type" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_activity_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "quote_activity_logs_quote_id_idx" ON "quote_activity_logs"("quote_id");

CREATE TABLE IF NOT EXISTS "quote_sequences" (
    "id" TEXT NOT NULL,
    "financial_year" TEXT NOT NULL,
    "next_number" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_sequences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "quote_sequences_financial_year_key" ON "quote_sequences"("financial_year");

-- ─── 6. PINCODES & ALLOCATION LOGS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "pincodes" (
    "id" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "postOffice" TEXT,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "isServiceable" BOOLEAN NOT NULL DEFAULT true,
    "geohash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pincodes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "pincodes_pincode_key" ON "pincodes"("pincode");
CREATE INDEX IF NOT EXISTS "pincodes_pincode_idx" ON "pincodes"("pincode");
CREATE INDEX IF NOT EXISTS "pincodes_state_idx" ON "pincodes"("state");
CREATE INDEX IF NOT EXISTS "pincodes_district_idx" ON "pincodes"("district");
CREATE INDEX IF NOT EXISTS "pincodes_city_idx" ON "pincodes"("city");
CREATE INDEX IF NOT EXISTS "pincodes_geohash_idx" ON "pincodes"("geohash");

CREATE TABLE IF NOT EXISTS "allocation_logs" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "customerPincode" TEXT NOT NULL,
    "customerLatitude" DOUBLE PRECISION NOT NULL,
    "customerLongitude" DOUBLE PRECISION NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "calculatedDistanceKm" DOUBLE PRECISION NOT NULL,
    "durationMinutes" DOUBLE PRECISION,
    "algorithmUsed" TEXT NOT NULL DEFAULT 'OSRM_STREET_NETWORK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allocation_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "allocation_logs_orderId_idx" ON "allocation_logs"("orderId");
CREATE INDEX IF NOT EXISTS "allocation_logs_warehouseId_idx" ON "allocation_logs"("warehouseId");
CREATE INDEX IF NOT EXISTS "allocation_logs_customerPincode_idx" ON "allocation_logs"("customerPincode");
CREATE INDEX IF NOT EXISTS "allocation_logs_createdAt_idx" ON "allocation_logs"("createdAt");

-- ─── 7. COURIERS, SHIPMENTS & SHIPPING ZONES ─────────────────────────────────
CREATE TABLE IF NOT EXISTS "couriers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trackingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "couriers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "couriers_code_key" ON "couriers"("code");
CREATE INDEX IF NOT EXISTS "couriers_code_idx" ON "couriers"("code");
CREATE INDEX IF NOT EXISTS "couriers_isActive_idx" ON "couriers"("isActive");

CREATE TABLE IF NOT EXISTS "warehouse_zone_mappings" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "pinStart" TEXT NOT NULL,
    "pinEnd" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_zone_mappings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "warehouse_zone_mappings_warehouseId_idx" ON "warehouse_zone_mappings"("warehouseId");
CREATE INDEX IF NOT EXISTS "warehouse_zone_mappings_zoneId_idx" ON "warehouse_zone_mappings"("zoneId");
CREATE INDEX IF NOT EXISTS "warehouse_zone_mappings_pinStart_pinEnd_idx" ON "warehouse_zone_mappings"("pinStart", "pinEnd");

CREATE TABLE IF NOT EXISTS "courier_rates" (
    "id" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "weightFrom" DECIMAL(8,3) NOT NULL,
    "weightTo" DECIMAL(8,3) NOT NULL,
    "baseRate" DECIMAL(10,2) NOT NULL,
    "additionalRate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "fuelSurcharge" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "handlingCharge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "codCharge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "estimatedDeliveryDays" INTEGER NOT NULL DEFAULT 3,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courier_rates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "courier_rates_courierId_idx" ON "courier_rates"("courierId");
CREATE INDEX IF NOT EXISTS "courier_rates_zoneId_idx" ON "courier_rates"("zoneId");
CREATE INDEX IF NOT EXISTS "courier_rates_weightFrom_weightTo_idx" ON "courier_rates"("weightFrom", "weightTo");
CREATE INDEX IF NOT EXISTS "courier_rates_isActive_idx" ON "courier_rates"("isActive");

CREATE TABLE IF NOT EXISTS "shipments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "courierId" TEXT,
    "zoneId" TEXT,
    "shippingCost" DECIMAL(10,2) NOT NULL,
    "deliveryDays" INTEGER,
    "trackingNumber" TEXT,
    "shipmentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "shipments_orderId_key" ON "shipments"("orderId");
CREATE INDEX IF NOT EXISTS "shipments_orderId_idx" ON "shipments"("orderId");
CREATE INDEX IF NOT EXISTS "shipments_warehouseId_idx" ON "shipments"("warehouseId");
CREATE INDEX IF NOT EXISTS "shipments_courierId_idx" ON "shipments"("courierId");
CREATE INDEX IF NOT EXISTS "shipments_shipmentStatus_idx" ON "shipments"("shipmentStatus");

-- ─── 8. INVOICE MODULE TABLES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "invoiceType" "InvoiceType" NOT NULL DEFAULT 'TAX_INVOICE',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "customerId" TEXT,
    "warehouseId" TEXT,
    "orderId" TEXT,
    "shipmentId" TEXT,
    "paymentId" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxableAmount" DECIMAL(12,2) NOT NULL,
    "cgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "igst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cess" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "roundOff" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(12,2) NOT NULL,
    "amountInWords" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "exchangeRate" DECIMAL(8,4) NOT NULL DEFAULT 1.0,
    "placeOfSupply" TEXT,
    "isReverseCharge" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" TIMESTAMP(3),
    "paymentTerms" TEXT DEFAULT 'DUE_ON_RECEIPT',
    "verificationToken" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "documentHash" TEXT NOT NULL,
    "digitalSignatureStatus" TEXT NOT NULL DEFAULT 'UNSIGNED',
    "signedAt" TIMESTAMP(3),
    "pdfPath" TEXT,
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "emailedAt" TIMESTAMP(3),
    "printedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "notes" TEXT,
    "internalRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_verificationToken_key" ON "invoices"("verificationToken");
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_verificationId_key" ON "invoices"("verificationId");
CREATE INDEX IF NOT EXISTS "invoices_invoiceNumber_idx" ON "invoices"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "invoices_financialYear_idx" ON "invoices"("financialYear");
CREATE INDEX IF NOT EXISTS "invoices_invoiceType_idx" ON "invoices"("invoiceType");
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices"("status");
CREATE INDEX IF NOT EXISTS "invoices_customerId_idx" ON "invoices"("customerId");
CREATE INDEX IF NOT EXISTS "invoices_orderId_idx" ON "invoices"("orderId");
CREATE INDEX IF NOT EXISTS "invoices_verificationToken_idx" ON "invoices"("verificationToken");

CREATE TABLE IF NOT EXISTS "invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT,
    "sku" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "hsnCode" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'NOS',
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxableValue" DECIMAL(12,2) NOT NULL,
    "cgstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sgstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "igstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cessRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cessAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");
CREATE INDEX IF NOT EXISTS "invoice_items_productId_idx" ON "invoice_items"("productId");
CREATE INDEX IF NOT EXISTS "invoice_items_sku_idx" ON "invoice_items"("sku");

CREATE TABLE IF NOT EXISTS "invoice_history" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT,
    "comment" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "invoice_history_invoiceId_idx" ON "invoice_history"("invoiceId");
CREATE INDEX IF NOT EXISTS "invoice_history_action_idx" ON "invoice_history"("action");

CREATE TABLE IF NOT EXISTS "invoice_sequences" (
    "id" TEXT NOT NULL,
    "invoiceType" "InvoiceType" NOT NULL,
    "financialYear" TEXT NOT NULL,
    "branchCode" TEXT NOT NULL DEFAULT 'MAIN',
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_sequences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_sequences_invoiceType_financialYear_branchCode_key" ON "invoice_sequences"("invoiceType", "financialYear", "branchCode");

-- ─── 9. APPOINTMENT BOOKING SYSTEM TABLES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS "appointment_services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 15,
    "maxParallelBookings" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_services_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "appointment_services_slug_key" ON "appointment_services"("slug");

CREATE TABLE IF NOT EXISTS "staff_availabilities" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "locationId" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_availabilities_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "staff_availabilities_staffUserId_dayOfWeek_idx" ON "staff_availabilities"("staffUserId", "dayOfWeek");

CREATE TABLE IF NOT EXISTS "blackout_dates" (
    "id" TEXT NOT NULL,
    "locationId" TEXT,
    "staffUserId" TEXT,
    "date" DATE NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blackout_dates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "blackout_dates_date_idx" ON "blackout_dates"("date");

CREATE TABLE IF NOT EXISTS "appointments" (
    "id" TEXT NOT NULL,
    "appointmentNumber" TEXT NOT NULL,
    "trackingId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "locationId" TEXT,
    "customerUserId" TEXT,
    "staffUserId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "customFields" JSONB,
    "notes" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "appointments_appointmentNumber_key" ON "appointments"("appointmentNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "appointments_trackingId_key" ON "appointments"("trackingId");
CREATE INDEX IF NOT EXISTS "appointments_trackingId_idx" ON "appointments"("trackingId");
CREATE INDEX IF NOT EXISTS "appointments_appointmentNumber_idx" ON "appointments"("appointmentNumber");
CREATE INDEX IF NOT EXISTS "appointments_customerEmail_idx" ON "appointments"("customerEmail");
CREATE INDEX IF NOT EXISTS "appointments_date_status_idx" ON "appointments"("date", "status");

CREATE TABLE IF NOT EXISTS "appointment_status_histories" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL,
    "comment" TEXT,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_status_histories_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "appointment_status_histories_appointmentId_idx" ON "appointment_status_histories"("appointmentId");

-- ─── 10. SAFE FOREIGN KEY CONSTRAINTS ─────────────────────────────────────────
DO $$
BEGIN
    -- quotes relations
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_user_id_fkey') THEN
        ALTER TABLE "quotes" ADD CONSTRAINT "quotes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_items_quote_id_fkey') THEN
        ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_items_product_id_fkey') THEN
        ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_items_variant_id_fkey') THEN
        ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_activity_logs_quote_id_fkey') THEN
        ALTER TABLE "quote_activity_logs" ADD CONSTRAINT "quote_activity_logs_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_activity_logs_changed_by_fkey') THEN
        ALTER TABLE "quote_activity_logs" ADD CONSTRAINT "quote_activity_logs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    -- shipments relations
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shipments_orderId_fkey') THEN
        ALTER TABLE "shipments" ADD CONSTRAINT "shipments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shipments_warehouseId_fkey') THEN
        ALTER TABLE "shipments" ADD CONSTRAINT "shipments_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shipments_courierId_fkey') THEN
        ALTER TABLE "shipments" ADD CONSTRAINT "shipments_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "couriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    -- warehouse_zone_mappings relations
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'warehouse_zone_mappings_warehouseId_fkey') THEN
        ALTER TABLE "warehouse_zone_mappings" ADD CONSTRAINT "warehouse_zone_mappings_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'warehouse_zone_mappings_zoneId_fkey') THEN
        ALTER TABLE "warehouse_zone_mappings" ADD CONSTRAINT "warehouse_zone_mappings_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "shipping_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- courier_rates relations
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'courier_rates_courierId_fkey') THEN
        ALTER TABLE "courier_rates" ADD CONSTRAINT "courier_rates_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "couriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'courier_rates_zoneId_fkey') THEN
        ALTER TABLE "courier_rates" ADD CONSTRAINT "courier_rates_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "shipping_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- invoices relations
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_customerId_fkey') THEN
        ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_warehouseId_fkey') THEN
        ALTER TABLE "invoices" ADD CONSTRAINT "invoices_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_orderId_fkey') THEN
        ALTER TABLE "invoices" ADD CONSTRAINT "invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_shipmentId_fkey') THEN
        ALTER TABLE "invoices" ADD CONSTRAINT "invoices_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_invoiceId_fkey') THEN
        ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_history_invoiceId_fkey') THEN
        ALTER TABLE "invoice_history" ADD CONSTRAINT "invoice_history_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- appointments relations
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_availabilities_staffUserId_fkey') THEN
        ALTER TABLE "staff_availabilities" ADD CONSTRAINT "staff_availabilities_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_serviceId_fkey') THEN
        ALTER TABLE "appointments" ADD CONSTRAINT "appointments_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "appointment_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_customerUserId_fkey') THEN
        ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_staffUserId_fkey') THEN
        ALTER TABLE "appointments" ADD CONSTRAINT "appointments_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointment_status_histories_appointmentId_fkey') THEN
        ALTER TABLE "appointment_status_histories" ADD CONSTRAINT "appointment_status_histories_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
