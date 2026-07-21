import type { LeaveService } from '../attendance/leave-service.js';

export class WorkflowEffects {
  constructor(private readonly leaveService?: LeaveService) {}

  async applyFinalEffects(input: {
    request: {
      tenantId: string;
      id: string;
      requestType: string;
      requestedByMembershipId: string;
      branchId: string;
      status: string;
      payloadJson: unknown;
      reason: string;
    };
    actorMembershipId: string;
    correlationId: string;
  }) {
    if (input.request.status !== 'APPROVED') return { applied: false };
    if (
      input.request.requestType === 'LEAVE_SCHEDULE' ||
      input.request.requestType === 'SUDDEN_LEAVE'
    ) {
      return this.leaveService?.applyApprovedLeaveRequest(input) ?? { applied: false };
    }
    return { applied: true };
  }
}
