import { describe, expect, it } from 'vitest';
import { KpiSourceService } from '../../src/modules/kpi/kpi-source-service.js';

describe('attendance privacy integration harness', () => {
  it('returns KPI attendance snapshots without media metadata or signed URL fields', async () => {
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
            observedAt: new Date('2026-07-24T02:00:00.000Z'),
            value: '100',
            dayClassification: 'WORKED_ON_TIME',
            scheduleVersionId: 'schedule-1',
            policyVersionId: 'policy-1',
            mediaObjectId: 'media-secret',
            signedUrl: 'https://signed.example/video',
          };
        },
      } as never,
    );

    const snapshot = await service.read({
      tenantId: 'tenant-1',
      membershipId: 'member-1',
      branchId: 'branch-1',
      businessDate: '2026-07-24',
      kpiCode: 'ATTENDANCE_ON_TIME_RATE',
      submission: null,
      mapping: {
        id: 'mapping-1',
        sourceType: 'DOMAIN_ADAPTER',
        adapterCode: 'ATTENDANCE_ON_TIME_RATE',
      },
    } as never);

    const serialized = JSON.stringify(snapshot);
    expect(snapshot).toMatchObject({ unit: 'PERCENT', value: '100' });
    expect(serialized).not.toContain('media-secret');
    expect(serialized).not.toContain('signed.example');
    expect(serialized).not.toContain('signedUrl');
  });
});
