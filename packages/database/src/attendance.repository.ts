import { runInTransaction, type DatabaseExecutor, type DatabaseTransaction } from './client.js';
import type { Prisma } from './generated/prisma/client.js';
import { businessMonthBounds } from '@adsup/domain';

export interface AttendancePageInput {
  tenantId: string;
  cursor?: string;
  take?: number;
}

export class AttendanceRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  inTransaction(transaction: DatabaseTransaction) {
    return new AttendanceRepository(transaction);
  }

  listShifts(input: AttendancePageInput) {
    return this.db.shiftDefinition.findMany({
      where: { tenantId: input.tenantId },
      orderBy: [{ code: 'asc' }, { versionNumber: 'desc' }, { id: 'asc' }],
      cursor: input.cursor
        ? { tenantId_id: { tenantId: input.tenantId, id: input.cursor } }
        : undefined,
      skip: input.cursor ? 1 : 0,
      take: Math.min(Math.max(input.take ?? 50, 1), 200),
    });
  }

  getShift(tenantId: string, id: string) {
    return this.db.shiftDefinition.findUnique({ where: { tenantId_id: { tenantId, id } } });
  }

  listSchedules(input: {
    tenantId: string;
    branchId?: string;
    membershipId?: string;
    dateFrom: Date;
    dateTo: Date;
    take?: number;
  }) {
    return this.db.workScheduleVersion.findMany({
      where: {
        tenantId: input.tenantId,
        branchId: input.branchId,
        membershipId: input.membershipId,
        businessDate: { gte: input.dateFrom, lte: input.dateTo },
      },
      orderBy: [{ businessDate: 'asc' }, { membershipId: 'asc' }, { versionNumber: 'desc' }],
      take: Math.min(Math.max(input.take ?? 100, 1), 500),
    });
  }

  getEffectiveSchedule(tenantId: string, membershipId: string, businessDate: Date) {
    return this.db.workScheduleVersion.findFirst({
      where: { tenantId, membershipId, businessDate, supersededAt: null },
      orderBy: [{ versionNumber: 'desc' }, { id: 'desc' }],
    });
  }

  createScheduleVersion(input: {
    tenantId: string;
    membershipId: string;
    branchId: string;
    businessDate: Date;
    shiftDefinitionId: string | null;
    state: 'SCHEDULED' | 'OFF' | 'LEAVE_APPROVED' | 'ADJUSTED' | 'CANCELLED';
    leaveDurationKind?: 'FULL_DAY' | 'MORNING_HALF' | 'DATE_RANGE' | null;
    changeKind:
      'SELF_EDIT' | 'CHANGE_REQUEST' | 'MANAGER_ADJUSTMENT' | 'OFF_CALENDAR' | 'LEAVE_APPROVAL';
    sourceRequestId?: string | null;
    sourceOffCalendarId?: string | null;
    effectiveAt: Date;
    createdByMembershipId: string;
    reason: string;
    correlationId: string;
  }) {
    return runInTransaction(this.db, async (tx) => {
      const previous = await tx.workScheduleVersion.findFirst({
        where: {
          tenantId: input.tenantId,
          membershipId: input.membershipId,
          businessDate: input.businessDate,
          supersededAt: null,
        },
        orderBy: [{ versionNumber: 'desc' }, { id: 'desc' }],
      });
      if (previous) {
        const supersededAt = new Date(
          Math.max(input.effectiveAt.getTime(), previous.effectiveAt.getTime() + 1),
        );
        await tx.workScheduleVersion.update({
          where: { tenantId_id: { tenantId: input.tenantId, id: previous.id } },
          data: { supersededAt },
        });
      }
      const schedule = await tx.workScheduleVersion.create({
        data: {
          tenantId: input.tenantId,
          membershipId: input.membershipId,
          branchId: input.branchId,
          businessDate: input.businessDate,
          shiftDefinitionId: input.shiftDefinitionId,
          state: input.state,
          leaveDurationKind: input.leaveDurationKind,
          changeKind: input.changeKind,
          sourceRequestId: input.sourceRequestId,
          sourceOffCalendarId: input.sourceOffCalendarId,
          versionNumber: (previous?.versionNumber ?? 0) + 1,
          effectiveAt: input.effectiveAt,
          createdByMembershipId: input.createdByMembershipId,
          reason: input.reason,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.createdByMembershipId,
          correlationId: input.correlationId,
          eventType: 'WORK_SCHEDULE_VERSION_CREATED',
          targetType: 'WORK_SCHEDULE_VERSION',
          targetId: schedule.id,
          reason: input.reason,
          beforeRedacted: previous
            ? ({
                id: previous.id,
                versionNumber: previous.versionNumber,
                state: previous.state,
              } satisfies Prisma.InputJsonValue)
            : undefined,
          afterRedacted: {
            id: schedule.id,
            membershipId: schedule.membershipId,
            branchId: schedule.branchId,
            businessDate: schedule.businessDate.toISOString().slice(0, 10),
            state: schedule.state,
            versionNumber: schedule.versionNumber,
          },
        },
      });
      await tx.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          aggregateType: 'WORK_SCHEDULE_VERSION',
          aggregateId: schedule.id,
          eventType: 'attendance.schedule.version-created',
          dedupeKey: `attendance-schedule:${schedule.id}`,
          payloadRedacted: {
            scheduleVersionId: schedule.id,
            membershipId: schedule.membershipId,
            branchId: schedule.branchId,
            businessDate: schedule.businessDate.toISOString().slice(0, 10),
            versionNumber: schedule.versionNumber,
          },
          correlationId: input.correlationId,
        },
      });
      return schedule;
    });
  }

  listOffCalendarVersions(input: {
    tenantId: string;
    branchId?: string;
    dateFrom: Date;
    dateTo: Date;
  }) {
    return this.db.companyOffCalendarVersion.findMany({
      where: {
        tenantId: input.tenantId,
        status: 'ACTIVE',
        startDate: { lte: input.dateTo },
        endDate: { gte: input.dateFrom },
        OR: [{ scopeType: 'TENANT' }, { scopeType: 'BRANCH', branchId: input.branchId }],
      },
      orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
    });
  }

  async createOffCalendarVersion(input: {
    tenantId: string;
    scopeType: 'TENANT' | 'BRANCH';
    branchId?: string | null;
    name: string;
    startDate: Date;
    endDate: Date;
    timezone?: string;
    actorMembershipId: string;
    reason: string;
    correlationId: string;
  }) {
    return runInTransaction(this.db, async (tx) => {
      const latest = await tx.companyOffCalendarVersion.findFirst({
        where: {
          tenantId: input.tenantId,
          scopeType: input.scopeType,
          branchId: input.branchId ?? null,
          name: input.name,
        },
        orderBy: { versionNumber: 'desc' },
      });
      const version = await tx.companyOffCalendarVersion.create({
        data: {
          tenantId: input.tenantId,
          scopeType: input.scopeType,
          branchId: input.branchId,
          name: input.name,
          startDate: input.startDate,
          endDate: input.endDate,
          timezone: input.timezone ?? 'Asia/Ho_Chi_Minh',
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
          eventType: 'COMPANY_OFF_CALENDAR_VERSION_CREATED',
          targetType: 'COMPANY_OFF_CALENDAR_VERSION',
          targetId: version.id,
          reason: input.reason,
          afterRedacted: {
            scopeType: version.scopeType,
            branchId: version.branchId,
            startDate: version.startDate.toISOString().slice(0, 10),
            endDate: version.endDate.toISOString().slice(0, 10),
            versionNumber: version.versionNumber,
          },
        },
      });
      await tx.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          aggregateType: 'COMPANY_OFF_CALENDAR_VERSION',
          aggregateId: version.id,
          eventType: 'attendance.off-calendar.version-created',
          dedupeKey: `attendance-off-calendar:${version.id}`,
          payloadRedacted: {
            offCalendarVersionId: version.id,
            scopeType: version.scopeType,
            branchId: version.branchId,
          },
          correlationId: input.correlationId,
        },
      });
      return version;
    });
  }

  isOffCalendarDay(input: { tenantId: string; branchId: string; businessDate: Date }) {
    return this.db.companyOffCalendarVersion.findFirst({
      where: {
        tenantId: input.tenantId,
        status: 'ACTIVE',
        startDate: { lte: input.businessDate },
        endDate: { gte: input.businessDate },
        OR: [{ scopeType: 'TENANT' }, { scopeType: 'BRANCH', branchId: input.branchId }],
      },
      orderBy: [{ scopeType: 'desc' }, { versionNumber: 'desc' }, { id: 'desc' }],
    });
  }

  getEffectiveVideoPolicy(tenantId: string, branchId: string | null, businessDate: Date) {
    return this.db.videoPolicyVersion.findFirst({
      where: {
        tenantId,
        effectiveFromDate: { lte: businessDate },
        OR: [{ effectiveToDate: null }, { effectiveToDate: { gte: businessDate } }],
        AND: [{ OR: [{ scopeType: 'TENANT' }, { scopeType: 'BRANCH', branchId }] }],
      },
      orderBy: [{ scopeType: 'desc' }, { versionNumber: 'desc' }, { id: 'desc' }],
    });
  }

  getAttendanceEvent(tenantId: string, id: string) {
    return this.db.attendanceEvent.findUnique({ where: { tenantId_id: { tenantId, id } } });
  }

  async createVideoPolicyVersion(input: {
    tenantId: string;
    scopeType: 'TENANT' | 'BRANCH';
    branchId?: string | null;
    effectiveFromDate: Date;
    effectiveToDate?: Date | null;
    requiresAcknowledgement: boolean;
    requiresFullBody: boolean;
    requiresWorkArea: boolean;
    manualReviewRequired: boolean;
    acknowledgementText?: string | null;
    missingCheckinPenaltyMinor: bigint;
    videoFailedPenaltyMinor: bigint;
    currency: 'VND';
    actorMembershipId: string;
    reason: string;
    correlationId: string;
  }) {
    return runInTransaction(this.db, async (tx) => {
      const latest = await tx.videoPolicyVersion.findFirst({
        where: {
          tenantId: input.tenantId,
          scopeType: input.scopeType,
          branchId: input.branchId ?? null,
        },
        orderBy: { versionNumber: 'desc' },
      });
      const policy = await tx.videoPolicyVersion.create({
        data: {
          tenantId: input.tenantId,
          scopeType: input.scopeType,
          branchId: input.branchId,
          versionNumber: (latest?.versionNumber ?? 0) + 1,
          effectiveFromDate: input.effectiveFromDate,
          effectiveToDate: input.effectiveToDate,
          requiresAcknowledgement: input.requiresAcknowledgement,
          requiresFullBody: input.requiresFullBody,
          requiresWorkArea: input.requiresWorkArea,
          manualReviewRequired: input.manualReviewRequired,
          acknowledgementText: input.acknowledgementText,
          missingCheckinPenaltyMinor: input.missingCheckinPenaltyMinor,
          videoFailedPenaltyMinor: input.videoFailedPenaltyMinor,
          currency: input.currency,
          createdByMembershipId: input.actorMembershipId,
          reason: input.reason,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.actorMembershipId,
          correlationId: input.correlationId,
          eventType: 'VIDEO_POLICY_VERSION_CREATED',
          targetType: 'VIDEO_POLICY_VERSION',
          targetId: policy.id,
          reason: input.reason,
          afterRedacted: { scopeType: policy.scopeType, versionNumber: policy.versionNumber },
        },
      });
      await tx.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          aggregateType: 'VIDEO_POLICY_VERSION',
          aggregateId: policy.id,
          eventType: 'attendance.video-policy.version-created',
          dedupeKey: `attendance-video-policy:${policy.id}`,
          payloadRedacted: { policyVersionId: policy.id, scopeType: policy.scopeType },
          correlationId: input.correlationId,
        },
      });
      return policy;
    });
  }

  getVideoPolicy(tenantId: string, id: string) {
    return this.db.videoPolicyVersion.findUnique({ where: { tenantId_id: { tenantId, id } } });
  }

  getPolicyAcknowledgement(tenantId: string, membershipId: string, policyVersionId: string) {
    return this.db.videoPolicyAcknowledgement.findUnique({
      where: {
        tenantId_membershipId_policyVersionId: { tenantId, membershipId, policyVersionId },
      },
    });
  }

  acknowledgeVideoPolicy(input: {
    tenantId: string;
    membershipId: string;
    policyVersionId: string;
    sessionId?: string | null;
    deviceId?: string | null;
    action: 'ACKNOWLEDGED';
    correlationId: string;
  }) {
    return runInTransaction(this.db, async (tx) => {
      const acknowledgement = await tx.videoPolicyAcknowledgement.upsert({
        where: {
          tenantId_membershipId_policyVersionId: {
            tenantId: input.tenantId,
            membershipId: input.membershipId,
            policyVersionId: input.policyVersionId,
          },
        },
        update: { deviceId: input.deviceId, action: input.action },
        create: input,
      });
      await tx.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.membershipId,
          correlationId: input.correlationId,
          eventType: 'VIDEO_POLICY_ACKNOWLEDGED',
          targetType: 'VIDEO_POLICY_ACKNOWLEDGEMENT',
          targetId: acknowledgement.id,
          reason: 'VIDEO_POLICY_ACKNOWLEDGED_BY_MEMBER',
          afterRedacted: { policyVersionId: input.policyVersionId },
        },
      });
      await tx.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          aggregateType: 'VIDEO_POLICY_ACKNOWLEDGEMENT',
          aggregateId: acknowledgement.id,
          eventType: 'attendance.video-policy.acknowledged',
          dedupeKey: `attendance-video-policy-acknowledged:${acknowledgement.id}`,
          payloadRedacted: {
            acknowledgementId: acknowledgement.id,
            policyVersionId: input.policyVersionId,
            membershipId: input.membershipId,
          },
          correlationId: input.correlationId,
        },
      });
      return acknowledgement;
    });
  }

  getMediaObject(tenantId: string, id: string) {
    return this.db.mediaObject.findUnique({ where: { tenantId_id: { tenantId, id } } });
  }

  getEffectiveAttendancePenaltyPolicy(
    tenantId: string,
    branchId: string | null,
    businessDate: Date,
  ) {
    return this.db.attendancePenaltyPolicyVersion.findFirst({
      where: {
        tenantId,
        effectiveFromDate: { lte: businessDate },
        OR: [{ effectiveToDate: null }, { effectiveToDate: { gte: businessDate } }],
        AND: [{ OR: [{ scopeType: 'TENANT' }, { scopeType: 'BRANCH', branchId }] }],
      },
      orderBy: [{ scopeType: 'desc' }, { versionNumber: 'desc' }, { id: 'desc' }],
    });
  }

  async createCheckIn(input: {
    tenantId: string;
    membershipId: string;
    branchId: string;
    businessDate: Date;
    scheduleVersionId: string;
    videoPolicyVersionId: string;
    checkInAt: Date;
    state:
      | 'PENDING_VIDEO'
      | 'VIDEO_UPLOADED'
      | 'CONFIRMED'
      | 'MISSING_CHECK_IN'
      | 'NON_WORKED'
      | 'EXEMPT_OFF';
    dayClassification:
      'WORKED_ON_TIME' | 'WORKED_LATE' | 'NON_WORKED_NO_CHECKIN' | 'OFF_OR_APPROVED_LEAVE';
    classificationReason: string;
    mediaObjectId: string;
    originalContentType: string;
    originalChecksum: string;
    correlationId: string;
  }) {
    return runInTransaction(this.db, async (tx) => {
      const event = await tx.attendanceEvent.create({
        data: {
          tenantId: input.tenantId,
          membershipId: input.membershipId,
          branchId: input.branchId,
          businessDate: input.businessDate,
          scheduleVersionId: input.scheduleVersionId,
          videoPolicyVersionId: input.videoPolicyVersionId,
          checkInAt: input.checkInAt,
          state: input.state,
          dayClassification: input.dayClassification,
          classificationReason: input.classificationReason,
          correlationId: input.correlationId,
        },
      });
      const videoAsset = await tx.checkInVideoAsset.create({
        data: {
          tenantId: input.tenantId,
          attendanceEventId: event.id,
          mediaObjectId: input.mediaObjectId,
          originalContentType: input.originalContentType,
          originalChecksum: input.originalChecksum,
          processingState: 'UPLOADED',
          uploadedAt: input.checkInAt,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.membershipId,
          correlationId: input.correlationId,
          eventType: 'ATTENDANCE_CHECKIN_CREATED',
          targetType: 'ATTENDANCE_EVENT',
          targetId: event.id,
          reason: 'VIDEO_CHECKIN_SUBMITTED',
          afterRedacted: {
            attendanceEventId: event.id,
            businessDate: event.businessDate.toISOString().slice(0, 10),
            state: event.state,
            dayClassification: event.dayClassification,
          },
        },
      });
      await tx.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          aggregateType: 'ATTENDANCE_EVENT',
          aggregateId: event.id,
          eventType: 'attendance.checkin.recorded',
          dedupeKey: `attendance-check-in:${event.id}`,
          payloadRedacted: {
            attendanceEventId: event.id,
            membershipId: event.membershipId,
            branchId: event.branchId,
            businessDate: event.businessDate.toISOString().slice(0, 10),
            dayClassification: event.dayClassification,
          },
          correlationId: input.correlationId,
        },
      });
      await tx.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          aggregateType: 'CHECKIN_VIDEO_ASSET',
          aggregateId: videoAsset.id,
          eventType: 'attendance.video.conversion-requested',
          dedupeKey: `attendance-video-conversion-requested:${videoAsset.id}`,
          payloadRedacted: {
            videoAssetId: videoAsset.id,
            attendanceEventId: event.id,
            membershipId: event.membershipId,
            branchId: event.branchId,
          },
          correlationId: input.correlationId,
        },
      });
      return event;
    });
  }

  createLateOccurrence(input: {
    tenantId: string;
    attendanceEventId: string;
    membershipId: string;
    branchId: string;
    businessDate: Date;
    shiftStartAt: Date;
    checkInAt: Date;
    lateSeconds: number;
    lateMinutes: number;
    after15Local: boolean;
    after18Local: boolean;
    queueImpactFlag: boolean;
    policyVersionId: string;
  }) {
    const month = businessMonthBounds(input.businessDate);
    return runInTransaction(this.db, async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(
            ${`attendance-late:${input.tenantId}:${input.membershipId}:${month.yearMonth}`},
            0
          )
        )
      `;
      const monthlyLateSequence =
        (await tx.lateOccurrence.count({
          where: {
            tenantId: input.tenantId,
            membershipId: input.membershipId,
            businessDate: {
              gte: month.start,
              lt: month.end,
            },
          },
        })) + 1;
      return tx.lateOccurrence.create({
        data: {
          ...input,
          monthlyLateSequence,
          firstLateExempt: monthlyLateSequence === 1,
        },
      });
    });
  }

  async markApprovedLateNotice(input: {
    tenantId: string;
    requestId: string;
    membershipId: string;
    businessDate: Date;
    correlationId: string;
  }) {
    return runInTransaction(this.db, async (tx) => {
      const occurrences = await tx.lateOccurrence.findMany({
        where: {
          tenantId: input.tenantId,
          membershipId: input.membershipId,
          businessDate: input.businessDate,
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      for (const occurrence of occurrences) {
        if (occurrence.lateNoticeRequestId === input.requestId) continue;
        await tx.lateOccurrence.update({
          where: { tenantId_id: { tenantId: input.tenantId, id: occurrence.id } },
          data: { lateNoticeRequestId: input.requestId },
        });
      }
      if (occurrences.length) {
        await tx.auditEvent.create({
          data: {
            tenantId: input.tenantId,
            correlationId: input.correlationId,
            eventType: 'LATE_NOTICE_APPROVED_LINKED',
            targetType: 'APPROVAL_REQUEST',
            targetId: input.requestId,
            reason: 'APPROVED_LATE_NOTICE_FINAL_EFFECT',
            afterRedacted: {
              businessDate: input.businessDate.toISOString().slice(0, 10),
              membershipId: input.membershipId,
              linkedOccurrences: occurrences.length,
            },
          },
        });
      }
      return occurrences;
    });
  }

  async listDayCloseCandidates(input: {
    tenantId: string;
    businessDate: Date;
    branchId?: string;
    take?: number;
  }) {
    const schedules = await this.db.workScheduleVersion.findMany({
      where: {
        tenantId: input.tenantId,
        branchId: input.branchId,
        businessDate: input.businessDate,
        supersededAt: null,
        state: { in: ['SCHEDULED', 'ADJUSTED'] },
        shiftDefinitionId: { not: null },
      },
      orderBy: [{ branchId: 'asc' }, { membershipId: 'asc' }, { id: 'asc' }],
      take: Math.min(Math.max(input.take ?? 500, 1), 1000),
    });
    if (!schedules.length) return [];
    const existing = await this.db.attendanceEvent.findMany({
      where: {
        tenantId: input.tenantId,
        businessDate: input.businessDate,
        membershipId: { in: schedules.map((schedule) => schedule.membershipId) },
      },
      select: { membershipId: true },
    });
    const membershipsWithAttendance = new Set(existing.map((event) => event.membershipId));
    return schedules
      .filter((schedule) => !membershipsWithAttendance.has(schedule.membershipId))
      .map((schedule) => ({
        tenantId: schedule.tenantId,
        membershipId: schedule.membershipId,
        branchId: schedule.branchId,
        businessDate: schedule.businessDate,
        scheduleVersionId: schedule.id,
        shiftDefinitionId: schedule.shiftDefinitionId!,
      }));
  }

  async createMissingCheckInEvent(input: {
    tenantId: string;
    membershipId: string;
    branchId: string;
    businessDate: Date;
    scheduleVersionId: string;
    correlationId: string;
  }) {
    const policy = await this.getEffectiveVideoPolicy(
      input.tenantId,
      input.branchId,
      input.businessDate,
    );
    if (!policy) return null;
    return runInTransaction(this.db, async (tx) => {
      const event = await tx.attendanceEvent.upsert({
        where: {
          tenantId_membershipId_businessDate: {
            tenantId: input.tenantId,
            membershipId: input.membershipId,
            businessDate: input.businessDate,
          },
        },
        update: {},
        create: {
          tenantId: input.tenantId,
          membershipId: input.membershipId,
          branchId: input.branchId,
          businessDate: input.businessDate,
          scheduleVersionId: input.scheduleVersionId,
          videoPolicyVersionId: policy.id,
          checkInAt: null,
          state: 'MISSING_CHECK_IN',
          dayClassification: 'NON_WORKED_NO_CHECKIN',
          classificationReason: 'NO_CHECKIN_AFTER_12_LOCAL',
          correlationId: input.correlationId,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          correlationId: input.correlationId,
          eventType: 'ATTENDANCE_DAY_CLOSED_MISSING_CHECKIN',
          targetType: 'ATTENDANCE_EVENT',
          targetId: event.id,
          reason: 'NO_CHECKIN_AFTER_12_LOCAL',
          afterRedacted: {
            attendanceEventId: event.id,
            membershipId: event.membershipId,
            branchId: event.branchId,
            businessDate: event.businessDate.toISOString().slice(0, 10),
          },
        },
      });
      await tx.outboxEvent.upsert({
        where: {
          tenantId_dedupeKey: {
            tenantId: input.tenantId,
            dedupeKey: `attendance-day-closed:${event.id}`,
          },
        },
        update: {},
        create: {
          tenantId: input.tenantId,
          aggregateType: 'ATTENDANCE_EVENT',
          aggregateId: event.id,
          eventType: 'attendance.day.closed',
          dedupeKey: `attendance-day-closed:${event.id}`,
          payloadRedacted: {
            attendanceEventId: event.id,
            membershipId: event.membershipId,
            branchId: event.branchId,
            businessDate: event.businessDate.toISOString().slice(0, 10),
            state: event.state,
            dayClassification: event.dayClassification,
          },
          correlationId: input.correlationId,
        },
      });
      return event;
    });
  }

  createVideoReviewResult(input: {
    tenantId: string;
    attendanceEventId: string;
    reviewStatus: 'PASSED' | 'FAILED' | 'WAIVED';
    reviewedByMembershipId: string;
    reason: string;
    failedCriteria: string[];
    correlationId: string;
  }) {
    return runInTransaction(this.db, async (tx) => {
      const review = await tx.videoReviewResult.create({
        data: {
          tenantId: input.tenantId,
          attendanceEventId: input.attendanceEventId,
          reviewStatus: input.reviewStatus,
          reviewedByMembershipId: input.reviewedByMembershipId,
          reason: input.reason,
          failedCriteriaJson: input.failedCriteria as Prisma.InputJsonValue,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.reviewedByMembershipId,
          correlationId: input.correlationId,
          eventType: 'VIDEO_REVIEW_RECORDED',
          targetType: 'VIDEO_REVIEW_RESULT',
          targetId: review.id,
          reason: input.reason,
          afterRedacted: {
            attendanceEventId: review.attendanceEventId,
            reviewStatus: review.reviewStatus,
          },
        },
      });
      if (input.reviewStatus === 'PASSED' || input.reviewStatus === 'WAIVED') {
        await tx.attendanceEvent.update({
          where: { tenantId_id: { tenantId: input.tenantId, id: input.attendanceEventId } },
          data: { state: 'CONFIRMED' },
        });
      }
      const videoAsset = await tx.checkInVideoAsset.findUnique({
        where: {
          tenantId_attendanceEventId: {
            tenantId: input.tenantId,
            attendanceEventId: input.attendanceEventId,
          },
        },
      });
      if (videoAsset) {
        await tx.actionItem.updateMany({
          where: {
            tenantId: input.tenantId,
            sourceType: 'ATTENDANCE_VIDEO_REVIEW',
            sourceId: videoAsset.id,
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
      await tx.outboxEvent.upsert({
        where: {
          tenantId_dedupeKey: {
            tenantId: input.tenantId,
            dedupeKey: `attendance-video-reviewed:${review.id}`,
          },
        },
        update: {},
        create: {
          tenantId: input.tenantId,
          aggregateType: 'VIDEO_REVIEW_RESULT',
          aggregateId: review.id,
          eventType: 'attendance.video.reviewed',
          dedupeKey: `attendance-video-reviewed:${review.id}`,
          payloadRedacted: {
            reviewId: review.id,
            attendanceEventId: review.attendanceEventId,
            reviewStatus: review.reviewStatus,
          },
          correlationId: input.correlationId,
        },
      });
      return review;
    });
  }

  getActiveAssignments(input: {
    tenantId: string;
    membershipId?: string;
    branchId?: string;
    at: Date;
  }) {
    return this.db.assignment.findMany({
      where: {
        tenantId: input.tenantId,
        membershipId: input.membershipId,
        branchId: input.branchId,
        status: 'ACTIVE',
        effectiveFrom: { lte: input.at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.at } }],
      },
      orderBy: [{ effectiveFrom: 'desc' }, { id: 'asc' }],
    });
  }

  listExistingLeaveDates(input: {
    tenantId: string;
    membershipId: string;
    dateFrom: Date;
    dateTo: Date;
  }) {
    return this.db.workScheduleVersion.findMany({
      where: {
        tenantId: input.tenantId,
        membershipId: input.membershipId,
        OR: [{ state: 'LEAVE_APPROVED' }, { leaveDurationKind: 'MORNING_HALF' }],
        supersededAt: null,
        businessDate: {
          gte: input.dateFrom,
          lt: new Date(input.dateTo.getTime() + 86_400_000),
        },
      },
      select: { businessDate: true },
      orderBy: { businessDate: 'asc' },
    });
  }

  listLeaveConflictCandidates(input: {
    tenantId: string;
    branchId: string;
    dateFrom: Date;
    dateTo: Date;
    excludeRequestId?: string;
    excludeMembershipId?: string;
  }) {
    return this.db.approvalRequest.findMany({
      where: {
        tenantId: input.tenantId,
        branchId: input.branchId,
        requestType: { in: ['LEAVE_SCHEDULE', 'SUDDEN_LEAVE'] },
        status: { in: ['IN_REVIEW', 'APPROVED'] },
        id: input.excludeRequestId ? { not: input.excludeRequestId } : undefined,
        requestedByMembershipId: input.excludeMembershipId
          ? { not: input.excludeMembershipId }
          : undefined,
        businessDate: { lt: new Date(input.dateTo.getTime() + 86_400_000) },
      },
      orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
    });
  }

  createLeaveConflictSnapshots(input: {
    tenantId: string;
    approvalRequestId: string;
    branchId: string;
    dates: Date[];
    departmentId?: string | null;
    positionId?: string | null;
    result: 'CLEAR' | 'CONFLICT' | 'WARNING';
    conflictingRequestId?: string | null;
    conflictingMembershipId?: string | null;
  }) {
    if (input.dates.length === 0) return Promise.resolve({ count: 0 });
    return this.db.leaveConflictSnapshot.createMany({
      data: input.dates.map((businessDate) => ({
        tenantId: input.tenantId,
        approvalRequestId: input.approvalRequestId,
        branchId: input.branchId,
        businessDate,
        departmentId: input.departmentId,
        positionId: input.positionId,
        conflictingRequestId: input.conflictingRequestId,
        conflictingMembershipId: input.conflictingMembershipId,
        result: input.result,
      })),
    });
  }

  listMonthlyAbsenceSummaries(input: {
    tenantId: string;
    yearMonth: string;
    branchId?: string;
    overThreshold?: boolean;
    take?: number;
  }) {
    return this.db.monthlyAbsenceSummary.findMany({
      where: {
        tenantId: input.tenantId,
        yearMonth: input.yearMonth,
        branchId: input.branchId,
        overThreshold: input.overThreshold,
      },
      orderBy: [{ overThreshold: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }],
      take: Math.min(Math.max(input.take ?? 100, 1), 500),
    });
  }

  async readAttendanceOnTime(input: {
    tenantId: string;
    membershipId: string;
    branchId: string;
    businessDate: string;
  }) {
    const event = await this.db.attendanceEvent.findUnique({
      where: {
        tenantId_membershipId_businessDate: {
          tenantId: input.tenantId,
          membershipId: input.membershipId,
          businessDate: new Date(`${input.businessDate}T00:00:00.000Z`),
        },
      },
    });
    if (!event || event.branchId !== input.branchId || event.state !== 'CONFIRMED') return null;
    if (event.dayClassification === 'WORKED_ON_TIME') {
      return {
        sourceAttendanceEventId: event.id,
        observedAt: event.checkInAt ?? event.serverRecordedAt,
        value: '100' as const,
        dayClassification: event.dayClassification,
        scheduleVersionId: event.scheduleVersionId,
        policyVersionId: event.videoPolicyVersionId,
      };
    }
    if (event.dayClassification === 'WORKED_LATE') {
      return {
        sourceAttendanceEventId: event.id,
        observedAt: event.checkInAt ?? event.serverRecordedAt,
        value: '0' as const,
        dayClassification: event.dayClassification,
        scheduleVersionId: event.scheduleVersionId,
        policyVersionId: event.videoPolicyVersionId,
      };
    }
    return null;
  }

  getClient() {
    return this.db;
  }
}
