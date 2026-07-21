# Data Model: KPI hằng ngày và việc cần hoàn thành

Mọi bảng tenant-owned có khóa đầu tiên `tenant_id UUID`, mọi lookup/unique/index nghiệp vụ đều chứa
`tenant_id`. Foreign key tenant-owned dùng cặp `(tenant_id, id)` để ngăn liên kết chéo tenant.

## Enumerations

- `KpiValueType`: `MONEY`, `COUNT`, `PERCENTAGE`
- `KpiDirection`: `AT_LEAST`, `AT_MOST`
- `KpiSourceType`: `FORM_FIELD`, `DOMAIN_ADAPTER`
- `KpiScopeType`: `TENANT`, `BRANCH`, `DEPARTMENT`, `GROUP`, `MEMBERSHIP`
- `ReportStatus`: `OPEN`, `SUBMITTED`, `LATE`, `CLOSED`
- `EvaluationStatus`: `PASSED`, `FAILED`, `EXEMPT`
- `PenaltyKind`: `DAILY_KPI`, `PHOTO_EVIDENCE`
- `PenaltyStatus`: `ASSESSED`, `FULLY_REVERSED`
- `EvidenceDebtStatus`: `WAITING_PHOTOS`, `SATISFIED`, `OVERDUE`, `WAIVED`
- `ActionItemState`: `OPEN`, `OVERDUE`, `COMPLETED`, `DISMISSED`
- `ActionItemType`: `KPI_REPORT`, `KPI_SHORTFALL`, `PHOTO_DEBT`, `DATA_QUALITY`
- `JobRunStatus`: `PENDING`, `RUNNING`, `COMPLETED`, `PARTIAL`, `FAILED`
- `OutboxStatus`: `PENDING`, `PROCESSING`, `SENT`, `DEAD_LETTER`

## Configuration entities

### `KpiDefinition`

Fields: `tenant_id`, `id`, stable `code`, `name`, `description`, `value_type`, `unit`, `direction`,
`source_type`, `status`, `created_by_membership_id`, timestamps.

Constraints/indexes:

- PK `(tenant_id,id)`, unique `(tenant_id,code)`.
- Value/unit consistency check: MONEY has currency unit; PERCENTAGE uses percentage points.
- No hard delete after referenced; status becomes archived.

### `KpiTargetVersion`

Fields: `tenant_id`, `id`, `kpi_definition_id`, `scope_type`, nullable branch/department/group/membership
scope IDs, typed target columns (`target_money_minor`, `target_count`, `target_percentage`), `required`,
`effective_from`, `effective_to`, `version_number`, actor, `reason`, timestamps.

Constraints/indexes:

- Exactly one typed target matches definition value type.
- Exactly the scope ID required by `scope_type` is set.
- Unique version `(tenant_id,kpi_definition_id,scope_type,scope_key,version_number)`.
- Index effective resolution by tenant/KPI/scope/effective range.
- Service rejects overlapping effective ranges for the same natural scope; writes use transaction lock.

### `KpiSourceMappingVersion`

Fields: `tenant_id`, `id`, `kpi_definition_id`, `source_type`, nullable `form_template_id`,
`form_version_id`, `json_pointer`, nullable `adapter_code`, `aggregation`, `normalization_json`,
`requires_evidence`, effective range, version, actor, reason.

Constraints: form fields are required only for `FORM_FIELD`; adapter code only for `DOMAIN_ADAPTER`;
JSON Pointer must be allow-listed and mapping is immutable after effective use.

### `DailyKpiPolicyVersion`

Fields: `tenant_id`, `id`, `scope_type` (`TENANT|BRANCH`), nullable `branch_id`, `version_number`,
`effective_from_date`, `effective_to_date`, `timezone`, `report_open_local`, `report_close_local`,
`evaluation_local`, `failure_penalty_minor` default `100000`, `currency`=`VND`, `kpi_scope_json`,
`membership_scope_json`, `exemption_rule_json`, `evidence_enabled`, `evidence_grace_seconds` default `300`,
nullable `photo_penalty_minor`, actor, reason, timestamps.

Constraints:

- Time order is open < close < evaluation within the same business day.
- Tenant policy has no branch; branch override has one tenant-owned branch.
- Unique `(tenant_id,scope_type,branch_id,version_number)` and no overlapping effective date ranges.
- Bulk apply creates one version per selected branch in one transaction and one audit correlation group.

## Daily operational entities

### `DailyKpiReport`

Fields: `tenant_id`, `id`, `membership_id`, `branch_id`, `business_date`, `policy_version_id`, resolved
`opened_at`, `closed_at`, `evaluation_at`, `status`, nullable current revision ID, timestamps.

Unique `(tenant_id,membership_id,business_date)`. The selected branch/policy/time instants are immutable
after creation. Header is created lazily on first progress/submission read or by the close-day worker, so a
missing submission still has a report/evaluation anchor. Multiple effective branches block header/evaluation
creation, are recorded as a safe job item error and create a data-quality action item.

### `DailyKpiReportRevision`

