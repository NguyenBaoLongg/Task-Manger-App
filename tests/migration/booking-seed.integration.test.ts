import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const seedPath = new URL('../../packages/database/prisma/seed.ts', import.meta.url);
const verifyPath = new URL(
  '../../packages/database/prisma/verify-booking-seed.ts',
  import.meta.url,
);

describe('Module 4 deterministic seed source', () => {
  it('declares all permissions and representative fixtures', async () => {
    const seed = await readFile(seedPath, 'utf8');
    for (const expected of [
      "'booking.customer.read'",
      "'booking.customer.manage'",
      "'booking.read'",
      "'booking.manage'",
      "'booking.arrival.manage'",
      "'booking.outcome.manage'",
      "'booking.tour.complete'",
      "'booking.config.manage'",
      "'booking.report.rerun'",
      "'booking.export.create'",
      "'booking.export.download'",
      "'booking.retention.manage'",
      "'booking.legal-hold.manage'",
      "code: 'BOOKING_FORM'",
      'customerPhotoConsentPolicyVersion.upsert',
      'bookingRetentionPolicyVersion.upsert',
    ])
      expect(seed).toContain(expected);
  });

  it('provides an idempotent seed verification helper', async () => {
    const source = await readFile(verifyPath, 'utf8');
    expect(source).toContain('verifyBookingSeed');
    expect(source).toContain('bookingFormVersions');
    expect(source).toContain('cancellationReasons');
    expect(source).toContain('reportDestinations');
  });
});
