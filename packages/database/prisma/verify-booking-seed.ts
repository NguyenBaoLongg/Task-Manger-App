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
    retentionPolicyDefaults,
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
    database.bookingRetentionPolicyVersion.findFirst({
      where: { tenantId, versionNumber: 1 },
      select: { customerPhotoDays: true, xlsxDays: true },
    }),
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
    retentionPolicyDefaults,
  };
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/verify-booking-seed.ts')) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required for booking seed verification');
  const { createDatabaseClient } = await import('../src/client.js');
  const database = createDatabaseClient(databaseUrl);
  const result = await verifyBookingSeed(database);
  if (
    result.bookingFormVersions < 1 ||
    result.cancellationReasons < 1 ||
    result.reportDestinations < 1 ||
    result.consentPolicies < 1 ||
    result.retentionPolicies < 1 ||
    result.customers < 1 ||
    result.services < 1 ||
    result.bookings < 1 ||
    result.retentionPolicyDefaults?.customerPhotoDays !== 180 ||
    result.retentionPolicyDefaults?.xlsxDays !== 30
  ) {
    throw new Error(`Booking seed verification failed: ${JSON.stringify(result)}`);
  }
  console.log(JSON.stringify(result));
  await database.$disconnect();
}
