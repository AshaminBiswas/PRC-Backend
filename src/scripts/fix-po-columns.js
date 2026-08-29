const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function fixPoColumns() {
  console.log('Dropping NOT NULL on all legacy columns of po_submissions...');
  const stmts = [
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
        RAISE NOTICE 'Dropped NOT NULL on %', col.column_name;
      END LOOP;
    END $$;`
  ];

  for (const sql of stmts) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log('✅ Executed dynamic drop NOT NULL loop');
    } catch (err) {
      console.warn('⚠️ Error:', err.message);
    }
  }

  await prisma.$disconnect();
  console.log('🎉 All legacy constraints cleared!');
  process.exit(0);
}

fixPoColumns();
