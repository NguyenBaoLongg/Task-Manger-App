import type { MembershipId, TenantId, UUID } from '../foundation.js';
import type { AttendanceBranchId, AttendanceBusinessDate } from '../attendance/types.js';

export type RequestType = 'SHIFT_CHANGE' | 'LATE_NOTICE' | 'LEAVE_SCHEDULE' | 'SUDDEN_LEAVE';
export type RequestStatus =
  'DRAFT' | 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
export type ApprovalStepMode = 'SEQUENTIAL' | 'PARALLEL';
export type ApprovalDecision = 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'CANCEL';

export interface WorkflowRequestIdentity {
  tenantId: TenantId;
  requestId: UUID;
  requestType: RequestType;
  requestedByMembershipId: MembershipId;
  branchId: AttendanceBranchId;
  businessDate?: AttendanceBusinessDate | null;
}

export interface ApprovalDecisionCommand {
  tenantId: TenantId;
  requestId: UUID;
  stepId: UUID;
  approverMembershipId: MembershipId;
  decision: ApprovalDecision;
  reason: string;
  idempotencyKey: string;
}
