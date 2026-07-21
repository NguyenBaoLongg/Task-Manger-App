import { describe, it } from 'vitest';
import { expectOperations } from '../helpers/contracts.js';

describe('organization HTTP contract', () => {
  it('covers structure, membership, assignment and roles', async () => {
    await expectOperations([
      'listBranches',
      'createBranch',
      'updateBranchStatus',
      'listDepartments',
      'createDepartment',
      'updateDepartmentStatus',
      'listPositions',
      'createPosition',
      'updatePositionStatus',
      'listMemberships',
      'updateMembership',
      'createAssignment',
      'listMembershipAssignments',
      'listRoles',
      'createRole',
      'grantRoleBinding',
    ]);
  });
});
