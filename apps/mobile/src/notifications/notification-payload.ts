export type SafeNotificationPayload = {
  tenantId: string;
  eventId: string;
  kind: string;
  sourceId?: string;
  deepLink?: string;
  action?: 'ARRIVED_PROOF' | 'CANCEL_OR_RESCHEDULE';
};
export const parseNotificationPayload = (value: unknown): SafeNotificationPayload | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  if (
    typeof item.tenantId !== 'string' ||
    typeof item.eventId !== 'string' ||
    typeof item.kind !== 'string'
  )
    return undefined;
  if (
    'token' in item ||
    'signedUrl' in item ||
    'email' in item ||
    (item.deepLink && (typeof item.deepLink !== 'string' || !item.deepLink.startsWith('/')))
  )
    return undefined;
  return {
    tenantId: item.tenantId,
    eventId: item.eventId,
    kind: item.kind,
    ...(typeof item.sourceId === 'string' ? { sourceId: item.sourceId } : {}),
    ...(typeof item.deepLink === 'string' ? { deepLink: item.deepLink } : {}),
    ...(item.action === 'ARRIVED_PROOF' || item.action === 'CANCEL_OR_RESCHEDULE'
      ? { action: item.action }
      : {}),
  };
};
