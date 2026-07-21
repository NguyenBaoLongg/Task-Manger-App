import type { DatabaseClient } from './client.js';

export class KpiEvidenceRepository {
  constructor(private readonly db: DatabaseClient) {}

  getDebt(tenantId: string, id: string) {
    return this.db.evidenceDebt.findUnique({ where: { tenantId_id: { tenantId, id } } });
  }

  getDebtByReport(tenantId: string, reportId: string) {
    return this.db.evidenceDebt.findUnique({
      where: { tenantId_reportId: { tenantId, reportId } },
    });
  }

  ensureDebt(input: {
    tenantId: string;
    reportId: string;
    policyVersionId: string;
    requiredCount: number;
    deadlineAt: Date;
    actorMembershipId?: string;
    correlationId?: string;
  }) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM daily_kpi_reports
        WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.reportId}::uuid
        FOR UPDATE
      `;
      const existing = await tx.evidenceDebt.findUnique({
        where: {
          tenantId_reportId: { tenantId: input.tenantId, reportId: input.reportId },
        },
      });
      if (existing) return existing;
      const report = await tx.dailyKpiReport.findUnique({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.reportId } },
      });
      if (!report) throw new Error('EVIDENCE_REPORT_NOT_FOUND');
      const debt = await tx.evidenceDebt.create({
        data: {
          tenantId: input.tenantId,
          reportId: input.reportId,
          policyVersionId: input.policyVersionId,
          requiredCount: input.requiredCount,
          deadlineAt: input.deadlineAt,
        },
      });
      const correlationId = input.correlationId ?? `evidence-debt:${debt.id}`;
      await tx.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.actorMembershipId,
          correlationId,
          eventType: 'EVIDENCE_DEBT_CREATED',
          targetType: 'EVIDENCE_DEBT',
          targetId: debt.id,
          reason: 'EVIDENCE_POLICY_REQUIRED',
          afterRedacted: {
            reportId: debt.reportId,
            requiredCount: debt.requiredCount,
            deadlineAt: debt.deadlineAt.toISOString(),
          },
        },
      });
      await tx.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          aggregateType: 'EVIDENCE_DEBT',
          aggregateId: debt.id,
          eventType: 'kpi.evidence.debt-created',
          dedupeKey: `evidence-debt:${debt.id}:created`,
          payloadRedacted: { debtId: debt.id, membershipId: report.membershipId },
          correlationId,
        },
      });
      return debt;
    });
  }

  async refreshDebt(input: { tenantId: string; debtId: string; now: Date }) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM evidence_debts
        WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.debtId}::uuid
        FOR UPDATE
      `;
      const debt = await tx.evidenceDebt.findUnique({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.debtId } },
      });
      if (!debt) return null;
      const report = await tx.dailyKpiReport.findUnique({
        where: { tenantId_id: { tenantId: input.tenantId, id: debt.reportId } },
      });
      if (!report) return null;
      const receivedCount = await tx.mediaObject.count({
        where: {
          tenantId: input.tenantId,
          ownerMembershipId: report.membershipId,
          sourceType: 'DAILY_KPI_REPORT',
          sourceId: report.id,
          purpose: 'FORM_EVIDENCE',
          status: 'READY',
          deletedAt: null,
        },
      });
      const nextState =
        debt.state !== 'WAITING_PHOTOS'
          ? debt.state
          : receivedCount >= debt.requiredCount
            ? 'SATISFIED'
            : input.now >= debt.deadlineAt
              ? 'OVERDUE'
              : 'WAITING_PHOTOS';
      if (nextState === debt.state && receivedCount === debt.receivedCount) {
        return { debt, report };
      }
      const updated = await tx.evidenceDebt.update({
        where: { tenantId_id: { tenantId: input.tenantId, id: debt.id } },
        data: {
          receivedCount,
          state: nextState,
          stateVersion: { increment: 1 },
          finalizedAt: nextState === 'SATISFIED' || nextState === 'OVERDUE' ? input.now : undefined,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          correlationId: `evidence-debt:${debt.id}`,
          eventType: 'EVIDENCE_DEBT_REFRESHED',
          targetType: 'EVIDENCE_DEBT',
          targetId: debt.id,
          reason: nextState === debt.state ? 'READY_MEDIA_COUNT_CHANGED' : `STATE_${nextState}`,
          beforeRedacted: {
            state: debt.state,
            receivedCount: debt.receivedCount,
            stateVersion: debt.stateVersion,
          },
          afterRedacted: {
            state: updated.state,
            receivedCount: updated.receivedCount,
            stateVersion: updated.stateVersion,
          },
        },
      });
      if (nextState !== debt.state || receivedCount !== debt.receivedCount) {
        await tx.outboxEvent.upsert({
          where: {
            tenantId_dedupeKey: {
              tenantId: input.tenantId,
              dedupeKey: `evidence-debt:${debt.id}:v${updated.stateVersion}`,
            },
          },
          update: {},
          create: {
            tenantId: input.tenantId,
            aggregateType: 'EVIDENCE_DEBT',
            aggregateId: debt.id,
            eventType:
              nextState === 'SATISFIED'
                ? 'kpi.evidence.satisfied'
                : nextState === 'OVERDUE'
                  ? 'kpi.evidence.overdue'
                  : 'kpi.evidence.progress',
            dedupeKey: `evidence-debt:${debt.id}:v${updated.stateVersion}`,
            payloadRedacted: {
              debtId: debt.id,
              state: nextState,
              membershipId: report.membershipId,
            },
            correlationId: `evidence-debt:${debt.id}`,
          },
        });
      }
      return { debt: updated, report };
    });
  }

  listDue(tenantId: string, now: Date, take = 200) {
    return this.db.evidenceDebt.findMany({
      where: { tenantId, state: 'WAITING_PHOTOS', deadlineAt: { lte: now } },
      orderBy: [{ deadlineAt: 'asc' }, { id: 'asc' }],
      take: Math.min(Math.max(take, 1), 500),
    });
  }

  listUnreminded(tenantId: string, take = 200) {
    return this.db.evidenceDebt.findMany({
      where: { tenantId, state: 'WAITING_PHOTOS', remindedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: Math.min(Math.max(take, 1), 500),
    });
  }

  async markReminded(input: { tenantId: string; debtId: string; now: Date }) {
    return this.db.$transaction(async (tx) => {
      const claimed = await tx.evidenceDebt.updateMany({
        where: {
          tenantId: input.tenantId,
          id: input.debtId,
          state: 'WAITING_PHOTOS',
          remindedAt: null,
        },
        data: { remindedAt: input.now },
      });
      if (claimed.count !== 1) return false;
      const debt = await tx.evidenceDebt.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.debtId } },
      });
      const report = await tx.dailyKpiReport.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: input.tenantId, id: debt.reportId } },
      });
      await tx.outboxEvent.upsert({
        where: {
          tenantId_dedupeKey: {
            tenantId: input.tenantId,
            dedupeKey: `evidence-debt:${debt.id}:reminder`,
          },
        },
        update: {},
        create: {
          tenantId: input.tenantId,
          aggregateType: 'EVIDENCE_DEBT',
          aggregateId: debt.id,
          eventType: 'kpi.evidence.reminder',
          dedupeKey: `evidence-debt:${debt.id}:reminder`,
          payloadRedacted: {
            debtId: debt.id,
            membershipId: report.membershipId,
            remainingCount: Math.max(0, debt.requiredCount - debt.receivedCount),
          },
          correlationId: `evidence-debt:${debt.id}`,
        },
      });
      return true;
    });
  }

  async assessPhotoPenalty(input: { tenantId: string; debtId: string; now: Date }) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM evidence_debts
        WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.debtId}::uuid
        FOR UPDATE
      `;
      const debt = await tx.evidenceDebt.findUnique({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.debtId } },
      });
      if (!debt || debt.state !== 'OVERDUE') return null;
      if (debt.penaltyOutcomeId) {
        return tx.penaltyOutcome.findUnique({
          where: { tenantId_id: { tenantId: input.tenantId, id: debt.penaltyOutcomeId } },
        });
      }
      const policy = await tx.dailyKpiPolicyVersion.findUnique({
        where: { tenantId_id: { tenantId: input.tenantId, id: debt.policyVersionId } },
      });
      const report = await tx.dailyKpiReport.findUnique({
        where: { tenantId_id: { tenantId: input.tenantId, id: debt.reportId } },
      });
      if (!policy?.photoPenaltyMinor || !report) return null;
      const penalty = await tx.penaltyOutcome.upsert({
        where: {
          tenantId_membershipId_businessDate_kind_sourceKey: {
            tenantId: input.tenantId,
            membershipId: report.membershipId,
            businessDate: report.businessDate,
            kind: 'PHOTO_EVIDENCE',
            sourceKey: debt.id,
          },
        },
        update: {},
        create: {
          tenantId: input.tenantId,
          membershipId: report.membershipId,
          branchId: report.branchId,
          businessDate: report.businessDate,
          policyVersionId: policy.id,
          kind: 'PHOTO_EVIDENCE',
          sourceKey: debt.id,
          amountMinor: policy.photoPenaltyMinor,
          failedDetailsJson: [
            {
              debtId: debt.id,
              requiredCount: debt.requiredCount,
              receivedCount: debt.receivedCount,
            },
          ],
          assessedAt: input.now,
        },
      });
      const linked = await tx.evidenceDebt.updateMany({
        where: { tenantId: input.tenantId, id: debt.id, penaltyOutcomeId: null },
        data: { penaltyOutcomeId: penalty.id },
      });
      if (linked.count === 1) {
        await tx.auditEvent.create({
          data: {
            tenantId: input.tenantId,
            correlationId: `evidence-debt:${debt.id}`,
            eventType: 'PHOTO_EVIDENCE_PENALTY_ASSESSED',
            targetType: 'PENALTY_OUTCOME',
            targetId: penalty.id,
            reason: 'PHOTO_EVIDENCE_DEADLINE_EXPIRED',
            afterRedacted: {
              debtId: debt.id,
              amountMinor: penalty.amountMinor.toString(),
              policyVersionId: policy.id,
            },
          },
        });
        await tx.outboxEvent.upsert({
          where: {
            tenantId_dedupeKey: {
              tenantId: input.tenantId,
              dedupeKey: `photo-penalty:${penalty.id}`,
            },
          },
          update: {},
          create: {
            tenantId: input.tenantId,
            aggregateType: 'PENALTY_OUTCOME',
            aggregateId: penalty.id,
            eventType: 'kpi.photo-penalty.assessed',
            dedupeKey: `photo-penalty:${penalty.id}`,
            payloadRedacted: {
              penaltyId: penalty.id,
              debtId: debt.id,
              membershipId: report.membershipId,
            },
            correlationId: `evidence-debt:${debt.id}`,
          },
        });
      }
      return penalty;
    });
  }
}
