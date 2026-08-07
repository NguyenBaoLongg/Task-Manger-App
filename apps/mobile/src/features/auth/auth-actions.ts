import type { QueryClient } from '@tanstack/react-query';
import { clearTenantCache } from '@/storage/query-client';
import { clearSession } from './session-runtime';
import { useTenantContextStore } from '@/tenant/tenant-context-store';

export const createAuthActions = (queryClient: QueryClient) => ({
  logout: async () => {
    await clearSession();
    useTenantContextStore.getState().clear();
    queryClient.clear();
  },
  switchTenant: async (currentTenantId: string) => {
    useTenantContextStore.getState().clear();
    await clearTenantCache(queryClient, currentTenantId);
  },
  handleSuspension: async () => {
    await clearSession();
    useTenantContextStore.getState().clear();
    queryClient.clear();
    return { route: '/(auth)/sign-in' as const, reason: 'ACCOUNT_SUSPENDED' as const };
  },
});
