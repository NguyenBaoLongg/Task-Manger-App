import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ActionItemRepository,
  createDatabaseClient,
  KpiGovernanceRepository,
  type DatabaseClient,
} from '@adsup/database';
import { OutboxDispatcher } from '../../src/outbox/outbox-dispatcher.js';
import {
  cleanupKpiLiveFixture,
  createKpiLiveFixture,
  type KpiLiveFixture,
} from '../../../api/tests/helpers/kpi-live-fixture.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('KPI outbox delivery integration', () => {
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

  it('delivers an action-item effect once and marks the durable row sent', async () => {
    const action = await new ActionItemRepository(db).project({
      tenantId: fixture.tenantId,
      ownerMembershipId: fixture.employeeMembershipId,
      branchId: fixture.branchIds[0],
      itemType: 'KPI_SHORTFALL',
      sourceType: 'KPI_DEFINITION',
      sourceId: fixture.definitionId,
      businessDate: new Date('2026-07-19T00:00:00Z'),
      state: 'OPEN',
      title: 'Còn thiếu doanh số',
      remainingValue: '2500000',
      unit: 'VND',
      deadlineAt: new Date('2026-07-19T13:00:00Z'),
      sourceFreshnessAt: new Date('2026-07-19T12:00:00Z'),
      deepLink: 'adsup://kpi/reports/2026-07-19',
      eventId: randomUUID(),
      correlationId: 'outbox-live',
    });
    const realtime: unknown[] = [];
    const notifications: unknown[] = [];
    const claimAt = new Date('2000-01-02T00:00:00Z');
    await db.outboxEvent.updateMany({
      where: { tenantId: fixture.tenantId, aggregateId: action.id },
      data: { availableAt: new Date('2000-01-01T00:00:00Z') },
    });
    const dispatcher = new OutboxDispatcher(
      new KpiGovernanceRepository(db),
      {
        async publishActionItemChanged(value) {
          realtime.push(value);
        },
        async publishProgressChanged(value) {
          realtime.push(value);
        },
      },
      {
        async notify(value) {
          notifications.push(value);
        },
      },
    );
    const result = await dispatcher.dispatch('worker-outbox-live', claimAt, 100);
    expect(result.sent).toBeGreaterThanOrEqual(1);
    expect(realtime).toContainEqual(
      expect.objectContaining({
        tenantId: fixture.tenantId,
        membershipId: fixture.employeeMembershipId,
        actionItemId: action.id,
      }),
    );
    expect(notifications).toHaveLength(0);
    expect(
      await db.outboxEvent.findFirstOrThrow({
        where: { tenantId: fixture.tenantId, aggregateId: action.id },
      }),
    ).toMatchObject({ status: 'SENT' });
    await expect(dispatcher.dispatch('worker-outbox-live', claimAt, 100)).resolves.toMatchObject({
      claimed: 0,
    });
  });
});
