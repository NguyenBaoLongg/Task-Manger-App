import { KPI_REALTIME_CHANNEL, type KpiRealtimeEffectPort } from '@adsup/domain';
import { createClient } from 'redis';

export { KPI_REALTIME_CHANNEL };

interface RealtimeMetrics {
  increment(name: string, by?: number): void;
}

interface RedisPublisher {
  publish(channel: string, message: string): Promise<number>;
}

export class RedisKpiRealtimeEffect implements KpiRealtimeEffectPort {
  constructor(
    private readonly publisher: RedisPublisher,
    private readonly metrics: RealtimeMetrics,
  ) {}

  async publishActionItemChanged(
    input: Parameters<KpiRealtimeEffectPort['publishActionItemChanged']>[0],
  ) {
    await this.publish({ type: 'action-item.changed', ...input });
  }

  async publishProgressChanged(
    input: Parameters<KpiRealtimeEffectPort['publishProgressChanged']>[0],
  ) {
    await this.publish({ type: 'kpi.progress.changed', ...input });
  }

  private async publish(payload: Record<string, unknown>) {
    await this.publisher.publish(KPI_REALTIME_CHANNEL, JSON.stringify(payload));
    this.metrics.increment('realtime_effects_total');
  }
}

class LocalKpiRealtimeEffect implements KpiRealtimeEffectPort {
  constructor(private readonly metrics: RealtimeMetrics) {}

  async publishActionItemChanged() {
    this.metrics.increment('realtime_effects_total');
  }

  async publishProgressChanged() {
    this.metrics.increment('realtime_effects_total');
  }
}

export async function createKpiRealtimeEffect(input: {
  mode: 'memory' | 'redis-streams';
  redisUrl?: string;
  metrics: RealtimeMetrics;
}) {
  if (input.mode === 'memory') {
    return {
      effect: new LocalKpiRealtimeEffect(input.metrics),
      close: async () => undefined,
    };
  }
  if (!input.redisUrl) throw new Error('REDIS_URL_REQUIRED');
  const client = createClient({ url: input.redisUrl });
  await client.connect();
  return {
    effect: new RedisKpiRealtimeEffect(client, input.metrics),
    close: async () => client.quit(),
  };
}
