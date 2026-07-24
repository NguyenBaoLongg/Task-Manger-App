import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export type DatabaseClient = PrismaClient;
export type DatabaseTransaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
export type DatabaseExecutor = DatabaseClient | DatabaseTransaction;

export function runInTransaction<T>(
  database: DatabaseExecutor,
  operation: (transaction: DatabaseTransaction) => Promise<T>,
): Promise<T> {
  const client = database as DatabaseClient;
  if (typeof client.$transaction === 'function') {
    return client.$transaction(operation);
  }
  return operation(database as DatabaseTransaction);
}

export function createDatabaseClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}

export async function disconnectDatabase(client: PrismaClient): Promise<void> {
  await client.$disconnect();
}
