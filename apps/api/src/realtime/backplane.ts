import { createAdapter } from '@socket.io/redis-streams-adapter';
import { KPI_REALTIME_CHANNEL } from '@adsup/domain';
import { createClient } from 'redis';
import type { Server } from 'socket.io';
import { z } from 'zod';
import { membershipRoom } from './socket-gateway.js';

const actionItemChanged = z.object({
  type: z.literal('action-item.changed'),
  tenantId: z.string().uuid(),
  membershipId: z.string().uuid(),
  actionItemId: z.string().uuid(),
  stateVersion: z.number().int().positive(),
});
const progressChanged = z.object({
  type: z.literal('kpi.progress.changed'),
  tenantId: z.string().uuid(),
  membershipId: z.string().uuid(),
  reportId: z.string().uuid(),
  kpiDefinitionId: z.string().uuid(),
});
const realtimeEnvelope = z.discriminatedUnion('type', [actionItemChanged, progressChanged]);

export function parseKpiRealtimeEnvelope(raw: string) {
  return realtimeEnvelope.parse(JSON.parse(raw));
}

export async function configureBackplane(
  io: Server,
  mode: 'memory' | 'redis-streams',
  redisUrl?: string,
  telemetry?: { increment(name: string): void },
) {
  if (mode === 'memory') return async () => undefined;
  if (!redisUrl) throw new Error('REDIS_URL is required for redis-streams');
  const client = createClient({ url: redisUrl });
  const subscriber = client.duplicate();
  try {
    await client.connect();
    await subscriber.connect();
    await subscriber.subscribe(KPI_REALTIME_CHANNEL, (raw) => {
      try {
        const event = parseKpiRealtimeEnvelope(raw);
        io.to(membershipRoom(event.tenantId, event.membershipId)).emit(event.type, event);
      } catch {
        telemetry?.increment('adapter_invalid_events_total');
      }
    });
  } catch (error) {
    telemetry?.increment('adapter_failures_total');
    if (subscriber.isOpen) await subscriber.quit();
    if (client.isOpen) await client.quit();
    throw error;
  }
  io.adapter(createAdapter(client));
  return async () => {
    await subscriber.unsubscribe(KPI_REALTIME_CHANNEL);
    await subscriber.quit();
    await client.quit();
  };
}
