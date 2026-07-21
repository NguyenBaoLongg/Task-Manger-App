import { ProblemError, requiredEvidenceCount } from '@adsup/domain';
import type { ActionItemRepository, KpiEvidenceRepository, KpiRepository } from '@adsup/database';

export class KpiEvidenceService {
  constructor(
    private readonly evidence: KpiEvidenceRepository,
    private readonly kpi: KpiRepository,
    private readonly actions: ActionItemRepository,
  ) {}

  async ensureForReport(input: {
    tenantId: string;
    membershipId: string;
    reportId: string;
    policyVersionId: string;
    evidenceEnabled: boolean;
    graceSeconds: number;
    kpisRequiringEvidence: number;
    formHasRevenue: boolean;
    baseAt: Date;
    correlationId: string;
  }) {
    const requiredCount = requiredEvidenceCount({
      evidenceEnabled: input.evidenceEnabled,
      kpisRequiringEvidence: input.kpisRequiringEvidence,
      formHasRevenue: input.formHasRevenue,
    });
    if (requiredCount === 0) return null;
    const report = await this.kpi.getReport(input.tenantId, input.reportId);
    if (!report || report.membershipId !== input.membershipId) {
      throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy báo cáo.');
    }
    const debt = await this.evidence.ensureDebt({
      tenantId: input.tenantId,
      reportId: input.reportId,
      policyVersionId: input.policyVersionId,
      requiredCount,
      deadlineAt: new Date(input.baseAt.getTime() + input.graceSeconds * 1_000),
      actorMembershipId: input.membershipId,
      correlationId: input.correlationId,
    });
    await this.project(debt, report, input.correlationId);
    return debt;
  }

  async refresh(input: {
    tenantId: string;
    membershipId: string;
    debtId: string;
    now: Date;
    correlationId: string;
  }) {
    const debt = await this.evidence.getDebt(input.tenantId, input.debtId);
    if (!debt) throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy nợ ảnh.');
    const report = await this.kpi.getReport(input.tenantId, debt.reportId);
    if (!report || report.membershipId !== input.membershipId) {
      throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy nợ ảnh.');
    }
    const refreshed = await this.evidence.refreshDebt({
      tenantId: input.tenantId,
      debtId: debt.id,
      now: input.now,
    });
    if (!refreshed) throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy nợ ảnh.');
    await this.project(refreshed.debt, refreshed.report, input.correlationId);
    return refreshed.debt;
  }

  private project(
    debt: {
      id: string;
      requiredCount: number;
      receivedCount: number;
      state: 'WAITING_PHOTOS' | 'SATISFIED' | 'OVERDUE' | 'WAIVED';
      deadlineAt: Date;
      updatedAt: Date;
    },
    report: { tenantId: string; membershipId: string; branchId: string; businessDate: Date },
    correlationId: string,
  ) {
    return this.actions.project({
      tenantId: report.tenantId,
      ownerMembershipId: report.membershipId,
      branchId: report.branchId,
      itemType: 'PHOTO_DEBT',
      sourceType: 'EVIDENCE_DEBT',
      sourceId: debt.id,
      businessDate: report.businessDate,
      state:
        debt.state === 'SATISFIED' || debt.state === 'WAIVED'
          ? 'COMPLETED'
          : debt.state === 'OVERDUE'
            ? 'OVERDUE'
            : 'OPEN',
      title: `Còn thiếu ${Math.max(0, debt.requiredCount - debt.receivedCount)} ảnh minh chứng`,
      targetValue: String(debt.requiredCount),
      actualValue: String(debt.receivedCount),
      remainingValue: String(Math.max(0, debt.requiredCount - debt.receivedCount)),
      unit: 'PHOTO',
      deadlineAt: debt.deadlineAt,
      sourceFreshnessAt: debt.updatedAt,
      deepLink: `adsup://kpi/evidence-debts/${debt.id}`,
      correlationId,
    });
  }
}
