import type { DatabaseClient } from '../src/client.js';

export const sampleBookingTenantId = '10000000-0000-4000-8000-000000000001';

export async function verifyBookingSeed(database: DatabaseClient) {
  const tenantId = sampleBookingTenantId;
  const [
    bookingFormVersions,
    cancellationReasons,
    reportDestinations,
    consentPolicies,
    retentionPolicies,
    customers,
    services,
    bookings,
  ] = await Promise.all([
    database.formVersion.count({
      where: { tenantId, formTemplateId: '00000065-0000-4000-8000-000000000004' },
    }),
    database.bookingCancellationReason.count({ where: { tenantId } }),
    database.bookingReportDestination.count({ where: { tenantId } }),
    database.customerPhotoConsentPolicyVersion.count({ where: { tenantId } }),
    database.bookingRetentionPolicyVersion.count({ where: { tenantId } }),
    database.customer.count({ where: { tenantId } }),
    database.serviceOffering.count({ where: { tenantId } }),
    database.booking.count({ where: { tenantId } }),
  ]);
  return {
    tenantId,
    bookingFormVersions,
    cancellationReasons,
    reportDestinations,
    consentPolicies,
    retentionPolicies,
    customers,
    services,
    bookings,
  };
}
