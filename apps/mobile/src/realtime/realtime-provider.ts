import type { QueryClient } from '@tanstack/react-query';
import type { TenantContext } from '@/tenant/tenant-context';
import { tenantQueryKey } from '@/tenant/tenant-scope';
import { createSocketClient, type MobileSocketClient } from './socket-client';

export const createRealtimeProvider = (options: {
  baseUrl: string;
  getAccessToken: () => string | undefined;
  context: TenantContext;
  queryClient: QueryClient;
}): { start: () => () => void; stop: () => void; client: MobileSocketClient } => {
  const client = createSocketClient(options);
  const start = () => {
    client.connect();
    return client.on('action-item.changed', (payload) => {
      const value = payload as { itemId?: string };
      void options.queryClient.invalidateQueries({
        queryKey: tenantQueryKey(options.context, ['action-items']),
      });
      if (value.itemId)
        void options.queryClient.invalidateQueries({
          queryKey: tenantQueryKey(options.context, ['action-items', value.itemId]),
        });
    });
  };
  return { start, stop: () => client.disconnect(), client };
};
