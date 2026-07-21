import { describe, expect, it } from 'vitest';
import { ProblemError, assertSameTenant, problemDocument } from './foundation.js';
import { authorize, type AuthorizationInput } from './authorization.js';

describe('foundation boundaries', () => {
  it('rejects a foreign tenant without disclosing resource existence', () => {
    expect(() => assertSameTenant('tenant-a', 'tenant-b')).toThrowError(ProblemError);
    try {
      assertSameTenant('tenant-a', 'tenant-b');
    } catch (error) {
      expect(problemDocument(error, 'correlation-1')).toMatchObject({
        status: 404,
        code: 'RESOURCE_NOT_FOUND',
        correlationId: 'correlation-1',
      });
    }
  });

  it('requires active scoped membership and permission', () => {
    const input: AuthorizationInput = {
      tenantId: 'tenant-a',
      membershipId: 'member-a',
      membershipStatus: 'ACTIVE',
      permission: 'branch.manage',
      requestedBranchId: 'branch-a',
      bindings: [
        {
          permission: 'branch.manage',
          scopeType: 'BRANCH',
          branchId: 'branch-a',
          effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        },
      ],
      now: new Date('2026-07-19T00:00:00Z'),
    };
    expect(authorize(input)).toEqual({ allowed: true });
    expect(authorize({ ...input, requestedBranchId: 'branch-b' }).allowed).toBe(false);
    expect(authorize({ ...input, requestedBranchId: undefined })).toEqual({
      allowed: false,
      reason: 'SCOPE_MISMATCH',
    });
  });
});
