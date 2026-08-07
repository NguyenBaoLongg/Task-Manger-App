import { QueryClient } from '@tanstack/react-query';

export const createMobileQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 1, staleTime: 30_000, gcTime: 5 * 60_000 },
      mutations: { retry: 0 },
    },
  });

export const clearTenantCache = async (queryClient: QueryClient, tenantId: string) => {
  await queryClient.cancelQueries({ queryKey: ['tenant', tenantId] });
  queryClient.removeQueries({ queryKey: ['tenant', tenantId] });
};

export const clearSensitiveCache = async (queryClient: QueryClient) => {
  await queryClient.cancelQueries({
    predicate: (query) =>
      query.queryKey.some((part) =>
        ['media', 'payment-proof', 'signed-url', 'private'].includes(String(part)),
      ),
  });
  queryClient.removeQueries({
    predicate: (query) =>
      query.queryKey.some((part) =>
        ['media', 'payment-proof', 'signed-url', 'private'].includes(String(part)),
      ),
  });
};
