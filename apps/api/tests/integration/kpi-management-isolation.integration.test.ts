import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ActionItemRepository, createDatabaseClient, type DatabaseClient } from '@adsup/database';
import {
  cleanupKpiLiveFixture,
  createKpiLiveFixture,
  type KpiLiveFixture,
} from '../helpers/kpi-live-fixture.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('manager action-item isolation and cursor', () => {
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

  it('paginates stably and never aggregates an unrequested branch', async () => {
    const repository = new ActionItemRepository(db);
    const now = new Date('2026-07-19T12:00:00Z');
    for (let index = 0; index < 4; index += 1) {
      await repository.project({
        tenantId: fixture.tenantId,
        ownerMembershipId: fixture.employeeMembershipId,
        branchId: index === 3 ? fixture.branchIds[1] : fixture.branchIds[0],
        itemType: index % 2 ? 'KPI_SHORTFALL' : 'KPI_REPORT',
        sourceType: 'TEST',
        sourceId: randomUUID(),
        businessDate: new Date('2026-07-19T00:00:00Z'),
        state: 'OPEN',
        title: `Item ${index}`,
        deadlineAt: now,
        sourceFreshnessAt: new Date(now.getTime() + index),
        deepLink: 'adsup://test',
        correlationId: `manager-item-${index}`,
      });
    }
    const first = await repository.listManaged({
      tenantId: fixture.tenantId,
      branchIds: [fixture.branchIds[0]],
      take: 2,
    });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toEqual(expect.any(String));
    expect(first.openCount).toBe(3);
    const second = await repository.listManaged({
      tenantId: fixture.tenantId,
      branchIds: [fixture.branchIds[0]],
      take: 2,
      cursor: first.nextCursor!,
    });
    expect(second.items).toHaveLength(1);
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(3);
    expect(
      [...first.items, ...second.items].every((item) => item.branchId === fixture.branchIds[0]),
    ).toBe(true);
  });
});
