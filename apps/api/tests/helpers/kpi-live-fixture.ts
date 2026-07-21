import { randomUUID } from 'node:crypto';
import type { DatabaseClient } from '@adsup/database';

export interface KpiLiveFixture {
  tenantId: string;
  ownerUserId: string;
  employeeUserId: string;
  ownerMembershipId: string;
  employeeMembershipId: string;
  branchIds: [string, string];
  definitionId: string;
}

export async function createKpiLiveFixture(db: DatabaseClient): Promise<KpiLiveFixture> {
  const tenantId = randomUUID();
  const ownerUserId = randomUUID();
  const employeeUserId = randomUUID();
  const ownerMembershipId = randomUUID();
  const employeeMembershipId = randomUUID();
  const branchIds: [string, string] = [randomUUID(), randomUUID()];
  const definitionId = randomUUID();
  await db.user.createMany({
    data: [
      { id: ownerUserId, fullName: 'KPI Owner', fullNameConfirmedAt: new Date() },
      { id: employeeUserId, fullName: 'KPI Employee', fullNameConfirmedAt: new Date() },
    ],
  });
  await db.tenant.create({
    data: {
      id: tenantId,
      name: 'KPI Live Fixture',
      slug: `kpi-live-${tenantId.slice(0, 8)}`,
      createdByUserId: ownerUserId,
    },
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
    ],
  });
  await db.branch.createMany({
    data: [
      {
        tenantId,
        id: branchIds[0],
        code: 'B1',
        name: 'Branch 1',
        createdByMembershipId: ownerMembershipId,
      },
      {
        tenantId,
        id: branchIds[1],
        code: 'B2',
        name: 'Branch 2',
        createdByMembershipId: ownerMembershipId,
      },
    ],
  });
  await db.assignment.create({
    data: {
      tenantId,
      membershipId: employeeMembershipId,
      branchId: branchIds[0],
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      createdByMembershipId: ownerMembershipId,
      reason: 'Live test single branch',
    },
  });
  await db.kpiDefinition.create({
    data: {
      tenantId,
      id: definitionId,
      code: 'LIVE_REVENUE',
      name: 'Doanh số live',
      valueType: 'MONEY',
      unit: 'VND',
      direction: 'AT_LEAST',
      sourceType: 'FORM_FIELD',
      createdByMembershipId: ownerMembershipId,
    },
  });
  return {
    tenantId,
    ownerUserId,
    employeeUserId,
    ownerMembershipId,
    employeeMembershipId,
    branchIds,
    definitionId,
  };
}

export async function createKpiReportSource(
  db: DatabaseClient,
  fixture: KpiLiveFixture,
  revenue = '7500000',
) {
  const template = await db.formTemplate.create({
    data: {
      tenantId: fixture.tenantId,
      code: `REPORT_${randomUUID().slice(0, 8)}`,
      name: 'Daily report',
      createdByMembershipId: fixture.ownerMembershipId,
    },
  });
  const version = await db.formVersion.create({
    data: {
      tenantId: fixture.tenantId,
      formTemplateId: template.id,
      versionNumber: 1,
      status: 'PUBLISHED',
      jsonSchema: { type: 'object' },
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      publishedAt: new Date(),
      publishedByMembershipId: fixture.ownerMembershipId,
    },
  });
  await db.formTemplate.update({
    where: { tenantId_id: { tenantId: fixture.tenantId, id: template.id } },
    data: { currentPublishedVersionId: version.id },
  });
  const submission = await db.formSubmission.create({
    data: {
      tenantId: fixture.tenantId,
      formTemplateId: template.id,
      formVersionId: version.id,
      submittedByMembershipId: fixture.employeeMembershipId,
      branchId: fixture.branchIds[0],
      data: { revenue },
      idempotencyKey: randomUUID(),
    },
  });
  return { template, version, submission };
}

export async function cleanupKpiLiveFixture(db: DatabaseClient, fixture: KpiLiveFixture) {
  const tenantId = fixture.tenantId;
  await db.dailyKpiReport.updateMany({ where: { tenantId }, data: { currentRevisionId: null } });
  await db.outboxEvent.deleteMany({ where: { tenantId } });
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
  await db.auditEvent.deleteMany({ where: { tenantId } });
  await db.assignment.deleteMany({ where: { tenantId } });
  await db.branch.deleteMany({ where: { tenantId } });
  await db.tenantMembership.deleteMany({ where: { tenantId } });
  await db.tenant.delete({ where: { id: tenantId } });
  await db.user.deleteMany({
    where: { id: { in: [fixture.ownerUserId, fixture.employeeUserId] } },
  });
}
