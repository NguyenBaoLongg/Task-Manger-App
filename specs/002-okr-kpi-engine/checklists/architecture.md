# Architecture Requirements Checklist: KPI hằng ngày và việc cần hoàn thành

**Purpose**: Test completeness, clarity, consistency and measurability before implementation tasks
**Created**: 2026-07-19
**Feature**: [spec.md](../spec.md)

## Requirement Completeness

- [x] CHK001 Are KPI value types, directions, units, source types and lifecycle states bounded? [Spec FR-001, Data Model KpiDefinition]
- [x] CHK002 Are target scopes, precedence and effective-version history all defined? [Spec FR-003–FR-004, Research R2]
- [x] CHK003 Are tenant and branch policy scopes, atomic bulk application and fallback behavior defined? [Spec FR-005–FR-007]
- [x] CHK004 Are report header, immutable revision and eligible closing revision concepts complete? [Spec FR-009–FR-010, Data Model DailyKpiReport]
- [x] CHK005 Are automatic source mapping, normalization, source snapshot and client-authority restrictions defined? [Spec FR-011–FR-012]
- [x] CHK006 Are progress fields sufficient for target, actual, remaining, freshness, deadline and deep-link? [Spec FR-013, FR-023]
- [x] CHK007 Are pass, fail, exemption and data-error results objectively distinguished? [Spec FR-014–FR-015, Research R3]
- [x] CHK008 Are original penalty, effective amount and append-only correction requirements complete? [Spec FR-016–FR-018]
- [x] CHK009 Are evidence required-count, valid media, grace, reminder, terminal states and optional amount covered? [Spec FR-019–FR-021]
- [x] CHK010 Are employee and manager action-item projections, unique source keys and history defined? [Spec FR-022–FR-025]

## Money and Time Clarity

- [x] CHK011 Is VND represented exactly and protected from binary floating-point behavior? [Spec Edge Cases, Research R5]
- [x] CHK012 Is the default daily KPI amount exactly 100.000 VND and capped at one outcome per person/day? [Spec FR-016, SC-003]
- [x] CHK013 Is policy version snapshotted so later edits never change a closed amount? [Spec US3, FR-007, FR-018]
- [x] CHK014 Is adjustment behavior explicit without overwriting original financial history? [Spec FR-018, Data Model PenaltyAdjustment]
- [x] CHK015 Are 18:00 inclusive, 20:00 exclusive and evaluation after close encoded unambiguously? [Spec FR-008, Research R4]
- [x] CHK016 Are business date, tenant timezone and UTC instant all preserved for replay? [Spec Edge Cases, Data Model DailyKpiReport]
- [x] CHK017 Does late data remain auditable without retroactively converting a failed closed day? [Spec FR-010, FR-014, Research R6]

## Tenant, Branch and Authorization Consistency

- [x] CHK018 Does every new entity, unique key, lookup and job retain tenant scope? [Spec CR-001, Data Model introduction]
- [x] CHK019 Is the employee identity consistently an authenticated membership rather than name/email? [Spec FR-009, Module 1 dependency]
- [x] CHK020 Is one effective working branch required while the historical assignment schema remains extensible? [Clarification, Spec FR-007, Research R3]
- [x] CHK021 Does multiple active branch data fail safe without creating a guessed penalty? [Spec Edge Cases, Quickstart single-branch case]
- [x] CHK022 Are employee self-read/write and manager/owner scoped operations separated? [Spec US2/US4, CR-002]
- [x] CHK023 Are cross-tenant IDs rejected atomically for policy, source, media, reports and action items? [Spec CR-001, SC-002]
- [x] CHK024 Is assignment explicitly not an authorization grant? [Spec CR-002, Constitution II]

## Historical and Concurrency Correctness

- [x] CHK025 Are configuration versions immutable/effective-dated with actor, reason and audit? [Spec FR-003–FR-005, FR-027]
- [x] CHK026 Are calculation inputs and algorithms sufficient to reproduce historical remaining/pass results? [Spec FR-012, Data Model KpiCalculationEvent]
- [x] CHK027 Are evaluation and penalty unique business keys specified independent of queue delivery semantics? [Spec FR-017, Research R7]
- [x] CHK028 Are public idempotency replay and same-key/different-payload conflict outcomes defined? [Spec Edge Cases, FR-026]
- [x] CHK029 Are worker lease, batch, checkpoint and partial failure semantics defined? [Spec Edge Cases, Plan transaction boundaries]
- [x] CHK030 Is outbox committed atomically and downstream delivery deduplicated? [Spec FR-028, Domain Events]
- [x] CHK031 Do suspension/archive/leave actions preserve all closed history? [Spec FR-029]

## Evidence, Privacy and Operations

- [x] CHK032 Is evidence activated only by an explicit versioned policy/template rule? [Spec FR-019, Research R9]
- [x] CHK033 Can only READY media with matching tenant, owner and source satisfy evidence? [Data Model EvidenceDebt, Quickstart]
- [x] CHK034 Is perceptual hash prohibited from making an MVP fraud decision? [Spec FR-021, FR-030]
- [x] CHK035 Are raw form, revenue, media URLs and identity values excluded from outbox/logs? [Spec CR-004, Domain Events]
- [x] CHK036 Are metadata retention and existing media retention/tombstones reconciled? [Spec Assumptions, Data Model retention]
- [x] CHK037 Are metrics bounded and free of tenant/member high-cardinality labels? [Spec CR-005, Research R11]
- [x] CHK038 Are local realtime/media/attendance dependencies testable without live credentials? [Spec CR-006, Source Adapter]

## Verification and Scope

- [x] CHK039 Does every public operation have success, validation, authn, authz, idempotency/conflict and safe-error test intent? [Spec SC-008, OpenAPI]
- [x] CHK040 Are pure arithmetic/time/policy rules assigned unit-level verification? [Plan Verification Strategy]
- [x] CHK041 Are schema upgrade, clean deploy, composite tenant constraints and seed reruns included? [Plan Verification Strategy]
- [x] CHK042 Is 100-way retry/concurrency uniqueness measurable? [Spec SC-003, SC-007]
- [x] CHK043 Are 10.000-member batch and p95 targets capacity evidence rather than hard business limits? [Spec SC-009, Quickstart Load Profile]
- [x] CHK044 Are advanced OKR, weekly check-in, attendance ownership, booking/export and mobile UI excluded? [Spec FR-030, Assumptions]
- [x] CHK045 Does post-design Constitution review pass without a documented exception? [Plan Constitution Check]

## Notes

- Validation result: 45/45 checks pass.
- Highest-risk areas for task generation: money/time boundaries, tenant isolation, single-branch fail-safe,
  concurrent close-day uniqueness and immutable adjustment history.
