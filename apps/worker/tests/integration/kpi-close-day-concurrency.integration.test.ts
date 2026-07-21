import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, KpiWorkerRepository, type DatabaseClient } from '@adsup/database';
import {
  cleanupKpiLiveFixture,
  createKpiLiveFixture,
  type KpiLiveFixture,
} from '../../../api/tests/helpers/kpi-live-fixture.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('close-day concurrent retry safety', () => {
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

  it('turns 100 concurrent deliveries into one evaluation and one penalty', async () => {
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
        createdByMembershipId: fixture.ownerMembershipId,
        reason: 'Concurrency policy',
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
    const worker = new KpiWorkerRepository(db);
    const run = await worker.ensureRun({
      tenantId: fixture.tenantId,
      jobType: 'CONCURRENCY_TEST',
      businessDate,
      correlationId: 'concurrency-close',
    });
    const input: Parameters<KpiWorkerRepository['closeEvaluation']>[0] = {
      tenantId: fixture.tenantId,
      reportId: report.id,
      membershipId: fixture.employeeMembershipId,
      branchId: fixture.branchIds[0],
      businessDate,
      policyVersionId: policy.id,
      status: 'FAILED',
      failedDetails: [{ code: 'REPORT_MISSING' }],
      evaluatedAt: new Date('2026-07-19T13:00:02Z'),
      jobRunId: run.id,
      penaltyMinor: 100000n,
      correlationId: 'concurrency-close',
    };
    const results = [];
    for (let batch = 0; batch < 20; batch += 1) {
      results.push(
        ...(await Promise.all(Array.from({ length: 5 }, () => worker.closeEvaluation(input)))),
      );
    }
    expect(results.filter((result) => !result.replayed)).toHaveLength(1);
    expect(results.filter((result) => result.replayed)).toHaveLength(99);
    expect(await db.dailyKpiEvaluation.count({ where: { tenantId: fixture.tenantId } })).toBe(1);
    expect(
      await db.penaltyOutcome.count({ where: { tenantId: fixture.tenantId, kind: 'DAILY_KPI' } }),
    ).toBe(1);
  });
});
