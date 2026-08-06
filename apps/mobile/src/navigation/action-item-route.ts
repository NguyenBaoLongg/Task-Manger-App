import type { TenantContext } from '@/tenant/tenant-context';
import { resolveActionItemIntent, type DeepLinkIntent } from './deep-link-resolver';
export type { DeepLinkIntent } from './deep-link-resolver';

export const resolveActionItemRoute = (
  intent: DeepLinkIntent,
  options: {
    context: TenantContext;
    now: number;
    authenticated: boolean;
    permissions: readonly string[];
  },
) => resolveActionItemIntent(intent, options);
