import type { TenantContextValue } from './tenant-context';
import type { WorkspaceSelection } from './workspace-selection-storage';

export type RestoreOutcome =
  | { route: 'sign-in' }
  | { route: 'workspace-selection' }
  | { route: 'branch-selection'; tenantId: string; membershipId: string }
  | { route: 'dashboard'; context: TenantContextValue };

type Membership = {
  tenantId: string;
  membershipId: string;
  status?: string;
};

type Branch = { id: string; status?: string };

export type RestoreInput = {
  /** The saved preference, or undefined when the user has not chosen yet. */
  selection?: WorkspaceSelection;
  /** True when a session exists and could be loaded. */
  hasSession: boolean;
  /** Memberships as the backend reports them right now. */
  listMemberships: () => Promise<Membership[]>;
  /** Branches the backend currently allows for that membership. */
  listBranches: (tenantId: string) => Promise<Branch[]>;
};

/**
 * Decides where a relaunched app should land.
 *
 * The saved selection only narrows the question. Every value that grants access — membership
 * existence, membership status, branch availability — is re-read from the backend on each restore,
 * so revoked membership or a removed branch sends the user back to selection rather than into a
 * scope they no longer hold. A selection naming a tenant the backend no longer returns is treated
 * as absent, not as a hint to trust.
 */
export const restoreWorkspaceContext = async (input: RestoreInput): Promise<RestoreOutcome> => {
  if (!input.hasSession) return { route: 'sign-in' };
  if (!input.selection) return { route: 'workspace-selection' };

  const memberships = await input.listMemberships();
  const membership = memberships.find(
    (item) => item.tenantId === input.selection?.tenantId && item.status !== 'SUSPENDED',
  );
  if (!membership) return { route: 'workspace-selection' };

  const branches = await input.listBranches(membership.tenantId);
  if (branches.length === 0) return { route: 'workspace-selection' };

  const savedBranchId = input.selection.branchId;
  const branch = savedBranchId ? branches.find((item) => item.id === savedBranchId) : undefined;
  if (!branch) {
    return {
      route: 'branch-selection',
      tenantId: membership.tenantId,
      membershipId: membership.membershipId,
    };
  }

  return {
    route: 'dashboard',
    context: {
      tenantId: membership.tenantId,
      membershipId: membership.membershipId,
      branchId: branch.id,
      permissions: [],
      version: 1,
    },
  };
};
