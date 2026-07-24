# Data Model: Chấm công và workflow duyệt

Mọi entity tenant-owned có `tenant_id` và mọi FK tới entity tenant-owned dùng cặp `(tenant_id,id)` hoặc
scope tương đương để chặn liên kết chéo tenant. Mọi record gắn nhân viên nghiệp vụ dùng
`tenant_membership_id`; tên chỉ là dữ liệu hiển thị.

## Enumerations

- `ShiftStatus`: `ACTIVE`, `RETIRED`
- `ScheduleState`: `SCHEDULED`, `OFF`, `LEAVE_APPROVED`, `ADJUSTED`, `CANCELLED`
- `ScheduleChangeKind`: `SELF_EDIT`, `CHANGE_REQUEST`, `MANAGER_ADJUSTMENT`, `OFF_CALENDAR`, `LEAVE_APPROVAL`
- `AttendanceState`: `PENDING_VIDEO`, `VIDEO_UPLOADED`, `CONFIRMED`, `MISSING_CHECK_IN`, `NON_WORKED`, `EXEMPT_OFF`
- `VideoProcessingState`: `REQUESTED`, `UPLOADED`, `VERIFYING`, `CONVERTING`, `READY`, `FAILED_RETRYABLE`, `FAILED_FINAL`
- `VideoReviewStatus`: `PENDING`, `PASSED`, `FAILED`, `WAIVED`
- `DayWorkClassification`: `WORKED_ON_TIME`, `WORKED_LATE`, `NON_WORKED_NO_CHECKIN`, `OFF_OR_APPROVED_LEAVE`
- `ViolationKind`: `MISSING_CHECK_IN`, `VIDEO_STANDARD_FAILED`, `LATE_BASE`, `LATE_NO_NOTICE`, `SUDDEN_LEAVE_NO_NOTICE`, `SUDDEN_LEAVE_OVER_LIMIT`, `LEAVE_RULE_VIOLATION`
- `PenaltySettlementStatus`: `PENDING`, `SUBMITTED`, `CONFIRMED`, `REJECTED`, `WAIVED`, `REFUNDED`
- `RequestType`: `SHIFT_CHANGE`, `LATE_NOTICE`, `LEAVE_SCHEDULE`, `SUDDEN_LEAVE`
- `RequestStatus`: `DRAFT`, `SUBMITTED`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `CANCELLED`, `EXPIRED`
- `ApprovalStepMode`: `SEQUENTIAL`, `PARALLEL`
- `ApprovalDecision`: `APPROVE`, `REJECT`, `REQUEST_CHANGES`, `CANCEL`
- `LeaveDurationKind`: `FULL_DAY`, `MORNING_HALF`, `DATE_RANGE`
- `OffCalendarScope`: `TENANT`, `BRANCH`
- `JobRunStatus`: `PENDING`, `RUNNING`, `COMPLETED`, `PARTIAL`, `FAILED`

## Schedule and OFF calendar

### `ShiftDefinition`

Fields: `tenant_id`, `id`, stable `code`, `name`, `start_local_time`, `timezone`, `status`,
`effective_from_date`, `effective_to_date`, `version_number`, actor, reason, timestamps.

Constraints/indexes:

- Unique `(tenant_id,code,version_number)`.
- Tenant seed creates `SHIFT_0830` and `SHIFT_0930`.
- Retire by status/effective range; never hard-delete referenced shifts.

### `WorkScheduleVersion`

Fields: `tenant_id`, `id`, `tenant_membership_id`, `branch_id`, `business_date`, nullable
`shift_definition_id`, `state`, `change_kind`, `source_request_id?`, `source_off_calendar_id?`,
`version_number`, `effective_at`, `superseded_at?`, actor, reason, timestamps.

Constraints/indexes:

- Unique active `(tenant_id,tenant_membership_id,business_date)` where `superseded_at` is null.
- Branch must be the sole current branch for the membership at the business date.
- `SCHEDULED` requires a shift; `OFF`/`LEAVE_APPROVED` must not require a shift.
- Any change after shift start requires manager permission and reason.

### `CompanyOffCalendarVersion`

