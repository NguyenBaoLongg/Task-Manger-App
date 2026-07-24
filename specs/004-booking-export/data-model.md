# Data Model: Booking và xuất báo cáo

Mọi bảng dưới đây có composite identity `(tenant_id, id)`, composite tenant foreign keys và index
bắt đầu bằng `tenant_id`. Timestamp dùng UTC; `business_date` và timezone/policy snapshot giữ cách
diễn giải theo tenant.

## Enums

- `BookingType`: `SCHEDULED`, `WALK_IN`
- `BookingStatus`: `SCHEDULED`, `ARRIVED`, `NO_SHOW`, `CANCELLED`, `RESCHEDULED`
- `PhotoDebtState`: `OPEN`, `RESOLVED`, `WAIVED`
- `BookingReportType`: `TOMORROW_SCHEDULE`, `TODAY_OUTCOME`
- `BookingJobState`: `PENDING`, `RUNNING`, `SUCCEEDED`, `RETRYABLE`, `FAILED`
- `ExportState`: `PENDING`, `RUNNING`, `READY`, `RETRYABLE`, `FAILED`, `EXPIRED`
- `ConsentMethod`: `VERBAL`, `WRITTEN`, `OTHER`

## Customer

Fields: `tenant_id`, `id`, `display_name`, `phone_normalized?`, `email_normalized?`, `note?`,
`created_by_membership_id`, timestamps, `archived_at?`, `state_version`.

Rules:
- PII fields are encrypted/redacted according to platform policy and never emitted to logs.
- Optional dedupe indexes are tenant-scoped; duplicate-looking customers are not auto-merged.
- Update uses optimistic state version and writes redacted audit before/after.

## CustomerBranchAccess

Fields: `tenant_id`, `customer_id`, `branch_id`, `granted_by_membership_id`, `granted_at`,
`revoked_at?`.

Unique active mapping per tenant/customer/branch. Customer reads require at least one active mapping
inside actor branch scope.

## ServiceOffering / ServiceOfferingVersion / ServiceBranchAvailability

`ServiceOffering`: tenant ID, stable code, created actor/time.

`ServiceOfferingVersion`: tenant/id, service ID, version number, name, description?, status,
effective interval, actor and timestamps. Effective versions are immutable.

`ServiceBranchAvailability`: tenant ID, service version ID, branch ID, effective interval, status.

A booking references an active service-branch mapping at `scheduled_start_at`/arrival server time.

## Booking

Fields:
- identity/scope: `tenant_id`, `id`, `branch_id`
- links: `customer_id`, `service_offering_id`, `service_offering_version_id`,
  `assigned_membership_id`,
  `form_submission_id?`, `form_version_id?`
- snapshots: `service_code_snapshot`, `service_name_snapshot`
- schedule: `booking_type`, `scheduled_start_at`, `business_date`, `timezone_snapshot`
- lifecycle: `status`, `state_version`, `rescheduled_from_id?`, `rescheduled_to_id?`
- attribution: `created_by_membership_id`, `created_at`, `updated_at`

Indexes:
- `(tenant_id, branch_id, business_date, scheduled_start_at, id)`
- `(tenant_id, assigned_membership_id, business_date, status)`
- `(tenant_id, customer_id, scheduled_start_at desc)`

Constraint:

```sql
EXCLUDE USING gist (
  tenant_id WITH =,
  branch_id WITH =,
  assigned_membership_id WITH =,
  tstzrange(scheduled_start_at, scheduled_start_at + interval '60 minutes', '[)') WITH &&
)
WHERE (
  booking_type = 'SCHEDULED'
  AND status IN ('SCHEDULED', 'ARRIVED')
);
```

Migration enables `btree_gist`. Walk-ins and terminal scheduled bookings do not enter the
constraint. Prisma schema documents the raw migration-owned constraint.

## BookingStatusTransition

Fields: tenant/id, booking ID, from/to status, reason version ID?, reason code/label snapshot?,
actor membership ID, evidence media ID?, correlation ID, idempotency/source event ID, occurred at,
redacted metadata snapshot.

Append-only. Unique `(tenant_id, booking_id, source_event_id)`.

Valid transitions:

```text
SCHEDULED -> ARRIVED | NO_SHOW | CANCELLED | RESCHEDULED
ARRIVED   -> CANCELLED (privileged correction only)
NO_SHOW/CANCELLED/RESCHEDULED are terminal
```

