import { describe, expect, it } from 'vitest';
import {
  changeBookingMediaLegalHoldSchema,
  createBookingRetentionPolicySchema,
  createBookingServiceVersionSchema,
  createCustomerPhotoConsentPolicySchema,
  bookingRetentionPolicySchema,
  customerPhotoConsentPolicySchema,
  legalHoldResultSchema,
  serviceOfferingVersionSchema,
} from '@adsup/contracts';
import { loadBookingOpenApiDocument } from '@adsup/contracts';

describe('booking retention contracts', () => {
  it('validates versioned service, consent, retention and legal-hold commands', () => {
    expect(
      createBookingServiceVersionSchema.parse({
        code: 'FACIAL_BASIC',
        name: 'Basic facial',
        branchIds: ['10000000-0000-4000-8000-000000000001'],
        effectiveFrom: '2026-07-25T00:00:00.000Z',
      }),
    ).toMatchObject({ code: 'FACIAL_BASIC' });
    expect(
      createCustomerPhotoConsentPolicySchema.parse({
        title: 'Photo consent',
        policyText: 'Customer agrees.',
        allowedMethods: ['VERBAL'],
        effectiveFrom: '2026-07-25T00:00:00.000Z',
      }).allowedMethods,
    ).toEqual(['VERBAL']);
    expect(
      createBookingRetentionPolicySchema.parse({
        customerPhotoDays: 180,
        xlsxDays: 30,
        effectiveFrom: '2026-07-25T00:00:00.000Z',
      }),
    ).toMatchObject({ customerPhotoDays: 180, xlsxDays: 30 });
    expect(
      changeBookingMediaLegalHoldSchema.parse({ action: 'PLACE', reason: 'Investigation' }),
    ).toEqual({
      action: 'PLACE',
      reason: 'Investigation',
    });
    expect(serviceOfferingVersionSchema.safeParse({}).success).toBe(false);
    expect(bookingRetentionPolicySchema.safeParse({}).success).toBe(false);
    expect(customerPhotoConsentPolicySchema.safeParse({}).success).toBe(false);
    expect(legalHoldResultSchema.safeParse({}).success).toBe(false);
  });

  it('publishes the US6 routes and permission metadata', async () => {
    const document = await loadBookingOpenApiDocument();
    const paths = document.paths as Record<string, Record<string, { 'x-permission'?: string }>>;
    expect(paths['/v1/tenants/{tenantId}/booking-retention-policies']?.post?.['x-permission']).toBe(
      'booking.retention.manage',
    );
    expect(
      paths['/v1/tenants/{tenantId}/booking-media/{mediaId}/legal-hold']?.post?.['x-permission'],
    ).toBe('booking.legal-hold.manage');
  });
});
