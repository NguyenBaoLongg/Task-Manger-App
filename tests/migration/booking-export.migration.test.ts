import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL(
  '../../packages/database/prisma/migrations/202607240001_booking_export/migration.sql',
  import.meta.url,
);
const schemaPath = new URL('../../packages/database/prisma/schema.prisma', import.meta.url);

describe('Module 4 booking migration', () => {
  it('creates tenant-scoped booking, consent, report and export tables', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    for (const table of [
      'customers',
      'customer_branch_access',
      'service_offerings',
      'service_offering_versions',
      'service_branch_availability',
      'bookings',
      'booking_status_transitions',
      'booking_cancellation_reasons',
      'booking_cancellation_reason_versions',
      'customer_photo_consent_policy_versions',
      'customer_photo_consents',
      'customer_photo_debts',
      'tour_completions',
      'booking_report_destinations',
      'booking_job_runs',
      'booking_report_deliveries',
      'export_requests',
      'booking_retention_policy_versions',
    ])
      expect(sql).toContain(`CREATE TABLE "${table}"`);
  });

  it('keeps Module 1-3 data and adds Module 4 Prisma models', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    const schema = await readFile(schemaPath, 'utf8');
    expect(sql).not.toContain('DROP TABLE "attendance_events"');
    expect(sql).not.toContain('DROP TABLE "daily_kpi_reports"');
    for (const model of [
      'model Customer',
      'model ServiceOfferingVersion',
      'model Booking',
      'model CustomerPhotoConsent',
      'model CustomerPhotoDebt',
      'model TourCompletion',
      'model ExportRequest',
    ])
      expect(schema).toContain(model);
  });
});
