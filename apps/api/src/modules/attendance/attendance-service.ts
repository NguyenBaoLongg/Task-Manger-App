import {
  ProblemError,
  calculateLate,
  classifyAttendanceDay,
  localTimeFlags,
  shouldCreateQueueImpact,
  shiftStartInstant,
  systemClock,
  type Clock,
} from '@adsup/domain';
import type { AttendanceRepository } from '@adsup/database';

const dateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);

export class AttendanceService {
  constructor(
    private readonly repository: AttendanceRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  createVideoPolicyVersion(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    scopeType: 'TENANT' | 'BRANCH';
    branchId?: string;
    effectiveFromDate: string;
    effectiveToDate?: string | null;
    requiresAcknowledgement: boolean;
    requiresFullBody: boolean;
    requiresWorkArea: boolean;
    manualReviewRequired: boolean;
    acknowledgementText?: string;
    missingCheckinPenaltyMinor: bigint;
    videoFailedPenaltyMinor: bigint;
    currency: 'VND';
    reason: string;
  }) {
    return this.repository.createVideoPolicyVersion({
      ...input,
      branchId: input.branchId ?? null,
      effectiveFromDate: dateOnly(input.effectiveFromDate),
      effectiveToDate: input.effectiveToDate ? dateOnly(input.effectiveToDate) : null,
    });
  }

  async acknowledgeVideoPolicy(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    policyVersionId: string;
    action: 'ACKNOWLEDGED';
    deviceId?: string;
  }) {
    const policy = await this.repository.getVideoPolicy(input.tenantId, input.policyVersionId);
    if (!policy)
      throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'KhÃ´ng tÃ¬m tháº¥y policy video.');
    return this.repository.acknowledgeVideoPolicy({
      tenantId: input.tenantId,
      membershipId: input.actorMembershipId,
      policyVersionId: input.policyVersionId,
      deviceId: input.deviceId,
      action: input.action,
      correlationId: input.correlationId,
    });
  }

  async createCheckIn(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    businessDate: string;
    mediaObjectId: string;
  }) {
    const businessDate = dateOnly(input.businessDate);
    const schedule = await this.repository.getEffectiveSchedule(
      input.tenantId,
      input.actorMembershipId,
      businessDate,
    );
    if (!schedule || !schedule.shiftDefinitionId) {
      throw new ProblemError(
        422,
        'BUSINESS_RULE_VIOLATION',
        'KhÃ´ng cÃ³ lá»‹ch ca Ä‘á»ƒ check-in.',
      );
    }
    const shift = await this.repository.getShift(input.tenantId, schedule.shiftDefinitionId);
    if (!shift) throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'KhÃ´ng tÃ¬m tháº¥y ca lÃ m.');
    const policy = await this.repository.getEffectiveVideoPolicy(
      input.tenantId,
      schedule.branchId,
      businessDate,
    );
    if (!policy) throw new ProblemError(422, 'BUSINESS_RULE_VIOLATION', 'ChÆ°a cÃ³ policy video.');
    if (
      policy.requiresAcknowledgement &&
      !(await this.repository.getPolicyAcknowledgement(
        input.tenantId,
        input.actorMembershipId,
        policy.id,
      ))
    ) {
      throw new ProblemError(
        422,
        'BUSINESS_RULE_VIOLATION',
        'Cáº§n xÃ¡c nháº­n policy video trÆ°á»›c khi check-in.',
      );
    }
    const media = await this.repository.getMediaObject(input.tenantId, input.mediaObjectId);
    if (!media || media.ownerMembershipId !== input.actorMembershipId || media.status !== 'READY') {
      throw new ProblemError(
        404,
        'RESOURCE_NOT_FOUND',
        'KhÃ´ng tÃ¬m tháº¥y video check-in há»£p lá»‡.',
      );
    }
    const checkInAt = this.clock.now();
    const shiftStartAt = shiftStartInstant({
      businessDate: input.businessDate,
      startLocalTime: shift.startLocalTime,
      timezone: shift.timezone,
    });
    const late = calculateLate(shiftStartAt, checkInAt);
    const classification = classifyAttendanceDay({
      hasCheckIn: true,
      lateMinutes: late.lateMinutes,
      checkInAt,
      timezone: shift.timezone,
    });
    const event = await this.repository.createCheckIn({
      tenantId: input.tenantId,
      membershipId: input.actorMembershipId,
      branchId: schedule.branchId,
      businessDate,
      scheduleVersionId: schedule.id,
      videoPolicyVersionId: policy.id,
      checkInAt,
      state: 'VIDEO_UPLOADED',
      dayClassification: classification.classification,
      classificationReason: classification.reason,
      mediaObjectId: media.id,
      originalContentType: media.contentType,
      originalChecksum: media.checksumSha256,
      correlationId: input.correlationId,
    });
    if (late.lateMinutes > 0) {
      const penaltyPolicy = await this.repository.getEffectiveAttendancePenaltyPolicy(
        input.tenantId,
        schedule.branchId,
        businessDate,
      );
      if (penaltyPolicy) {
        const flags = localTimeFlags(checkInAt, shift.timezone);
        await this.repository.createLateOccurrence({
          tenantId: input.tenantId,
          attendanceEventId: event.id,
          membershipId: input.actorMembershipId,
          branchId: schedule.branchId,
          businessDate,
          shiftStartAt,
          checkInAt,
          lateSeconds: late.lateSeconds,
          lateMinutes: late.lateMinutes,
          after15Local: flags.after15Local,
          after18Local: flags.after18Local,
          queueImpactFlag: shouldCreateQueueImpact({
            lateMinutes: late.lateMinutes,
            classification: classification.classification,
          }),
          policyVersionId: penaltyPolicy.id,
        });
      }
    }
    return event;
  }
}
