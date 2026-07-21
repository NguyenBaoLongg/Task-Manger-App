import {
  calculateProgress,
  kpiDigest,
  parseExactMetric,
  resolveTarget,
  serializeExactMetric,
  type ExactMetricValue,
  type TargetCandidate,
} from '@adsup/domain';
import type { KpiDefinition, KpiRepository, KpiTargetVersion } from '@adsup/database';
import type { ActionItemService } from '../action-items/action-item-service.js';
import type { KpiReportService } from './kpi-report-service.js';
import type { KpiSourceService } from './kpi-source-service.js';
import type { KpiEvidenceService } from './kpi-evidence-service.js';

function targetMetric(definition: KpiDefinition, target: KpiTargetVersion): ExactMetricValue {
  const value =
    definition.valueType === 'MONEY'
      ? target.targetMoneyMinor!.toString()
      : definition.valueType === 'COUNT'
        ? target.targetCount!.toString()
        : target.targetPercentage!.toString();
  return parseExactMetric(definition.valueType, value, definition.unit);
}

export class KpiProgressService {
  constructor(
    private readonly repository: KpiRepository,
    private readonly reports: KpiReportService,
    private readonly sources: KpiSourceService,
    private readonly actionItems: ActionItemService,
    private readonly evidence?: KpiEvidenceService,
  ) {}

  async current(input: {
    tenantId: string;
    membershipId: string;
    businessDate: string;
    correlationId: string;
  }) {
    const { report, assignment, policy } = await this.reports.ensureDailyReport(
      input.tenantId,
      input.membershipId,
      input.businessDate,
    );
    const definitions = (await this.repository.listDefinitions(input.tenantId, 200)).filter(
      (definition) => definition.status === 'ACTIVE',
    );
    const targets = await this.repository.listEffectiveTargets(input.tenantId, report.closedAt);
    const mappings = await this.repository.listEffectiveMappings(input.tenantId, report.closedAt);
    const revision = report.currentRevisionId
      ? await this.repository.getReportRevision(input.tenantId, report.currentRevisionId)
      : null;
    const submission = revision
      ? await this.repository.getFormSubmission(input.tenantId, revision.formSubmissionId)
      : null;
    await this.actionItems.projectKpiReport({
      tenantId: input.tenantId,
      membershipId: input.membershipId,
      branchId: report.branchId,
      departmentId: assignment.departmentId,
      businessDate: report.businessDate,
      reportId: report.id,
      submitted: Boolean(revision),
      deadlineAt: report.closedAt,
      sourceFreshnessAt: revision?.submittedAt ?? report.openedAt,
      correlationId: input.correlationId,
      eventId: revision?.id ?? report.id,
    });
    const items = [];
    for (const definition of definitions) {
      const candidateRows = targets.filter(
        (target) =>
          target.kpiDefinitionId === definition.id &&
          (target.scopeType === 'TENANT' ||
            (target.scopeType === 'BRANCH' && target.scopeId === report.branchId) ||
            (target.scopeType === 'DEPARTMENT' && target.scopeId === assignment.departmentId) ||
            (target.scopeType === 'MEMBERSHIP' && target.scopeId === input.membershipId)),
      );
      const chosen = resolveTarget(candidateRows as TargetCandidate[], report.closedAt);
      if (!chosen) continue;
      const target = candidateRows.find((row) => row.id === chosen.id)!;
      const mapping = mappings.find((item) => item.kpiDefinitionId === definition.id) ?? null;
      const source = mapping
        ? await this.sources.read({
            tenantId: input.tenantId,
            membershipId: input.membershipId,
            branchId: report.branchId,
            businessDate: input.businessDate,
            kpiCode: definition.code,
            mapping,
            submission,
          })
        : null;
      const targetValue = targetMetric(definition, target);
      let actual: ExactMetricValue | null = null;
      let sourceStatus: 'FRESH' | 'MISSING' | 'ERROR' = 'MISSING';
      if (source) {
        try {
          actual = parseExactMetric(definition.valueType, source.value, definition.unit);
          sourceStatus = 'FRESH';
        } catch {
          sourceStatus = 'ERROR';
        }
      }
      const progress = calculateProgress(targetValue, actual, definition.direction);
      const item = {
        kpiDefinitionId: definition.id,
        code: definition.code,
        name: definition.name,
        target: { value: serializeExactMetric(targetValue), unit: definition.unit },
        actual: actual ? { value: serializeExactMetric(actual), unit: definition.unit } : null,
        remaining: { value: serializeExactMetric(progress.remaining), unit: definition.unit },
        passed: progress.passed,
        required: target.required,
        sourceStatus,
        sourceObservedAt: source?.observedAt ?? null,
        deadlineAt: report.closedAt,
        deepLink: `adsup://kpi/reports/${input.businessDate}`,
      };
      items.push(item);
      let calculationEventId: string | undefined;
      if (mapping) {
        const calculation = await this.repository.createCalculation({
          tenantId: input.tenantId,
          reportId: report.id,
          reportRevisionId: revision?.id,
          kpiDefinitionId: definition.id,
          targetVersionId: target.id,
          mappingVersionId: mapping.id,
          targetValue: item.target.value,
          actualValue: item.actual?.value,
          remainingValue: item.remaining.value,
          unit: definition.unit,
          passed: progress.passed,
          sourceType: source?.sourceType ?? 'MISSING',
          sourceId: source?.sourceId,
          sourceObservedAt: source?.observedAt,
          inputDigest: kpiDigest({
            targetId: target.id,
            mappingId: mapping.id,
            sourceDigest: source?.inputDigest ?? 'missing',
          }),
        });
        calculationEventId = calculation.id;
      }
      await this.actionItems.projectKpiShortfall({
        tenantId: input.tenantId,
        membershipId: input.membershipId,
        branchId: report.branchId,
        departmentId: assignment.departmentId,
        businessDate: report.businessDate,
        reportId: report.id,
        kpiDefinitionId: definition.id,
        definitionName: definition.name,
        target: item.target.value,
        actual: item.actual?.value ?? null,
        remaining: item.remaining.value,
        unit: item.remaining.unit,
        deadlineAt: report.closedAt,
        sourceFreshnessAt: source?.observedAt ?? revision?.submittedAt ?? report.openedAt,
        passed: !target.required || progress.passed,
        correlationId: input.correlationId,
        eventId: calculationEventId,
      });
    }
    const evidenceDebt = this.evidence
      ? await this.evidence.ensureForReport({
          tenantId: input.tenantId,
          membershipId: input.membershipId,
          reportId: report.id,
          policyVersionId: policy.id,
          evidenceEnabled: policy.evidenceEnabled,
          graceSeconds: policy.evidenceGraceSeconds,
          kpisRequiringEvidence: mappings.filter((mapping) => mapping.requiresEvidence).length,
          formHasRevenue: items.some(
            (item) => item.code === 'DAILY_REVENUE' && item.actual !== null,
          ),
          baseAt: revision?.submittedAt ?? report.closedAt,
          correlationId: input.correlationId,
        })
      : null;
    return {
      businessDate: input.businessDate,
      reportStatus: report.status,
      openedAt: report.openedAt,
      closedAt: report.closedAt,
      items,
      evidenceDebt,
    };
  }
}
