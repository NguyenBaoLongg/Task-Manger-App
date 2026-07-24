import { randomUUID } from 'node:crypto';
import type { DatabaseClient } from './client.js';
import type { Prisma } from './generated/prisma/client.js';
import type { CheckInReminderMessage, PendingCheckInReminderRecipient } from '@adsup/domain';

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

  async claimDayRun(input: {
    tenantId: string;
    jobType: string;
    businessDate: Date;
    correlationId: string;
    leaseOwner: string;
    now: Date;
    leaseDurationMs?: number;
  }) {
    const run = await this.ensureDayRun(input);
    return this.claimRun({
      tenantId: input.tenantId,
      runId: run.id,
      leaseOwner: input.leaseOwner,
      now: input.now,
      leaseDurationMs: input.leaseDurationMs,
    });
  }

  async claimMonthRun(input: {
    tenantId: string;
    jobType: string;
    yearMonth: string;
    correlationId: string;
    leaseOwner: string;
    now: Date;
    leaseDurationMs?: number;
  }) {
    const run = await this.ensureMonthRun(input);
    return this.claimRun({
      tenantId: input.tenantId,
      runId: run.id,
      leaseOwner: input.leaseOwner,
      now: input.now,
      leaseDurationMs: input.leaseDurationMs,
    });
  }

  async heartbeatRun(input: {
    tenantId: string;
    runId: string;
    leaseOwner: string;
    now: Date;
    leaseDurationMs?: number;
    checkpointCursor?: string | null;
  }) {
    const updated = await this.db.attendanceJobRun.updateMany({
      where: {
        tenantId: input.tenantId,
        id: input.runId,
        status: 'RUNNING',
        leaseOwner: input.leaseOwner,
        leaseUntil: { gt: input.now },
      },
      data: {
        leaseUntil: new Date(input.now.getTime() + (input.leaseDurationMs ?? 60_000)),
        checkpointCursor: input.checkpointCursor,
      },
    });
    return updated.count === 1;
  }

  async completeRun(input: {
    tenantId: string;
    runId: string;
    leaseOwner: string;
    now: Date;
    checkpointCursor?: string | null;
  }) {
    const updated = await this.db.attendanceJobRun.updateMany({
      where: {
        tenantId: input.tenantId,
        id: input.runId,
        status: 'RUNNING',
        leaseOwner: input.leaseOwner,
      },
      data: {
        status: 'COMPLETED',
        checkpointCursor: input.checkpointCursor,
        leaseOwner: null,
        leaseUntil: null,
        completedAt: input.now,
        safeErrorCode: null,
        safeErrorMessage: null,
      },
    });
    return updated.count === 1;
  }

  async failRun(input: {
    tenantId: string;
    runId: string;
    leaseOwner: string;
    now: Date;
    safeErrorCode: string;
    checkpointCursor?: string | null;
  }) {
    const updated = await this.db.attendanceJobRun.updateMany({
      where: {
        tenantId: input.tenantId,
        id: input.runId,
        status: 'RUNNING',
        leaseOwner: input.leaseOwner,
      },
      data: {
        status: 'FAILED',
        checkpointCursor: input.checkpointCursor,
        leaseOwner: null,
        leaseUntil: null,
        completedAt: input.now,
        safeErrorCode: input.safeErrorCode,
        safeErrorMessage: null,
      },
    });
    return updated.count === 1;
  }

  claimPendingVideoAssets(input: {
    tenantId: string;
    leaseOwner: string;
    now: Date;
    leaseDurationMs?: number;
    take?: number;
  }) {
    const take = Math.min(Math.max(input.take ?? 50, 1), 200);
    const leaseUntil = new Date(input.now.getTime() + (input.leaseDurationMs ?? 300_000));
    return this.db.$queryRaw<Array<{ tenantId: string; id: string; attemptCount: number }>>`
      WITH candidates AS (
        SELECT tenant_id, id
        FROM checkin_video_assets
        WHERE tenant_id = ${input.tenantId}::uuid
          AND processing_state IN ('REQUESTED', 'UPLOADED', 'VERIFYING', 'FAILED_RETRYABLE', 'CONVERTING')
          AND (lease_until IS NULL OR lease_until <= ${input.now})
        ORDER BY requested_at ASC, id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${take}
      )
      UPDATE checkin_video_assets AS asset
      SET processing_state = 'CONVERTING',
          lease_owner = ${input.leaseOwner},
          lease_until = ${leaseUntil},
          attempt_count = asset.attempt_count + 1,
          updated_at = ${input.now}
      FROM candidates
      WHERE asset.tenant_id = candidates.tenant_id
        AND asset.id = candidates.id
      RETURNING
        asset.tenant_id AS "tenantId",
        asset.id,
        asset.attempt_count AS "attemptCount"
    `;
  }

  listActiveTenantsForAttendance() {
    return this.db.tenant.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, timezone: true },
      orderBy: { id: 'asc' },
    });
  }

  async listPendingCheckInReminderRecipients(input: {
    tenantId: string;
    businessDate: string;
    targetStartLocalTime: string;
    take?: number;
  }): Promise<PendingCheckInReminderRecipient[]> {
    const take = Math.min(Math.max(input.take ?? 200, 1), 500);
    const rows = await this.db.$queryRaw<
      Array<{
        tenant_id: string;
        membership_id: string;
        branch_id: string;
        business_date: Date;
        schedule_version_id: string;
        shift_definition_id: string;
        shift_code: string;
        shift_start_local_time: string;
        membership_display_name: string;
      }>
    >`
      SELECT
        w.tenant_id,
        w.membership_id,
        w.branch_id,
        w.business_date,
        w.id AS schedule_version_id,
        s.id AS shift_definition_id,
        s.code AS shift_code,
        s.start_local_time AS shift_start_local_time,
        tm.membership_display_name
      FROM work_schedule_versions w
      INNER JOIN shift_definitions s
        ON s.tenant_id = w.tenant_id
       AND s.id = w.shift_definition_id
      INNER JOIN tenant_memberships tm
        ON tm.tenant_id = w.tenant_id
       AND tm.id = w.membership_id
      LEFT JOIN attendance_events ae
        ON ae.tenant_id = w.tenant_id
       AND ae.membership_id = w.membership_id
       AND ae.business_date = w.business_date
       AND ae.check_in_at IS NOT NULL
      WHERE w.tenant_id = ${input.tenantId}::uuid
        AND w.business_date = ${input.businessDate}::date
        AND w.superseded_at IS NULL
        AND w.state IN ('SCHEDULED', 'ADJUSTED')
        AND w.shift_definition_id IS NOT NULL
        AND s.status = 'ACTIVE'
        AND s.start_local_time = ${input.targetStartLocalTime}
        AND tm.status = 'ACTIVE'
        AND ae.id IS NULL
      ORDER BY w.branch_id ASC, s.start_local_time ASC, tm.membership_display_name ASC, w.id ASC
      LIMIT ${take}
    `;
    return rows.map((row) => ({
      tenantId: row.tenant_id,
      membershipId: row.membership_id,
      branchId: row.branch_id,
      businessDate: row.business_date.toISOString().slice(0, 10),
      scheduleVersionId: row.schedule_version_id,
      shiftDefinitionId: row.shift_definition_id,
      shiftCode: row.shift_code,
      shiftStartLocalTime: row.shift_start_local_time,
      membershipDisplayName: row.membership_display_name,
    }));
  }

  async listFinalCheckInReminderRecipients(input: {
    tenantId: string;
    businessDate: string;
    take?: number;
  }): Promise<PendingCheckInReminderRecipient[]> {
    const take = Math.min(Math.max(input.take ?? 500, 1), 500);
    const rows = await this.db.$queryRaw<
      Array<{
        tenant_id: string;
        membership_id: string;
        branch_id: string;
        business_date: Date;
        schedule_version_id: string;
        shift_definition_id: string;
        shift_code: string;
        shift_start_local_time: string;
        membership_display_name: string;
      }>
    >`
      SELECT
        w.tenant_id,
        w.membership_id,
        w.branch_id,
        w.business_date,
        w.id AS schedule_version_id,
        s.id AS shift_definition_id,
        s.code AS shift_code,
        s.start_local_time AS shift_start_local_time,
        tm.membership_display_name
      FROM work_schedule_versions w
      INNER JOIN shift_definitions s
        ON s.tenant_id = w.tenant_id
       AND s.id = w.shift_definition_id
      INNER JOIN tenant_memberships tm
        ON tm.tenant_id = w.tenant_id
       AND tm.id = w.membership_id
      LEFT JOIN attendance_events ae
        ON ae.tenant_id = w.tenant_id
       AND ae.membership_id = w.membership_id
       AND ae.business_date = w.business_date
       AND ae.check_in_at IS NOT NULL
      WHERE w.tenant_id = ${input.tenantId}::uuid
        AND w.business_date = ${input.businessDate}::date
        AND w.superseded_at IS NULL
        AND w.state IN ('SCHEDULED', 'ADJUSTED')
        AND w.shift_definition_id IS NOT NULL
        AND s.status = 'ACTIVE'
        AND s.start_local_time < '12:00'
        AND tm.status = 'ACTIVE'
        AND ae.id IS NULL
      ORDER BY w.branch_id ASC, s.start_local_time ASC, tm.membership_display_name ASC, w.id ASC
      LIMIT ${take}
    `;
    return rows.map((row) => ({
      tenantId: row.tenant_id,
      membershipId: row.membership_id,
      branchId: row.branch_id,
      businessDate: row.business_date.toISOString().slice(0, 10),
      scheduleVersionId: row.schedule_version_id,
      shiftDefinitionId: row.shift_definition_id,
      shiftCode: row.shift_code,
      shiftStartLocalTime: row.shift_start_local_time,
      membershipDisplayName: row.membership_display_name,
    }));
  }

  emitCheckInReminder(input: CheckInReminderMessage) {
    const payloadRedacted: Prisma.InputJsonObject = {
      branchId: input.branchId,
      businessDate: input.businessDate,
      shiftDefinitionId: input.shiftDefinitionId,
      shiftCode: input.shiftCode,
      shiftStartLocalTime: input.shiftStartLocalTime,
      reminderKind: input.reminderKind,
      reminderLeadMinutes: input.reminderLeadMinutes,
      reminderAt: input.reminderAt.toISOString(),
      mentionMembershipIds: input.mentionMembershipIds,
      mentionDisplayNames: input.mentionDisplayNames,
      messageBody: input.messageBody,
      ...(input.cutoffLocalTime ? { cutoffLocalTime: input.cutoffLocalTime } : {}),
    };
    return this.db.outboxEvent.upsert({
      where: {
        tenantId_dedupeKey: {
          tenantId: input.tenantId,
          dedupeKey: input.dedupeKey,
        },
      },
      update: {},
      create: {
        tenantId: input.tenantId,
        aggregateType: 'ATTENDANCE_CHECKIN_REMINDER',
        aggregateId: input.shiftDefinitionId,
        eventType: 'attendance.checkin-reminder.due',
        dedupeKey: input.dedupeKey,
        payloadRedacted,
        correlationId: `checkin-reminder:${input.tenantId}:${input.businessDate}:${input.shiftDefinitionId}`,
      },
    });
  }

  markVideoConversionReady(input: {
    tenantId: string;
    id: string;
    leaseOwner: string;
    convertedMediaObjectId?: string;
  }) {
    return this.db.$transaction(async (tx) => {
      const updated = await tx.checkInVideoAsset.updateMany({
        where: { tenantId: input.tenantId, id: input.id, leaseOwner: input.leaseOwner },
        data: {
          processingState: 'READY',
          convertedMediaObjectId: input.convertedMediaObjectId,
          readyAt: new Date(),
          leaseOwner: null,
          leaseUntil: null,
          lastSafeErrorCode: null,
        },
      });
      if (updated.count !== 1) return null;
      return this.publishVideoLifecycle(tx, {
        tenantId: input.tenantId,
        id: input.id,
        eventType: 'attendance.video.ready',
        title: 'Video check-in can duoc xem lai',
      });
    });
  }

  markVideoConversionFailed(input: {
    tenantId: string;
    id: string;
    leaseOwner: string;
    safeErrorCode: string;
  }) {
    return this.db.$transaction(async (tx) => {
      const updated = await tx.checkInVideoAsset.updateMany({
        where: { tenantId: input.tenantId, id: input.id, leaseOwner: input.leaseOwner },
        data: {
          processingState: 'FAILED_RETRYABLE',
          leaseOwner: null,
          leaseUntil: null,
          lastSafeErrorCode: input.safeErrorCode,
        },
      });
      if (updated.count !== 1) return null;
      return this.publishVideoLifecycle(tx, {
        tenantId: input.tenantId,
        id: input.id,
        eventType: 'attendance.video.failed',
        title: 'Xu ly video check-in that bai',
        safeErrorCode: input.safeErrorCode,
      });
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
        businessDate: { lt: end },
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
      const summary = await this.db.monthlyAbsenceSummary.upsert({
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
      });
      if (!summary.overThreshold) {
        await this.db.actionItem.updateMany({
          where: {
            tenantId: input.tenantId,
            sourceType: 'ABSENCE_OVER_THRESHOLD',
            sourceId: summary.id,
            state: { in: ['OPEN', 'OVERDUE'] },
          },
          data: {
            state: 'COMPLETED',
            completedAt: new Date(),
            sourceFreshnessAt: new Date(),
            stateVersion: { increment: 1 },
          },
        });
      }
      summaries.push(summary);
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
      const managerMembershipIds = await resolveScopedPermissionMembers(
        tx,
        input.tenantId,
        summary.branchId,
        'workflow.decide',
      );
      const businessDate = new Date(`${summary.yearMonth}-01T00:00:00.000Z`);
      for (const managerMembershipId of managerMembershipIds) {
        const item = await tx.actionItem.upsert({
          where: {
            tenantId_ownerMembershipId_itemType_sourceType_sourceId_businessDate: {
              tenantId: input.tenantId,
              ownerMembershipId: managerMembershipId,
              itemType: 'DATA_QUALITY',
              sourceType: 'ABSENCE_OVER_THRESHOLD',
              sourceId: summary.id,
              businessDate,
            },
          },
          update: {
            state: 'OPEN',
            completedAt: null,
            sourceFreshnessAt: new Date(),
            stateVersion: { increment: 1 },
          },
          create: {
            tenantId: input.tenantId,
            ownerMembershipId: managerMembershipId,
            branchId: summary.branchId,
            itemType: 'DATA_QUALITY',
            sourceType: 'ABSENCE_OVER_THRESHOLD',
            sourceId: summary.id,
            businessDate,
            state: 'OPEN',
            title: 'Nhan su nghi qua 5 ngay trong thang',
            deadlineAt: new Date(),
            sourceFreshnessAt: new Date(),
            deepLink: `adsup://attendance/absences/${summary.id}`,
          },
        });
        await tx.outboxEvent.upsert({
          where: {
            tenantId_dedupeKey: {
              tenantId: input.tenantId,
              dedupeKey: `absence-action-item:${item.id}:v${item.stateVersion}`,
            },
          },
          update: {},
          create: {
            tenantId: input.tenantId,
            aggregateType: 'ACTION_ITEM',
            aggregateId: item.id,
            eventType: 'action-item.changed',
            dedupeKey: `absence-action-item:${item.id}:v${item.stateVersion}`,
            payloadRedacted: {
              actionItemId: item.id,
              ownerMembershipId: managerMembershipId,
              state: item.state,
              stateVersion: item.stateVersion,
            },
            correlationId: input.correlationId ?? `monthly-absence:${summary.yearMonth}`,
          },
        });
      }
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
          eventType: 'absence.summary.threshold-exceeded',
          dedupeKey: input.notificationEffectKey,
          payloadRedacted: {
            summaryId: summary.id,
            membershipId: summary.membershipId,
            branchId: summary.branchId,
            yearMonth: summary.yearMonth,
            approvedAbsenceDays: summary.approvedAbsenceDaysDecimal.toString(),
            managerMembershipIds,
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

  private async claimRun(input: {
    tenantId: string;
    runId: string;
    leaseOwner: string;
    now: Date;
    leaseDurationMs?: number;
  }) {
    const updated = await this.db.attendanceJobRun.updateMany({
      where: {
        tenantId: input.tenantId,
        id: input.runId,
        OR: [
          { status: { not: 'RUNNING' } },
          { leaseUntil: null },
          { leaseUntil: { lte: input.now } },
        ],
      },
      data: {
        status: 'RUNNING',
        leaseOwner: input.leaseOwner,
        leaseUntil: new Date(input.now.getTime() + (input.leaseDurationMs ?? 60_000)),
        attempt: { increment: 1 },
        startedAt: input.now,
        completedAt: null,
        safeErrorCode: null,
        safeErrorMessage: null,
      },
    });
    if (updated.count !== 1) return null;
    return this.db.attendanceJobRun.findUniqueOrThrow({
      where: { tenantId_id: { tenantId: input.tenantId, id: input.runId } },
    });
  }

  private async publishVideoLifecycle(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      id: string;
      eventType: 'attendance.video.ready' | 'attendance.video.failed';
      title: string;
      safeErrorCode?: string;
    },
  ) {
    const asset = await tx.checkInVideoAsset.findUniqueOrThrow({
      where: { tenantId_id: { tenantId: input.tenantId, id: input.id } },
    });
    const event = await tx.attendanceEvent.findUniqueOrThrow({
      where: {
        tenantId_id: {
          tenantId: input.tenantId,
          id: asset.attendanceEventId,
        },
      },
    });
    const policy = await tx.videoPolicyVersion.findUnique({
      where: {
        tenantId_id: {
          tenantId: input.tenantId,
          id: event.videoPolicyVersionId,
        },
      },
    });
    const reviewerMembershipIds = await resolveScopedPermissionMembers(
      tx,
      input.tenantId,
      event.branchId,
      'attendance.video.review',
    );
    if (input.eventType === 'attendance.video.failed' || policy?.manualReviewRequired) {
      const now = new Date();
      for (const reviewerMembershipId of reviewerMembershipIds) {
        const item = await tx.actionItem.upsert({
          where: {
            tenantId_ownerMembershipId_itemType_sourceType_sourceId_businessDate: {
              tenantId: input.tenantId,
              ownerMembershipId: reviewerMembershipId,
              itemType: 'DATA_QUALITY',
              sourceType: 'ATTENDANCE_VIDEO_REVIEW',
              sourceId: asset.id,
              businessDate: event.businessDate,
            },
          },
          update: {
            state: 'OPEN',
            completedAt: null,
            sourceFreshnessAt: now,
            stateVersion: { increment: 1 },
          },
          create: {
            tenantId: input.tenantId,
            ownerMembershipId: reviewerMembershipId,
            branchId: event.branchId,
            itemType: 'DATA_QUALITY',
            sourceType: 'ATTENDANCE_VIDEO_REVIEW',
            sourceId: asset.id,
            businessDate: event.businessDate,
            state: 'OPEN',
            title: input.title,
            deadlineAt: now,
            sourceFreshnessAt: now,
            deepLink: `adsup://attendance/video-review/${event.id}`,
          },
        });
        await tx.outboxEvent.upsert({
          where: {
            tenantId_dedupeKey: {
              tenantId: input.tenantId,
              dedupeKey: `video-action-item:${item.id}:v${item.stateVersion}`,
            },
          },
          update: {},
          create: {
            tenantId: input.tenantId,
            aggregateType: 'ACTION_ITEM',
            aggregateId: item.id,
            eventType: 'action-item.changed',
            dedupeKey: `video-action-item:${item.id}:v${item.stateVersion}`,
            payloadRedacted: {
              actionItemId: item.id,
              ownerMembershipId: reviewerMembershipId,
              state: item.state,
              stateVersion: item.stateVersion,
            },
            correlationId: `attendance-video:${asset.id}`,
          },
        });
      }
    }
    await tx.outboxEvent.upsert({
      where: {
        tenantId_dedupeKey: {
          tenantId: input.tenantId,
          dedupeKey: `${input.eventType}:${asset.id}:${asset.attemptCount}`,
        },
      },
      update: {},
      create: {
        tenantId: input.tenantId,
        aggregateType: 'CHECKIN_VIDEO_ASSET',
        aggregateId: asset.id,
        eventType: input.eventType,
        dedupeKey: `${input.eventType}:${asset.id}:${asset.attemptCount}`,
        payloadRedacted: {
          videoAssetId: asset.id,
          attendanceEventId: event.id,
          membershipId: event.membershipId,
          branchId: event.branchId,
          processingState: asset.processingState,
          reviewerMembershipIds,
          ...(input.safeErrorCode ? { safeErrorCode: input.safeErrorCode } : {}),
        },
        correlationId: `attendance-video:${asset.id}`,
      },
    });
    return asset;
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

async function resolveScopedPermissionMembers(
  tx: Prisma.TransactionClient,
  tenantId: string,
  branchId: string,
  permissionCode: string,
) {
  const permission = await tx.permission.findUnique({
    where: { code: permissionCode },
    select: { id: true },
  });
  if (!permission) return [];
  const roleIds = (
    await tx.rolePermission.findMany({
      where: { tenantId, permissionId: permission.id },
      select: { roleId: true },
    })
  ).map((binding) => binding.roleId);
  if (!roleIds.length) return [];
  const now = new Date();
  const bindings = await tx.membershipRoleBinding.findMany({
    where: {
      tenantId,
      roleId: { in: roleIds },
      effectiveFrom: { lte: now },
      AND: [
        { OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
        { OR: [{ scopeType: 'TENANT' }, { scopeType: 'BRANCH', branchId }] },
      ],
    },
    select: { membershipId: true },
  });
  const active = await tx.tenantMembership.findMany({
    where: {
      tenantId,
      id: { in: bindings.map((binding) => binding.membershipId) },
      status: 'ACTIVE',
    },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  return active.map((membership) => membership.id);
}
