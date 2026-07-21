# KPI Source Adapter Contract

The KPI engine owns calculation, not source business data. A source adapter implements:

```ts
type KpiSourceQuery = {
  tenantId: string;
  membershipId: string;
  branchId: string;
  businessDate: string; // YYYY-MM-DD in snapshotted tenant timezone
  kpiCode: string;
  mappingVersionId: string;
};

type KpiSourceSnapshot = {
  sourceType: "FORM_SUBMISSION" | "ATTENDANCE" | "DOMAIN";
  sourceId: string;
  observedAt: string;
  value: string; // exact decimal integer/percentage string
  unit: string;
  inputDigest: string;
};

interface KpiSourcePort {
  read(query: KpiSourceQuery): Promise<KpiSourceSnapshot | null>;
}
```

Rules:

- Caller derives tenant/member/branch from authenticated or worker scope; adapter never accepts a scope
  override from untrusted form data.
- Same authoritative source version returns the same digest/value; a changed source produces a new digest
  and append-only calculation event.
- `null` means missing data, not zero. Adapter errors use stable safe codes and cannot make a KPI pass.
- Form adapter reads only the published form/version and allow-listed JSON Pointer stored in mapping.
- Attendance adapter is a test double in Module 2 and is implemented by Module 3 without schema changes.
- Values are exact strings; normalization and comparison happen in the domain engine.
