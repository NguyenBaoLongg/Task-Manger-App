import type { QueryClient } from '@tanstack/react-query';
import type { TenantContext } from '@/tenant/tenant-context';
import { tenantQueryKey } from '@/tenant/tenant-scope';

type ActionItemEvent = {
  eventId: string;
  tenantId: string;
  branchId?: string;
  itemId: string;
  stateVersion: number;
};

export const createActionItemRealtimeHandler = (
  queryClient: QueryClient,
  context: TenantContext,
) => {
  const seen = new Set<string>();
  return (event: ActionItemEvent) => {
    if (seen.has(event.eventId)) return;
    if (
      event.tenantId !== context.tenantId ||
      (event.branchId && context.branchId && event.branchId !== context.branchId)
    )
      return;
    seen.add(event.eventId);
    void queryClient.invalidateQueries({ queryKey: tenantQueryKey(context, ['action-items']) });
  };
};
