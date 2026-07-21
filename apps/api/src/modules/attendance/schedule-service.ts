import {
  ProblemError,
  classifyScheduleChange,
  resolveSoleCurrentBranch,
  shiftStartInstant,
  systemClock,
  type Clock,
} from '@adsup/domain';
import type { AttendanceRepository } from '@adsup/database';
import type { ActionItemRepository } from '@adsup/database';

const dateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);

export class ScheduleService {
  constructor(
    private readonly repository: AttendanceRepository,
    private readonly clock: Clock = systemClock,
    private readonly actionItems?: ActionItemRepository,
  ) {}

  async listShifts(input: { tenantId: string; cursor?: string }) {
    const items = await this.repository.listShifts(input);
    return { items, pageInfo: { nextCursor: null } };
  }

  async listSchedules(input: {
    tenantId: string;
    branchId?: string;
    membershipId?: string;
    dateFrom: string;
    dateTo: string;
    cursor?: string;
  }) {
    const items = await this.repository.listSchedules({
      tenantId: input.tenantId,
      branchId: input.branchId,
      membershipId: input.membershipId,
      dateFrom: dateOnly(input.dateFrom),
      dateTo: dateOnly(input.dateTo),
    });
    return { items, pageInfo: { nextCursor: null } };
  }

  async createOrEditMySchedule(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    businessDate: string;
    shiftDefinitionId: string;
    reason?: string;
  }) {
    const shift = await this.repository.getShift(input.tenantId, input.shiftDefinitionId);
    if (!shift || shift.status !== 'ACTIVE') {
      throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'KhÃ´ng tÃ¬m tháº¥y ca lÃ m.');
    }
    const businessDate = dateOnly(input.businessDate);
    if (
      shift.effectiveFromDate > businessDate ||
      (shift.effectiveToDate && shift.effectiveToDate < businessDate)
    ) {
      throw new ProblemError(
        422,
        'BUSINESS_RULE_VIOLATION',
        'Ca lÃ m khÃ´ng hiá»‡u lá»±c cho ngÃ y nÃ y.',
      );
    }

    const shiftStartAt = shiftStartInstant({
      businessDate: input.businessDate,
      startLocalTime: shift.startLocalTime,
      timezone: shift.timezone,
    });
    const assignments = await this.repository.getClient().assignment.findMany({
      where: {
        tenantId: input.tenantId,
        membershipId: input.actorMembershipId,
        status: 'ACTIVE',
        effectiveFrom: { lte: shiftStartAt },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: shiftStartAt } }],
      },
    });
    const branch = resolveSoleCurrentBranch(assignments, shiftStartAt);
    if (!branch.ok) {
      throw new ProblemError(
        422,
        branch.code,
        branch.code === 'NO_ACTIVE_BRANCH'
          ? 'NhÃ¢n sá»± chÆ°a cÃ³ cÆ¡ sá»Ÿ lÃ m viá»‡c hiá»‡u lá»±c.'
          : 'NhÃ¢n sá»± Ä‘ang cÃ³ nhiá»u cÆ¡ sá»Ÿ hiá»‡u lá»±c.',
      );
    }

    const existing = await this.repository.getEffectiveSchedule(
      input.tenantId,
      input.actorMembershipId,
      businessDate,
    );
    const decision = classifyScheduleChange({
      now: this.clock.now(),
      shiftStartAt,
      hasExistingSchedule: Boolean(existing),
    });
    if (decision.outcome === 'APPROVAL_REQUIRED') {
      await this.projectScheduleActionItem({
        tenantId: input.tenantId,
        ownerMembershipId: input.actorMembershipId,
        branchId: branch.branchId,
        sourceId: existing?.id ?? shift.id,
        businessDate,
        deadlineAt: shiftStartAt,
        title: 'YÃªu cáº§u duyá»‡t Ä‘á»•i ca',
        correlationId: input.correlationId,
      });
      throw new ProblemError(
        422,
        'BUSINESS_RULE_VIOLATION',
        'Thay Ä‘á»•i ca trong vÃ²ng 24 giá» cáº§n gá»­i yÃªu cáº§u duyá»‡t.',
        { nextAction: 'SUBMIT_SHIFT_CHANGE_REQUEST' },
      );
    }
    if (decision.outcome === 'MANAGER_REQUIRED') {
      await this.projectScheduleActionItem({
        tenantId: input.tenantId,
        ownerMembershipId: input.actorMembershipId,
        branchId: branch.branchId,
        sourceId: existing?.id ?? shift.id,
        businessDate,
        deadlineAt: shiftStartAt,
        title: 'Ca Ä‘Ã£ báº¯t Ä‘áº§u cáº§n quáº£n lÃ½ Ä‘iá»u chá»‰nh',
        correlationId: input.correlationId,
      });
      throw new ProblemError(
        422,
        'BUSINESS_RULE_VIOLATION',
        'Ca Ä‘Ã£ báº¯t Ä‘áº§u, chá»‰ quáº£n lÃ½ Ä‘Æ°á»£c Ä‘iá»u chá»‰nh cÃ³ lÃ½ do.',
        { nextAction: 'MANAGER_ADJUSTMENT_REQUIRED' },
      );
    }

    return this.repository.createScheduleVersion({
      tenantId: input.tenantId,
      membershipId: input.actorMembershipId,
      branchId: branch.branchId,
      businessDate,
      shiftDefinitionId: shift.id,
      state: 'SCHEDULED',
      changeKind: existing ? 'SELF_EDIT' : 'SELF_EDIT',
      effectiveAt: this.clock.now(),
      createdByMembershipId: input.actorMembershipId,
      reason: input.reason ?? 'SELF_SCHEDULE_CHANGE',
      correlationId: input.correlationId,
    });
  }

  private async projectScheduleActionItem(input: {
    tenantId: string;
    ownerMembershipId: string;
    branchId: string;
    sourceId: string;
    businessDate: Date;
    deadlineAt: Date;
    title: string;
    correlationId: string;
  }) {
    if (!this.actionItems) return;
    const now = this.clock.now();
    await this.actionItems.project({
      tenantId: input.tenantId,
      ownerMembershipId: input.ownerMembershipId,
      branchId: input.branchId,
      itemType: 'DATA_QUALITY',
      sourceType: 'APPROVAL_DECISION_REQUIRED',
      sourceId: input.sourceId,
      businessDate: input.businessDate,
      state: 'OPEN',
      title: input.title,
      deadlineAt: input.deadlineAt,
      sourceFreshnessAt: now,
      deepLink: `adsup://attendance/schedules/${input.sourceId}`,
      correlationId: input.correlationId,
    });
  }
}
