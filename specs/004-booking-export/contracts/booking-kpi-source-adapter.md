# Booking KPI Source Adapter Contract

Module 2 requests authoritative tour metrics through a service boundary, not direct table access.

```ts
interface BookingKpiSourceAdapter {
  getCompletedTourCount(input: {
    tenantId: string;
    membershipId: string;
    branchId: string;
    businessDate: string;
    asOf: string;
  }): Promise<{
    value: number | null;
    sourceFreshnessAt: string;
    sourceRefs: Array<{
      type: "TOUR_COMPLETION";
      id: string;
      occurredAt: string;
    }>;
  }>;
}
```

Rules:
- Every source row must match tenant, branch, performer and business date.
- Only active, committed `TourCompletion` records at or before `asOf` count.
- Superseded/corrected records do not double count.
- Return `null` when source quality is indeterminate; do not silently return zero.
- `sourceRefs` contain IDs/timestamps only, never customer PII or media URLs.
- Repeated calls for the same snapshot are deterministic.
- `booking.tour-completed.v1` may trigger refresh, but the adapter query remains authoritative.

Required verification: valid count, zero count, indeterminate data, cross-tenant denial, branch
mismatch, correction/supersession, as-of cutoff and event retry dedupe.
