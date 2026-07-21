import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ActionItemRepository,
  KpiEvidenceRepository,
  KpiRepository,
  KpiWorkerRepository,
  createDatabaseClient,
  type DatabaseClient,
} from '@adsup/database';
import { InMemoryKpiSource, FixedClock } from '@adsup/testing';
import { KpiConfigService } from '../../src/modules/kpi/kpi-config-service.js';
import { KpiPolicyService } from '../../src/modules/kpi/kpi-policy-service.js';
import { KpiReportService } from '../../src/modules/kpi/kpi-report-service.js';
import { KpiSourceService } from '../../src/modules/kpi/kpi-source-service.js';
import { KpiProgressService } from '../../src/modules/kpi/kpi-progress-service.js';
import { KpiPenaltyService } from '../../src/modules/kpi/kpi-penalty-service.js';
import { ActionItemService } from '../../src/modules/action-items/action-item-service.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('Module 2 KPI with PostgreSQL', () => {
  let db: DatabaseClient;
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  const ownerUserId = randomUUID();
  const employeeUserId = randomUUID();
  const otherEmployeeUserId = randomUUID();
  const foreignUserId = randomUUID();
  const ownerMembershipId = randomUUID();
  const employeeMembershipId = randomUUID();
  const otherEmployeeMembershipId = randomUUID();
  const foreignMembershipId = randomUUID();
  const branchId = randomUUID();
  const foreignBranchId = randomUUID();
  const businessDate = '2026-07-19';
  const businessDateValue = new Date(`${businessDate}T00:00:00.000Z`);
  let reportId = '';
  let penaltyId = '';

  beforeAll(async () => {
    db = createDatabaseClient(databaseUrl!);
    await db.user.createMany({
      data: [ownerUserId, employeeUserId, otherEmployeeUserId, foreignUserId].map((id, index) => ({
        id,
        fullName: `KPI Test ${index}`,
        fullNameConfirmedAt: new Date(),
      })),
    });
    await db.tenant.createMany({
      data: [
        {
          id: tenantId,
          name: 'KPI Tenant',
          slug: `kpi-${tenantId.slice(0, 8)}`,
          createdByUserId: ownerUserId,
        },
        {
          id: otherTenantId,
          name: 'Foreign KPI Tenant',
          slug: `kpi-${otherTenantId.slice(0, 8)}`,
          createdByUserId: foreignUserId,
        },
      ],
    });
    await db.tenantMembership.createMany({
      data: [
        {
          tenantId,
          id: ownerMembershipId,
          userId: ownerUserId,
          membershipDisplayName: 'Owner',
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
        {
          tenantId,
          id: employeeMembershipId,
          userId: employeeUserId,
          membershipDisplayName: 'Employee',
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
        {
          tenantId,
          id: otherEmployeeMembershipId,
          userId: otherEmployeeUserId,
          membershipDisplayName: 'Other employee',
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
        {
          tenantId: otherTenantId,
          id: foreignMembershipId,
          userId: foreignUserId,
          membershipDisplayName: 'Foreign',
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      ],
    });
    await db.branch.createMany({
      data: [
        {
          tenantId,
          id: branchId,
          code: 'MAIN',
          name: 'Main',
          createdByMembershipId: ownerMembershipId,
        },
        {
          tenantId: otherTenantId,
          id: foreignBranchId,
          code: 'FOREIGN',
          name: 'Foreign',
          createdByMembershipId: foreignMembershipId,
        },
      ],
    });
    await db.assignment.create({
      data: {
        tenantId,
        membershipId: employeeMembershipId,
        branchId,
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        createdByMembershipId: ownerMembershipId,
        reason: 'KPI test assignment',
      },
    });
  });

  afterAll(async () => {
    if (!db) return;
    await db.dailyKpiReport.updateMany({ where: { tenantId }, data: { currentRevisionId: null } });
    await db.outboxEvent.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
    await db.actionItemTransition.deleteMany({ where: { tenantId } });
    await db.actionItem.deleteMany({ where: { tenantId } });
    await db.evidenceDebt.deleteMany({ where: { tenantId } });
    await db.penaltyAdjustment.deleteMany({ where: { tenantId } });
    await db.penaltyOutcome.deleteMany({ where: { tenantId } });
    await db.dailyKpiEvaluation.deleteMany({ where: { tenantId } });
    await db.kpiCalculationEvent.deleteMany({ where: { tenantId } });
    await db.dailyKpiReportRevision.deleteMany({ where: { tenantId } });
    await db.dailyKpiReport.deleteMany({ where: { tenantId } });
    await db.kpiJobRun.deleteMany({ where: { tenantId } });
    await db.dailyKpiPolicyVersion.deleteMany({ where: { tenantId } });
    await db.kpiSourceMappingVersion.deleteMany({ where: { tenantId } });
    await db.kpiTargetVersion.deleteMany({ where: { tenantId } });
    await db.kpiDefinition.deleteMany({ where: { tenantId } });
    await db.mediaObject.deleteMany({ where: { tenantId } });
    await db.formTemplate.updateMany({
      where: { tenantId },
      data: { currentPublishedVersionId: null },
    });
    await db.formSubmission.deleteMany({ where: { tenantId } });
    await db.formVersion.deleteMany({ where: { tenantId } });
    await db.formTemplate.deleteMany({ where: { tenantId } });
    await db.auditEvent.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
    await db.assignment.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
    await db.branch.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
    await db.tenantMembership.deleteMany({
      where: { tenantId: { in: [tenantId, otherTenantId] } },
    });
    await db.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
    await db.user.deleteMany({
      where: { id: { in: [ownerUserId, employeeUserId, otherEmployeeUserId, foreignUserId] } },
    });
    await db.$disconnect();
  });

  it('creates versioned configuration atomically and rejects a foreign branch', async () => {
    const repository = new KpiRepository(db);
    const config = new KpiConfigService(repository);
    const policy = new KpiPolicyService(repository);
    const definition = await config.createDefinition({
      tenantId,
      code: 'TEST_REVENUE',
      name: 'Doanh số test',
      valueType: 'MONEY',
      unit: 'VND',
      direction: 'AT_LEAST',
      sourceType: 'FORM_FIELD',
      reason: 'Create test KPI',
      actorMembershipId: ownerMembershipId,
      correlationId: 'kpi-config-definition',
    });
    await config.createTarget({
      tenantId,
      kpiDefinitionId: definition.id,
      scopeType: 'TENANT',
      target: { value: '10000000', unit: 'VND' },
      required: true,
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      reason: 'Set revenue target',
      actorMembershipId: ownerMembershipId,
      correlationId: 'kpi-config-target',
    });
    await policy.bulkCreate({
      tenantId,
      scope: 'TENANT',
      branchIds: [],
      effectiveFromDate: '2026-01-01',
      timezone: 'Asia/Ho_Chi_Minh',
      reportOpenLocal: '18:00:00',
      reportCloseLocal: '20:00:00',
      evaluationLocal: '20:00:01',
      failurePenaltyMinor: '100000',
      currency: 'VND',
      kpiDefinitionIds: [definition.id],
      membershipScope: {},
      exemptionRule: {},
      evidenceEnabled: false,
      evidenceGraceSeconds: 300,
      reason: 'Create tenant policy',
      actorMembershipId: ownerMembershipId,
      correlationId: 'kpi-config-policy',
    });
    await expect(
      policy.bulkCreate({
        tenantId,
        scope: 'BRANCHES',
        branchIds: [branchId, foreignBranchId],
        effectiveFromDate: '2027-01-01',
        timezone: 'Asia/Ho_Chi_Minh',
        reportOpenLocal: '18:00:00',
        reportCloseLocal: '20:00:00',
        evaluationLocal: '20:00:01',
        failurePenaltyMinor: '100000',
        currency: 'VND',
        kpiDefinitionIds: [definition.id],
        membershipScope: {},
        exemptionRule: {},
        evidenceEnabled: false,
        evidenceGraceSeconds: 300,
        reason: 'Must reject foreign branch',
        actorMembershipId: ownerMembershipId,
        correlationId: 'kpi-config-foreign',
      }),
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    expect(await db.dailyKpiPolicyVersion.count({ where: { tenantId } })).toBe(1);
  });

  it('retains revisions, makes 20:00 exclusive and returns exact remaining', async () => {
    const repository = new KpiRepository(db);
    const definition = await db.kpiDefinition.findFirstOrThrow({
      where: { tenantId, code: 'TEST_REVENUE' },
    });
    const template = await db.formTemplate.create({
      data: {
        tenantId,
        code: 'KPI_TEST',
        name: 'KPI Test',
        createdByMembershipId: ownerMembershipId,
      },
    });
    const version = await db.formVersion.create({
      data: {
        tenantId,
        formTemplateId: template.id,
        versionNumber: 1,
        status: 'PUBLISHED',
        jsonSchema: { type: 'object' },
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        publishedAt: new Date(),
        publishedByMembershipId: ownerMembershipId,
      },
    });
    await db.formTemplate.update({
      where: { tenantId_id: { tenantId, id: template.id } },
      data: { currentPublishedVersionId: version.id },
    });
    await new KpiConfigService(repository).createSourceMapping({
      tenantId,
      kpiDefinitionId: definition.id,
      sourceType: 'FORM_FIELD',
      formTemplateId: template.id,
      formVersionId: version.id,
      jsonPointer: '/revenue',
      aggregation: 'LATEST',
      requiresEvidence: false,
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      reason: 'Map revenue form',
      actorMembershipId: ownerMembershipId,
      correlationId: 'kpi-mapping',
    });
    const submission = await db.formSubmission.create({
      data: {
        tenantId,
        formTemplateId: template.id,
        formVersionId: version.id,
        submittedByMembershipId: employeeMembershipId,
        branchId,
        data: { revenue: '7500000' },
        idempotencyKey: 'kpi-form-submission-1',
      },
    });
    const clock = new FixedClock(new Date('2026-07-19T11:30:00.000Z'));
    const reports = new KpiReportService(repository, clock);
    const first = await reports.appendRevision({
      tenantId,
      membershipId: employeeMembershipId,
      businessDate,
      formSubmissionId: submission.id,
      correlationId: 'kpi-report-first',
    });
    expect(first.acceptedInWindow).toBe(true);
    const progress = new KpiProgressService(
      repository,
      reports,
      new KpiSourceService(new InMemoryKpiSource()),
      new ActionItemService(new ActionItemRepository(db)),
    );
    const snapshot = await progress.current({
      tenantId,
      membershipId: employeeMembershipId,
      businessDate,
      correlationId: 'kpi-progress',
    });
    expect(snapshot.items).toContainEqual(
      expect.objectContaining({
        kpiDefinitionId: definition.id,
        target: { value: '10000000', unit: 'VND' },
        actual: { value: '7500000', unit: 'VND' },
        remaining: { value: '2500000', unit: 'VND' },
        passed: false,
      }),
    );
    clock.advance(90 * 60 * 1_000);
    const lateSubmission = await db.formSubmission.create({
      data: {
        tenantId,
        formTemplateId: template.id,
        formVersionId: version.id,
        submittedByMembershipId: employeeMembershipId,
        branchId,
        data: { revenue: '10000000' },
        idempotencyKey: 'kpi-form-submission-2',
      },
    });
    const late = await reports.appendRevision({
      tenantId,
      membershipId: employeeMembershipId,
      businessDate,
      formSubmissionId: lateSubmission.id,
      correlationId: 'kpi-report-late',
    });
    expect(late.submittedAt.toISOString()).toBe('2026-07-19T13:00:00.000Z');
    expect(late.acceptedInWindow).toBe(false);
    const report = await repository.getReportByMemberDate(
      tenantId,
      employeeMembershipId,
      businessDateValue,
    );
    expect(report?.currentRevisionId).toBe(first.id);
    reportId = report!.id;
  });

  it('closes once under 100 retry deliveries and creates one 100000 VND penalty', async () => {
    const worker = new KpiWorkerRepository(db);
    const run = await worker.ensureRun({
      tenantId,
      jobType: 'KPI_TEST_CLOSE',
      businessDate: businessDateValue,
      correlationId: 'kpi-close',
    });
    const report = await db.dailyKpiReport.findUniqueOrThrow({
      where: { tenantId_id: { tenantId, id: reportId } },
    });
    const closeInput: Parameters<KpiWorkerRepository['closeEvaluation']>[0] = {
      tenantId,
      reportId,
      membershipId: employeeMembershipId,
      branchId,
      businessDate: businessDateValue,
      policyVersionId: report.policyVersionId,
      reportRevisionId: report.currentRevisionId,
      status: 'FAILED',
      failedDetails: [{ code: 'KPI_SHORTFALL', remaining: '2500000', unit: 'VND' }],
      evaluatedAt: new Date('2026-07-19T13:00:02.000Z'),
      jobRunId: run.id,
      penaltyMinor: 100_000n,
      correlationId: 'kpi-close',
    };
    const first = await worker.closeEvaluation(closeInput);
    expect(first.replayed).toBe(false);
    for (let index = 0; index < 99; index += 1) {
      expect((await worker.closeEvaluation(closeInput)).replayed).toBe(true);
    }
    expect(
      await db.dailyKpiEvaluation.count({
        where: { tenantId, membershipId: employeeMembershipId, businessDate: businessDateValue },
      }),
    ).toBe(1);
    const penalties = await db.penaltyOutcome.findMany({
      where: {
        tenantId,
        membershipId: employeeMembershipId,
        businessDate: businessDateValue,
        kind: 'DAILY_KPI',
      },
    });
    expect(penalties).toHaveLength(1);
    expect(penalties[0]!.amountMinor).toBe(100_000n);
    expect(
      await db.dailyKpiReport.findUniqueOrThrow({
        where: { tenantId_id: { tenantId, id: reportId } },
      }),
    ).toMatchObject({ status: 'CLOSED' });
    penaltyId = penalties[0]!.id;
  });

  it('keeps the original penalty immutable and replays one adjustment', async () => {
    const service = new KpiPenaltyService(new KpiRepository(db));
    const input = {
      tenantId,
      penaltyId,
      deltaMinor: '-50000',
      actorMembershipId: ownerMembershipId,
      idempotencyKey: 'kpi-adjustment-idempotency',
      reason: 'Approved correction',
      correlationId: 'kpi-adjustment',
    };
    const first = await service.adjust(input);
    const replay = await service.adjust(input);
    expect(first.effectiveAmountMinor).toBe(50_000n);
    expect(replay.effectiveAmountMinor).toBe(50_000n);
    expect(
      await db.penaltyAdjustment.count({ where: { tenantId, penaltyOutcomeId: penaltyId } }),
    ).toBe(1);
    expect(
      (
        await db.penaltyOutcome.findUniqueOrThrow({
          where: { tenantId_id: { tenantId, id: penaltyId } },
        })
      ).amountMinor,
    ).toBe(100_000n);
  });

  it('counts only READY evidence owned by the report employee', async () => {
    const evidence = new KpiEvidenceRepository(db);
    const policy = await db.dailyKpiPolicyVersion.findFirstOrThrow({ where: { tenantId } });
    const debt = await evidence.ensureDebt({
      tenantId,
      reportId,
      policyVersionId: policy.id,
      requiredCount: 2,
      deadlineAt: new Date('2026-07-19T13:10:00Z'),
    });
    const common = {
      tenantId,
      branchId,
      sourceType: 'DAILY_KPI_REPORT',
      sourceId: reportId,
      purpose: 'FORM_EVIDENCE',
      storageProvider: 'memory',
      bucket: 'test',
      contentType: 'image/jpeg',
      byteSize: 10n,
      status: 'READY' as const,
      uploadExpiresAt: new Date('2026-07-20T00:00:00Z'),
      readyAt: new Date('2026-07-19T13:01:00Z'),
    };
    await db.mediaObject.createMany({
      data: [
        {
          ...common,
          ownerMembershipId: employeeMembershipId,
          objectKey: `${tenantId}/kpi/${randomUUID()}`,
          checksumSha256: 'a'.repeat(64),
        },
        {
          ...common,
          ownerMembershipId: otherEmployeeMembershipId,
          objectKey: `${tenantId}/kpi/${randomUUID()}`,
          checksumSha256: 'b'.repeat(64),
        },
      ],
    });
    const partial = await evidence.refreshDebt({
      tenantId,
      debtId: debt.id,
      now: new Date('2026-07-19T13:02:00Z'),
    });
    expect(partial?.debt).toMatchObject({ receivedCount: 1, state: 'WAITING_PHOTOS' });
    await db.mediaObject.create({
      data: {
        ...common,
        ownerMembershipId: employeeMembershipId,
        objectKey: `${tenantId}/kpi/${randomUUID()}`,
        checksumSha256: 'c'.repeat(64),
      },
    });
    const complete = await evidence.refreshDebt({
      tenantId,
      debtId: debt.id,
      now: new Date('2026-07-19T13:03:00Z'),
    });
    expect(complete?.debt).toMatchObject({ receivedCount: 2, state: 'SATISFIED' });
  });
});
