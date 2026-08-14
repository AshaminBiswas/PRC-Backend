import { PrismaClient } from '@prisma/client';
import { env } from './env';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  readPrisma?: PrismaClient;
};

export const writePrisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: env.isDev ? ['query', 'error', 'warn'] : ['error'],
  });

export const readPrisma =
  globalForPrisma.readPrisma ||
  (env.database.readUrl
    ? new PrismaClient({
        datasources: { db: { url: env.database.readUrl } },
        log: env.isDev ? ['error', 'warn'] : ['error'],
      })
    : writePrisma);

if (env.isDev) {
  globalForPrisma.prisma = writePrisma;
  globalForPrisma.readPrisma = readPrisma;
}

export const prisma = writePrisma;

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
