import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertNoPerceptualFraudDecision } from '@adsup/domain';
import { createDatabaseClient, KpiEvidenceRepository, type DatabaseClient } from '@adsup/database';
import { EvidenceDebtRunner } from '../../src/kpi/evidence-debt-runner.js';
import {
  cleanupKpiLiveFixture,
  createKpiLiveFixture,
  type KpiLiveFixture,
} from '../../../api/tests/helpers/kpi-live-fixture.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('evidence reminder/finalization retry safety', () => {
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

  it('retries 100 times with one reminder, transition and optional photo penalty', async () => {
    const businessDate = new Date('2026-07-19T00:00:00Z');
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
        evidenceEnabled: true,
        evidenceGraceSeconds: 300,
        photoPenaltyMinor: 50000n,
        createdByMembershipId: fixture.ownerMembershipId,
        reason: 'Evidence worker policy',
      },
    });
    const report = await db.dailyKpiReport.create({
      data: {
        tenantId: fixture.tenantId,
        membershipId: fixture.employeeMembershipId,
        branchId: fixture.branchIds[0],
        businessDate,
        policyVersionId: policy.id,
        openedAt: new Date('2026-07-19T11:00:00Z'),
        closedAt: new Date('2026-07-19T13:00:00Z'),
        evaluationAt: new Date('2026-07-19T13:00:01Z'),
      },
    });
    const repository = new KpiEvidenceRepository(db);
    const debt = await repository.ensureDebt({
      tenantId: fixture.tenantId,
      reportId: report.id,
      policyVersionId: policy.id,
      requiredCount: 2,
      deadlineAt: new Date('2026-07-19T13:05:00Z'),
    });
    const runner = new EvidenceDebtRunner(repository);
    const now = new Date('2026-07-19T13:05:01Z');
    const results = [];
    for (let index = 0; index < 100; index += 1)
      results.push(await runner.run({ tenantId: fixture.tenantId, now }));
    expect(results[0]).toMatchObject({ reminded: 1, finalized: 1, penalties: 1 });
    expect(
      results
        .slice(1)
        .every(
          (result) => result.reminded === 0 && result.finalized === 0 && result.penalties === 0,
        ),
    ).toBe(true);
    const finalizedDebt = await db.evidenceDebt.findUniqueOrThrow({
      where: { tenantId_id: { tenantId: fixture.tenantId, id: debt.id } },
    });
    expect(finalizedDebt.state).toBe('OVERDUE');
    expect(finalizedDebt.receivedCount).toBe(0);
    expect(finalizedDebt.remindedAt).toBeInstanceOf(Date);
    expect(typeof finalizedDebt.penaltyOutcomeId).toBe('string');
    expect(
      await db.penaltyOutcome.count({
        where: { tenantId: fixture.tenantId, kind: 'PHOTO_EVIDENCE' },
      }),
    ).toBe(1);
    expect(
      await db.outboxEvent.count({
        where: { tenantId: fixture.tenantId, eventType: 'kpi.evidence.reminder' },
      }),
    ).toBe(1);
    expect(
      await db.outboxEvent.count({
        where: { tenantId: fixture.tenantId, eventType: 'kpi.evidence.overdue' },
      }),
    ).toBe(1);
    expect(
      await db.outboxEvent.count({
        where: { tenantId: fixture.tenantId, eventType: 'kpi.photo-penalty.assessed' },
      }),
    ).toBe(1);
    expect(assertNoPerceptualFraudDecision()).toBe('DISABLED_IN_MVP');
  });
});
