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

export const connectDatabases = async () => {
  await writePrisma.$connect();
  if (readPrisma !== writePrisma) {
    await readPrisma.$connect();
  }
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
