import type { TenantContext } from '@/tenant/tenant-context';
import { resolveActionItemRoute } from '@/navigation/action-item-route';
import { parseNotificationPayload } from './notification-payload';
export const handleNotificationDeepLink = (
  payload: unknown,
  options: {
    context: TenantContext;
    now: number;
    authenticated: boolean;
    permissions: readonly string[];
  },
) => {
  const parsed = parseNotificationPayload(payload);
  if (!parsed || !parsed.deepLink) return { kind: 'refresh' as const };
  return resolveActionItemRoute(
    { ...parsed, deepLink: parsed.deepLink, receivedAt: options.now, tenantId: parsed.tenantId },
    options,
  );
};
