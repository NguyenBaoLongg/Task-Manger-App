import { describe, expect, it } from 'vitest';
import {
  isBookingRetentionEligible,
  resolveBookingRetentionPolicy,
  retentionUntilForMedia,
} from './retention.js';

const policy = (
  overrides: Partial<Parameters<typeof resolveBookingRetentionPolicy>[0][number]> = {},
) => ({
  tenantId: 'tenant-1',
  id: 'policy-1',
  versionNumber: 1,
  customerPhotoDays: 180,
  xlsxDays: 30,
  effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
  effectiveTo: null,
  ...overrides,
});

describe('booking retention policy', () => {
  it('resolves the latest effective version and respects effectiveTo', () => {
    const resolved = resolveBookingRetentionPolicy(
      [
        policy({ id: 'v1', versionNumber: 1 }),
        policy({
          id: 'v2',
          versionNumber: 2,
          customerPhotoDays: 90,
          effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
          effectiveTo: new Date('2026-09-01T00:00:00.000Z'),
        }),
        policy({
          id: 'v3',
          versionNumber: 3,
          customerPhotoDays: 30,
          effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
        }),
      ],
      new Date('2026-08-01T00:00:00.000Z'),
    );
    expect(resolved?.id).toBe('v2');
    expect(
      resolveBookingRetentionPolicy(
        [policy({ effectiveFrom: new Date('2027-01-01T00:00:00.000Z') })],
        new Date('2026-08-01T00:00:00.000Z'),
      ),
    ).toBeNull();
  });

  it('calculates purpose-specific expiry and blocks held or already deleted media', () => {
    const activePolicy = policy({ id: 'v2', customerPhotoDays: 90, xlsxDays: 30 });
    const createdAt = new Date('2026-07-01T00:00:00.000Z');
    expect(retentionUntilForMedia('CUSTOMER_BOOKING_PHOTO', createdAt, activePolicy)).toEqual(
      new Date('2026-09-29T00:00:00.000Z'),
    );
    expect(retentionUntilForMedia('REPORT_XLSX', createdAt, activePolicy)).toEqual(
      new Date('2026-07-31T00:00:00.000Z'),
    );
    const base = {
      status: 'READY' as const,
      retentionUntil: new Date('2026-07-30T00:00:00.000Z'),
      legalHoldAt: null,
      deletedAt: null,
    };
    expect(isBookingRetentionEligible(base, new Date('2026-08-01T00:00:00.000Z'))).toBe(true);
    expect(
      isBookingRetentionEligible(
        { ...base, legalHoldAt: new Date('2026-07-15T00:00:00.000Z') },
        new Date('2026-08-01T00:00:00.000Z'),
      ),
    ).toBe(false);
    expect(
      isBookingRetentionEligible(
        { ...base, status: 'DELETED', deletedAt: new Date('2026-07-31T00:00:00.000Z') },
        new Date('2026-08-01T00:00:00.000Z'),
      ),
    ).toBe(false);
  });
});
