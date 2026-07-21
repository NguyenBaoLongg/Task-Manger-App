import { describe, expect, it, vi } from 'vitest';
import { CloseDayRunner } from '../../src/kpi/close-day-runner.js';
import { RerunRunner } from '../../src/kpi/rerun-runner.js';

const tenantId = '10000000-0000-4000-8000-000000000001';
const businessDate = new Date('2026-07-19T00:00:00Z');

describe('close-day lease/checkpoint runner', () => {
  it('continues after a poison employee and records a partial checkpoint', async () => {
    const advanceCheckpoint = vi.fn();
    const failRun = vi.fn();
    const repository = {
      ensureRun: vi.fn().mockResolvedValue({ id: 'run-1' }),
      claimRun: vi.fn().mockResolvedValue({ id: 'run-1', checkpoint: null }),
      listCandidateMemberships: vi
        .fn()
        .mockResolvedValueOnce([{ id: 'member-1' }, { id: 'member-2' }]),
      advanceCheckpoint,
      failRun,
      completeRun: vi.fn(),
    };
    const closeMembership = vi
      .fn()
      .mockRejectedValueOnce(new Error('poison'))
      .mockResolvedValueOnce({ replayed: false });
    const runner = new CloseDayRunner(repository as never, { closeMembership } as never, 200);
    await expect(
      runner.run({
        tenantId,
        businessDate,
        now: new Date('2026-07-19T13:00:02Z'),
        workerId: 'worker-1',
      }),
    ).resolves.toMatchObject({ processed: 2, failures: 1 });
    expect(advanceCheckpoint).toHaveBeenLastCalledWith(
      expect.objectContaining({ checkpoint: 'member-2' }),
    );
    expect(failRun).toHaveBeenCalledWith(
      expect.objectContaining({ partial: true, code: 'ITEM_FAILURES' }),
    );
  });

  it('does no work when another worker owns the lease', async () => {
    const repository = {
      ensureRun: vi.fn().mockResolvedValue({ id: 'run-1' }),
      claimRun: vi.fn().mockResolvedValue(null),
    };
    const runner = new CloseDayRunner(repository as never, { closeMembership: vi.fn() } as never);
    await expect(runner.run({ tenantId, businessDate })).resolves.toEqual({
      runId: 'run-1',
      claimed: false,
      processed: 0,
    });
  });
});

describe('manual evaluation rerun runner', () => {
  it('honors the persisted branch/member scope and completes the durable run', async () => {
    const completeRun = vi.fn();
    const listCandidateMemberships = vi.fn().mockResolvedValueOnce([{ id: 'member-2' }]);
    const repository = {
      listPendingRerunRuns: vi.fn().mockResolvedValue([
        {
          id: 'rerun-1',
          businessDate,
          correlationId: 'rerun',
          payloadJson: { branchIds: ['branch-1'], membershipIds: ['member-2'] },
        },
      ]),
      claimRun: vi.fn().mockResolvedValue({
        id: 'rerun-1',
        checkpoint: null,
        payloadJson: { branchIds: ['branch-1'], membershipIds: ['member-2'] },
      }),
      listCandidateMemberships,
      advanceCheckpoint: vi.fn(),
      completeRun,
      failRun: vi.fn(),
    };
    const closeMembership = vi.fn().mockResolvedValue({ replayed: true });
    const runner = new RerunRunner(repository as never, { closeMembership } as never);
    await expect(
      runner.runPending(
        tenantId,
        new Date('2026-07-19T13:00:02Z'),
        '00000000-0000-4000-8000-000000000099',
      ),
    ).resolves.toEqual([{ runId: 'rerun-1', processed: 1, failures: 0 }]);
    expect(listCandidateMemberships).toHaveBeenCalledWith(tenantId, undefined, 200, {
      membershipIds: ['member-2'],
      branchIds: ['branch-1'],
      businessDate,
    });
    expect(closeMembership).toHaveBeenCalledWith(
      expect.objectContaining({ membershipId: 'member-2', jobRunId: 'rerun-1' }),
    );
    expect(completeRun).toHaveBeenCalledOnce();
  });
});
