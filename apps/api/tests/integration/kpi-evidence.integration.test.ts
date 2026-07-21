import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ActionItemRepository,
  createDatabaseClient,
  KpiEvidenceRepository,
  KpiRepository,
  type DatabaseClient,
} from '@adsup/database';
import { KpiEvidenceService } from '../../src/modules/kpi/kpi-evidence-service.js';
import {
  cleanupKpiLiveFixture,
  createKpiLiveFixture,
  type KpiLiveFixture,
} from '../helpers/kpi-live-fixture.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('KPI evidence tenant/owner/source authorization', () => {
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

  it('counts only matching READY media and hides the debt from another employee', async () => {
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
        createdByMembershipId: fixture.ownerMembershipId,
        reason: 'Evidence policy',
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
    const evidence = new KpiEvidenceRepository(db);
    const debt = await evidence.ensureDebt({
      tenantId: fixture.tenantId,
      reportId: report.id,
      policyVersionId: policy.id,
      requiredCount: 2,
      deadlineAt: new Date('2026-07-19T13:05:00Z'),
    });
    const common = {
      tenantId: fixture.tenantId,
      branchId: fixture.branchIds[0],
      sourceType: 'DAILY_KPI_REPORT',
      sourceId: report.id,
      purpose: 'FORM_EVIDENCE',
      storageProvider: 'memory',
      bucket: 'test',
      contentType: 'image/jpeg',
      byteSize: 10n,
      uploadExpiresAt: new Date('2026-07-20T00:00:00Z'),
    };
    await db.mediaObject.createMany({
      data: [
        {
          ...common,
          ownerMembershipId: fixture.employeeMembershipId,
          objectKey: `${fixture.tenantId}/evidence/${randomUUID()}`,
          checksumSha256: 'a'.repeat(64),
          status: 'READY',
          readyAt: new Date(),
        },
        {
          ...common,
          ownerMembershipId: fixture.ownerMembershipId,
          objectKey: `${fixture.tenantId}/evidence/${randomUUID()}`,
          checksumSha256: 'b'.repeat(64),
          status: 'READY',
          readyAt: new Date(),
        },
        {
          ...common,
          ownerMembershipId: fixture.employeeMembershipId,
          sourceId: randomUUID(),
          objectKey: `${fixture.tenantId}/evidence/${randomUUID()}`,
          checksumSha256: 'c'.repeat(64),
          status: 'READY',
          readyAt: new Date(),
        },
        {
          ...common,
          ownerMembershipId: fixture.employeeMembershipId,
          objectKey: `${fixture.tenantId}/evidence/${randomUUID()}`,
          checksumSha256: 'd'.repeat(64),
          status: 'PENDING_UPLOAD',
        },
      ],
    });
    const service = new KpiEvidenceService(
      evidence,
      new KpiRepository(db),
      new ActionItemRepository(db),
    );
    await expect(
      service.refresh({
        tenantId: fixture.tenantId,
        membershipId: fixture.employeeMembershipId,
        debtId: debt.id,
        now: new Date('2026-07-19T13:02:00Z'),
        correlationId: 'evidence-refresh',
      }),
    ).resolves.toMatchObject({ receivedCount: 1, state: 'WAITING_PHOTOS' });
    await expect(
      service.refresh({
        tenantId: fixture.tenantId,
        membershipId: fixture.ownerMembershipId,
        debtId: debt.id,
        now: new Date('2026-07-19T13:02:00Z'),
        correlationId: 'evidence-foreign-owner',
      }),
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });
});
