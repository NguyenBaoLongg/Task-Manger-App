import { randomUUID } from 'node:crypto';
import type { DatabaseClient } from './client.js';
import type { Prisma } from './generated/prisma/client.js';

export class KpiWorkerRepository {
  constructor(private readonly db: DatabaseClient) {}

  async ensureRun(input: {
    tenantId: string;
    jobType: string;
    businessDate: Date;
    correlationId: string;
    payloadJson?: Prisma.InputJsonValue;
  }) {
    return this.db.kpiJobRun.upsert({
      where: {
        tenantId_jobType_businessDate: {
          tenantId: input.tenantId,
          jobType: input.jobType,
          businessDate: input.businessDate,
        },
      },
      update: {},
      create: { ...input, payloadJson: input.payloadJson ?? {}, id: randomUUID() },
    });
  }

  listPendingRerunRuns(tenantId: string, now = new Date(), take = 20) {
    return this.db.kpiJobRun.findMany({
      where: {
        tenantId,
        jobType: { startsWith: 'DAILY_KPI_RERUN_' },
        OR: [
          { status: { in: ['PENDING', 'PARTIAL', 'FAILED'] } },
          { status: 'RUNNING', leaseUntil: { lte: now } },
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: Math.min(Math.max(take, 1), 100),
    });
  }

  async claimRun(input: {
    tenantId: string;
    id: string;
    workerId: string;
    now: Date;
    leaseUntil: Date;
  }) {
    const claimed = await this.db.kpiJobRun.updateMany({
      where: {
        tenantId: input.tenantId,
        id: input.id,
        OR: [
          { status: { in: ['PENDING', 'PARTIAL', 'FAILED'] } },
          { status: 'RUNNING', leaseUntil: { lte: input.now } },
        ],
      },
      data: {
        status: 'RUNNING',
        leaseOwner: input.workerId,
        leaseUntil: input.leaseUntil,
        startedAt: input.now,
        attempt: { increment: 1 },
      },
    });
    if (claimed.count !== 1) return null;
    return this.db.kpiJobRun.findUnique({
      where: { tenantId_id: { tenantId: input.tenantId, id: input.id } },
    });
  }

  advanceCheckpoint(input: {
    tenantId: string;
    id: string;
    workerId: string;
    checkpoint: string;
    leaseUntil: Date;
  }) {
    return this.db.kpiJobRun.updateMany({
      where: {
        tenantId: input.tenantId,
        id: input.id,
        status: 'RUNNING',
        leaseOwner: input.workerId,
      },
      data: { checkpoint: input.checkpoint, leaseUntil: input.leaseUntil },
    });
  }

  completeRun(input: { tenantId: string; id: string; workerId: string; completedAt: Date }) {
    return this.db.kpiJobRun.updateMany({
      where: {
        tenantId: input.tenantId,
        id: input.id,
        status: 'RUNNING',
        leaseOwner: input.workerId,
      },
      data: {
        status: 'COMPLETED',
        completedAt: input.completedAt,
        leaseOwner: null,
        leaseUntil: null,
      },
    });
  }

  failRun(input: {
    tenantId: string;
    id: string;
    workerId: string;
    code: string;
    partial: boolean;
  }) {
    return this.db.kpiJobRun.updateMany({
      where: {
        tenantId: input.tenantId,
        id: input.id,
        status: 'RUNNING',
        leaseOwner: input.workerId,
      },
      data: {
        status: input.partial ? 'PARTIAL' : 'FAILED',
        safeErrorCode: input.code,
        errorCount: { increment: 1 },
        leaseOwner: null,
        leaseUntil: null,
      },
    });
  }

  async listCandidateMemberships(
    tenantId: string,
    afterMembershipId?: string,
    take = 200,
    scope?: { membershipIds?: string[]; branchIds?: string[]; businessDate?: Date },
  ) {
    let membershipIds = scope?.membershipIds;
    if (scope?.branchIds?.length) {
      const businessInstant = scope.businessDate
        ? new Date(`${scope.businessDate.toISOString().slice(0, 10)}T12:00:00.000Z`)
        : new Date();
      const assigned = await this.db.assignment.findMany({
        where: {
          tenantId,
          branchId: { in: scope.branchIds },
          status: 'ACTIVE',
          effectiveFrom: { lte: businessInstant },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: businessInstant } }],
        },
        select: { membershipId: true },
        distinct: ['membershipId'],
      });
      const branchMembershipIds = new Set(assigned.map((item) => item.membershipId));
      membershipIds = membershipIds?.length
        ? membershipIds.filter((id) => branchMembershipIds.has(id))
        : [...branchMembershipIds];
    }
    if (membershipIds && membershipIds.length === 0) return [];
    return this.db.tenantMembership.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        id: {
          gt: afterMembershipId,
          in: membershipIds,
        },
      },
      orderBy: { id: 'asc' },
      take: Math.min(Math.max(take, 1), 500),
    });
  }

  async closeEvaluation(input: {
    tenantId: string;
    reportId: string;
    membershipId: string;
    branchId: string;
    businessDate: Date;
    policyVersionId: string;
    reportRevisionId?: string | null;
    status: 'PASSED' | 'FAILED' | 'EXEMPT';
    failedDetails: unknown[];
    exemptionSource?: string | null;
    evaluatedAt: Date;
    jobRunId: string;
    penaltyMinor: bigint;
    correlationId: string;
  }) {
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM daily_kpi_reports
          WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.reportId}::uuid
          FOR UPDATE
        `;
        const existing = await tx.dailyKpiEvaluation.findUnique({
          where: {
            tenantId_membershipId_businessDate: {
              tenantId: input.tenantId,
              membershipId: input.membershipId,
              businessDate: input.businessDate,
            },
          },
        });
        if (existing) {
          const penalty = await tx.penaltyOutcome.findUnique({
            where: {
              tenantId_membershipId_businessDate_kind_sourceKey: {
                tenantId: input.tenantId,
                membershipId: input.membershipId,
                businessDate: input.businessDate,
                kind: 'DAILY_KPI',
                sourceKey: '',
              },
            },
          });
          return { evaluation: existing, penalty, replayed: true };
        }
        const evaluation = await tx.dailyKpiEvaluation.create({
          data: {
            tenantId: input.tenantId,
            reportId: input.reportId,
            membershipId: input.membershipId,
            branchId: input.branchId,
            businessDate: input.businessDate,
            policyVersionId: input.policyVersionId,
            reportRevisionId: input.reportRevisionId,
            status: input.status,
            failedDetailsJson: input.failedDetails as Prisma.InputJsonValue,
            exemptionSource: input.exemptionSource,
            evaluatedAt: input.evaluatedAt,
            jobRunId: input.jobRunId,
          },
        });
        const penalty =
          input.status === 'FAILED' && input.penaltyMinor > 0n
            ? await tx.penaltyOutcome.create({
                data: {
                  tenantId: input.tenantId,
                  evaluationId: evaluation.id,
                  membershipId: input.membershipId,
                  branchId: input.branchId,
                  businessDate: input.businessDate,
                  policyVersionId: input.policyVersionId,
                  kind: 'DAILY_KPI',
                  sourceKey: '',
                  amountMinor: input.penaltyMinor,
                  failedDetailsJson: input.failedDetails as Prisma.InputJsonValue,
                  assessedAt: input.evaluatedAt,
                },
              })
            : null;
        await tx.dailyKpiReport.update({
          where: { tenantId_id: { tenantId: input.tenantId, id: input.reportId } },
          data: { status: 'CLOSED' },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: input.tenantId,
            correlationId: input.correlationId,
            eventType: 'DAILY_KPI_EVALUATION_CLOSED',
            targetType: 'DAILY_KPI_EVALUATION',
            targetId: evaluation.id,
            reason: 'DAILY_KPI_CLOSE_JOB',
            afterRedacted: {
              membershipId: input.membershipId,
              businessDate: input.businessDate.toISOString().slice(0, 10),
              status: input.status,
              policyVersionId: input.policyVersionId,
              penaltyId: penalty?.id,
            },
          },
        });
        await tx.outboxEvent.create({
          data: {
            tenantId: input.tenantId,
            aggregateType: 'DAILY_KPI_EVALUATION',
            aggregateId: evaluation.id,
            eventType: 'kpi.evaluation.closed',
            dedupeKey: `kpi-evaluation:${evaluation.id}`,
            payloadRedacted: { evaluationId: evaluation.id, status: evaluation.status },
            correlationId: input.correlationId,
          },
        });
        if (penalty) {
          await tx.outboxEvent.create({
            data: {
              tenantId: input.tenantId,
              aggregateType: 'PENALTY_OUTCOME',
              aggregateId: penalty.id,
              eventType: 'kpi.penalty.assessed',
              dedupeKey: `kpi-penalty:${penalty.id}`,
              payloadRedacted: { penaltyId: penalty.id, membershipId: input.membershipId },
              correlationId: input.correlationId,
            },
          });
        }
        return { evaluation, penalty, replayed: false };
      },
      { maxWait: 15_000, timeout: 30_000 },
    );
  }

  getClient() {
    return this.db;
  }
}
