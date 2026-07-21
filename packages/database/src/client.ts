import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export type DatabaseClient = PrismaClient;
export type DatabaseTransaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

export function createDatabaseClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}

export async function disconnectDatabase(client: PrismaClient): Promise<void> {
  await client.$disconnect();
}
