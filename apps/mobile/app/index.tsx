import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { getAuthenticatedClient, getStoredSession } from '@/features/auth/session-runtime';
import { selectBranch, selectWorkspace } from '@/features/workspace/workspace-queries';
import { restoreWorkspaceContext, type RestoreOutcome } from '@/tenant/restore-workspace-context';
import { createWorkspaceSelectionStorage } from '@/tenant/workspace-selection-storage';
import { useTenantContextStore } from '@/tenant/tenant-context-store';
import { LoadingState } from '@/components/async-states/AsyncState';

const selectionStorage = createWorkspaceSelectionStorage();

/**
 * Entry point. This screen used to redirect unconditionally to sign-in, which meant every relaunch
 * discarded the workspace and branch the user had already chosen — the tenant context lives in
 * memory only. Restoring it here removes that repeated selection and lets a relaunched app reach
 * the dashboard directly, which is also what SC-003 measures.
 *
 * Authority still comes from the backend: the stored value only names a workspace, and
 * `restoreWorkspaceContext` re-reads membership and branch before any route is chosen.
 */
export default function Index() {
  const setContext = useTenantContextStore((state) => state.setContext);
  const [outcome, setOutcome] = useState<RestoreOutcome>();

  useEffect(() => {
    let active = true;

    const resolve = async (): Promise<RestoreOutcome> => {
      const session = await getStoredSession();
      if (!session) return { route: 'sign-in' };

      const selection = await selectionStorage.load();
      if (!selection) return { route: 'workspace-selection' };

      const client = await getAuthenticatedClient();
      return restoreWorkspaceContext({
        hasSession: true,
        selection,
        listMemberships: () => selectWorkspace(client),
        listBranches: (tenantId) => selectBranch(client, tenantId),
      });
    };

    void resolve()
      .catch((): RestoreOutcome => ({ route: 'sign-in' }))
      .then((result) => {
        if (!active) return;
        if (result.route === 'dashboard') setContext(result.context);
        setOutcome(result);
      });

    return () => {
      active = false;
    };
  }, [setContext]);

  if (!outcome) return <LoadingState label="Đang khôi phục phiên làm việc" />;
  if (outcome.route === 'dashboard') return <Redirect href="/(tabs)/dashboard" />;
  if (outcome.route === 'workspace-selection')
    return <Redirect href="/(auth)/workspace-selection" />;
  if (outcome.route === 'branch-selection') {
    return (
      <Redirect
        href={{
          pathname: '/(auth)/branch-selection',
          params: { tenantId: outcome.tenantId, membershipId: outcome.membershipId },
        }}
      />
    );
  }
  return <Redirect href="/(auth)/sign-in" />;
}
