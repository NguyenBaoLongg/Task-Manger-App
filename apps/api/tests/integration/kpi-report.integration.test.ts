import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, KpiRepository, type DatabaseClient } from '@adsup/database';
import { FixedClock } from '@adsup/testing';
import { KpiReportService } from '../../src/modules/kpi/kpi-report-service.js';
import {
  cleanupKpiLiveFixture,
  createKpiLiveFixture,
  createKpiReportSource,
  type KpiLiveFixture,
} from '../helpers/kpi-live-fixture.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('daily KPI report revisions', () => {
  let db: DatabaseClient;
  let fixture: KpiLiveFixture;
  const businessDate = '2026-07-19';
  beforeAll(async () => {
    db = createDatabaseClient(databaseUrl!);
    fixture = await createKpiLiveFixture(db);
    await db.dailyKpiPolicyVersion.create({
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
        reason: 'Report integration policy',
      },
    });
  });
  afterAll(async () => {
    await cleanupKpiLiveFixture(db, fixture);
    await db.$disconnect();
  });

  it('keeps two in-window revisions, treats exactly 20:00 as late and rejects foreign employee sources', async () => {
    const repository = new KpiRepository(db);
    const firstSource = await createKpiReportSource(db, fixture, '7000000');
    const clock = new FixedClock(new Date('2026-07-19T11:30:00Z'));
    const reports = new KpiReportService(repository, clock);
    const first = await reports.appendRevision({
      tenantId: fixture.tenantId,
      membershipId: fixture.employeeMembershipId,
      businessDate,
      formSubmissionId: firstSource.submission.id,
      correlationId: 'report-first',
    });
    clock.advance(10 * 60 * 1000);
    const secondSubmission = await db.formSubmission.create({
      data: {
        ...firstSource.submission,
        id: randomUUID(),
        data: { revenue: '8000000' },
        idempotencyKey: randomUUID(),
        submittedAt: new Date(),
      },
    });
    const second = await reports.appendRevision({
      tenantId: fixture.tenantId,
      membershipId: fixture.employeeMembershipId,
      businessDate,
      formSubmissionId: secondSubmission.id,
      correlationId: 'report-second',
    });
    clock.advance(80 * 60 * 1000);
    const lateSubmission = await db.formSubmission.create({
      data: {
        ...firstSource.submission,
        id: randomUUID(),
        data: { revenue: '10000000' },
        idempotencyKey: randomUUID(),
        submittedAt: new Date(),
      },
    });
    const late = await reports.appendRevision({
      tenantId: fixture.tenantId,
      membershipId: fixture.employeeMembershipId,
      businessDate,
      formSubmissionId: lateSubmission.id,
      correlationId: 'report-late',
    });
    expect([first.acceptedInWindow, second.acceptedInWindow, late.acceptedInWindow]).toEqual([
      true,
      true,
      false,
    ]);
    expect(late.submittedAt.toISOString()).toBe('2026-07-19T13:00:00.000Z');
    const report = await repository.getReportByMemberDate(
      fixture.tenantId,
      fixture.employeeMembershipId,
      new Date(`${businessDate}T00:00:00Z`),
    );
    expect(report?.currentRevisionId).toBe(second.id);
    const page = await reports.revisions(
      fixture.tenantId,
      fixture.employeeMembershipId,
      businessDate,
    );
    expect(page.items).toHaveLength(3);
    const foreignSubmission = await db.formSubmission.create({
      data: {
        tenantId: fixture.tenantId,
        formTemplateId: firstSource.template.id,
        formVersionId: firstSource.version.id,
        submittedByMembershipId: fixture.ownerMembershipId,
        branchId: fixture.branchIds[0],
        data: { revenue: '9000000' },
        idempotencyKey: randomUUID(),
        submittedAt: new Date(),
      },
    });
    await expect(
      reports.appendRevision({
        tenantId: fixture.tenantId,
        membershipId: fixture.employeeMembershipId,
        businessDate,
        formSubmissionId: foreignSubmission.id,
        correlationId: 'report-foreign',
      }),
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });
});
