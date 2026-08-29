const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function migratePoEnums() {
  console.log('🔄 Converting po_submissions columns to native PostgreSQL ENUMs...');

  const stmts = [
    // 1. Create enum types if not exists
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
    END $$;`,

    // 2. Drop existing defaults to allow type alteration
    `ALTER TABLE "po_submissions" ALTER COLUMN "status" DROP DEFAULT;`,
    `ALTER TABLE "po_submissions" ALTER COLUMN "classification" DROP DEFAULT;`,
    `ALTER TABLE "po_submissions" ALTER COLUMN "priority" DROP DEFAULT;`,
    `ALTER TABLE "po_submissions" ALTER COLUMN "source" DROP DEFAULT;`,

    // 3. Cast columns to ENUM types
    `ALTER TABLE "po_submissions" ALTER COLUMN "status" TYPE "PoStatus" USING "status"::TEXT::"PoStatus";`,
    `ALTER TABLE "po_submissions" ALTER COLUMN "classification" TYPE "PoClassification" USING "classification"::TEXT::"PoClassification";`,
    `ALTER TABLE "po_submissions" ALTER COLUMN "priority" TYPE "PoPriority" USING "priority"::TEXT::"PoPriority";`,
    `ALTER TABLE "po_submissions" ALTER COLUMN "source" TYPE "PoSource" USING "source"::TEXT::"PoSource";`,

    // 4. Set proper typed defaults
    `ALTER TABLE "po_submissions" ALTER COLUMN "status" SET DEFAULT 'NEW'::"PoStatus";`,
    `ALTER TABLE "po_submissions" ALTER COLUMN "classification" SET DEFAULT 'PO_DETECTED'::"PoClassification";`,
    `ALTER TABLE "po_submissions" ALTER COLUMN "priority" SET DEFAULT 'MEDIUM'::"PoPriority";`,
    `ALTER TABLE "po_submissions" ALTER COLUMN "source" SET DEFAULT 'EMAIL'::"PoSource";`,

    // 5. Ensure po_email_messages direction is also typed
    `ALTER TABLE "po_email_messages" ALTER COLUMN "direction" DROP DEFAULT;`,
    `ALTER TABLE "po_email_messages" ALTER COLUMN "direction" TYPE "EmailDirection" USING "direction"::TEXT::"EmailDirection";`,
    `ALTER TABLE "po_email_messages" ALTER COLUMN "direction" SET DEFAULT 'INCOMING'::"EmailDirection";`,
  ];

  for (const sql of stmts) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log('✅ Executed:', sql.replace(/\s+/g, ' ').trim());
    } catch (err) {
      console.warn('⚠️ Warning/Skipped:', err.message);
    }
  }

  await prisma.$disconnect();
  console.log('🎉 All PO Enum migrations successfully applied!');
  process.exit(0);
}

migratePoEnums();
