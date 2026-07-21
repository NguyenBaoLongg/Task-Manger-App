import {
  ProblemError,
  kpiDigest,
  serializeExactMetric,
  type ExactMetricValue,
} from '@adsup/domain';
import type { DatabaseClient } from './client.js';
import type { Prisma } from './generated/prisma/client.js';
import {
  decodeOrdinalCursor,
  decodeTimeCursor,
  encodeOrdinalCursor,
  encodeTimeCursor,
} from './cursor.js';

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

function typedTarget(value: ExactMetricValue) {
  return {
    targetMoneyMinor: value.valueType === 'MONEY' ? value.atomic : null,
    targetCount: value.valueType === 'COUNT' ? value.atomic : null,
    targetPercentage: value.valueType === 'PERCENTAGE' ? serializeExactMetric(value) : null,
  };
}

export class KpiRepository {
  constructor(private readonly db: DatabaseClient) {}

  listDefinitions(tenantId: string, take = 100) {
    return this.db.kpiDefinition.findMany({
      where: { tenantId },
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
      take: Math.min(Math.max(take, 1), 200),
    });
  }

  getDefinition(tenantId: string, id: string) {
    return this.db.kpiDefinition.findUnique({ where: { tenantId_id: { tenantId, id } } });
  }

  createDefinition(input: {
    tenantId: string;
    code: string;
    name: string;
    description?: string;
    valueType: 'MONEY' | 'COUNT' | 'PERCENTAGE';
    unit: string;
    direction: 'AT_LEAST' | 'AT_MOST';
    sourceType: 'FORM_FIELD' | 'DOMAIN_ADAPTER';
    actorMembershipId: string;
    reason: string;
    correlationId: string;
  }) {
    return this.db.$transaction(async (tx) => {
      const definition = await tx.kpiDefinition.create({
        data: {
          tenantId: input.tenantId,
          code: input.code,
          name: input.name,
          description: input.description,
          valueType: input.valueType,
          unit: input.unit,
          direction: input.direction,
          sourceType: input.sourceType,
          createdByMembershipId: input.actorMembershipId,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.actorMembershipId,
          correlationId: input.correlationId,
          eventType: 'KPI_DEFINITION_CREATED',
          targetType: 'KPI_DEFINITION',
          targetId: definition.id,
          reason: input.reason,
          afterRedacted: {
            code: definition.code,
            valueType: definition.valueType,
            unit: definition.unit,
          },
        },
      });
      await tx.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          aggregateType: 'KPI_DEFINITION',
          aggregateId: definition.id,
          eventType: 'kpi.definition.created',
          dedupeKey: `kpi-definition:${definition.id}`,
          payloadRedacted: { definitionId: definition.id },
          correlationId: input.correlationId,
        },
      });
      return definition;
    });
  }

  createTargetVersion(input: {
    tenantId: string;
    kpiDefinitionId: string;
    scopeType: 'TENANT' | 'BRANCH' | 'DEPARTMENT' | 'GROUP' | 'MEMBERSHIP';
    scopeId?: string | null;
    target: ExactMetricValue;
    required: boolean;
    effectiveFrom: Date;
    effectiveTo?: Date | null;
    actorMembershipId: string;
    reason: string;
    correlationId: string;
  }) {
    return this.db.$transaction(async (tx) => {
      const definition = await tx.kpiDefinition.findUnique({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.kpiDefinitionId } },
      });
      if (!definition || definition.status !== 'ACTIVE') {
        throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy KPI.');
      }
      if (
        definition.valueType !== input.target.valueType ||
        definition.unit !== input.target.unit
      ) {
        throw new ProblemError(422, 'VALIDATION_FAILED', 'Target không đúng loại hoặc đơn vị KPI.');
      }
      const overlapping = await tx.kpiTargetVersion.findFirst({
        where: {
          tenantId: input.tenantId,
          kpiDefinitionId: input.kpiDefinitionId,
          scopeType: input.scopeType,
          scopeId: input.scopeId ?? null,
          effectiveFrom: { lt: input.effectiveTo ?? new Date('9999-12-31T00:00:00Z') },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveFrom } }],
        },
      });
      if (overlapping) throw new ProblemError(409, 'CONFLICT', 'Khoảng target bị chồng lấp.');
      const latest = await tx.kpiTargetVersion.findFirst({
        where: {
          tenantId: input.tenantId,
          kpiDefinitionId: input.kpiDefinitionId,
          scopeType: input.scopeType,
          scopeId: input.scopeId ?? null,
        },
        orderBy: { versionNumber: 'desc' },
      });
      const target = await tx.kpiTargetVersion.create({
        data: {
          tenantId: input.tenantId,
          kpiDefinitionId: input.kpiDefinitionId,
          scopeType: input.scopeType,
          scopeId: input.scopeId,
          ...typedTarget(input.target),
          required: input.required,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: input.effectiveTo,
          versionNumber: (latest?.versionNumber ?? 0) + 1,
          createdByMembershipId: input.actorMembershipId,
          reason: input.reason,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.actorMembershipId,
          correlationId: input.correlationId,
          eventType: 'KPI_TARGET_VERSION_CREATED',
          targetType: 'KPI_TARGET_VERSION',
          targetId: target.id,
          reason: input.reason,
          beforeRedacted: latest
            ? { id: latest.id, versionNumber: latest.versionNumber }
            : undefined,
          afterRedacted: {
            id: target.id,
            versionNumber: target.versionNumber,
            scopeType: target.scopeType,
          },
        },
      });
      await tx.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          aggregateType: 'KPI_TARGET_VERSION',
          aggregateId: target.id,
          eventType: 'kpi.target.version-created',
          dedupeKey: `kpi-target:${target.id}`,
          payloadRedacted: { targetVersionId: target.id },
          correlationId: input.correlationId,
        },
      });
      return target;
    });
  }

  createSourceMappingVersion(input: {
    tenantId: string;
    kpiDefinitionId: string;
    sourceType: 'FORM_FIELD' | 'DOMAIN_ADAPTER';
    formTemplateId?: string | null;
    formVersionId?: string | null;
    jsonPointer?: string | null;
    adapterCode?: string | null;
    aggregation: string;
    requiresEvidence: boolean;
    effectiveFrom: Date;
    effectiveTo?: Date | null;
    actorMembershipId: string;
    reason: string;
    correlationId: string;
  }) {
    return this.db.$transaction(async (tx) => {
      const definition = await tx.kpiDefinition.findUnique({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.kpiDefinitionId } },
      });
      if (!definition) throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy KPI.');
      if (input.formVersionId) {
        const version = await tx.formVersion.findUnique({
          where: { tenantId_id: { tenantId: input.tenantId, id: input.formVersionId } },
        });
        if (
          !version ||
          version.formTemplateId !== input.formTemplateId ||
          version.status !== 'PUBLISHED'
        ) {
          throw new ProblemError(422, 'VALIDATION_FAILED', 'Phiên bản form nguồn không hợp lệ.');
        }
      }
      const overlapping = await tx.kpiSourceMappingVersion.findFirst({
        where: {
          tenantId: input.tenantId,
          kpiDefinitionId: input.kpiDefinitionId,
          sourceType: input.sourceType,
          effectiveFrom: {
            lt: input.effectiveTo ?? new Date('9999-12-31T00:00:00Z'),
          },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveFrom } }],
        },
      });
      if (overlapping) {
        throw new ProblemError(409, 'CONFLICT', 'Khoảng source mapping bị chồng lấp.');
      }
      const latest = await tx.kpiSourceMappingVersion.findFirst({
        where: {
          tenantId: input.tenantId,
          kpiDefinitionId: input.kpiDefinitionId,
          sourceType: input.sourceType,
        },
        orderBy: { versionNumber: 'desc' },
      });
      const mapping = await tx.kpiSourceMappingVersion.create({
        data: {
          tenantId: input.tenantId,
          kpiDefinitionId: input.kpiDefinitionId,
          sourceType: input.sourceType,
          formTemplateId: input.formTemplateId,
          formVersionId: input.formVersionId,
          jsonPointer: input.jsonPointer,
          adapterCode: input.adapterCode,
          aggregation: input.aggregation,
          requiresEvidence: input.requiresEvidence,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: input.effectiveTo,
          versionNumber: (latest?.versionNumber ?? 0) + 1,
          createdByMembershipId: input.actorMembershipId,
          reason: input.reason,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.actorMembershipId,
          correlationId: input.correlationId,
          eventType: 'KPI_SOURCE_MAPPING_VERSION_CREATED',
          targetType: 'KPI_SOURCE_MAPPING_VERSION',
          targetId: mapping.id,
          reason: input.reason,
          afterRedacted: { sourceType: mapping.sourceType, versionNumber: mapping.versionNumber },
        },
      });
      await tx.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          aggregateType: 'KPI_SOURCE_MAPPING_VERSION',
          aggregateId: mapping.id,
          eventType: 'kpi.source-mapping.version-created',
          dedupeKey: `kpi-source-mapping:${mapping.id}`,
          payloadRedacted: {
            mappingVersionId: mapping.id,
            kpiDefinitionId: mapping.kpiDefinitionId,
            sourceType: mapping.sourceType,
          },
          correlationId: input.correlationId,
        },
      });
      return mapping;
    });
  }

  bulkCreatePolicyVersions(input: {
    tenantId: string;
    scope: 'TENANT' | 'BRANCHES';
    branchIds: string[];
    effectiveFromDate: Date;
    effectiveToDate?: Date | null;
    timezone: string;
    reportOpenLocal: string;
    reportCloseLocal: string;
    evaluationLocal: string;
    failurePenaltyMinor: bigint;
    kpiDefinitionIds: string[];
    membershipScope: Record<string, unknown>;
    exemptionRule: Record<string, unknown>;
    evidenceEnabled: boolean;
    evidenceGraceSeconds: number;
    photoPenaltyMinor?: bigint | null;
    actorMembershipId: string;
    reason: string;
    correlationId: string;
  }) {
    return this.db.$transaction(async (tx) => {
      if (input.scope === 'BRANCHES') {
        const branches = await tx.branch.findMany({
          where: { tenantId: input.tenantId, id: { in: input.branchIds }, status: 'ACTIVE' },
          select: { id: true },
        });
        if (branches.length !== input.branchIds.length) {
          throw new ProblemError(
            404,
            'RESOURCE_NOT_FOUND',
            'Có cơ sở không thuộc tenant hoặc không hoạt động.',
          );
        }
      }
      const scopes = input.scope === 'TENANT' ? [null] : input.branchIds;
      const results = [];
      for (const branchId of scopes) {
        const scopeType = branchId ? 'BRANCH' : 'TENANT';
        const overlap = await tx.dailyKpiPolicyVersion.findFirst({
          where: {
            tenantId: input.tenantId,
            scopeType,
            branchId,
            effectiveFromDate: { lte: input.effectiveToDate ?? new Date('9999-12-31T00:00:00Z') },
            OR: [{ effectiveToDate: null }, { effectiveToDate: { gte: input.effectiveFromDate } }],
          },
        });
        if (overlap) throw new ProblemError(409, 'CONFLICT', 'Khoảng policy bị chồng lấp.');
        const latest = await tx.dailyKpiPolicyVersion.findFirst({
          where: { tenantId: input.tenantId, scopeType, branchId },
          orderBy: { versionNumber: 'desc' },
        });
        const policy = await tx.dailyKpiPolicyVersion.create({
          data: {
            tenantId: input.tenantId,
            scopeType,
            branchId,
            versionNumber: (latest?.versionNumber ?? 0) + 1,
            effectiveFromDate: input.effectiveFromDate,
            effectiveToDate: input.effectiveToDate,
            timezone: input.timezone,
            reportOpenLocal: input.reportOpenLocal,
            reportCloseLocal: input.reportCloseLocal,
            evaluationLocal: input.evaluationLocal,
            failurePenaltyMinor: input.failurePenaltyMinor,
            currency: 'VND',
            kpiScopeJson: { kpiDefinitionIds: input.kpiDefinitionIds },
            membershipScopeJson: input.membershipScope as Prisma.InputJsonValue,
            exemptionRuleJson: input.exemptionRule as Prisma.InputJsonValue,
            evidenceEnabled: input.evidenceEnabled,
            evidenceGraceSeconds: input.evidenceGraceSeconds,
            photoPenaltyMinor: input.photoPenaltyMinor,
            createdByMembershipId: input.actorMembershipId,
            reason: input.reason,
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: input.tenantId,
            actorMembershipId: input.actorMembershipId,
            correlationId: input.correlationId,
            eventType: 'DAILY_KPI_POLICY_VERSION_CREATED',
            targetType: 'DAILY_KPI_POLICY_VERSION',
            targetId: policy.id,
            reason: input.reason,
            afterRedacted: { scopeType, branchId, versionNumber: policy.versionNumber },
          },
        });
        await tx.outboxEvent.create({
          data: {
            tenantId: input.tenantId,
            aggregateType: 'DAILY_KPI_POLICY_VERSION',
            aggregateId: policy.id,
            eventType: 'kpi.policy.version-created',
            dedupeKey: `kpi-policy:${policy.id}`,
            payloadRedacted: { policyVersionId: policy.id, branchId },
            correlationId: input.correlationId,
          },
        });
        results.push(policy);
      }
      return results;
    });
  }

  async listPolicyCandidates(tenantId: string, branchId: string, businessDate: string) {
    const date = new Date(`${businessDate}T00:00:00.000Z`);
    const rows = await this.db.dailyKpiPolicyVersion.findMany({
      where: {
        tenantId,
        effectiveFromDate: { lte: date },
        OR: [{ effectiveToDate: null }, { effectiveToDate: { gte: date } }],
        AND: [{ OR: [{ scopeType: 'TENANT' }, { scopeType: 'BRANCH', branchId }] }],
      },
    });
    return rows.map((row) => ({
      ...row,
      effectiveFromDate: dateOnly(row.effectiveFromDate),
      effectiveToDate: row.effectiveToDate ? dateOnly(row.effectiveToDate) : null,
    }));
  }

  listEffectiveAssignments(tenantId: string, membershipId: string, instant: Date) {
    return this.db.assignment.findMany({
      where: {
        tenantId,
        membershipId,
        status: 'ACTIVE',
        effectiveFrom: { lte: instant },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: instant } }],
      },
      orderBy: [{ effectiveFrom: 'desc' }, { id: 'asc' }],
    });
  }

  getFormSubmission(tenantId: string, id: string) {
    return this.db.formSubmission.findUnique({ where: { tenantId_id: { tenantId, id } } });
  }

  getTenant(tenantId: string) {
    return this.db.tenant.findUnique({ where: { id: tenantId } });
  }

  ensureReport(input: {
    tenantId: string;
    membershipId: string;
    branchId: string;
    businessDate: Date;
    policyVersionId: string;
    openedAt: Date;
    closedAt: Date;
    evaluationAt: Date;
  }) {
    return this.db.dailyKpiReport.upsert({
      where: {
        tenantId_membershipId_businessDate: {
          tenantId: input.tenantId,
          membershipId: input.membershipId,
          businessDate: input.businessDate,
        },
      },
      update: {},
      create: input,
    });
  }

  async appendReportRevision(input: {
    tenantId: string;
    reportId: string;
    formSubmissionId: string;
    formVersionId: string;
    submittedAt: Date;
    acceptedInWindow: boolean;
    sourceDigest: string;
    actorMembershipId: string;
    correlationId: string;
    reason: string;
  }) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM daily_kpi_reports
          WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.reportId}::uuid
          FOR UPDATE
        `;
      const existing = await tx.dailyKpiReportRevision.findUnique({
        where: {
          tenantId_reportId_formSubmissionId: {
            tenantId: input.tenantId,
            reportId: input.reportId,
            formSubmissionId: input.formSubmissionId,
          },
        },
      });
      if (existing) {
        if (existing.sourceDigest !== input.sourceDigest) {
          throw new ProblemError(
            409,
            'IDEMPOTENCY_KEY_REUSED',
            'Submission đã liên kết với dữ liệu khác.',
          );
        }
        return existing;
      }
      const latest = await tx.dailyKpiReportRevision.findFirst({
        where: { tenantId: input.tenantId, reportId: input.reportId },
        orderBy: { revisionNumber: 'desc' },
      });
      const revision = await tx.dailyKpiReportRevision.create({
        data: {
          tenantId: input.tenantId,
          reportId: input.reportId,
          revisionNumber: (latest?.revisionNumber ?? 0) + 1,
          formSubmissionId: input.formSubmissionId,
          formVersionId: input.formVersionId,
          submittedAt: input.submittedAt,
          acceptedInWindow: input.acceptedInWindow,
          sourceDigest: input.sourceDigest,
          createdByMembershipId: input.actorMembershipId,
        },
      });
      await tx.dailyKpiReport.update({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.reportId } },
        data: input.acceptedInWindow
          ? { currentRevisionId: revision.id, status: 'SUBMITTED' }
          : { status: latest ? undefined : 'LATE' },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.actorMembershipId,
          correlationId: input.correlationId,
          eventType: 'DAILY_KPI_REPORT_REVISION_CREATED',
          targetType: 'DAILY_KPI_REPORT_REVISION',
          targetId: revision.id,
          reason: input.reason,
          afterRedacted: {
            reportId: input.reportId,
            revisionNumber: revision.revisionNumber,
            acceptedInWindow: revision.acceptedInWindow,
          },
        },
      });
      await tx.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          aggregateType: 'DAILY_KPI_REPORT',
          aggregateId: input.reportId,
          eventType: 'kpi.report.revision-created',
          dedupeKey: `kpi-revision:${revision.id}`,
          payloadRedacted: { reportId: input.reportId, revisionId: revision.id },
          correlationId: input.correlationId,
        },
      });
      return revision;
    });
  }

  async listReportRevisions(input: {
    tenantId: string;
    reportId: string;
    cursor?: string;
    take?: number;
  }) {
    const take = Math.min(Math.max(input.take ?? 50, 1), 200);
    const cursor = decodeOrdinalCursor(input.cursor);
    const page = await this.db.dailyKpiReportRevision.findMany({
      where: {
        tenantId: input.tenantId,
        reportId: input.reportId,
        AND: cursor
          ? [
              {
                OR: [
                  { revisionNumber: { lt: cursor.ordinal } },
                  { revisionNumber: cursor.ordinal, id: { lt: cursor.id } },
                ],
              },
            ]
          : undefined,
      },
      orderBy: [{ revisionNumber: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });
    const hasNext = page.length > take;
    const items = page.slice(0, take);
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasNext && last ? encodeOrdinalCursor(last.revisionNumber, last.id) : null,
    };
  }

  getReportByMemberDate(tenantId: string, membershipId: string, businessDate: Date) {
    return this.db.dailyKpiReport.findUnique({
      where: { tenantId_membershipId_businessDate: { tenantId, membershipId, businessDate } },
    });
  }

  getReport(tenantId: string, id: string) {
    return this.db.dailyKpiReport.findUnique({ where: { tenantId_id: { tenantId, id } } });
  }

  getReportRevision(tenantId: string, id: string) {
    return this.db.dailyKpiReportRevision.findUnique({ where: { tenantId_id: { tenantId, id } } });
  }

  listEffectiveTargets(tenantId: string, instant: Date) {
    return this.db.kpiTargetVersion.findMany({
      where: {
        tenantId,
        effectiveFrom: { lte: instant },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: instant } }],
      },
    });
  }

  listEffectiveMappings(tenantId: string, instant: Date) {
    return this.db.kpiSourceMappingVersion.findMany({
      where: {
        tenantId,
        effectiveFrom: { lte: instant },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: instant } }],
      },
      orderBy: [{ versionNumber: 'desc' }, { id: 'desc' }],
    });
  }

  listEffectiveAttendanceSourceMappings(tenantId: string, instant: Date) {
    return this.db.kpiSourceMappingVersion.findMany({
      where: {
        tenantId,
        sourceType: 'DOMAIN_ADAPTER',
        adapterCode: 'ATTENDANCE_ON_TIME_RATE',
        effectiveFrom: { lte: instant },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: instant } }],
      },
      orderBy: [{ versionNumber: 'desc' }, { id: 'desc' }],
    });
  }

  createCalculation(input: {
    tenantId: string;
    reportId: string;
    reportRevisionId?: string | null;
    kpiDefinitionId: string;
    targetVersionId: string;
    mappingVersionId: string;
    targetValue: string;
    actualValue?: string | null;
    remainingValue: string;
    unit: string;
    passed: boolean;
    sourceType: string;
    sourceId?: string | null;
    sourceObservedAt?: Date | null;
    inputDigest?: string;
  }) {
    const inputDigest = input.inputDigest ?? kpiDigest(input);
    return this.db.$transaction(async (tx) => {
      const calculation = await tx.kpiCalculationEvent.upsert({
        where: {
          tenantId_reportId_kpiDefinitionId_inputDigest: {
            tenantId: input.tenantId,
            reportId: input.reportId,
            kpiDefinitionId: input.kpiDefinitionId,
            inputDigest,
          },
        },
        update: {},
        create: { ...input, inputDigest },
      });
      const report = await tx.dailyKpiReport.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.reportId } },
      });
      await tx.outboxEvent.upsert({
        where: {
          tenantId_dedupeKey: {
            tenantId: input.tenantId,
            dedupeKey: `kpi-progress:${calculation.id}`,
          },
        },
        update: {},
        create: {
          tenantId: input.tenantId,
          aggregateType: 'KPI_CALCULATION',
          aggregateId: calculation.id,
          eventType: 'kpi.progress.changed',
          dedupeKey: `kpi-progress:${calculation.id}`,
          payloadRedacted: {
            reportId: input.reportId,
            membershipId: report.membershipId,
            kpiDefinitionId: input.kpiDefinitionId,
            passed: input.passed,
          },
          correlationId: `kpi-calculation:${calculation.id}`,
        },
      });
      return calculation;
    });
  }

  listLatestCalculations(tenantId: string, reportId: string) {
    return this.db.kpiCalculationEvent.findMany({
      where: { tenantId, reportId },
      orderBy: [{ calculatedAt: 'desc' }, { id: 'desc' }],
      distinct: ['kpiDefinitionId'],
    });
  }

  async listCalculationHistory(input: {
    tenantId: string;
    reportId: string;
    kpiDefinitionId?: string;
    cursor?: string;
    take?: number;
  }) {
    const take = Math.min(Math.max(input.take ?? 50, 1), 200);
    const cursor = decodeTimeCursor(input.cursor);
    const page = await this.db.kpiCalculationEvent.findMany({
      where: {
        tenantId: input.tenantId,
        reportId: input.reportId,
        kpiDefinitionId: input.kpiDefinitionId,
        AND: cursor
          ? [
              {
                OR: [
                  { calculatedAt: { lt: cursor.timestamp } },
                  { calculatedAt: cursor.timestamp, id: { lt: cursor.id } },
                ],
              },
            ]
          : undefined,
      },
      orderBy: [{ calculatedAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });
    const items = page.slice(0, take);
    const last = items.at(-1);
    return {
      items,
      nextCursor: page.length > take && last ? encodeTimeCursor(last.calculatedAt, last.id) : null,
    };
  }

  listEvaluations(input: {
    tenantId: string;
    branchId?: string;
    membershipId?: string;
    from?: Date;
    to?: Date;
    status?: 'PASSED' | 'FAILED' | 'EXEMPT';
    cursor?: string;
    take?: number;
  }) {
    const take = Math.min(Math.max(input.take ?? 50, 1), 100);
    const cursor = decodeTimeCursor(input.cursor);
    return this.db.dailyKpiEvaluation
      .findMany({
        where: {
          tenantId: input.tenantId,
          branchId: input.branchId,
          membershipId: input.membershipId,
          businessDate: input.from || input.to ? { gte: input.from, lte: input.to } : undefined,
          status: input.status,
          AND: cursor
            ? [
                {
                  OR: [
                    { businessDate: { lt: cursor.timestamp } },
                    { businessDate: cursor.timestamp, id: { lt: cursor.id } },
                  ],
                },
              ]
            : undefined,
        },
        orderBy: [{ businessDate: 'desc' }, { id: 'desc' }],
        take: take + 1,
      })
      .then((page) => {
        const hasNext = page.length > take;
        const items = page.slice(0, take);
        const last = items.at(-1);
        return {
          items,
          nextCursor: hasNext && last ? encodeTimeCursor(last.businessDate, last.id) : null,
        };
      });
  }

  getPenalty(tenantId: string, id: string) {
    return this.db.penaltyOutcome.findUnique({ where: { tenantId_id: { tenantId, id } } });
  }

  async listPenaltyAdjustments(input: {
    tenantId: string;
    penaltyId: string;
    cursor?: string;
    take?: number;
  }) {
    const take = Math.min(Math.max(input.take ?? 50, 1), 200);
    const cursor = decodeTimeCursor(input.cursor);
    const page = await this.db.penaltyAdjustment.findMany({
      where: {
        tenantId: input.tenantId,
        penaltyOutcomeId: input.penaltyId,
        AND: cursor
          ? [
              {
                OR: [
                  { createdAt: { lt: cursor.timestamp } },
                  { createdAt: cursor.timestamp, id: { lt: cursor.id } },
                ],
              },
            ]
          : undefined,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });
    const items = page.slice(0, take);
    const last = items.at(-1);
    return {
      items,
      nextCursor: page.length > take && last ? encodeTimeCursor(last.createdAt, last.id) : null,
    };
  }

  async createPenaltyAdjustment(input: {
    tenantId: string;
    penaltyId: string;
    deltaMinor: bigint;
    actorMembershipId: string;
    idempotencyKey: string;
    reason: string;
    correlationId: string;
  }) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM penalty_outcomes
          WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.penaltyId}::uuid
          FOR UPDATE
        `;
      const existing = await tx.penaltyAdjustment.findUnique({
        where: {
          tenantId_actorMembershipId_idempotencyKey: {
            tenantId: input.tenantId,
            actorMembershipId: input.actorMembershipId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (existing) {
        if (
          existing.penaltyOutcomeId !== input.penaltyId ||
          existing.deltaMinor !== input.deltaMinor
        ) {
          throw new ProblemError(
            409,
            'IDEMPOTENCY_KEY_REUSED',
            'Khóa đã dùng cho điều chỉnh khác.',
          );
        }
        const penalty = await tx.penaltyOutcome.findUniqueOrThrow({
          where: { tenantId_id: { tenantId: input.tenantId, id: input.penaltyId } },
        });
        const all = await tx.penaltyAdjustment.findMany({
          where: { tenantId: input.tenantId, penaltyOutcomeId: input.penaltyId },
        });
        return {
          adjustment: existing,
          effectiveAmountMinor: all.reduce(
            (sum, item) => sum + item.deltaMinor,
            penalty.amountMinor,
          ),
          replayed: true,
        };
      }
      const penalty = await tx.penaltyOutcome.findUnique({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.penaltyId } },
      });
      if (!penalty) throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy khoản phạt.');
      const current = await tx.penaltyAdjustment.findMany({
        where: { tenantId: input.tenantId, penaltyOutcomeId: input.penaltyId },
      });
      const effective =
        current.reduce((sum, item) => sum + item.deltaMinor, penalty.amountMinor) +
        input.deltaMinor;
      if (input.deltaMinor === 0n || effective < 0n) {
        throw new ProblemError(
          422,
          'BUSINESS_RULE_VIOLATION',
          'Điều chỉnh tiền phạt không hợp lệ.',
        );
      }
      const adjustment = await tx.penaltyAdjustment.create({
        data: {
          tenantId: input.tenantId,
          penaltyOutcomeId: input.penaltyId,
          deltaMinor: input.deltaMinor,
          actorMembershipId: input.actorMembershipId,
          idempotencyKey: input.idempotencyKey,
          reason: input.reason,
          correlationId: input.correlationId,
        },
      });
      if (effective === 0n) {
        await tx.penaltyOutcome.update({
          where: { tenantId_id: { tenantId: input.tenantId, id: input.penaltyId } },
          data: { status: 'FULLY_REVERSED' },
        });
      }
      await tx.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.actorMembershipId,
          correlationId: input.correlationId,
          eventType: 'KPI_PENALTY_ADJUSTED',
          targetType: 'PENALTY_ADJUSTMENT',
          targetId: adjustment.id,
          reason: input.reason,
          beforeRedacted: { effectiveAmountMinor: (effective - input.deltaMinor).toString() },
          afterRedacted: {
            effectiveAmountMinor: effective.toString(),
            deltaMinor: input.deltaMinor.toString(),
          },
        },
      });
      await tx.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          aggregateType: 'PENALTY_ADJUSTMENT',
          aggregateId: adjustment.id,
          eventType: 'kpi.penalty.adjusted',
          dedupeKey: `kpi-adjustment:${adjustment.id}`,
          payloadRedacted: {
            adjustmentId: adjustment.id,
            penaltyId: input.penaltyId,
            membershipId: penalty.membershipId,
          },
          correlationId: input.correlationId,
        },
      });
      return { adjustment, effectiveAmountMinor: effective, replayed: false };
    });
  }

  getClient() {
    return this.db;
  }
}
