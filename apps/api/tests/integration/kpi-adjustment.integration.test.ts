import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, KpiRepository, type DatabaseClient } from '@adsup/database';
import { KpiPenaltyService } from '../../src/modules/kpi/kpi-penalty-service.js';
import {
  cleanupKpiLiveFixture,
  createKpiLiveFixture,
  type KpiLiveFixture,
} from '../helpers/kpi-live-fixture.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('append-only penalty adjustment ledger', () => {
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

  it('serializes concurrent corrections, replays one key and preserves the original amount', async () => {
    const policy = await db.dailyKpiPolicyVersion.create({
      data: {
        tenantId: fixture.tenantId,
        scopeType: 'TENANT',
        versionNumber: 1,
        effectiveFromDate: new Date('2026-01-01T00:00:00Z'),
        timezone: 'Asia/Ho_Chi_Minh',
        reportOpenLocal: '18:00:00',
        reportCloseLocal: '20:00:00',
        evaluationLocal: '20:00:01',
        failurePenaltyMinor: 100000n,
        createdByMembershipId: fixture.ownerMembershipId,
        reason: 'Adjustment policy',
      },
    });
    const penalty = await db.penaltyOutcome.create({
      data: {
        tenantId: fixture.tenantId,
        membershipId: fixture.employeeMembershipId,
        branchId: fixture.branchIds[0],
        businessDate: new Date('2026-07-19T00:00:00Z'),
        policyVersionId: policy.id,
        kind: 'PHOTO_EVIDENCE',
        sourceKey: 'adjustment-ledger-fixture',
        amountMinor: 100000n,
        failedDetailsJson: [{ code: 'PHOTO_EVIDENCE_MISSING' }],
        assessedAt: new Date('2026-07-19T13:00:02Z'),
      },
    });
    const service = new KpiPenaltyService(new KpiRepository(db));
    const correction = (key: string) =>
      service.adjust({
        tenantId: fixture.tenantId,
        penaltyId: penalty.id,
        deltaMinor: '-60000',
        actorMembershipId: fixture.ownerMembershipId,
        idempotencyKey: key,
        reason: 'Điều chỉnh được duyệt',
        correlationId: key,
      });
    const concurrent = await Promise.allSettled([correction('adjust-a'), correction('adjust-b')]);
    expect(concurrent.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(concurrent.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const first = concurrent.find(
      (result) => result.status === 'fulfilled',
    ) as PromiseFulfilledResult<Awaited<ReturnType<typeof correction>>>;
    const replay = await correction(first.value.adjustment.idempotencyKey);
    expect(replay.replayed).toBe(true);
    expect(
      await db.penaltyAdjustment.count({
        where: { tenantId: fixture.tenantId, penaltyOutcomeId: penalty.id },
      }),
    ).toBe(1);
    expect(
      (
        await db.penaltyOutcome.findUniqueOrThrow({
          where: { tenantId_id: { tenantId: fixture.tenantId, id: penalty.id } },
        })
      ).amountMinor,
    ).toBe(100000n);
    expect(
      await db.auditEvent.count({
        where: { tenantId: fixture.tenantId, eventType: 'KPI_PENALTY_ADJUSTED' },
      }),
    ).toBe(1);
    expect(
      await db.outboxEvent.count({
        where: { tenantId: fixture.tenantId, eventType: 'kpi.penalty.adjusted' },
      }),
    ).toBe(1);
  });
});
