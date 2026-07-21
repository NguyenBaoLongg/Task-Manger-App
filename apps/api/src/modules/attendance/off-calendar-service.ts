import { ProblemError, systemClock, type Clock } from '@adsup/domain';
import type { AttendanceRepository } from '@adsup/database';

const dateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);

export class OffCalendarService {
  constructor(
    private readonly repository: AttendanceRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  createVersion(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    scopeType: 'TENANT' | 'BRANCH';
    branchId?: string;
    name: string;
    startDate: string;
    endDate: string;
    reason: string;
  }) {
    if (input.endDate < input.startDate) {
      throw new ProblemError(422, 'VALIDATION_FAILED', 'Khoang ngay OFF khong hop le.');
    }
    if (input.scopeType === 'BRANCH' && !input.branchId) {
      throw new ProblemError(422, 'VALIDATION_FAILED', 'OFF theo co so can branchId.');
    }
    if (input.scopeType === 'TENANT' && input.branchId) {
      throw new ProblemError(422, 'VALIDATION_FAILED', 'OFF tenant khong duoc gan branchId.');
    }
    this.clock.now();
    return this.repository.createOffCalendarVersion({
      tenantId: input.tenantId,
      scopeType: input.scopeType,
      branchId: input.branchId ?? null,
      name: input.name,
      startDate: dateOnly(input.startDate),
      endDate: dateOnly(input.endDate),
      actorMembershipId: input.actorMembershipId,
      reason: input.reason,
      correlationId: input.correlationId,
    });
  }
}
