import {
  calculateProgress,
  evaluateDailyKpis,
  isMembershipInPolicyScope,
  parseExactMetric,
  resolvePolicy,
  resolveSoleCurrentBranch,
  resolveTarget,
  serializeExactMetric,
  snapshotPolicyInstants,
  type ExactMetricValue,
  type KpiProgressDetail,
  type TargetCandidate,
} from '@adsup/domain';
import type {
  ActionItemRepository,
  KpiRepository,
  KpiWorkerRepository,
  KpiDefinition,
  KpiTargetVersion,
} from '@adsup/database';

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);
const targetMetric = (definition: KpiDefinition, target: KpiTargetVersion): ExactMetricValue => {
  const raw =
    definition.valueType === 'MONEY'
      ? target.targetMoneyMinor!.toString()
      : definition.valueType === 'COUNT'
        ? target.targetCount!.toString()
        : target.targetPercentage!.toString();
  return parseExactMetric(definition.valueType, raw, definition.unit);
};

export class CloseDayService {
  constructor(
    private readonly kpi: KpiRepository,
    private readonly worker: KpiWorkerRepository,
    private readonly actions: ActionItemRepository,
  ) {}

  async closeMembership(input: {
    tenantId: string;
    membershipId: string;
    businessDate: Date;
    jobRunId: string;
    now: Date;
    correlationId: string;
  }) {
    const businessDate = dateOnly(input.businessDate);
    const dataQualityAt = new Date(`${businessDate}T00:00:00.000Z`);
    const assignmentInstant = new Date(`${businessDate}T12:00:00.000Z`);
    const assignments = await this.kpi.listEffectiveAssignments(
      input.tenantId,
      input.membershipId,
      assignmentInstant,
    );
    const branch = resolveSoleCurrentBranch(assignments, assignmentInstant);
    if (!branch.ok) {
      await this.actions.project({
        tenantId: input.tenantId,
        ownerMembershipId: input.membershipId,
        itemType: 'DATA_QUALITY',
        sourceType: 'TENANT_MEMBERSHIP',
        sourceId: input.membershipId,
        businessDate: input.businessDate,
        state: 'OPEN',
        title:
          branch.code === 'MULTIPLE_ACTIVE_BRANCHES'
            ? 'Nhân viên đang thuộc nhiều cơ sở hiệu lực'
            : 'Nhân viên chưa có cơ sở hiệu lực',
        deadlineAt: dataQualityAt,
        sourceFreshnessAt: dataQualityAt,
        deepLink: `adsup://management/members/${input.membershipId}/assignments`,
        correlationId: input.correlationId,
      });
      return { blocked: true as const, code: branch.code };
    }
    const assignment = assignments.find((item) => item.branchId === branch.branchId)!;
    const policyCandidates = await this.kpi.listPolicyCandidates(
      input.tenantId,
      branch.branchId,
      businessDate,
    );
    const selectedPolicy = resolvePolicy(policyCandidates, branch.branchId, businessDate);
    if (!selectedPolicy) return { blocked: true as const, code: 'POLICY_MISSING' };
    const policy = policyCandidates.find((item) => item.id === selectedPolicy.id)!;
    if (!isMembershipInPolicyScope(policy.membershipScopeJson, input.membershipId)) {
      return { skipped: true as const, code: 'OUTSIDE_POLICY_MEMBERSHIP_SCOPE' };
    }
    const instants = snapshotPolicyInstants(policy, businessDate);
    if (input.now < instants.evaluationAt)
      return { blocked: true as const, code: 'EVALUATION_NOT_DUE' };
    const report = await this.kpi.ensureReport({
      tenantId: input.tenantId,
      membershipId: input.membershipId,
      branchId: branch.branchId,
      businessDate: input.businessDate,
      policyVersionId: policy.id,
      ...instants,
    });
    const definitions = (await this.kpi.listDefinitions(input.tenantId, 200)).filter(
      (item) => item.status === 'ACTIVE',
    );
    const configuredIds = Array.isArray(
      (policy.kpiScopeJson as { kpiDefinitionIds?: unknown }).kpiDefinitionIds,
    )
      ? ((policy.kpiScopeJson as { kpiDefinitionIds: string[] }).kpiDefinitionIds ?? [])
      : [];
    const applicableDefinitions = configuredIds.length
      ? definitions.filter((item) => configuredIds.includes(item.id))
      : definitions;
    const targets = await this.kpi.listEffectiveTargets(input.tenantId, report.closedAt);
    const calculations = await this.kpi.listLatestCalculations(input.tenantId, report.id);
    const progress: KpiProgressDetail[] = [];
    const failedDetails: Array<Record<string, unknown>> = [];
    for (const definition of applicableDefinitions) {
      const candidates = targets.filter(
        (target) =>
          target.kpiDefinitionId === definition.id &&
          (target.scopeType === 'TENANT' ||
            (target.scopeType === 'BRANCH' && target.scopeId === branch.branchId) ||
            (target.scopeType === 'DEPARTMENT' && target.scopeId === assignment.departmentId) ||
            (target.scopeType === 'MEMBERSHIP' && target.scopeId === input.membershipId)),
      );
      const selected = resolveTarget(candidates as TargetCandidate[], report.closedAt);
      if (!selected) {
        await this.actions.project({
          tenantId: input.tenantId,
          ownerMembershipId: input.membershipId,
          branchId: branch.branchId,
          departmentId: assignment.departmentId,
          itemType: 'DATA_QUALITY',
          sourceType: 'KPI_DEFINITION',
          sourceId: definition.id,
          businessDate: input.businessDate,
          state: 'OPEN',
          title: `KPI ${definition.name} chưa có target hiệu lực`,
          deadlineAt: dataQualityAt,
          sourceFreshnessAt: dataQualityAt,
          deepLink: `adsup://management/kpi/definitions/${definition.id}/targets`,
          correlationId: input.correlationId,
        });
        return { blocked: true as const, code: 'TARGET_MISSING' };
      }
      const target = candidates.find((item) => item.id === selected.id)!;
      const targetValue = targetMetric(definition, target);
      const calculation = calculations.find(
        (item) => item.kpiDefinitionId === definition.id && item.targetVersionId === target.id,
      );
      const actual = calculation?.actualValue
        ? parseExactMetric(definition.valueType, calculation.actualValue, definition.unit)
        : null;
      const result = calculateProgress(targetValue, actual, definition.direction);
      const detail: KpiProgressDetail = {
        kpiDefinitionId: definition.id,
        required: target.required,
        passed: result.passed,
        target: targetValue,
        actual,
        remaining: result.remaining,
        sourceStatus: calculation ? 'FRESH' : 'MISSING',
      };
      progress.push(detail);
      if (target.required && !result.passed) {
        failedDetails.push({
          kpiDefinitionId: definition.id,
          targetVersionId: target.id,
          target: serializeExactMetric(targetValue),
          actual: actual ? serializeExactMetric(actual) : null,
          remaining: serializeExactMetric(result.remaining),
          unit: definition.unit,
          sourceType: calculation?.sourceType ?? 'MISSING',
          sourceId: calculation?.sourceId ?? null,
        });
      }
    }
    const exemptionRule = policy.exemptionRuleJson as { membershipIds?: unknown };
    const exemptionSource =
      Array.isArray(exemptionRule.membershipIds) &&
      exemptionRule.membershipIds.includes(input.membershipId)
        ? 'POLICY_MEMBERSHIP_EXEMPTION'
        : null;
    const decision = evaluateDailyKpis({
      hasEligibleReport: Boolean(report.currentRevisionId),
      progress,
      exemptionSource,
    });
    if (!report.currentRevisionId && failedDetails.length === 0) {
      failedDetails.push({ code: 'REPORT_MISSING', businessDate });
    }
    return this.worker.closeEvaluation({
      tenantId: input.tenantId,
      reportId: report.id,
      membershipId: input.membershipId,
      branchId: branch.branchId,
      businessDate: input.businessDate,
      policyVersionId: policy.id,
      reportRevisionId: report.currentRevisionId,
      status: decision.status,
      failedDetails,
      exemptionSource: decision.exemptionSource,
      evaluatedAt: input.now,
      jobRunId: input.jobRunId,
      penaltyMinor: policy.failurePenaltyMinor,
      correlationId: input.correlationId,
    });
  }
}
