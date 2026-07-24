import { describe, expect, it, vi } from 'vitest';
import { AttendanceRepository } from './attendance.repository.js';

describe('attendance video lifecycle events', () => {
  it('emits policy acknowledgement and conversion request events without media locations', async () => {
    const eventTypes: string[] = [];
    const payloads: unknown[] = [];
    const transaction = {
      videoPolicyAcknowledgement: {
        upsert: async () => ({
          id: 'ack-1',
          tenantId: 'tenant-1',
          membershipId: 'member-1',
          policyVersionId: 'policy-1',
        }),
      },
      attendanceEvent: {
        create: async (input: { data: Record<string, unknown> }) => ({
          id: 'attendance-1',
          ...input.data,
        }),
      },
      checkInVideoAsset: {
        create: async () => ({ id: 'asset-1' }),
      },
      auditEvent: {
        create: async () => ({ id: 'audit-1' }),
      },
      outboxEvent: {
        create: vi.fn(async (input: { data: { eventType: string; payloadRedacted: unknown } }) => {
          eventTypes.push(input.data.eventType);
          payloads.push(input.data.payloadRedacted);
          return input.data;
        }),
      },
    };
    const repository = new AttendanceRepository({
      $transaction: async <T>(operation: (client: typeof transaction) => Promise<T>) =>
        operation(transaction),
    } as never);

    await repository.acknowledgeVideoPolicy({
      tenantId: 'tenant-1',
      membershipId: 'member-1',
      policyVersionId: 'policy-1',
      action: 'ACKNOWLEDGED',
      correlationId: 'acknowledge',
    });
    await repository.createCheckIn({
      tenantId: 'tenant-1',
      membershipId: 'member-1',
      branchId: 'branch-1',
      businessDate: new Date('2026-07-24T00:00:00.000Z'),
      scheduleVersionId: 'schedule-1',
      videoPolicyVersionId: 'policy-1',
      checkInAt: new Date('2026-07-24T01:30:00.000Z'),
      state: 'VIDEO_UPLOADED',
      dayClassification: 'WORKED_ON_TIME',
      classificationReason: 'CHECKED_IN_ON_TIME',
      mediaObjectId: 'media-1',
      originalContentType: 'video/webm',
      originalChecksum: 'a'.repeat(64),
      correlationId: 'check-in',
    });

    expect(eventTypes).toEqual(
      expect.arrayContaining([
        'attendance.video-policy.acknowledged',
        'attendance.video.conversion-requested',
      ]),
    );
    expect(JSON.stringify(payloads)).not.toContain('objectKey');
    expect(JSON.stringify(payloads)).not.toContain('signedUrl');
  });
});
