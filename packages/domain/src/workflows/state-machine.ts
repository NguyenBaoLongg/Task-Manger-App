import { randomUUID } from 'node:crypto';
import { ProblemError } from '../foundation.js';
import type { ApprovalDecision, ApprovalStepMode, RequestStatus } from './types.js';

export interface WorkflowStepTemplate {
  mode: ApprovalStepMode;
  requiredApprovalCount: number;
}

export interface WorkflowRunStep {
  id: string;
  stepOrder: number;
  mode: ApprovalStepMode;
  requiredApprovalCount: number;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'SKIPPED';
}

export function createInitialRunSteps(templates: WorkflowStepTemplate[]): WorkflowRunStep[] {
  return templates.map((template, index) => ({
    id: randomUUID(),
    stepOrder: index + 1,
    mode: template.mode,
    requiredApprovalCount: template.requiredApprovalCount,
    status: index === 0 ? 'ACTIVE' : 'PENDING',
  }));
}

export function applyApprovalDecision(input: {
  requestStatus: RequestStatus;
  steps: WorkflowRunStep[];
  stepId: string;
  decision: ApprovalDecision;
  approvalsOnStep: number;
}): { requestStatus: RequestStatus; steps: WorkflowRunStep[] } {
  if (!['SUBMITTED', 'IN_REVIEW'].includes(input.requestStatus)) {
    throw new ProblemError(
      409,
      'CONFLICT',
      'YÃªu cáº§u khÃ´ng cÃ²n á»Ÿ tráº¡ng thÃ¡i cÃ³ thá»ƒ duyá»‡t.',
    );
  }
  const steps = input.steps.map((step) => ({ ...step }));
  const current = steps.find((step) => step.id === input.stepId);
  if (!current || current.status !== 'ACTIVE') {
    throw new ProblemError(409, 'CONFLICT', 'BÆ°á»›c duyá»‡t khÃ´ng active.');
  }
  if (input.decision === 'REJECT') {
    current.status = 'COMPLETED';
    return { requestStatus: 'REJECTED', steps };
  }
  if (input.decision === 'REQUEST_CHANGES') {
    return { requestStatus: 'IN_REVIEW', steps };
  }
  if (input.decision === 'CANCEL') {
    current.status = 'COMPLETED';
    return { requestStatus: 'CANCELLED', steps };
  }
  if (input.approvalsOnStep < current.requiredApprovalCount) {
    return { requestStatus: 'IN_REVIEW', steps };
  }
  current.status = 'COMPLETED';
  const next = steps.find((step) => step.stepOrder === current.stepOrder + 1);
  if (next) {
    next.status = 'ACTIVE';
    return { requestStatus: 'IN_REVIEW', steps };
  }
  return { requestStatus: 'APPROVED', steps };
}
