import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { dependencies, send } from './published-http.contract.test.js';

const tenantId = '10000000-0000-4000-8000-000000000001';
const bookingId = '20000000-0000-4000-8000-000000000001';
const exportId = '30000000-0000-4000-8000-000000000001';

describe('Module 4 published HTTP shell', () => {
  it.each([
    ['get', `/v1/tenants/${tenantId}/customers`],
    ['post', `/v1/tenants/${tenantId}/bookings`],
    ['post', `/v1/tenants/${tenantId}/bookings/${bookingId}/customer-photo-consents`],
    ['post', `/v1/tenants/${tenantId}/booking-reports:rerun`],
    ['post', `/v1/tenants/${tenantId}/exports`],
    ['post', `/v1/tenants/${tenantId}/exports/${exportId}/download-url`],
  ] as const)('authenticates %s %s', async (method, path) => {
    const app = createApp(
      dependencies({
        bookings: {},
        bookingConfig: {},
        bookingExports: {},
      }),
    );
    const response = await send(app, method, path).send({});
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
  });

  it('executes the US1 customer, service catalog and booking routes', async () => {
    const calls: string[] = [];
    const customerService = {
      list: async () => ({ items: [], nextCursor: null }),
      get: async () => ({ id: bookingId, branchIds: [tenantId] }),
      create: async () => ({ id: bookingId, branchIds: [tenantId] }),
      update: async () => ({ id: bookingId, stateVersion: 2, branchIds: [tenantId] }),
    };
    const bookingService = {
      listEffectiveServices: async () => [],
      list: async () => ({ items: [], nextCursor: null }),
      get: async () => ({ id: bookingId, transitions: [] }),
      createScheduled: async () => {
        calls.push('createScheduled');
        return { id: bookingId, status: 'SCHEDULED' };
      },
    };
    const app = createApp(
      dependencies({
        bookings: { customerService, bookingService } as never,
      }),
    );
    const authorized = (method: string, path: string) =>
      send(app, method, path)
        .set('Authorization', 'Bearer valid-test-token')
        .set('idempotency-key', 'booking-us1-contract-key');

    expect((await authorized('get', `/v1/tenants/${tenantId}/customers`)).status).toBe(200);
    expect(
      (
        await authorized('post', `/v1/tenants/${tenantId}/customers`).send({
          displayName: 'Khach A',
          branchIds: [tenantId],
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await authorized('patch', `/v1/tenants/${tenantId}/customers/${bookingId}`).send({
          expectedStateVersion: 1,
          displayName: 'Khach B',
        })
      ).status,
    ).toBe(200);
    expect((await authorized('get', `/v1/tenants/${tenantId}/booking-services`)).status).toBe(200);
    expect((await authorized('get', `/v1/tenants/${tenantId}/bookings`)).status).toBe(200);
    expect(
      (
        await authorized('post', `/v1/tenants/${tenantId}/bookings`).send({
          branchId: tenantId,
          customerId: bookingId,
          serviceOfferingId: bookingId,
          assignedMembershipId: bookingId,
          scheduledStartAt: '2026-07-25T09:00:00.000Z',
          formTemplateId: bookingId,
          formVersionId: bookingId,
          formData: {},
        })
      ).status,
    ).toBe(201);
    expect((await authorized('get', `/v1/tenants/${tenantId}/bookings/${bookingId}`)).status).toBe(
      200,
    );
    expect(calls).toEqual(['createScheduled']);
  });
});