Fields: `tenant_id`, `id`, `scope_type` (`TENANT|BRANCH`), nullable `branch_id`, `name`, `start_date`,
`end_date`, `timezone`, `version_number`, `status`, actor, reason, timestamps.

Constraints/indexes:

- Tenant scope has null branch; branch scope requires tenant-owned branch.
- No overlapping active ranges for the same natural scope/name unless a newer version supersedes the old one.
- OFF calendar does not count toward personal absence totals and suppresses attendance/KPI report requirements.

## Attendance and video

### `VideoPolicyVersion`

Fields: `tenant_id`, `id`, `scope_type` (`TENANT|BRANCH`), nullable `branch_id`, `version_number`,
`effective_from_date`, `effective_to_date`, `requires_acknowledgement`, `requires_full_body`,
`requires_work_area`, `manual_review_required`, `missing_checkin_penalty_minor` default `50000`,
`video_failed_penalty_minor` default `50000`, `currency` default `VND`, actor, reason, timestamps.

Constraints:

- Branch override wins over tenant policy for the employee branch and business date.
- Policy version is snapshotted into attendance/check-in violations.

### `VideoPolicyAcknowledgement`

Fields: `tenant_id`, `id`, `tenant_membership_id`, `policy_version_id`, `acknowledged_at`,
`session_id?`, `device_id?`, `action`, timestamps.

Constraints:

- Unique `(tenant_id,tenant_membership_id,policy_version_id)`.
- Must exist before accepting check-in video for a policy requiring acknowledgement.

### `AttendanceEvent`

Fields: `tenant_id`, `id`, `tenant_membership_id`, `branch_id`, `business_date`, `schedule_version_id`,
`video_policy_version_id`, `server_recorded_at`, nullable `check_in_at`, `state`, `day_classification`,
`classification_reason`, nullable `source_request_id`, `correlation_id`, timestamps.

Constraints/indexes:

- Unique `(tenant_id,tenant_membership_id,business_date)` for the canonical attendance event.
- Snapshot schedule/policy/branch cannot be changed after confirmed evaluation; corrections are separate transitions.
- `NON_WORKED_NO_CHECKIN` after the 12:00 tenant-local cutoff creates the missing-check-in violation; without a later
  check-in or approved correction, the day is exempt from daily KPI report requirement but not attendance violations.

### `CheckInVideoAsset`

Fields: `tenant_id`, `id`, `attendance_event_id`, `media_object_id`, `original_content_type`,
`original_checksum`, nullable `converted_media_object_id`, `processing_state`, `attempt_count`,
`last_safe_error_code?`, `requested_at`, `uploaded_at?`, `ready_at?`, timestamps.

Constraints:

- MediaObject must belong to same tenant, owner membership and attendance source.
- Conversion jobs are retry-safe; failed conversion cannot mark video READY.
- Binary content remains in object storage; metadata/audit only in PostgreSQL.

### `VideoReviewResult`

Fields: `tenant_id`, `id`, `attendance_event_id`, `review_status`, `reviewed_by_membership_id`,
`reviewed_at`, `reason`, `failed_criteria_json`, timestamps.

Constraints:

- MVP never creates `FAILED` from AI. Only actor with review permission can fail/waive.
- Review result writes audit and may create a `VIDEO_STANDARD_FAILED` violation.

### `LateOccurrence`

Fields: `tenant_id`, `id`, `attendance_event_id`, `tenant_membership_id`, `branch_id`, `business_date`,
`shift_start_at`, `check_in_at`, `late_seconds`, `late_minutes`, `monthly_late_sequence`,
`first_late_exempt`, `after_15_local`, `after_18_local`, `late_notice_request_id?`,
`queue_impact_flag`, `policy_version_id`, timestamps.

Constraints:

- `late_minutes = floor(max(0, check_in_at - shift_start_at) / 60 seconds)`.
- `late_minutes = 0` creates no late occurrence and does not consume first-late exemption.
- Check-in after 15:00 remains a worked-late day and report-eligible.

## Penalty and payment

### `AttendancePenaltyPolicyVersion`

