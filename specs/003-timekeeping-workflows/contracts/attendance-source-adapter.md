# Attendance KPI Source Adapter

Module 3 implements Module 2's `KpiSourcePort` for `ATTENDANCE_ON_TIME_RATE`. KPI calculation remains owned
by Module 2; Module 3 only provides authoritative attendance snapshots.

```ts
type AttendanceKpiSourceQuery = {
  tenantId: string;
  membershipId: string;
  branchId: string;
  businessDate: string; // YYYY-MM-DD in snapshotted tenant timezone
  kpiCode: "ON_TIME_RATE";
  mappingVersionId: string;
};

type AttendanceKpiSourceSnapshot = {
  sourceType: "ATTENDANCE";
  sourceId: string; // AttendanceEvent id
  observedAt: string; // attendance close/confirmation instant
  value: string; // exact percentage string, e.g. "100" or "0"
  unit: "PERCENT";
  inputDigest: string;
};
```

Rules:

- Query scope is derived by the caller from authenticated/worker context; adapter never trusts client scope.
- Only confirmed Module 3 attendance data is eligible.
- `WORKED_ON_TIME` returns `100`; `WORKED_LATE` returns `0`; `OFF_OR_APPROVED_LEAVE` and
  `NON_WORKED_NO_CHECKIN` return `null` when the employee is not report-eligible for KPI that day.
- Missing source returns `null`, not zero.
- Input digest changes when attendance classification, schedule snapshot, policy version or business date
  changes.
- No video metadata, signed URL, chat content or evidence payload appears in the snapshot, log or outbox.
- Cross-tenant, cross-branch or wrong-member data returns safe not-found/authorization errors in service
  boundaries; adapter itself should not leak existence.
