import { describe, expect, it } from 'vitest';
import { channelRoom, membershipRoom } from '../../src/realtime/socket-gateway.js';
import { parseKpiRealtimeEnvelope } from '../../src/realtime/backplane.js';

describe('realtime room isolation', () => {
  it('derives rooms from tenant and channel on the server', () => {
    expect(channelRoom('tenant-a', 'channel-1')).toBe('tenant:tenant-a:channel:channel-1');
    expect(channelRoom('tenant-a', 'channel-1')).not.toBe(channelRoom('tenant-b', 'channel-1'));
  });

  it('derives personal rooms with tenant isolation', () => {
    expect(membershipRoom('tenant-a', 'member-1')).toBe('tenant:tenant-a:membership:member-1');
    expect(membershipRoom('tenant-a', 'member-1')).not.toBe(membershipRoom('tenant-b', 'member-1'));
  });

  it('accepts only the bounded KPI realtime envelope', () => {
    const value = parseKpiRealtimeEnvelope(
      JSON.stringify({
        type: 'action-item.changed',
        tenantId: '00000000-0000-4000-8000-000000000001',
        membershipId: '00000000-0000-4000-8000-000000000002',
        actionItemId: '00000000-0000-4000-8000-000000000003',
        stateVersion: 2,
      }),
    );
    expect(value.type).toBe('action-item.changed');
    expect(() => parseKpiRealtimeEnvelope('{"type":"unknown"}')).toThrow();
  });
});
