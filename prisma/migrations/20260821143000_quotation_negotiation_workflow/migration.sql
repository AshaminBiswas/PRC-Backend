-- AlterTable
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "customer_proposed_advance_percent" DECIMAL(5, 2);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "customer_edit_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "customer_edit_remark" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "quotation_revisions" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "changed_by_id" TEXT,
    "previous_values" JSONB NOT NULL,
    "new_values" JSONB NOT NULL,
    "remark" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quotation_revisions_quote_id_idx" ON "quotation_revisions"("quote_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'quotation_revisions_quote_id_fkey'
    ) THEN
        ALTER TABLE "quotation_revisions" ADD CONSTRAINT "quotation_revisions_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
