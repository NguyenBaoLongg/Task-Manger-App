import { describe, expect, it, vi } from 'vitest';
import { OrganizationService } from '../../src/modules/organization/organization-service.js';

const tenantId = '10000000-0000-4000-8000-000000000001';
const actorMembershipId = '20000000-0000-4000-8000-000000000001';
const branchId = '30000000-0000-4000-8000-000000000001';

const baseInput = {
  tenantId,
  actorMembershipId,
  code: ' cn1 ',
  name: ' Cơ sở 1 ',
};

describe('organization service', () => {
  it('normalizes branch code and name', async () => {
    const createBranch = vi.fn((value: unknown) => value);
    const service = new OrganizationService({
      createBranch,
      listBranches: vi.fn().mockResolvedValue([{ id: branchId, status: 'ACTIVE' }]),
      createAssignment: vi.fn(),
    } as never);
    await service.createBranch(baseInput);
    expect(createBranch).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CN1', name: 'Cơ sở 1' }),
    );
  });

  it('auto-assigns the creator when the new branch is the only active one', async () => {
    const createBranch = vi.fn().mockResolvedValue({ id: branchId, status: 'ACTIVE' });
    const createAssignment = vi.fn();
    const service = new OrganizationService({
      createBranch,
      listBranches: vi.fn().mockResolvedValue([
        { id: branchId, status: 'ACTIVE' },
        { id: 'old-branch', status: 'INACTIVE' },
      ]),
      createAssignment,
    } as never);
    await service.createBranch(baseInput);
    expect(createAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        membershipId: actorMembershipId,
        branchId,
        reason: 'BRANCH_CREATED_BY_MEMBER',
        correlationId: expect.any(String) as string,
      }),
    );
  });

  it('does not auto-assign when another active branch already exists', async () => {
    const createBranch = vi.fn().mockResolvedValue({ id: branchId, status: 'ACTIVE' });
    const createAssignment = vi.fn();
    const service = new OrganizationService({
      createBranch,
      listBranches: vi.fn().mockResolvedValue([
        { id: branchId, status: 'ACTIVE' },
        { id: 'existing', status: 'ACTIVE' },
      ]),
      createAssignment,
    } as never);
    await service.createBranch(baseInput);
    expect(createAssignment).not.toHaveBeenCalled();
  });
});
