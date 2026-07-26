import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BookingRepository,
  createDatabaseClient,
  MediaRepository,
  type DatabaseClient,
} from '@adsup/database';
import { MediaService, redactMediaForLog } from '../../src/modules/media/media-service.js';
import { MemoryObjectStorage } from '../../src/modules/media/s3-object-storage.js';
import { ArrivalService } from '../../src/modules/bookings/arrival-service.js';
import { FormValidator } from '../../src/modules/forms/form-validator.js';
import {
  cleanupBookingLiveFixture,
  createBookingLiveFixture,
  type BookingLiveFixture,
} from '../helpers/booking-live-fixture.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

describe('booking arrival RBAC boundary', () => {
  it('denies a walk-in before repository access when the branch is outside actor scope', async () => {
    const repository = {
      getCustomerForBranch: async () => {
        throw new Error('repository must not be reached');
      },
    };
    const service = new ArrivalService(
      repository as never,
      {
        resolvePermissionScope: async () => ({ tenantWide: false, branchIds: [] }),
      },
      new FormValidator(),
      {} as never,
    );
    await expect(
      service.createWalkIn({
        tenantId: '10000000-0000-4000-8000-000000000001',
        actorMembershipId: '20000000-0000-4000-8000-000000000001',
        correlationId: 'rbac-denial',
        idempotencyKey: 'rbac-denial',
        branchId: '30000000-0000-4000-8000-000000000001',
        customerId: '40000000-0000-4000-8000-000000000001',
        serviceOfferingId: '50000000-0000-4000-8000-000000000001',
        assignedMembershipId: '60000000-0000-4000-8000-000000000001',
        consentMethod: 'VERBAL',
        consentPolicyVersionId: '70000000-0000-4000-8000-000000000001',
        formTemplateId: '80000000-0000-4000-8000-000000000001',
        formVersionId: '90000000-0000-4000-8000-000000000001',
        formData: {},
      }),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_DENIED' });
  });
});

live('booking media and debt isolation', () => {
  let database: DatabaseClient;
  let fixture: BookingLiveFixture;
  beforeAll(async () => {
    database = createDatabaseClient(databaseUrl!);
    fixture = await createBookingLiveFixture(database);
  });
  afterAll(async () => {
    await cleanupBookingLiveFixture(database, fixture);
    await database.$disconnect();
  });

  it('conceals cross-tenant booking/media/debt resources and redacts media secrets', async () => {
    const repository = new BookingRepository(database);
    const consent = await repository.recordCustomerPhotoConsent({
      tenantId: fixture.tenantId,
      bookingId: fixture.bookingId,
      actorMembershipId: fixture.membershipId,
      method: 'VERBAL',
      policyVersionId: fixture.consentPolicyVersionId,
      correlationId: 'isolation-consent',
    });
    const wrongTenantId = '90000000-0000-4000-8000-000000000009';
    await expect(
      repository.recordArrival({
        tenantId: wrongTenantId,
        bookingId: fixture.bookingId,
        actorMembershipId: fixture.membershipId,
        consentId: consent.id,
        expectedStateVersion: 1,
        correlationId: 'cross-tenant-arrival',
      }),
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    await expect(
      repository.listPhotoDebts({
        tenantId: wrongTenantId,
        allowedBranchIds: null,
        state: 'OPEN',
        limit: 20,
      }),
    ).resolves.toEqual({ items: [], nextCursor: null });
    await expect(
      repository.completeTour({
        tenantId: wrongTenantId,
        bookingId: fixture.bookingId,
        performedByMembershipId: fixture.membershipId,
        customerPhotoMediaId: fixture.bookingId,
        expectedBookingStateVersion: 1,
        correlationId: 'cross-tenant-tour',
      }),
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });

    const media = new MediaService(
      new MediaRepository(database),
      new MemoryObjectStorage(),
      'booking-test',
      300,
      { hasPermission: async () => true } as never,
    );
    await expect(
      media.createIntent({
        tenantId: wrongTenantId,
        actorMembershipId: fixture.membershipId,
        branchId: fixture.branchId,
        sourceType: 'BOOKING',
        sourceId: fixture.bookingId,
        purpose: 'CUSTOMER_BOOKING_PHOTO',
        consentId: consent.id,
        contentType: 'image/jpeg',
        byteSize: 100,
        checksumSha256: 'd'.repeat(64),
        correlationId: 'cross-tenant-media',
      }),
    ).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
    expect(
      redactMediaForLog({
        tenantId: fixture.tenantId,
        mediaId: fixture.bookingId,
        uploadUrl: 'https://secret.example/upload',
        checksumSha256: 'd'.repeat(64),
        customerDisplayName: 'Sensitive customer',
      }),
    ).toEqual({ tenantId: fixture.tenantId, mediaId: fixture.bookingId });
  });
});
