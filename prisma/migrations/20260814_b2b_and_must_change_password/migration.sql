-- ─── 1. USERS MUST CHANGE PASSWORD COLUMN ─────────────────────────────────────
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- ─── 2. B2B CUSTOMER PRICING TABLE ───────────────────────────────────────────
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

-- ─── 3. INDEXES & FOREIGN KEYS ───────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "b2b_customer_prices_userId_productId_key" ON "b2b_customer_prices"("userId", "productId");
CREATE INDEX IF NOT EXISTS "b2b_customer_prices_userId_idx" ON "b2b_customer_prices"("userId");
CREATE INDEX IF NOT EXISTS "b2b_customer_prices_productId_idx" ON "b2b_customer_prices"("productId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'b2b_customer_prices_userId_fkey') THEN
        ALTER TABLE "b2b_customer_prices" ADD CONSTRAINT "b2b_customer_prices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'b2b_customer_prices_productId_fkey') THEN
        ALTER TABLE "b2b_customer_prices" ADD CONSTRAINT "b2b_customer_prices_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
