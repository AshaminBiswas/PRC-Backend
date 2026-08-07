import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { env } from './env';
import { writePrisma } from './database';

interface ShardConfig {
  name: string;
  url: string;
}

const parseShardConfig = (): ShardConfig[] => {
  if (!env.database.shardsJson) return [];

  try {
    const parsed = JSON.parse(env.database.shardsJson) as ShardConfig[];
    return parsed.filter((shard) => shard.name && shard.url);
  } catch (error) {
    console.error('[Sharding] Invalid DATABASE_SHARDS JSON. Falling back to primary database.', error);
    return [];
  }
};

const shardConfigs = parseShardConfig();
const shardClients = new Map<string, PrismaClient>();

const hashKey = (key: string): number => {
  const digest = crypto.createHash('sha256').update(key).digest();
  return digest.readUInt32BE(0);
};

export const getShardForKey = (key: string): { name: string; prisma: PrismaClient } => {
  if (shardConfigs.length === 0) {
    return { name: 'primary', prisma: writePrisma };
  }

  const shard = shardConfigs[hashKey(key) % shardConfigs.length];
  let client = shardClients.get(shard.name);

  if (!client) {
    client = new PrismaClient({
      datasources: { db: { url: shard.url } },
      log: env.isDev ? ['error', 'warn'] : ['error'],
    });
    shardClients.set(shard.name, client);
  }

  return { name: shard.name, prisma: client };
};

export const disconnectShardClients = async () => {
  await Promise.all([...shardClients.values()].map((client) => client.$disconnect()));
};
