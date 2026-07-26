import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '../../packages/database/src/client.js';
import { sampleTenantId, verifyKpiSeed } from '../../packages/database/prisma/verify-kpi-seed.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('deterministic KPI sample seed', () => {
  let db: DatabaseClient;
  beforeAll(() => {
    db = createDatabaseClient(databaseUrl!);
  });
  afterAll(async () => db.$disconnect());

  it('has exactly 30 active members and one current branch per employee', async () => {
    await expect(verifyKpiSeed(db)).resolves.toMatchObject({
      tenantName: 'Công ty TNHH ABC',
      memberships: 30,
      membershipsWithOneBranch: 30,
      targets: 3,
      mappings: 3,
      policies: 1,
      forms: 4,
      permissions: 8,
    });
  });

  it('keeps the known sample tenant isolated', async () => {
    expect(await db.kpiDefinition.count({ where: { tenantId: sampleTenantId } })).toBe(3);
  });
});