Fields: `tenant_id`, `id`, `scope_type` (`TENANT|BRANCH`), nullable `branch_id`, `version_number`,
`effective_from_date`, `effective_to_date`, `timezone`, `late_fixed_1_15_minor` default `20000`,
`late_excess_per_minute_minor` default `2000`, `late_excess_after_minutes` default `15`,
`late_max_threshold_minutes` default `90`, `late_max_minor` default `200000`,
`late_no_notice_minor` default `100000`, `sudden_leave_no_notice_minor` default `50000`,
`sudden_leave_over_limit_minor` default `100000`, `leave_rule_violation_minor` default `200000`,
`monthly_sudden_leave_free_days` default `1`, `monthly_absence_notify_threshold_days` default `5`,
`currency` default `VND`, actor, reason, timestamps.

Constraints:

- Branch override wins over tenant policy.
- Amounts are non-negative integer minor units.
- Policy version is snapshotted into violations/settlements.

### `AttendanceViolation`

Fields: `tenant_id`, `id`, `tenant_membership_id`, `branch_id`, `business_date`, `violation_kind`,
`source_type`, `source_id`, `policy_version_id`, `amount_minor`, `currency`, `details_json`,
`assessed_at`, `idempotency_key`, timestamps.

Constraints:

- Unique `(tenant_id,violation_kind,source_type,source_id,idempotency_key)`.
- Individual violations are immutable; corrections use settlement adjustment/payment transitions.

### `PenaltySettlement`

Fields: `tenant_id`, `id`, `tenant_membership_id`, `branch_id`, `business_date`, `settlement_month`,
`base_amount_minor`, `independent_amount_minor`, `suppressed_amount_minor`, `total_amount_minor`,
`currency`, `status`, `policy_snapshot_json`, `component_snapshot_json`, timestamps.

Constraints:

- Unique `(tenant_id,tenant_membership_id,business_date,settlement_month)`.
- Applies `max(video_penalty, final_late_base_penalty)` plus independent no-notice/leave violations.
- Original amounts immutable; payment status transitions are append-only.

### `PenaltyPaymentTransition`

Fields: `tenant_id`, `id`, `settlement_id`, `from_status`, `to_status`, `amount_minor`, nullable
`media_object_id`, actor, reason, `idempotency_key`, `occurred_at`.

Constraints:

- Valid transitions: `PENDING -> SUBMITTED -> CONFIRMED`; `SUBMITTED -> REJECTED`; privileged
  `PENDING|SUBMITTED|CONFIRMED -> WAIVED`; privileged refund creates `REFUNDED`.
- Unique `(tenant_id,actor_membership_id,idempotency_key)`.

## Requests and approval workflow

### `WorkflowDefinitionVersion`

Fields: `tenant_id`, `id`, `request_type`, `scope_type` (`TENANT|BRANCH`), nullable `branch_id`,
`version_number`, `effective_from_date`, `effective_to_date`, `steps_json`, `parallel_rule_json`,
actor, reason, timestamps.

Constraints:

- Request types limited to `SHIFT_CHANGE`, `LATE_NOTICE`, `LEAVE_SCHEDULE`, `SUDDEN_LEAVE`.
- Step approvers resolve from role/permission/manager relationship within tenant/branch scope.

### `ApprovalRequest`

Fields: `tenant_id`, `id`, `request_type`, `requested_by_membership_id`, `branch_id`, `business_date?`,
`schedule_version_id?`, `workflow_version_id`, `status`, `payload_json`, `submitted_at`, `resolved_at?`,
`reason`, timestamps.

Payload by type:

- `SHIFT_CHANGE`: old/new shift, affected business date.
- `LATE_NOTICE`: shift date, notice channel/message reference, submitted before shift flag.
- `LEAVE_SCHEDULE`/`SUDDEN_LEAVE`: duration kind, start/end date, half-day value, evidence media refs,
  exception type and notification evidence.

Constraints:

- Request branch derives from effective assignment, not client trust.
- Idempotent submission by actor/request type/business key.

### `ApprovalRunStep`

Fields: `tenant_id`, `id`, `approval_request_id`, `step_order`, `mode`, `required_approval_count`,
`status`, `activated_at?`, `completed_at?`, timestamps.

### `ApprovalDecisionRecord`

Fields: `tenant_id`, `id`, `approval_request_id`, `step_id`, `approver_membership_id`, `decision`,
`reason`, `decided_at`, `idempotency_key`, timestamps.

Constraints:

- Unique `(tenant_id,approval_request_id,step_id,approver_membership_id)`.
- Sequential steps activate one at a time; parallel step completes according to the snapshotted rule.
- Final approval applies schedule/OFF/penalty effects once in the same transaction.

## Leave, OFF and monthly absence

### `LeaveConflictSnapshot`

Fields: `tenant_id`, `id`, `approval_request_id`, `branch_id`, `business_date`, `department_id?`,
`position_id?`, `conflicting_request_id?`, `conflicting_membership_id?`, `result`, `checked_at`.

Constraints:

- Conflict check runs at submission and approval using effective assignment versions.
- Conflict between different branches is allowed.

### `MonthlyAbsenceSummary`

Fields: `tenant_id`, `id`, `tenant_membership_id`, `branch_id`, `year_month`, `approved_absence_days_decimal`,
`sudden_leave_days_decimal`, `over_threshold`, `threshold_days` default `5`, `notified_manager_at?`,
`notification_effect_key?`, timestamps.

Constraints:

- Full day counts 1; morning half counts 0.5; date range expands to each applicable business date.
- Company OFF calendar does not count.
- Notification is idempotent per `(tenant_id,tenant_membership_id,year_month,threshold_days)`.

## Action, jobs and outbox

### `AttendanceActionItemSource`

Uses existing Module 2 `ActionItem` projection with source types:

- `ATTENDANCE_MISSING_CHECKIN`
- `ATTENDANCE_VIDEO_REVIEW`
- `APPROVAL_DECISION_REQUIRED`
- `APPROVAL_NEEDS_INFO`
- `PENALTY_PAYMENT_DUE`
- `ABSENCE_OVER_THRESHOLD`
- `ATTENDANCE_CHECKIN_REMINDER`

### `AttendanceJobRun`

Fields: `tenant_id`, `id`, `job_type`, `business_date?`, `year_month?`, `status`, `checkpoint_cursor`,
`lease_owner`, `lease_until`, attempt, safe error metadata, correlation ID, timestamps.

Unique natural keys:

- `(tenant_id,job_type,business_date)` for day close/video missing check-in.
- Pre-shift reminder effect key: `(tenant_id, branch_id, business_date, shift_definition_id, reminder_lead_minutes)`.
- Final reminder effect key: `(tenant_id, branch_id, business_date, shift_definition_id, cutoff_local_time, reminder_lead_minutes)`.
- `(tenant_id,job_type,year_month)` for monthly absence summary.

### `OutboxEvent`

Reuse Module 2 event envelope. Module 3 events use redacted payloads only: IDs, state, business date,
amount summaries, effect keys, mention membership IDs/display names for system reminders and safe reason codes.
No video URL, raw evidence payload, device token or user-authored personal chat message body appears in outbox/logs.

### `CheckInReminderEvent`

Fields in redacted payload: `tenant_id`, `branch_id`, `business_date`, `shift_definition_id`, `shift_code`,
`shift_start_local_time`, `reminder_kind`, `reminder_lead_minutes`, `cutoff_local_time?`,
`mention_membership_ids`, `mention_display_names`,
system-generated `message_body`, `dedupe_key`, timestamps.

Rules:

- Created 15 minutes before each shift start in tenant-local time.
- Created again as a final warning one hour before the missing-check-in cutoff, default 11:00 for the 12:00 cutoff.
- Includes only active scheduled memberships without check-in at reminder time.
- Excludes `OFF`, approved leave and already checked-in memberships.
- Retry-safe; same tenant/branch/date/shift/reminder-kind/cutoff/lead-minute key does not create a second bot reminder.

## Existing relationships

- Module 1: `TenantMembership`, `Branch`, `Department`, `Position`, `Assignment`, RBAC, chat channels,
  media, audit, idempotency, notification endpoints and realtime.
- Module 2: `ActionItem`, KPI policy/report exemption integration and `KpiSourcePort`.

## Retention

- Video check-in binary: 180 days unless tenant policy/legal hold extends.
- Employee evidence/payment proof image: 365 days unless policy/legal hold extends.
- Metadata, schedule, attendance, workflow, penalty and audit: 5 years.
- Retention deletion keeps tombstones with checksum/object identifiers, policy version and deletion actor/job.