Fields: `tenant_id`, `id`, `report_id`, `revision_number`, `form_submission_id`, `form_version_id`,
`submitted_at`, `accepted_in_window`, `source_digest`, `created_by_membership_id`, `created_at`.

Unique `(tenant_id,report_id,revision_number)` and `(tenant_id,report_id,form_submission_id)`. Append-only;
late revisions may be recorded for audit but never replace the eligible closing revision.

### `KpiCalculationEvent`

Fields: `tenant_id`, `id`, `report_id`, nullable revision ID, `kpi_definition_id`, target/mapping version
IDs, typed target/actual/remaining fields, unit, `passed`, `source_type`, `source_id`, `source_observed_at`,
`calculation_version`, `calculated_at`, `input_digest`.

Append-only. Unique idempotency key `(tenant_id,report_id,kpi_definition_id,input_digest)`; query index
orders newest calculation per report/KPI.

### `DailyKpiEvaluation`

Fields: `tenant_id`, `id`, `report_id`, membership/branch/business date/policy snapshot, selected revision
ID, `status`, `failed_details_json`, nullable exemption source, `evaluated_at`, `job_run_id`, algorithm version.

Unique `(tenant_id,membership_id,business_date)`. Immutable after insert. `PASSED` requires every required
KPI passed and a qualifying report; no report/late report/missing KPI yields `FAILED`.

### `PenaltyOutcome`

Fields: `tenant_id`, `id`, nullable `evaluation_id`, membership/branch/business date/policy version,
`kind` (`DAILY_KPI|PHOTO_EVIDENCE`), nullable `source_key`,
`amount_minor`, `currency`, failed details snapshot, `status`, `assessed_at`.

Daily KPI unique key is `(tenant_id,membership_id,business_date,kind)` for `DAILY_KPI`; evidence unique key
adds the debt `source_key` for `PHOTO_EVIDENCE`. `amount_minor >= 0`; zero/exempt evaluations do not create
an outcome and evidence creates one only when its policy version has an explicit amount. Original row is immutable.

### `PenaltyAdjustment`

Fields: `tenant_id`, `id`, `penalty_outcome_id`, signed `delta_minor`, `reason`, actor membership,
`correlation_id`, `idempotency_key`, `created_at`.

Unique `(tenant_id,actor_membership_id,idempotency_key)`. Append-only. Transaction validates resulting
effective amount is non-negative; full reversal changes projection status, not original amount.

## Evidence and action entities

### `EvidenceDebt`

Fields: `tenant_id`, `id`, `report_id`, `policy_version_id`, `required_count`, `received_count`, `state`,
`deadline_at`, nullable reminder/finalized instants, nullable penalty outcome link, state version, timestamps.

Unique `(tenant_id,report_id)`. Received count derives only from READY media matching tenant/owner/source.
Allowed transitions: `WAITING_PHOTOS -> SATISFIED|OVERDUE|WAIVED`; terminal states do not reopen.

### `ActionItem`

Fields: `tenant_id`, `id`, `owner_membership_id`, nullable branch/department, `item_type`, `source_type`,
`source_id`, `business_date`, `state`, `priority`, `title`, typed target/actual/remaining snapshot,
`unit`, `deadline_at`, `source_freshness_at`, `deep_link`, state version, timestamps/completed time.

Unique `(tenant_id,owner_membership_id,item_type,source_type,source_id,business_date)`. Current projection may
update idempotently while history remains in transitions. Manager indexes include tenant/branch/department/
state/date with cursor `(updated_at,id)`.

### `ActionItemTransition`

Fields: tenant/action item IDs, from/to state, reason code, actor nullable for worker, source event ID,
snapshot JSON, occurred_at. Unique `(tenant_id,action_item_id,source_event_id)`; append-only.

## Job and delivery entities

### `JobRun`

Fields: tenant ID, job type, business date, status, checkpoint cursor, attempt, lease owner/until,
started/completed times, safe error code/count, correlation ID.

Unique `(tenant_id,job_type,business_date)`. Lease is reclaimable; checkpoint advances only after employee
transaction commits.

### `OutboxEvent`

Fields: tenant/event IDs, aggregate type/ID, event type/schema version, dedupe key, redacted payload JSON,
status, attempt, available/lease/sent times, last safe error, created_at.

Unique `(tenant_id,dedupe_key)`. Index `(status,available_at,id)` supports dispatcher claims.

## Existing Module 1 relationships

- `TenantMembership`, `Assignment`, `Branch`, `Department`: scope and the sole-current-branch rule.
- `FormTemplate`, `FormVersion`, `FormSubmission`: report/source authority.
- `MediaObject`: evidence authority; no binary duplication.
- `AuditEvent`, `TenantIdempotencyRecord`: reused for public mutations.
- `MembershipRoleBinding`/`Permission`: configure/view/rerun/adjust authorization.

## Retention and deletion

KPI metadata, revisions, evaluations, penalties, adjustments and audit are retained five years unless legal
hold/policy requires longer. Membership suspension/leave and KPI archive never cascade-delete history.
Evidence binary follows Module 1 media retention; tombstone references remain sufficient to explain a debt.
