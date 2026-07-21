import { describe, expect, it } from 'vitest';
import { resolveSoleCurrentBranch } from './assignment.js';

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const now = new Date('2026-07-19T12:00:00Z');
const assignment = (branchId: string) => ({
  id: id(Number(branchId.slice(-1)) || 9),
  tenantId: id(1),
  membershipId: id(2),
  branchId,
  effectiveFrom: new Date('2026-01-01T00:00:00Z'),
  status: 'ACTIVE' as const,
});

describe('single working branch', () => {
  it('resolves one active branch', () => {
    expect(resolveSoleCurrentBranch([assignment(id(3))], now)).toMatchObject({
      ok: true,
      branchId: id(3),
    });
  });

  it('fails safe when no active branch exists', () => {
    expect(resolveSoleCurrentBranch([], now)).toEqual({
      ok: false,
      code: 'NO_ACTIVE_BRANCH',
      count: 0,
    });
  });

  it('fails safe when multiple branch assignments overlap', () => {
    expect(resolveSoleCurrentBranch([assignment(id(3)), assignment(id(4))], now)).toEqual({
      ok: false,
      code: 'MULTIPLE_ACTIVE_BRANCHES',
      count: 2,
    });
  });

  it('allows multiple assignment rows for the same single branch', () => {
    expect(resolveSoleCurrentBranch([assignment(id(3)), assignment(id(3))], now)).toMatchObject({
      ok: true,
      branchId: id(3),
    });
  });
});
