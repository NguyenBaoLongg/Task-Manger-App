import { describe, expect, it, vi } from 'vitest';
import { AttendanceService } from '../../src/modules/attendance/attendance-service.js';

function createCheckInHarness() {
  const acknowledgements = new Set<string>();
  const persistedEvents: Record<string, unknown>[] = [];
  const repository = {
    getVideoPolicy: async (tenantId: string, policyId: string) =>
      tenantId === 'tenant-1' && policyId === 'policy-1' ? { id: policyId } : null,
    acknowledgeVideoPolicy: vi.fn(
      async (input: { tenantId: string; membershipId: string; policyVersionId: string }) => {
        acknowledgements.add(`${input.tenantId}:${input.membershipId}:${input.policyVersionId}`);
        return { id: 'ack-1', ...input };
      },
    ),
    getEffectiveSchedule: async (tenantId: string, membershipId: string, businessDate: Date) =>
      tenantId === 'tenant-1' && membershipId === 'member-1'
        ? {
            id: 'schedule-1',
            branchId: 'branch-1',
            shiftDefinitionId: 'shift-1',
            businessDate,
          }
        : null,
    getShift: async (tenantId: string, shiftId: string) =>
      tenantId === 'tenant-1' && shiftId === 'shift-1'
        ? {
            id: shiftId,
            startLocalTime: '08:30',
            timezone: 'Asia/Ho_Chi_Minh',
          }
        : null,
    getEffectiveVideoPolicy: async (tenantId: string) =>
      tenantId === 'tenant-1'
        ? {
            id: 'policy-1',
            requiresAcknowledgement: true,
          }
        : null,
    getPolicyAcknowledgement: async (tenantId: string, membershipId: string, policyId: string) =>
      acknowledgements.has(`${tenantId}:${membershipId}:${policyId}`),
    getMediaObject: async (tenantId: string, mediaId: string) =>
      tenantId === 'tenant-1' && mediaId === 'media-1'
        ? {
            id: mediaId,
            ownerMembershipId: 'member-1',
            status: 'READY',
            contentType: 'video/mp4',
            checksumSha256: 'sha256-check-in',
          }
        : null,
    createCheckIn: vi.fn(async (input: Record<string, unknown>) => {
      const event = { id: 'event-1', ...input };
      persistedEvents.push(event);
      return event;
    }),
    getEffectiveAttendancePenaltyPolicy: async () => null,
  };
  return { repository, persistedEvents };
}

describe('attendance check-in integration harness', () => {
  it('persists authoritative schedule, policy and media snapshots after acknowledgement', async () => {
    const harness = createCheckInHarness();
    const service = new AttendanceService(harness.repository as never, {
      now: () => new Date('2026-07-21T01:25:00.000Z'),
    });

    await service.acknowledgeVideoPolicy({
      tenantId: 'tenant-1',
      actorMembershipId: 'member-1',
      correlationId: 'ack-correlation',
      policyVersionId: 'policy-1',
      action: 'ACKNOWLEDGED',
      deviceId: 'device-1',
    });
    await service.createCheckIn({
      tenantId: 'tenant-1',
      actorMembershipId: 'member-1',
      correlationId: 'checkin-correlation',
      businessDate: '2026-07-21',
      mediaObjectId: 'media-1',
    });

    expect(harness.persistedEvents).toHaveLength(1);
    expect(harness.persistedEvents[0]).toMatchObject({
      tenantId: 'tenant-1',
      membershipId: 'member-1',
      branchId: 'branch-1',
      scheduleVersionId: 'schedule-1',
      videoPolicyVersionId: 'policy-1',
      mediaObjectId: 'media-1',
      originalContentType: 'video/mp4',
      originalChecksum: 'sha256-check-in',
      dayClassification: 'WORKED_ON_TIME',
    });
  });

  it('rejects a cross-tenant media reference before persistence', async () => {
    const harness = createCheckInHarness();
    const service = new AttendanceService(harness.repository as never, {
      now: () => new Date('2026-07-21T01:25:00.000Z'),
    });
    await service.acknowledgeVideoPolicy({
      tenantId: 'tenant-1',
      actorMembershipId: 'member-1',
      correlationId: 'ack-correlation',
      policyVersionId: 'policy-1',
      action: 'ACKNOWLEDGED',
    });

    await expect(
      service.createCheckIn({
        tenantId: 'tenant-1',
        actorMembershipId: 'member-1',
        correlationId: 'cross-tenant',
        businessDate: '2026-07-21',
        mediaObjectId: 'tenant-2-media',
      }),
    ).rejects.toMatchObject({ status: 404, code: 'RESOURCE_NOT_FOUND' });
    expect(harness.persistedEvents).toHaveLength(0);
  });
});
