import { describe, expect, it, vi } from 'vitest';
import { AttendanceRepository } from './attendance.repository.js';
import { PenaltyRepository } from './penalty.repository.js';
import { WorkflowRepository } from './workflow.repository.js';

describe('Module 3 branch policy precedence', () => {
  it('requests branch video and penalty overrides before tenant defaults', async () => {
    const videoFindFirst = vi.fn(async () => null);
    const attendancePenaltyFindFirst = vi.fn(async () => null);
    const database = {
      videoPolicyVersion: { findFirst: videoFindFirst },
      attendancePenaltyPolicyVersion: { findFirst: attendancePenaltyFindFirst },
    };
    const attendance = new AttendanceRepository(database as never);
    const at = new Date('2026-07-24T00:00:00.000Z');

    await attendance.getEffectiveVideoPolicy('tenant-1', 'branch-1', at);
    await attendance.getEffectiveAttendancePenaltyPolicy('tenant-1', 'branch-1', at);

    expect(videoFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ scopeType: 'desc' }, { versionNumber: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(attendancePenaltyFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ scopeType: 'desc' }, { versionNumber: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('uses the same branch-first precedence in penalty assessment and workflow routing', async () => {
    const policyFindFirst = vi.fn(async () => null);
    const definitionFindMany = vi.fn(async () => []);
    const penalty = new PenaltyRepository({
      attendancePenaltyPolicyVersion: { findFirst: policyFindFirst },
    } as never);
    const workflow = new WorkflowRepository({
      workflowDefinitionVersion: { findMany: definitionFindMany },
    } as never);
    const at = new Date('2026-07-24T00:00:00.000Z');

    await penalty.getEffectiveAttendancePenaltyPolicy('tenant-1', 'branch-1', at);
    await workflow.listEffectiveDefinitions({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      requestType: 'LATE_NOTICE',
      businessDate: at,
    });

    expect(policyFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ scopeType: 'desc' }, { versionNumber: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(definitionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ scopeType: 'desc' }, { versionNumber: 'desc' }, { id: 'desc' }],
      }),
    );
  });
});
