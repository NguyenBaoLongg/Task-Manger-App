import { describe, expect, it } from 'vitest';
import { applyApprovalDecision, createInitialRunSteps } from './state-machine.js';

describe('workflow approval state machine', () => {
  it('activates a one-level sequential workflow and approves on first approval', () => {
    const steps = createInitialRunSteps([{ mode: 'SEQUENTIAL', requiredApprovalCount: 1 }]);
    expect(steps[0]?.status).toBe('ACTIVE');
    expect(
      applyApprovalDecision({
        requestStatus: 'IN_REVIEW',
        steps,
        stepId: steps[0]!.id,
        decision: 'APPROVE',
        approvalsOnStep: 1,
      }),
    ).toMatchObject({ requestStatus: 'APPROVED' });
  });

  it('keeps sequential workflow in review until the active step completes', () => {
    const steps = createInitialRunSteps([
      { mode: 'SEQUENTIAL', requiredApprovalCount: 1 },
      { mode: 'SEQUENTIAL', requiredApprovalCount: 1 },
    ]);
    const result = applyApprovalDecision({
      requestStatus: 'IN_REVIEW',
      steps,
      stepId: steps[0]!.id,
      decision: 'APPROVE',
      approvalsOnStep: 1,
    });
    expect(result.requestStatus).toBe('IN_REVIEW');
    expect(result.steps[1]?.status).toBe('ACTIVE');
  });

  it('completes parallel step only after required approvals and rejects immediately', () => {
    const steps = createInitialRunSteps([{ mode: 'PARALLEL', requiredApprovalCount: 2 }]);
    expect(
      applyApprovalDecision({
        requestStatus: 'IN_REVIEW',
        steps,
        stepId: steps[0]!.id,
        decision: 'APPROVE',
        approvalsOnStep: 1,
      }).requestStatus,
    ).toBe('IN_REVIEW');
    expect(
      applyApprovalDecision({
        requestStatus: 'IN_REVIEW',
        steps,
        stepId: steps[0]!.id,
        decision: 'APPROVE',
        approvalsOnStep: 2,
      }).requestStatus,
    ).toBe('APPROVED');
    expect(
      applyApprovalDecision({
        requestStatus: 'IN_REVIEW',
        steps,
        stepId: steps[0]!.id,
        decision: 'REJECT',
        approvalsOnStep: 0,
      }).requestStatus,
    ).toBe('REJECTED');
  });
});
