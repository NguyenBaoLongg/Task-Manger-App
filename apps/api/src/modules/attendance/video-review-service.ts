import { ProblemError } from '@adsup/domain';
import type { AttendanceRepository } from '@adsup/database';

export class VideoReviewService {
  constructor(private readonly repository: AttendanceRepository) {}

  async review(input: {
    tenantId: string;
    attendanceEventId: string;
    actorMembershipId: string;
    correlationId: string;
    reviewStatus: 'PASSED' | 'FAILED' | 'WAIVED';
    reason: string;
    failedCriteria?: string[];
  }) {
    const event = await this.repository.getAttendanceEvent(input.tenantId, input.attendanceEventId);
    if (!event) throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'KhÃ´ng tÃ¬m tháº¥y check-in.');
    return this.repository.createVideoReviewResult({
      tenantId: input.tenantId,
      attendanceEventId: input.attendanceEventId,
      reviewStatus: input.reviewStatus,
      reviewedByMembershipId: input.actorMembershipId,
      reason: input.reason,
      failedCriteria: input.failedCriteria ?? [],
      correlationId: input.correlationId,
    });
  }
}
