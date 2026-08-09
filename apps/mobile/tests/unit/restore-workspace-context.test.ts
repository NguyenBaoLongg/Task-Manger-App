import { restoreWorkspaceContext } from '@/tenant/restore-workspace-context';

const ACTIVE = [{ tenantId: 'tenant-1', membershipId: 'member-1', status: 'ACTIVE' }];
const BRANCHES = [
  { id: 'branch-1', status: 'ACTIVE' },
  { id: 'branch-2', status: 'ACTIVE' },
];

const build = (overrides: Partial<Parameters<typeof restoreWorkspaceContext>[0]> = {}) => ({
  hasSession: true,
  selection: { tenantId: 'tenant-1', branchId: 'branch-1' },
  listMemberships: async () => ACTIVE,
  listBranches: async () => BRANCHES,
  ...overrides,
});

describe('restoreWorkspaceContext', () => {
  it('sends a user with no session to sign-in without asking the backend anything', async () => {
    let asked = false;
    const outcome = await restoreWorkspaceContext(
      build({
        hasSession: false,
        listMemberships: async () => {
          asked = true;
          return ACTIVE;
        },
      }),
    );

    expect(outcome).toEqual({ route: 'sign-in' });
    expect(asked).toBe(false);
  });

  it('sends a user with no saved selection to workspace selection', async () => {
    expect(await restoreWorkspaceContext(build({ selection: undefined }))).toEqual({
      route: 'workspace-selection',
    });
  });

  it('restores the dashboard when the backend still confirms membership and branch', async () => {
    expect(await restoreWorkspaceContext(build())).toEqual({
      route: 'dashboard',
      context: {
        tenantId: 'tenant-1',
        membershipId: 'member-1',
        branchId: 'branch-1',
        permissions: [],
        version: 1,
      },
    });
  });

  it('ignores a selection naming a tenant the backend no longer returns', async () => {
    expect(
      await restoreWorkspaceContext(build({ selection: { tenantId: 'tenant-gone' } })),
    ).toEqual({ route: 'workspace-selection' });
  });

  it('ignores a selection whose membership is suspended', async () => {
    const outcome = await restoreWorkspaceContext(
      build({
        listMemberships: async () => [
          { tenantId: 'tenant-1', membershipId: 'member-1', status: 'SUSPENDED' },
        ],
      }),
    );

    expect(outcome).toEqual({ route: 'workspace-selection' });
  });

  it('asks for a branch again when the saved branch is no longer permitted', async () => {
    const outcome = await restoreWorkspaceContext(
      build({ selection: { tenantId: 'tenant-1', branchId: 'branch-removed' } }),
    );

    expect(outcome).toEqual({
      route: 'branch-selection',
      tenantId: 'tenant-1',
      membershipId: 'member-1',
    });
  });

  it('asks for a branch when the selection carries none', async () => {
    expect(await restoreWorkspaceContext(build({ selection: { tenantId: 'tenant-1' } }))).toEqual({
      route: 'branch-selection',
      tenantId: 'tenant-1',
      membershipId: 'member-1',
    });
  });

  it('never takes membership or permissions from the stored value', async () => {
    // A tampered selection carrying extra fields must not influence the resolved context.
    const tampered = {
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      membershipId: 'attacker-membership',
      permissions: ['chat.manage'],
    } as unknown as { tenantId: string; branchId?: string };

    const outcome = await restoreWorkspaceContext(build({ selection: tampered }));

    expect(outcome).toMatchObject({
      route: 'dashboard',
      context: { membershipId: 'member-1', permissions: [] },
    });
  });
});
