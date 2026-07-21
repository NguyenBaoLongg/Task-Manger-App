import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createDatabaseClient,
  KpiRepository,
  OrganizationRbacRepository,
  type DatabaseClient,
} from '@adsup/database';
import { KpiPolicyService as ApiKpiPolicyService } from '../../src/modules/kpi/kpi-policy-service.js';
import {
  cleanupKpiLiveFixture,
  createKpiLiveFixture,
  type KpiLiveFixture,
} from '../helpers/kpi-live-fixture.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('KPI configuration atomic integration', () => {
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

  it('commits two branch policies atomically with audit/outbox and rejects a foreign ID', async () => {
    const service = new ApiKpiPolicyService(new KpiRepository(db));
    const base = {
      tenantId: fixture.tenantId,
      scope: 'BRANCHES' as const,
      effectiveFromDate: '2026-01-01',
      timezone: 'Asia/Ho_Chi_Minh',
      reportOpenLocal: '18:00:00',
      reportCloseLocal: '20:00:00',
      evaluationLocal: '20:00:01',
      failurePenaltyMinor: '100000',
      currency: 'VND' as const,
      kpiDefinitionIds: [fixture.definitionId],
      membershipScope: {},
      exemptionRule: {},
      evidenceEnabled: false,
      evidenceGraceSeconds: 300,
      actorMembershipId: fixture.ownerMembershipId,
      correlationId: 'bulk-policy-live',
      reason: 'Áp dụng cho hai cơ sở',
    };
    await expect(
      service.bulkCreate({
        ...base,
        branchIds: [fixture.branchIds[0], '90000000-0000-4000-8000-000000000001'],
      }),
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    expect(await db.dailyKpiPolicyVersion.count({ where: { tenantId: fixture.tenantId } })).toBe(0);
    await expect(
      service.bulkCreate({ ...base, branchIds: fixture.branchIds }),
    ).resolves.toHaveLength(2);
    expect(
      await db.auditEvent.count({
        where: { tenantId: fixture.tenantId, eventType: 'DAILY_KPI_POLICY_VERSION_CREATED' },
      }),
    ).toBe(2);
    expect(
      await db.outboxEvent.count({
        where: { tenantId: fixture.tenantId, eventType: 'kpi.policy.version-created' },
      }),
    ).toBe(2);
  });

  it('rejects an overlapping second branch assignment for the same employee', async () => {
    const repository = new OrganizationRbacRepository(db);
    await expect(
      repository.createAssignment({
        tenantId: fixture.tenantId,
        membershipId: fixture.employeeMembershipId,
        branchId: fixture.branchIds[1],
        effectiveFrom: new Date('2026-07-19T00:00:00Z'),
        createdByMembershipId: fixture.ownerMembershipId,
        reason: 'Must keep one active branch',
        correlationId: 'single-branch-rule',
      }),
    ).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
    expect(
      await db.assignment.count({
        where: { tenantId: fixture.tenantId, membershipId: fixture.employeeMembershipId },
      }),
    ).toBe(1);
  });
});
