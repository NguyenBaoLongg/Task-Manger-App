import { describe, expect, it } from 'vitest';
import { createApp, type AppDependencies } from '../../src/app.js';
import { dependencies, send } from './published-http.contract.test.js';

const uuid = '10000000-0000-4000-8000-000000000001';
const date = '2026-07-21';

function scheduleDependencies(overrides: Partial<AppDependencies> = {}) {
  return dependencies({
    attendance: {
      scheduleService: {
        async listShifts() {
          return {
            items: [{ id: uuid, code: 'SHIFT_0830', startLocalTime: '08:30', versionNumber: 1 }],
            pageInfo: { nextCursor: null },
          };
        },
        async listSchedules() {
          return { items: [], pageInfo: { nextCursor: null } };
        },
        async createOrEditMySchedule() {
          return {
            id: uuid,
            membershipId: uuid,
            branchId: uuid,
            businessDate: date,
            state: 'SCHEDULED',
            versionNumber: 1,
          };
        },
      },
    } as unknown as AppDependencies['attendance'],
    ...overrides,
  });
}

describe('attendance schedule contract', () => {
  it('lists shifts and schedules behind tenant auth and RBAC', async () => {
    const app = createApp(scheduleDependencies());
    const shifts = await send(app, 'get', `/v1/tenants/${uuid}/attendance/shifts`).set(
      'Authorization',
      'Bearer test-token',
    );
    expect(shifts.status).toBe(200);
    expect(shifts.body.items[0]).toMatchObject({ code: 'SHIFT_0830' });

    const schedules = await send(
      app,
      'get',
      `/v1/tenants/${uuid}/attendance/schedules?dateFrom=${date}&dateTo=${date}`,
    ).set('Authorization', 'Bearer test-token');
    expect(schedules.status).toBe(200);
    expect(schedules.body.pageInfo).toEqual({ nextCursor: null });
  });

  it('requires idempotency and strict valid body for self schedule writes', async () => {
    const app = createApp(scheduleDependencies());
    const missingKey = await send(app, 'post', `/v1/tenants/${uuid}/attendance/schedules`)
      .set('Authorization', 'Bearer test-token')
      .send({ businessDate: date, shiftDefinitionId: uuid, reason: 'Register shift' });
    expect(missingKey.status).toBe(422);
    expect(missingKey.body.code).toBe('VALIDATION_FAILED');

    const invalid = await send(app, 'post', `/v1/tenants/${uuid}/attendance/schedules`)
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'schedule-invalid')
      .send({ businessDate: date, shiftDefinitionId: uuid, unexpected: true });
    expect(invalid.status).toBe(422);
    expect(invalid.body.code).toBe('VALIDATION_FAILED');

    const created = await send(app, 'post', `/v1/tenants/${uuid}/attendance/schedules`)
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'schedule-create')
      .send({ businessDate: date, shiftDefinitionId: uuid, reason: 'Register shift' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ state: 'SCHEDULED', versionNumber: 1 });
  });

  it('denies schedule management when RBAC scope is missing', async () => {
    const app = createApp(
      scheduleDependencies({
        rbacRepo: {
          async hasPermission() {
            return false;
          },
        } as unknown as AppDependencies['rbacRepo'],
      }),
    );
    const response = await send(
      app,
      'get',
      `/v1/tenants/${uuid}/attendance/schedules?dateFrom=${date}&dateTo=${date}`,
    ).set('Authorization', 'Bearer test-token');
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('AUTHORIZATION_DENIED');
  });
});
