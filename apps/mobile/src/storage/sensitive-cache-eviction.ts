import type { QueryClient } from '@tanstack/react-query';
import { clearSensitiveCache } from './query-client';
export const evictSensitiveCache = (queryClient: QueryClient) => clearSensitiveCache(queryClient);
