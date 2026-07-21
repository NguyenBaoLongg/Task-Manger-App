import type { KpiNotificationEffectPort } from '@adsup/domain';

interface NotificationMetrics {
  increment(name: string, by?: number): void;
}

type NotificationInput = Parameters<KpiNotificationEffectPort['notify']>[0];
type FetchLike = typeof fetch;

export class WebhookKpiNotificationEffect implements KpiNotificationEffectPort {
  constructor(
    private readonly url: string,
    private readonly secret: string,
    private readonly metrics: NotificationMetrics,
    private readonly fetcher: FetchLike = fetch,
  ) {}

  async notify(input: NotificationInput) {
    const response = await this.fetcher(this.url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.secret}`,
        'content-type': 'application/json',
        'idempotency-key': input.eventId,
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error('PUSH_RELAY_DELIVERY_FAILED');
    this.metrics.increment('notification_effects_total');
  }
}

class LocalKpiNotificationEffect implements KpiNotificationEffectPort {
  constructor(private readonly metrics: NotificationMetrics) {}

  async notify() {
    this.metrics.increment('notification_effects_total');
  }
}

export function createKpiNotificationEffect(input: {
  driver: 'noop' | 'webhook';
  webhookUrl?: string;
  webhookSecret: string;
  metrics: NotificationMetrics;
}): KpiNotificationEffectPort {
  if (input.driver === 'noop') return new LocalKpiNotificationEffect(input.metrics);
  if (!input.webhookUrl || input.webhookSecret.length < 32) {
    throw new Error('PUSH_WEBHOOK_CONFIG_INVALID');
  }
  return new WebhookKpiNotificationEffect(input.webhookUrl, input.webhookSecret, input.metrics);
}
