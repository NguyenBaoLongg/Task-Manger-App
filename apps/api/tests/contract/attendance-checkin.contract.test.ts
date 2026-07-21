import { describe, expect, it } from 'vitest';
import { createApp, type AppDependencies } from '../../src/app.js';
import { dependencies, send } from './published-http.contract.test.js';

const uuid = '10000000-0000-4000-8000-000000000001';
const date = '2026-07-21';

function checkInDependencies(overrides: Partial<AppDependencies> = {}) {
  return dependencies({
    attendance: {
      attendanceService: {
        async createVideoPolicyVersion() {
          return { id: uuid, scopeType: 'TENANT', versionNumber: 1 };
        },
        async acknowledgeVideoPolicy() {
          return { id: uuid, policyVersionId: uuid, acknowledgedAt: new Date() };
        },
        async createCheckIn() {
          return {
            id: uuid,
            membershipId: uuid,
            branchId: uuid,
            businessDate: date,
            state: 'VIDEO_UPLOADED',
            dayClassification: 'WORKED_ON_TIME',
          };
        },
      },
      videoReviewService: {
        async review() {
          return {
            id: uuid,
            attendanceEventId: uuid,
            reviewStatus: 'FAILED',
            reviewedAt: new Date(),
          };
        },
      },
    } as unknown as AppDependencies['attendance'],
    ...overrides,
  });
}

describe('attendance check-in contract', () => {
  it('configures video policy, records acknowledgement and accepts video check-in metadata', async () => {
    const app = createApp(checkInDependencies());
    const policy = await send(app, 'post', `/v1/tenants/${uuid}/attendance/video-policies`)
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'video-policy-create')
      .send({
        scopeType: 'TENANT',
        effectiveFromDate: date,
        requiresAcknowledgement: true,
        requiresFullBody: true,
        requiresWorkArea: true,
        manualReviewRequired: true,
        missingCheckinPenaltyMinor: 50000,
        videoFailedPenaltyMinor: 50000,
        reason: 'Default video policy',
      });
    expect(policy.status).toBe(201);

    const ack = await send(
      app,
      'post',
      `/v1/tenants/${uuid}/attendance/video-policy/acknowledgements`,
    )
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'video-policy-ack')
      .send({ policyVersionId: uuid, action: 'ACKNOWLEDGED' });
    expect(ack.status).toBe(201);

    const checkin = await send(app, 'post', `/v1/tenants/${uuid}/attendance/check-ins`)
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'video-checkin-create')
      .send({ businessDate: date, mediaObjectId: uuid });
    expect(checkin.status).toBe(201);
    expect(checkin.body).toMatchObject({ state: 'VIDEO_UPLOADED' });
  });

  it('manual review never accepts an AI-only failed decision path', async () => {
    const app = createApp(checkInDependencies());
    const invalid = await send(
      app,
      'post',
      `/v1/tenants/${uuid}/attendance/check-ins/${uuid}/review`,
    )
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'video-review-invalid')
      .send({ reviewStatus: 'AUTO_FAILED', reason: 'AI says no' });
    expect(invalid.status).toBe(422);

    const reviewed = await send(
      app,
      'post',
      `/v1/tenants/${uuid}/attendance/check-ins/${uuid}/review`,
    )
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'video-review-manual')
      .send({
        reviewStatus: 'FAILED',
        reason: 'Manual review failed',
        failedCriteria: ['WORK_AREA'],
      });
    expect(reviewed.status).toBe(200);
    expect(reviewed.body.reviewStatus).toBe('FAILED');
  });
});
