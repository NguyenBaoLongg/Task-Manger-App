export interface BookingRetentionPolicyLike {
  tenantId?: string;
  id: string;
  versionNumber: number;
  customerPhotoDays: number;
  xlsxDays: number;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
}

export function resolveBookingRetentionPolicy(
  policies: readonly BookingRetentionPolicyLike[],
  at: Date,
): BookingRetentionPolicyLike | null {
  return (
    [...policies]
      .filter(
        (policy) =>
          policy.effectiveFrom <= at &&
          (policy.effectiveTo === null ||
            policy.effectiveTo === undefined ||
            policy.effectiveTo > at),
      )
      .sort((left, right) => {
        const effectiveOrder = right.effectiveFrom.getTime() - left.effectiveFrom.getTime();
        return effectiveOrder || right.versionNumber - left.versionNumber;
      })[0] ?? null
  );
}

export function retentionUntilForMedia(
  purpose: string,
  createdAt: Date,
  policy: Pick<BookingRetentionPolicyLike, 'customerPhotoDays' | 'xlsxDays'>,
): Date | null {
  const days =
    purpose === 'CUSTOMER_BOOKING_PHOTO'
      ? policy.customerPhotoDays
      : purpose === 'REPORT_XLSX'
        ? policy.xlsxDays
        : null;
  if (days === null) return null;
  const expiresAt = new Date(createdAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + days);
  return expiresAt;
}

export function isBookingRetentionEligible(
  media: {
    status: string;
    retentionUntil?: Date | null;
    legalHoldAt?: Date | null;
    deletedAt?: Date | null;
  },
  now: Date,
) {
  return (
    media.status === 'READY' &&
    media.deletedAt === null &&
    media.retentionUntil !== null &&
    media.retentionUntil !== undefined &&
    media.retentionUntil <= now &&
    media.legalHoldAt === null
  );
}
