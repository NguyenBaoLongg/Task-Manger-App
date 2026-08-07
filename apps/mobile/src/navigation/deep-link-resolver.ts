import type { TenantContext } from '@/tenant/tenant-context';

export type DeepLinkIntent = {
  eventId?: string;
  tenantId: string;
  branchId?: string;
  deepLink: string;
  receivedAt: number;
  expiresAt?: number;
  action?: 'ARRIVED_PROOF' | 'CANCEL_OR_RESCHEDULE';
};

type ResolverOptions = { context: TenantContext; now: number; authenticated: boolean };
type ResolveResult =
  | { kind: 'open'; route: string; action?: DeepLinkIntent['action'] }
  | { kind: 'session-expired' | 'forbidden' | 'refresh' };

export const resolveDeepLink = (
  intent: DeepLinkIntent,
  { context, now, authenticated }: ResolverOptions,
): ResolveResult => {
  if (!authenticated) return { kind: 'session-expired' };
  if (
    intent.tenantId !== context.tenantId ||
    (intent.branchId && context.branchId && intent.branchId !== context.branchId)
  ) {
    return { kind: 'forbidden' };
  }
  if (intent.expiresAt !== undefined && now > intent.expiresAt) return { kind: 'refresh' };
  if (!intent.deepLink.startsWith('/') || intent.deepLink.includes('://'))
    return { kind: 'refresh' };
  return {
    kind: 'open',
    route: intent.deepLink,
    ...(intent.action ? { action: intent.action } : {}),
  };
};

export const resolveActionItemIntent = (
  intent: DeepLinkIntent,
  options: ResolverOptions & { permissions: readonly string[] },
) => {
  const resolved = resolveDeepLink(intent, options);
  if (resolved.kind !== 'open' || !intent.action) return resolved;
  const required = intent.action === 'ARRIVED_PROOF' ? 'booking.arrive' : 'booking.outcome.manage';
  if (!options.permissions.includes(required)) return { kind: 'forbidden' as const };
  return resolved;
};
