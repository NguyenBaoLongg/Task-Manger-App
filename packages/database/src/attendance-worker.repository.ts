import { randomUUID } from 'node:crypto';
import type { DatabaseClient } from './client.js';
import type { Prisma } from './generated/prisma/client.js';

export class AttendanceWorkerRepository {
  constructor(private readonly db: DatabaseClient) {}

  ensureDayRun(input: {
    tenantId: string;
    jobType: string;
    businessDate: Date;
    correlationId: string;
  }) {
    return this.db.attendanceJobRun.upsert({
      where: {
        tenantId_jobType_businessDate: {
          tenantId: input.tenantId,
          jobType: input.jobType,
          businessDate: input.businessDate,
        },
      },
      update: {},
      create: { ...input, id: randomUUID() },
    });
  }

  ensureMonthRun(input: {
    tenantId: string;
    jobType: string;
    yearMonth: string;
    correlationId: string;
  }) {
    return this.db.attendanceJobRun.upsert({
      where: {
        tenantId_jobType_yearMonth: {
          tenantId: input.tenantId,
          jobType: input.jobType,
          yearMonth: input.yearMonth,
        },
      },
      update: {},
      create: { ...input, id: randomUUID() },
    });
  }

  listPendingVideoAssets(tenantId: string, take = 50) {
    return this.db.checkInVideoAsset.findMany({
      where: {
        tenantId,
        processingState: {
          in: ['REQUESTED', 'UPLOADED', 'VERIFYING', 'CONVERTING', 'FAILED_RETRYABLE'],
        },
      },
      orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }],
      take: Math.min(Math.max(take, 1), 200),
    });
  }

  markVideoConversionReady(input: {
    tenantId: string;
    id: string;
    convertedMediaObjectId?: string;
  }) {
    return this.db.checkInVideoAsset.update({
      where: { tenantId_id: { tenantId: input.tenantId, id: input.id } },
      data: {
        processingState: 'READY',
        convertedMediaObjectId: input.convertedMediaObjectId,
        readyAt: new Date(),
        lastSafeErrorCode: null,
      },
    });
  }

  markVideoConversionFailed(input: { tenantId: string; id: string; safeErrorCode: string }) {
    return this.db.checkInVideoAsset.update({
      where: { tenantId_id: { tenantId: input.tenantId, id: input.id } },
      data: {
        processingState: 'FAILED_RETRYABLE',
        attemptCount: { increment: 1 },
        lastSafeErrorCode: input.safeErrorCode,
      },
    });
  }

  listRetentionCandidates(tenantId: string, now: Date, take = 100) {
    return this.db.mediaObject.findMany({
      where: { tenantId, status: 'READY', retentionUntil: { lte: now }, legalHoldAt: null },
      orderBy: [{ retentionUntil: 'asc' }, { id: 'asc' }],
      take: Math.min(Math.max(take, 1), 500),
    });
  }

  async tombstoneMediaObject(input: {
    tenantId: string;
    mediaObjectId: string;
    deletedByJobRunId?: string | null;
    reason: string;
  }) {
    return this.db.$transaction(async (tx) => {
      const media = await tx.mediaObject.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.mediaObjectId } },
      });
      if (media.legalHoldAt) return null;
      const tombstone = await tx.mediaRetentionTombstone.upsert({
        where: {
          tenantId_storageProvider_bucket_objectKey: {
            tenantId: media.tenantId,
            storageProvider: media.storageProvider,
            bucket: media.bucket,
            objectKey: media.objectKey,
          },
        },
        update: {},
        create: {
          tenantId: media.tenantId,
          mediaObjectId: media.id,
          sourceType: media.sourceType,
          sourceId: media.sourceId,
          purpose: media.purpose,
          storageProvider: media.storageProvider,
          bucket: media.bucket,
          objectKey: media.objectKey,
          checksumSha256: media.checksumSha256,
          byteSize: media.byteSize,
          contentType: media.contentType,
          deletedByJobRunId: input.deletedByJobRunId,
          reason: input.reason,
        },
      });
      await tx.mediaObject.update({
        where: { tenantId_id: { tenantId: media.tenantId, id: media.id } },
        data: { status: 'DELETED', deletedAt: new Date() },
      });
      await tx.outboxEvent.upsert({
        where: {
          tenantId_dedupeKey: {
            tenantId: media.tenantId,
            dedupeKey: `media-retention-tombstone:${tombstone.id}`,
          },
        },
        update: {},
        create: {
          tenantId: media.tenantId,
          aggregateType: 'MEDIA_RETENTION_TOMBSTONE',
          aggregateId: tombstone.id,
          eventType: 'attendance.media-retention.tombstoned',
          dedupeKey: `media-retention-tombstone:${tombstone.id}`,
          payloadRedacted: {
            tombstoneId: tombstone.id,
            mediaObjectId: media.id,
            sourceType: media.sourceType,
            sourceId: media.sourceId,
            purpose: media.purpose,
          },
          correlationId: `media-retention:${media.tenantId}`,
        },
      });
      return tombstone;
    });
  }

  async refreshMonthlyAbsenceSummaries(input: {
    tenantId: string;
    yearMonth: string;
    thresholdDays?: number;
    correlationId?: string;
  }) {
    const start = new Date(`${input.yearMonth}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const thresholdDays = input.thresholdDays ?? 5;
    const requests = await this.db.approvalRequest.findMany({
      where: {
        tenantId: input.tenantId,
        status: 'APPROVED',
        requestType: { in: ['LEAVE_SCHEDULE', 'SUDDEN_LEAVE'] },
        businessDate: { gte: start, lt: end },
      },
      orderBy: [{ requestedByMembershipId: 'asc' }, { submittedAt: 'asc' }],
    });
    const totals = new Map<
      string,
      {
        membershipId: string;
        branchId: string;
        approved: number;
        sudden: number;
      }
    >();
    for (const request of requests) {
      const payload = readLeavePayload(request.payloadJson);
      if (!payload) continue;
      const days = countLeaveDaysWithinMonth(payload, input.yearMonth);
      if (days === 0) continue;
      const key = `${request.requestedByMembershipId}:${request.branchId}`;
      const total = totals.get(key) ?? {
        membershipId: request.requestedByMembershipId,
        branchId: request.branchId,
        approved: 0,
        sudden: 0,
      };
      total.approved += days;
      if (request.requestType === 'SUDDEN_LEAVE') total.sudden += days;
      totals.set(key, total);
    }
    const summaries = [];
    for (const total of totals.values()) {
      summaries.push(
        await this.db.monthlyAbsenceSummary.upsert({
          where: {
            tenantId_membershipId_yearMonth_thresholdDays: {
              tenantId: input.tenantId,
              membershipId: total.membershipId,
              yearMonth: input.yearMonth,
              thresholdDays,
            },
          },
          update: {
            branchId: total.branchId,
            approvedAbsenceDaysDecimal: total.approved,
            suddenLeaveDaysDecimal: total.sudden,
            overThreshold: total.approved > thresholdDays,
          },
          create: {
            tenantId: input.tenantId,
            membershipId: total.membershipId,
            branchId: total.branchId,
            yearMonth: input.yearMonth,
            approvedAbsenceDaysDecimal: total.approved,
            suddenLeaveDaysDecimal: total.sudden,
            thresholdDays,
            overThreshold: total.approved > thresholdDays,
          },
        }),
      );
    }
    return summaries;
  }

  async markMonthlyAbsenceNotified(input: {
    tenantId: string;
    id: string;
    notificationEffectKey: string;
    correlationId?: string;
  }) {
    return this.db.$transaction(async (tx) => {
      const summary = await tx.monthlyAbsenceSummary.update({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.id } },
        data: {
          notifiedManagerAt: new Date(),
          notificationEffectKey: input.notificationEffectKey,
        },
      });
      await tx.outboxEvent.upsert({
        where: {
          tenantId_dedupeKey: {
            tenantId: input.tenantId,
            dedupeKey: input.notificationEffectKey,
          },
        },
        update: {},
        create: {
          tenantId: input.tenantId,
          aggregateType: 'MONTHLY_ABSENCE_SUMMARY',
          aggregateId: summary.id,
          eventType: 'attendance.monthly-absence.threshold-crossed',
          dedupeKey: input.notificationEffectKey,
          payloadRedacted: {
            summaryId: summary.id,
            membershipId: summary.membershipId,
            branchId: summary.branchId,
            yearMonth: summary.yearMonth,
            approvedAbsenceDays: summary.approvedAbsenceDaysDecimal.toString(),
          },
          correlationId: input.correlationId ?? `monthly-absence:${summary.yearMonth}`,
        },
      });
      return summary;
    });
  }

  getClient() {
    return this.db;
  }
}

interface LeavePayload {
  durationKind: 'FULL_DAY' | 'MORNING_HALF' | 'DATE_RANGE';
  startDate: string;
  endDate: string;
}

function readLeavePayload(value: Prisma.JsonValue): LeavePayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  if (
    !['FULL_DAY', 'MORNING_HALF', 'DATE_RANGE'].includes(String(payload.durationKind)) ||
    typeof payload.startDate !== 'string' ||
    typeof payload.endDate !== 'string'
  ) {
    return null;
  }
  return {
    durationKind: payload.durationKind as LeavePayload['durationKind'],
    startDate: payload.startDate,
    endDate: payload.endDate,
  };
}

function countLeaveDaysWithinMonth(payload: LeavePayload, yearMonth: string): number {
  const start = new Date(`${payload.startDate}T00:00:00.000Z`);
  const end = new Date(`${payload.endDate}T00:00:00.000Z`);
  let total = 0;
  for (let cursor = start; cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (cursor.toISOString().slice(0, 7) === yearMonth) {
      total += payload.durationKind === 'MORNING_HALF' ? 0.5 : 1;
    }
  }
  return total;
}
