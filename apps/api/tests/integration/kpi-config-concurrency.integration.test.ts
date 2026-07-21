import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, KpiRepository, type DatabaseClient } from '@adsup/database';
import { parseExactMetric } from '@adsup/domain';
import {
  cleanupKpiLiveFixture,
  createKpiLiveFixture,
  type KpiLiveFixture,
} from '../helpers/kpi-live-fixture.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('KPI configuration concurrency', () => {
  let db: DatabaseClient;
  let fixture: KpiLiveFixture;
  beforeAll(async () => {
    db = createDatabaseClient(databaseUrl!);
    fixture = await createKpiLiveFixture(db);
  });
  afterAll(async () => {
    await cleanupKpiLiveFixture(db, fixture);
    await db.$disconnect();
  });

  it('allows one immutable target version for concurrent overlapping writes', async () => {
    const repository = new KpiRepository(db);
    const input = {
      tenantId: fixture.tenantId,
      kpiDefinitionId: fixture.definitionId,
      scopeType: 'MEMBERSHIP' as const,
      scopeId: fixture.employeeMembershipId,
      target: parseExactMetric('MONEY', '10000000', 'VND'),
      required: true,
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      actorMembershipId: fixture.ownerMembershipId,
      reason: 'Concurrent target test',
      correlationId: 'concurrent-target',
    };
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => repository.createTargetVersion(input)),
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(
      await db.kpiTargetVersion.count({
        where: { tenantId: fixture.tenantId, kpiDefinitionId: fixture.definitionId },
      }),
    ).toBe(1);
  });
});
