import { describe, expect, it } from 'vitest';
import { createApp, type AppDependencies } from '../../src/app.js';
import { dependencies, send } from './published-http.contract.test.js';

const uuid = '10000000-0000-4000-8000-000000000001';
const date = '2026-07-21';

function leaveDependencies(overrides: Partial<AppDependencies> = {}) {
  return dependencies({
    attendance: {
      offCalendarService: {
        async createVersion() {
          return {
            id: uuid,
            scopeType: 'TENANT',
            branchId: null,
            name: 'Company OFF',
            startDate: date,
            endDate: date,
            versionNumber: 1,
          };
        },
      },
      absenceService: {
        async listMonthlySummaries() {
          return {
            items: [
              {
                membershipId: uuid,
                branchId: uuid,
                yearMonth: '2026-07',
                approvedAbsenceDays: '5.5',
                overThreshold: true,
              },
            ],
            pageInfo: { nextCursor: null },
          };
        },
      },
    } as unknown as AppDependencies['attendance'],
    workflows: {
      workflowService: {
        async createDefinitionVersion() {
          return { id: uuid, requestType: 'LEAVE_SCHEDULE', scopeType: 'TENANT', versionNumber: 1 };
        },
        async submitRequest() {
          return {
            id: uuid,
            requestType: 'LEAVE_SCHEDULE',
            status: 'IN_REVIEW',
            requestedByMembershipId: uuid,
          };
        },
        async decide() {
          return { id: uuid, requestType: 'LEAVE_SCHEDULE', status: 'APPROVED' };
        },
      },
    } as unknown as AppDependencies['workflows'],
    ...overrides,
  });
}

describe('attendance leave and OFF calendar contract', () => {
  it('creates tenant OFF calendar and lists monthly absence summaries', async () => {
    const app = createApp(leaveDependencies());
    const offCalendar = await send(app, 'post', `/v1/tenants/${uuid}/attendance/off-calendar`)
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'off-calendar-create')
      .send({
        scopeType: 'TENANT',
        name: 'Company OFF',
        startDate: date,
        endDate: date,
        reason: 'Company holiday',
      });
    expect(offCalendar.status).toBe(201);
    expect(offCalendar.body).toMatchObject({ scopeType: 'TENANT', versionNumber: 1 });

    const summaries = await send(
      app,
      'get',
      `/v1/tenants/${uuid}/attendance/absences/monthly-summary?yearMonth=2026-07&overThreshold=true`,
    ).set('Authorization', 'Bearer test-token');
    expect(summaries.status).toBe(200);
    expect(summaries.body.items[0]).toMatchObject({
      approvedAbsenceDays: '5.5',
      overThreshold: true,
    });
  });

  it('submits leave and sudden leave only through /workflows/requests', async () => {
    const app = createApp(leaveDependencies());
    const scheduledLeave = await send(app, 'post', `/v1/tenants/${uuid}/workflows/requests`)
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'leave-workflow')
      .send({
        requestType: 'LEAVE_SCHEDULE',
        payload: {
          durationKind: 'DATE_RANGE',
          startDate: date,
          endDate: '2026-07-22',
          exceptionEvidence: { type: 'WEDDING_PHOTO', mediaObjectId: uuid },
        },
        reason: 'Need approved leave',
      });
    expect(scheduledLeave.status).toBe(201);

    const suddenLeave = await send(app, 'post', `/v1/tenants/${uuid}/workflows/requests`)
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'sudden-leave-workflow')
      .send({
        requestType: 'SUDDEN_LEAVE',
        payload: {
          durationKind: 'MORNING_HALF',
          startDate: date,
          endDate: date,
          notifiedCompanyChat: true,
        },
        reason: 'Sudden morning leave',
      });
    expect(suddenLeave.status).toBe(201);

    const wrongRoute = await send(app, 'post', `/v1/tenants/${uuid}/attendance/leave-requests`)
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'leave-wrong-route')
      .send({});
    expect(wrongRoute.status).toBe(404);
  });

  it('rejects leave payloads with invalid date range', async () => {
    const app = createApp(leaveDependencies());
    const invalid = await send(app, 'post', `/v1/tenants/${uuid}/workflows/requests`)
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'leave-invalid-range')
      .send({
        requestType: 'LEAVE_SCHEDULE',
        payload: { durationKind: 'DATE_RANGE', startDate: '2026-07-23', endDate: '2026-07-21' },
        reason: 'Invalid leave range',
      });
    expect(invalid.status).toBe(422);
    expect(invalid.body.code).toBe('VALIDATION_FAILED');
  });
});
