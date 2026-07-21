import {
  ProblemError,
  isRevisionInWindow,
  kpiDigest,
  resolvePolicy,
  resolveSoleCurrentBranch,
  snapshotPolicyInstants,
  systemClock,
  type Clock,
} from '@adsup/domain';
import type { KpiRepository } from '@adsup/database';

const asBusinessDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ProblemError(422, 'VALIDATION_FAILED', 'Ngày nghiệp vụ không hợp lệ.');
  }
  return new Date(`${value}T00:00:00.000Z`);
};

export class KpiReportService {
  constructor(
    private readonly repository: KpiRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async ensureDailyReport(tenantId: string, membershipId: string, businessDate: string) {
    const instant = new Date(`${businessDate}T12:00:00.000Z`);
    const assignments = await this.repository.listEffectiveAssignments(
      tenantId,
      membershipId,
      instant,
    );
    const branch = resolveSoleCurrentBranch(assignments, instant);
    if (!branch.ok) {
      throw new ProblemError(
        422,
        branch.code,
        branch.code === 'MULTIPLE_ACTIVE_BRANCHES'
          ? 'Nhân viên đang có nhiều cơ sở hiệu lực.'
          : 'Nhân viên chưa có cơ sở hiệu lực.',
      );
    }
    const policies = await this.repository.listPolicyCandidates(
      tenantId,
      branch.branchId,
      businessDate,
    );
    const selectedPolicy = resolvePolicy(policies, branch.branchId, businessDate);
    if (!selectedPolicy)
      throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không có policy KPI hiệu lực.');
    const policy = policies.find((item) => item.id === selectedPolicy.id)!;
    const instants = snapshotPolicyInstants(policy, businessDate);
    const report = await this.repository.ensureReport({
      tenantId,
      membershipId,
      branchId: branch.branchId,
      businessDate: asBusinessDate(businessDate),
      policyVersionId: policy.id,
      ...instants,
    });
    const assignment = assignments.find((item) => item.branchId === branch.branchId)!;
    return { report, policy, assignment };
  }

  async appendRevision(input: {
    tenantId: string;
    membershipId: string;
    businessDate: string;
    formSubmissionId: string;
    correlationId: string;
    reason?: string;
  }) {
    const { report } = await this.ensureDailyReport(
      input.tenantId,
      input.membershipId,
      input.businessDate,
    );
    const submission = await this.repository.getFormSubmission(
      input.tenantId,
      input.formSubmissionId,
    );
    if (
      !submission ||
      submission.status !== 'SUBMITTED' ||
      submission.submittedByMembershipId !== input.membershipId ||
      submission.branchId !== report.branchId
    ) {
      throw new ProblemError(
        404,
        'RESOURCE_NOT_FOUND',
        'Không tìm thấy submission hợp lệ trong phạm vi.',
      );
    }
    const submittedAt = this.clock.now();
    return this.repository.appendReportRevision({
      tenantId: input.tenantId,
      reportId: report.id,
      formSubmissionId: submission.id,
      formVersionId: submission.formVersionId,
      submittedAt,
      acceptedInWindow: isRevisionInWindow(submittedAt, report),
      sourceDigest: kpiDigest({ formVersionId: submission.formVersionId, data: submission.data }),
      actorMembershipId: input.membershipId,
      correlationId: input.correlationId,
      reason: input.reason ?? 'DAILY_KPI_REPORT_SUBMITTED',
    });
  }

  async revisions(tenantId: string, membershipId: string, businessDate: string, cursor?: string) {
    const report = await this.repository.getReportByMemberDate(
      tenantId,
      membershipId,
      asBusinessDate(businessDate),
    );
    if (!report) return { items: [], nextCursor: null };
    return this.repository.listReportRevisions({ tenantId, reportId: report.id, cursor });
  }
}

export { asBusinessDate };
