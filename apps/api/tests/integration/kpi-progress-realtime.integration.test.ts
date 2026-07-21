import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ActionItemRepository,
  createDatabaseClient,
  KpiRepository,
  type DatabaseClient,
} from '@adsup/database';
import { FixedClock, InMemoryKpiSource } from '@adsup/testing';
import { ActionItemService } from '../../src/modules/action-items/action-item-service.js';
import { KpiProgressService } from '../../src/modules/kpi/kpi-progress-service.js';
import { KpiReportService } from '../../src/modules/kpi/kpi-report-service.js';
import { KpiSourceService } from '../../src/modules/kpi/kpi-source-service.js';
import {
  cleanupKpiLiveFixture,
  createKpiLiveFixture,
  createKpiReportSource,
  type KpiLiveFixture,
} from '../helpers/kpi-live-fixture.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('KPI progress projection and outbox', () => {
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

  it('recalculates from a new revision and closes the missing-work item with retryable effects', async () => {
    const repository = new KpiRepository(db);
    const source = await createKpiReportSource(db, fixture, '7500000');
    await db.kpiTargetVersion.create({
      data: {
        tenantId: fixture.tenantId,
        kpiDefinitionId: fixture.definitionId,
        scopeType: 'TENANT',
        targetMoneyMinor: 10000000n,
        required: true,
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        versionNumber: 1,
        createdByMembershipId: fixture.ownerMembershipId,
        reason: 'Progress target',
      },
    });
    await db.kpiSourceMappingVersion.create({
      data: {
        tenantId: fixture.tenantId,
        kpiDefinitionId: fixture.definitionId,
        sourceType: 'FORM_FIELD',
        formTemplateId: source.template.id,
        formVersionId: source.version.id,
        jsonPointer: '/revenue',
        aggregation: 'LATEST',
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        versionNumber: 1,
        createdByMembershipId: fixture.ownerMembershipId,
        reason: 'Progress mapping',
      },
    });
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
        reason: 'Progress policy',
      },
    });
    const reports = new KpiReportService(
      repository,
      new FixedClock(new Date('2026-07-19T11:30:00Z')),
    );
    const actions = new ActionItemService(new ActionItemRepository(db));
    const progress = new KpiProgressService(
      repository,
      reports,
      new KpiSourceService(new InMemoryKpiSource()),
      actions,
    );
    await reports.appendRevision({
      tenantId: fixture.tenantId,
      membershipId: fixture.employeeMembershipId,
      businessDate: '2026-07-19',
      formSubmissionId: source.submission.id,
      correlationId: 'progress-first',
    });
    const first = await progress.current({
      tenantId: fixture.tenantId,
      membershipId: fixture.employeeMembershipId,
      businessDate: '2026-07-19',
      correlationId: 'progress-first',
    });
    expect(first.items[0]).toMatchObject({
      actual: { value: '7500000' },
      remaining: { value: '2500000' },
      passed: false,
    });
    const secondSubmission = await db.formSubmission.create({
      data: {
        ...source.submission,
        id: randomUUID(),
        data: { revenue: '10000000' },
        idempotencyKey: randomUUID(),
        submittedAt: new Date(),
      },
    });
    await reports.appendRevision({
      tenantId: fixture.tenantId,
      membershipId: fixture.employeeMembershipId,
      businessDate: '2026-07-19',
      formSubmissionId: secondSubmission.id,
      correlationId: 'progress-second',
    });
    const second = await progress.current({
      tenantId: fixture.tenantId,
      membershipId: fixture.employeeMembershipId,
      businessDate: '2026-07-19',
      correlationId: 'progress-second',
    });
    expect(second.items[0]).toMatchObject({
      actual: { value: '10000000' },
      remaining: { value: '0' },
      passed: true,
    });
    expect(await db.kpiCalculationEvent.count({ where: { tenantId: fixture.tenantId } })).toBe(2);
    expect(
      await db.outboxEvent.count({
        where: { tenantId: fixture.tenantId, eventType: 'kpi.progress.changed' },
      }),
    ).toBe(2);
    expect(
      await db.actionItem.findFirstOrThrow({
        where: { tenantId: fixture.tenantId, itemType: 'KPI_SHORTFALL' },
      }),
    ).toMatchObject({ state: 'COMPLETED', remainingValue: '0' });
    const transitionsBeforeReplay = await db.actionItemTransition.count({
      where: { tenantId: fixture.tenantId },
    });
    const effectsBeforeReplay = await db.outboxEvent.count({
      where: { tenantId: fixture.tenantId, eventType: 'action-item.changed' },
    });
    await progress.current({
      tenantId: fixture.tenantId,
      membershipId: fixture.employeeMembershipId,
      businessDate: '2026-07-19',
      correlationId: 'progress-replay',
    });
    expect(await db.actionItemTransition.count({ where: { tenantId: fixture.tenantId } })).toBe(
      transitionsBeforeReplay,
    );
    expect(
      await db.outboxEvent.count({
        where: { tenantId: fixture.tenantId, eventType: 'action-item.changed' },
      }),
    ).toBe(effectsBeforeReplay);
  });
});
