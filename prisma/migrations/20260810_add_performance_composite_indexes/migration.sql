-- ─── 1. USER INDEXES ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "users_email_deletedAt_idx" ON "users" ("email", "deletedAt");

-- ─── 2. PRODUCT COMPOSITE INDEXES ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "products_categoryId_status_isVisible_idx" ON "products" ("categoryId", "status", "isVisible");
CREATE INDEX IF NOT EXISTS "products_status_isVisible_isFeatured_idx" ON "products" ("status", "isVisible", "isFeatured");
CREATE INDEX IF NOT EXISTS "products_status_isVisible_isBestseller_idx" ON "products" ("status", "isVisible", "isBestseller");
CREATE INDEX IF NOT EXISTS "products_status_isVisible_isNewArrival_idx" ON "products" ("status", "isVisible", "isNewArrival");
CREATE INDEX IF NOT EXISTS "products_status_isVisible_createdAt_idx" ON "products" ("status", "isVisible", "createdAt" DESC);

-- ─── 3. ORDER COMPOSITE INDEXES ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "orders_userId_status_createdAt_idx" ON "orders" ("userId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "orders_status_createdAt_idx" ON "orders" ("status", "createdAt" DESC);
