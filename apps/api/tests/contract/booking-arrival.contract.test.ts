import { describe, expect, it } from 'vitest';
import {
  completeTourSchema,
  createCustomerPhotoConsentSchema,
  createCustomerPhotoUploadIntentSchema,
  createWalkInBookingSchema,
  loadBookingOpenApiDocument,
  photoDebtQuerySchema,
  recordArrivalSchema,
} from '@adsup/contracts';
import { createApp } from '../../src/app.js';
import { dependencies, send } from './published-http.contract.test.js';

const id = '10000000-0000-4000-8000-000000000001';

describe('booking arrival contract', () => {
  it('publishes every US2 operation', async () => {
    const document = await loadBookingOpenApiDocument();
    const serialized = JSON.stringify(document);
    for (const operationId of [
      'createWalkInBooking',
      'recordCustomerPhotoConsent',
      'createCustomerPhotoUploadIntent',
      'recordBookingArrival',
      'listBookingPhotoDebts',
      'completeBookingTour',
    ]) {
      expect(serialized).toContain(`"operationId":"${operationId}"`);
    }
  });

  it('validates consent and booking-scoped image upload inputs', () => {
    expect(
      createCustomerPhotoConsentSchema.safeParse({
        method: 'VERBAL',
        policyVersionId: id,
      }).success,
    ).toBe(true);
    expect(
      createCustomerPhotoUploadIntentSchema.safeParse({
        consentId: id,
        contentType: 'image/jpeg',
        byteSize: 1024,
        checksumSha256: 'a'.repeat(64),
      }).success,
    ).toBe(true);
    expect(
      createCustomerPhotoUploadIntentSchema.safeParse({
        consentId: id,
        contentType: 'video/mp4',
        byteSize: 1024,
        checksumSha256: 'a'.repeat(64),
      }).success,
    ).toBe(false);
  });

  it('validates walk-in, arrival, debt query and tour payloads without client scope fields', () => {
    const walkIn = {
      branchId: id,
      customerId: id,
      serviceOfferingId: id,
      assignedMembershipId: id,
      consentMethod: 'WRITTEN',
      consentPolicyVersionId: id,
      formTemplateId: id,
      formVersionId: id,
      formData: {},
    };
    expect(createWalkInBookingSchema.safeParse(walkIn).success).toBe(true);
    expect(createWalkInBookingSchema.safeParse({ ...walkIn, tenantId: id }).success).toBe(false);
    expect(
      recordArrivalSchema.safeParse({
        consentId: id,
        customerPhotoMediaId: id,
        expectedStateVersion: 1,
      }).success,
    ).toBe(true);
    expect(
      completeTourSchema.safeParse({
        customerPhotoMediaId: id,
        expectedBookingStateVersion: 2,
      }).success,
    ).toBe(true);
    expect(photoDebtQuerySchema.parse({ state: 'OPEN', limit: '25' }).limit).toBe(25);
    expect(photoDebtQuerySchema.safeParse({ state: 'UNKNOWN' }).success).toBe(false);
  });

  it('mounts and executes the US2 HTTP routes with their published status codes', async () => {
    const arrivalService = {
      createWalkIn: async () => ({ booking: { id, status: 'ARRIVED' }, photoDebt: { id } }),
      recordConsent: async () => ({ id, method: 'VERBAL' }),
      createCustomerPhotoUploadIntent: async () => ({
        consentId: id,
        mediaId: id,
        uploadUrl: 'memory://upload',
        expiresAt: new Date(),
      }),
      recordArrival: async () => ({ booking: { id, status: 'ARRIVED' }, photoDebt: null }),
      listPhotoDebts: async () => ({ items: [], nextCursor: null }),
      completeTour: async () => ({ id, bookingId: id }),
    };
    const app = createApp(dependencies({ bookings: { arrivalService } as never }));
    let requestNumber = 0;
    const authorized = (method: string, path: string) => {
      requestNumber += 1;
      return send(app, method, path)
        .set('Authorization', 'Bearer valid-test-token')
        .set('idempotency-key', `booking-us2-${requestNumber}`);
    };
    const walkIn = {
      branchId: id,
      customerId: id,
      serviceOfferingId: id,
      assignedMembershipId: id,
      consentMethod: 'VERBAL',
      consentPolicyVersionId: id,
      formTemplateId: id,
      formVersionId: id,
      formData: {},
    };
    expect(
      (await authorized('post', `/v1/tenants/${id}/bookings:walk-in`).send(walkIn)).status,
    ).toBe(201);
    expect(
      (
        await authorized('post', `/v1/tenants/${id}/bookings/${id}/customer-photo-consents`).send({
          method: 'VERBAL',
          policyVersionId: id,
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await authorized(
          'post',
          `/v1/tenants/${id}/bookings/${id}/customer-photo-upload-intents`,
        ).send({
          consentId: id,
          contentType: 'image/jpeg',
          byteSize: 100,
          checksumSha256: 'a'.repeat(64),
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await authorized('post', `/v1/tenants/${id}/bookings/${id}/arrivals`).send({
          consentId: id,
          expectedStateVersion: 1,
        })
      ).status,
    ).toBe(200);
    expect((await authorized('get', `/v1/tenants/${id}/booking-photo-debts`)).status).toBe(200);
    expect(
      (
        await authorized('post', `/v1/tenants/${id}/bookings/${id}/tour-completions`).send({
          customerPhotoMediaId: id,
          expectedBookingStateVersion: 2,
        })
      ).status,
    ).toBe(201);
  });

  it('does not let the generic media route bypass booking arrival permission for customer photos', async () => {
    const checkedPermissions: string[] = [];
    const app = createApp(
      dependencies({
        rbacRepo: {
          async hasPermission(_tenantId: string, _membershipId: string, permission: string) {
            checkedPermissions.push(permission);
            return permission === 'media.create';
          },
          async hasAnyPermission() {
            return true;
          },
        } as never,
      }),
    );
    const response = await send(app, 'post', `/v1/tenants/${id}/media/upload-intents`)
      .set('Authorization', 'Bearer valid-test-token')
      .set('idempotency-key', 'booking-generic-photo-rbac')
      .send({
        branchId: id,
        sourceType: 'BOOKING',
        sourceId: id,
        purpose: 'CUSTOMER_BOOKING_PHOTO',
        contentType: 'image/jpeg',
        byteSize: 100,
        checksumSha256: 'a'.repeat(64),
      });
    expect(response.status).toBe(403);
    expect(checkedPermissions).toContain('booking.arrival.manage');
  });
});