Repeated identical idempotent transitions return prior result; conflicting transitions return 409.

## BookingCancellationReason / BookingCancellationReasonVersion

Root fields: tenant/id, stable code, created actor/time.

Version fields: tenant/id, reason ID, version number, label, applies-to cancellation/reschedule flags,
status, effective interval, actor, timestamps.

Published/effective versions are immutable. Booking transition snapshots code/label.

## CustomerPhotoConsentPolicyVersion

Fields: tenant/id, version number, title, policy text, allowed methods, status, effective interval,
created/published actor and timestamps. Published/effective rows are immutable and only one version
is effective at a time per tenant.

## CustomerPhotoConsent

Fields: tenant/id, branch ID, booking ID, customer ID, actor membership ID, method, policy version ID,
server timestamp, correlation ID. Append-only and must precede upload intent.

Customer-photo upload intent requires this consent ID and creates a `MediaObject` scoped to the same
tenant/branch/booking. A consent from another booking or expired/revoked policy cannot authorize it.

## CustomerPhotoDebt

Fields: tenant/id, branch ID, booking ID, customer ID, owner membership ID, state, state version,
action item ID?, resolved media ID?, opened/resolved/waived actor/time/reason, source event ID.

Unique active logical debt `(tenant_id, booking_id)`. `WAIVED` requires privileged permission,
reason and audit. Media completion and action-item closure share a transaction/outbox boundary.

## TourCompletion

Fields: tenant/id, branch ID, booking ID, customer ID, performed_by_membership_id, service ID,
customer_photo_media_id, form submission ID?, business date, completed at server time, source event
ID, correction link?, timestamps.

One active completion per booking. Corrections append a superseding record; no overwrite. Emits KPI
source event only after commit.

## BookingReportDestination

Fields: tenant/id, branch ID?, report type, chat channel ID, status, effective interval, actor,
timestamps. Channel tenant and branch compatibility are enforced.

## BookingJobRun / BookingReportDelivery

Run fields: tenant/id, job type, report type?, business date, branch scope snapshot, state, attempt,
lease owner/until, checkpoint, input hash, safe error code, correlation ID, started/completed times.

Delivery fields: tenant/id, run ID, branch ID?, destination channel ID, revision, dedupe key,
content hash, state, message ID?, attempt, safe error code, timestamps.

Unique job schedule key and delivery dedupe key prevent duplicate claims/messages.

## ExportRequest

Fields: tenant/id, requester membership ID, format (`XLSX` only), report/data types, date range,
branch scope snapshot, filter JSON + schema version + request hash, state, progress row count,
checkpoint, attempt/lease, media object ID?, checksum/byte size?, expires at, safe error code,
idempotency key, correlation ID, timestamps.

Rules:
- Range and rows obey configured hard limits.
- READY requires a READY `MediaObject` with purpose `REPORT_XLSX`.
- Download re-checks current RBAC for every requested branch.
- State machine:

```text
PENDING -> RUNNING -> READY -> EXPIRED
              \-> RETRYABLE -> RUNNING
              \-> FAILED
```

## BookingRetentionPolicyVersion

Fields: tenant/id, version number, customer photo days, XLSX days, platform-bound snapshot,
effective from/to, actor, created at. Effective versions are immutable.

## MediaRetentionTombstone

Reuse Module 3 entity. New source/purpose values support customer photos and XLSX. Unique source
deletion key, deletion reason/time, object checksum/size metadata, policy version and legal-hold
decision; no binary or PII payload.

## ActionItem Integration

Extend `ActionItemType` with booking-focused values:
- `BOOKING_MISSING_STATUS`
- `BOOKING_MISSING_CUSTOMER_PHOTO`
- `TOUR_INCOMPLETE`

Deterministic uniqueness uses tenant + owner + type + source booking/tour + business date. Deep
links are opaque server-generated routes for Module 5.

## Tenant FK and deletion policy

- No cross-tenant FK is scalar-only; every relation includes tenant ID.
- Customer/booking/history/tour metadata is not cascade-deleted during normal operation.
- Binary retention changes media status and writes tombstone; it does not delete business/audit rows.
- Tenant purge/restore remains a platform operation, outside Module 4 API.
