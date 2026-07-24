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
});
