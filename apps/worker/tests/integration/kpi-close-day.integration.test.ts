import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ActionItemRepository,
  createDatabaseClient,
  KpiRepository,
  KpiWorkerRepository,
  type DatabaseClient,
} from '@adsup/database';
import { CloseDayService } from '../../src/kpi/close-day-service.js';
import {
  cleanupKpiLiveFixture,
  createKpiLiveFixture,
  type KpiLiveFixture,
} from '../../../api/tests/helpers/kpi-live-fixture.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('close-day historical and data-quality behavior', () => {
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

  it('blocks a legacy multi-branch employee without evaluation or penalty', async () => {
    await db.assignment.create({
      data: {
        tenantId: fixture.tenantId,
        membershipId: fixture.employeeMembershipId,
        branchId: fixture.branchIds[1],
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        createdByMembershipId: fixture.ownerMembershipId,
        reason: 'Intentional corrupt fixture',
      },
    });
    const workers = new KpiWorkerRepository(db);
    const service = new CloseDayService(
      new KpiRepository(db),
      workers,
      new ActionItemRepository(db),
    );
    const result = await service.closeMembership({
      tenantId: fixture.tenantId,
      membershipId: fixture.employeeMembershipId,
      businessDate: new Date('2026-07-19T00:00:00Z'),
      jobRunId: '00000000-0000-4000-8000-000000000001',
      now: new Date('2026-07-19T13:00:02Z'),
      correlationId: 'multi-branch',
    });
    expect(result).toEqual({ blocked: true, code: 'MULTIPLE_ACTIVE_BRANCHES' });
    expect(
      await db.actionItem.findFirst({
        where: { tenantId: fixture.tenantId, itemType: 'DATA_QUALITY' },
      }),
    ).toMatchObject({ state: 'OPEN' });
    expect(await db.dailyKpiEvaluation.count({ where: { tenantId: fixture.tenantId } })).toBe(0);
    expect(await db.penaltyOutcome.count({ where: { tenantId: fixture.tenantId } })).toBe(0);
  });

  it('reclaims a failed lease from its persisted membership checkpoint', async () => {
    const workers = new KpiWorkerRepository(db);
    const businessDate = new Date('2026-07-18T00:00:00Z');
    const run = await workers.ensureRun({
      tenantId: fixture.tenantId,
      jobType: 'RESUME_TEST',
      businessDate,
      correlationId: 'resume-test',
    });
    await workers.claimRun({
      tenantId: fixture.tenantId,
      id: run.id,
      workerId: 'worker-a',
      now: new Date('2026-07-19T13:00:00Z'),
      leaseUntil: new Date('2026-07-19T13:01:00Z'),
    });
    await workers.advanceCheckpoint({
      tenantId: fixture.tenantId,
      id: run.id,
      workerId: 'worker-a',
      checkpoint: fixture.employeeMembershipId,
      leaseUntil: new Date('2026-07-19T13:01:00Z'),
    });
    await workers.failRun({
      tenantId: fixture.tenantId,
      id: run.id,
      workerId: 'worker-a',
      code: 'TEST_PARTIAL',
      partial: true,
    });
    const reclaimed = await workers.claimRun({
      tenantId: fixture.tenantId,
      id: run.id,
      workerId: 'worker-b',
      now: new Date('2026-07-19T13:02:00Z'),
      leaseUntil: new Date('2026-07-19T13:03:00Z'),
    });
    expect(reclaimed).toMatchObject({
      checkpoint: fixture.employeeMembershipId,
      leaseOwner: 'worker-b',
      status: 'RUNNING',
    });
  });
});
