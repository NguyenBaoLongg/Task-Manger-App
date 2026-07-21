import { describe, expect, it } from 'vitest';
import { KpiSourceService } from '../../src/modules/kpi/kpi-source-service.js';

const query = {
  tenantId: 'tenant-1',
  membershipId: 'member-1',
  branchId: 'branch-1',
  businessDate: '2026-07-21',
  kpiCode: 'ATTENDANCE_ON_TIME_RATE',
  submission: null,
  mapping: {
    id: 'mapping-1',
    sourceType: 'DOMAIN_ADAPTER',
    adapterCode: 'ATTENDANCE_ON_TIME_RATE',
  },
} as const;

describe('attendance KPI source adapter', () => {
  it('returns 100 for confirmed on-time attendance', async () => {
    const service = new KpiSourceService(
      {
        async read() {
          return null;
        },
      },
      {
        async readAttendanceOnTime() {
          return {
            sourceAttendanceEventId: 'event-1',
            observedAt: new Date('2026-07-21T02:00:00Z'),
            value: '100',
          };
        },
      },
    );
    await expect(service.read(query as never)).resolves.toMatchObject({
      sourceType: 'ATTENDANCE',
      sourceId: 'event-1',
      value: '100',
      unit: 'percent',
    });
  });

  it('returns 0 for confirmed late attendance and null when source is missing', async () => {
    const late = new KpiSourceService(
      {
        async read() {
          return null;
        },
      },
      {
        async readAttendanceOnTime() {
          return {
            sourceAttendanceEventId: 'event-2',
            observedAt: new Date('2026-07-21T03:00:00Z'),
            value: '0',
          };
        },
      },
    );
    await expect(late.read(query as never)).resolves.toMatchObject({ value: '0' });

    const missing = new KpiSourceService(
      {
        async read() {
          return null;
        },
      },
      {
        async readAttendanceOnTime() {
          return null;
        },
      },
    );
    await expect(missing.read(query as never)).resolves.toBeNull();
  });
});
