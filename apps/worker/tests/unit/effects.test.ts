import { describe, expect, it, vi } from 'vitest';
import { KPI_REALTIME_CHANNEL, RedisKpiRealtimeEffect } from '../../src/effects/realtime-effect.js';
import { WebhookKpiNotificationEffect } from '../../src/effects/notification-effect.js';

const tenantId = '00000000-0000-4000-8000-000000000001';
const membershipId = '00000000-0000-4000-8000-000000000002';

describe('worker production effects', () => {
  it('publishes a tenant-scoped realtime envelope to Redis', async () => {
    const publish = vi.fn(async (_channel: string, _message: string) => 1);
    const increment = vi.fn();
    const effect = new RedisKpiRealtimeEffect({ publish }, { increment });

    await effect.publishActionItemChanged({
      tenantId,
      membershipId,
      actionItemId: '00000000-0000-4000-8000-000000000003',
      stateVersion: 4,
    });

    expect(publish).toHaveBeenCalledOnce();
    expect(publish.mock.calls[0]?.[0]).toBe(KPI_REALTIME_CHANNEL);
    expect(JSON.parse(publish.mock.calls[0]?.[1] ?? '{}')).toMatchObject({
      type: 'action-item.changed',
      tenantId,
      membershipId,
      stateVersion: 4,
    });
    expect(increment).toHaveBeenCalledWith('realtime_effects_total');
  });

  it('sends an idempotent authenticated push relay request', async () => {
    const fetcher = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        new Response(null, { status: 202 }),
    );
    const increment = vi.fn();
    const effect = new WebhookKpiNotificationEffect(
      'https://push.internal/v1/events',
      'a'.repeat(32),
      { increment },
      fetcher,
    );
    const eventId = '00000000-0000-4000-8000-000000000004';

    await effect.notify({ tenantId, membershipId, eventId, type: 'kpi.evidence.overdue' });

    const call = fetcher.mock.calls[0];
    expect(call?.[0]).toBe('https://push.internal/v1/events');
    expect(call?.[1]?.method).toBe('POST');
    expect(new Headers(call?.[1]?.headers).get('idempotency-key')).toBe(eventId);
    expect(increment).toHaveBeenCalledWith('notification_effects_total');
  });

  it('retries through outbox when the push relay rejects the event', async () => {
    const effect = new WebhookKpiNotificationEffect(
      'https://push.internal/v1/events',
      'a'.repeat(32),
      { increment: vi.fn() },
      vi.fn(async () => new Response(null, { status: 503 })),
    );

    await expect(
      effect.notify({
        tenantId,
        membershipId,
        eventId: '00000000-0000-4000-8000-000000000004',
        type: 'kpi.evidence.overdue',
      }),
    ).rejects.toThrow('PUSH_RELAY_DELIVERY_FAILED');
  });
});
