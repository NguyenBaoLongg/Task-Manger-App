-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "ScheduleState" AS ENUM ('SCHEDULED', 'OFF', 'LEAVE_APPROVED', 'ADJUSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScheduleChangeKind" AS ENUM ('SELF_EDIT', 'CHANGE_REQUEST', 'MANAGER_ADJUSTMENT', 'OFF_CALENDAR', 'LEAVE_APPROVAL');

-- CreateEnum
CREATE TYPE "AttendanceState" AS ENUM ('PENDING_VIDEO', 'VIDEO_UPLOADED', 'CONFIRMED', 'MISSING_CHECK_IN', 'NON_WORKED', 'EXEMPT_OFF');

-- CreateEnum
CREATE TYPE "VideoProcessingState" AS ENUM ('REQUESTED', 'UPLOADED', 'VERIFYING', 'CONVERTING', 'READY', 'FAILED_RETRYABLE', 'FAILED_FINAL');

-- CreateEnum
CREATE TYPE "VideoReviewStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'WAIVED');

-- CreateEnum
CREATE TYPE "DayWorkClassification" AS ENUM ('WORKED_ON_TIME', 'WORKED_LATE', 'NON_WORKED_NO_CHECKIN', 'OFF_OR_APPROVED_LEAVE');

-- CreateEnum
CREATE TYPE "ViolationKind" AS ENUM ('MISSING_CHECK_IN', 'VIDEO_STANDARD_FAILED', 'LATE_BASE', 'LATE_NO_NOTICE', 'SUDDEN_LEAVE_NO_NOTICE', 'SUDDEN_LEAVE_OVER_LIMIT', 'LEAVE_RULE_VIOLATION');

-- CreateEnum
CREATE TYPE "PenaltySettlementStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMED', 'REJECTED', 'WAIVED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('SHIFT_CHANGE', 'LATE_NOTICE', 'LEAVE_SCHEDULE', 'SUDDEN_LEAVE');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ApprovalStepMode" AS ENUM ('SEQUENTIAL', 'PARALLEL');

-- CreateEnum
CREATE TYPE "ApprovalStepStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVE', 'REJECT', 'REQUEST_CHANGES', 'CANCEL');

-- CreateEnum
CREATE TYPE "LeaveDurationKind" AS ENUM ('FULL_DAY', 'MORNING_HALF', 'DATE_RANGE');

-- CreateEnum
CREATE TYPE "OffCalendarScope" AS ENUM ('TENANT', 'BRANCH');

-- CreateEnum
CREATE TYPE "LeaveConflictResult" AS ENUM ('CLEAR', 'CONFLICT', 'WARNING');

-- CreateEnum
CREATE TYPE "AttendanceJobRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "shift_definitions" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "start_local_time" VARCHAR(5) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "status" "ShiftStatus" NOT NULL DEFAULT 'ACTIVE',
    "effective_from_date" DATE NOT NULL,
    "effective_to_date" DATE,
    "version_number" INTEGER NOT NULL,
    "created_by_membership_id" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shift_definitions_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "work_schedule_versions" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "shift_definition_id" UUID,
    "state" "ScheduleState" NOT NULL,
    "change_kind" "ScheduleChangeKind" NOT NULL,
    "source_request_id" UUID,
    "source_off_calendar_id" UUID,
    "version_number" INTEGER NOT NULL,
    "effective_at" TIMESTAMPTZ(3) NOT NULL,
    "superseded_at" TIMESTAMPTZ(3),
    "created_by_membership_id" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "work_schedule_versions_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "company_off_calendar_versions" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "scope_type" "OffCalendarScope" NOT NULL,
    "branch_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "ResourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_membership_id" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "company_off_calendar_versions_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "video_policy_versions" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "scope_type" "ScopeType" NOT NULL,
    "branch_id" UUID,
    "version_number" INTEGER NOT NULL,
    "effective_from_date" DATE NOT NULL,
    "effective_to_date" DATE,
    "requires_acknowledgement" BOOLEAN NOT NULL DEFAULT true,
    "requires_full_body" BOOLEAN NOT NULL DEFAULT true,
    "requires_work_area" BOOLEAN NOT NULL DEFAULT true,
    "manual_review_required" BOOLEAN NOT NULL DEFAULT true,
    "acknowledgement_text" TEXT,
    "missing_checkin_penalty_minor" BIGINT NOT NULL DEFAULT 50000,
    "video_failed_penalty_minor" BIGINT NOT NULL DEFAULT 50000,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'VND',
    "created_by_membership_id" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_policy_versions_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "video_policy_acknowledgements" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "policy_version_id" UUID NOT NULL,
    "acknowledged_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "session_id" UUID,
    "device_id" VARCHAR(200),
    "action" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_policy_acknowledgements_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "attendance_events" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "schedule_version_id" UUID NOT NULL,
    "video_policy_version_id" UUID NOT NULL,
    "server_recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "check_in_at" TIMESTAMPTZ(3),
    "state" "AttendanceState" NOT NULL,
    "day_classification" "DayWorkClassification" NOT NULL,
    "classification_reason" VARCHAR(160) NOT NULL,
    "source_request_id" UUID,
    "correlation_id" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attendance_events_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "checkin_video_assets" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "attendance_event_id" UUID NOT NULL,
    "media_object_id" UUID NOT NULL,
    "original_content_type" VARCHAR(160) NOT NULL,
    "original_checksum" VARCHAR(64) NOT NULL,
    "converted_media_object_id" UUID,
    "processing_state" "VideoProcessingState" NOT NULL DEFAULT 'REQUESTED',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_safe_error_code" VARCHAR(100),
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_at" TIMESTAMPTZ(3),
    "ready_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "checkin_video_assets_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "video_review_results" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "attendance_event_id" UUID NOT NULL,
    "review_status" "VideoReviewStatus" NOT NULL,
    "reviewed_by_membership_id" UUID NOT NULL,
    "reviewed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" VARCHAR(500) NOT NULL,
    "failed_criteria_json" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_review_results_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "late_occurrences" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "attendance_event_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "shift_start_at" TIMESTAMPTZ(3) NOT NULL,
    "check_in_at" TIMESTAMPTZ(3) NOT NULL,
    "late_seconds" INTEGER NOT NULL,
    "late_minutes" INTEGER NOT NULL,
    "monthly_late_sequence" INTEGER NOT NULL,
    "first_late_exempt" BOOLEAN NOT NULL DEFAULT false,
    "after_15_local" BOOLEAN NOT NULL DEFAULT false,
    "after_18_local" BOOLEAN NOT NULL DEFAULT false,
    "late_notice_request_id" UUID,
    "queue_impact_flag" BOOLEAN NOT NULL DEFAULT false,
    "policy_version_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "late_occurrences_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "attendance_penalty_policy_versions" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "scope_type" "ScopeType" NOT NULL,
    "branch_id" UUID,
    "version_number" INTEGER NOT NULL,
    "effective_from_date" DATE NOT NULL,
    "effective_to_date" DATE,
    "timezone" VARCHAR(64) NOT NULL,
    "late_fixed_1_15_minor" BIGINT NOT NULL DEFAULT 20000,
    "late_excess_per_minute_minor" BIGINT NOT NULL DEFAULT 2000,
    "late_excess_after_minutes" INTEGER NOT NULL DEFAULT 15,
    "late_max_threshold_minutes" INTEGER NOT NULL DEFAULT 90,
    "late_max_minor" BIGINT NOT NULL DEFAULT 200000,
    "late_no_notice_minor" BIGINT NOT NULL DEFAULT 100000,
    "sudden_leave_no_notice_minor" BIGINT NOT NULL DEFAULT 50000,
    "sudden_leave_over_limit_minor" BIGINT NOT NULL DEFAULT 100000,
    "leave_rule_violation_minor" BIGINT NOT NULL DEFAULT 200000,
    "monthly_sudden_leave_free_days" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "monthly_absence_notify_threshold_days" DECIMAL(6,2) NOT NULL DEFAULT 5,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'VND',
    "created_by_membership_id" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_penalty_policy_versions_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "attendance_violations" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "violation_kind" "ViolationKind" NOT NULL,
    "source_type" VARCHAR(80) NOT NULL,
    "source_id" UUID NOT NULL,
    "policy_version_id" UUID NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'VND',
    "details_json" JSONB NOT NULL DEFAULT '{}',
    "assessed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotency_key" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_violations_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "penalty_settlements" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "settlement_month" VARCHAR(7) NOT NULL,
    "base_amount_minor" BIGINT NOT NULL,
    "independent_amount_minor" BIGINT NOT NULL,
    "suppressed_amount_minor" BIGINT NOT NULL,
    "total_amount_minor" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'VND',
    "status" "PenaltySettlementStatus" NOT NULL DEFAULT 'PENDING',
    "policy_snapshot_json" JSONB NOT NULL DEFAULT '{}',
    "component_snapshot_json" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "penalty_settlements_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "penalty_payment_transitions" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "settlement_id" UUID NOT NULL,
    "from_status" "PenaltySettlementStatus",
    "to_status" "PenaltySettlementStatus" NOT NULL,
    "amount_minor" BIGINT,
    "media_object_id" UUID,
    "actor_membership_id" UUID NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "idempotency_key" VARCHAR(160) NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "penalty_payment_transitions_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "workflow_definition_versions" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "request_type" "RequestType" NOT NULL,
    "scope_type" "ScopeType" NOT NULL,
    "branch_id" UUID,
    "version_number" INTEGER NOT NULL,
    "effective_from_date" DATE NOT NULL,
    "effective_to_date" DATE,
    "steps_json" JSONB NOT NULL,
    "parallel_rule_json" JSONB NOT NULL DEFAULT '{}',
    "created_by_membership_id" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_definition_versions_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "request_type" "RequestType" NOT NULL,
    "requested_by_membership_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "business_date" DATE,
    "schedule_version_id" UUID,
    "workflow_version_id" UUID NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "payload_json" JSONB NOT NULL,
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(3),
    "reason" VARCHAR(1000) NOT NULL,
    "idempotency_key" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "approval_run_steps" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "approval_request_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL,
    "mode" "ApprovalStepMode" NOT NULL,
    "required_approval_count" INTEGER NOT NULL,
    "status" "ApprovalStepStatus" NOT NULL DEFAULT 'PENDING',
    "activated_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "approval_run_steps_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "approval_decision_records" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "approval_request_id" UUID NOT NULL,
    "step_id" UUID NOT NULL,
    "approver_membership_id" UUID NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "decided_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotency_key" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_decision_records_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "leave_conflict_snapshots" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "approval_request_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "department_id" UUID,
    "position_id" UUID,
    "conflicting_request_id" UUID,
    "conflicting_membership_id" UUID,
    "result" "LeaveConflictResult" NOT NULL,
    "checked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_conflict_snapshots_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "monthly_absence_summaries" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "year_month" VARCHAR(7) NOT NULL,
    "approved_absence_days_decimal" DECIMAL(6,2) NOT NULL,
    "sudden_leave_days_decimal" DECIMAL(6,2) NOT NULL,
    "over_threshold" BOOLEAN NOT NULL DEFAULT false,
    "threshold_days" DECIMAL(6,2) NOT NULL DEFAULT 5,
    "notified_manager_at" TIMESTAMPTZ(3),
    "notification_effect_key" VARCHAR(200),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "monthly_absence_summaries_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "attendance_job_runs" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "job_type" VARCHAR(80) NOT NULL,
    "business_date" DATE,
    "year_month" VARCHAR(7),
    "status" "AttendanceJobRunStatus" NOT NULL DEFAULT 'PENDING',
    "checkpoint_cursor" VARCHAR(500),
    "lease_owner" VARCHAR(160),
    "lease_until" TIMESTAMPTZ(3),
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "safe_error_code" VARCHAR(100),
    "safe_error_message" VARCHAR(500),
    "correlation_id" VARCHAR(100) NOT NULL,
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attendance_job_runs_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "media_retention_tombstones" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "media_object_id" UUID,
    "source_type" VARCHAR(80) NOT NULL,
    "source_id" UUID,
    "purpose" VARCHAR(50) NOT NULL,
    "storage_provider" VARCHAR(32) NOT NULL,
    "bucket" VARCHAR(255) NOT NULL,
    "object_key" VARCHAR(1024) NOT NULL,
    "checksum_sha256" VARCHAR(64) NOT NULL,
    "byte_size" BIGINT NOT NULL,
    "content_type" VARCHAR(160) NOT NULL,
    "policy_version_id" UUID,
    "legal_hold_released" BOOLEAN NOT NULL DEFAULT false,
    "deleted_by_job_run_id" UUID,
    "deleted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" VARCHAR(500) NOT NULL,

    CONSTRAINT "media_retention_tombstones_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shift_definition_code_version_uniq" ON "shift_definitions"("tenant_id", "code", "version_number");
CREATE INDEX "shift_definition_effective_idx" ON "shift_definitions"("tenant_id", "status", "effective_from_date", "effective_to_date");
CREATE UNIQUE INDEX "work_schedule_active_unique_idx" ON "work_schedule_versions"("tenant_id", "membership_id", "business_date") WHERE "superseded_at" IS NULL;
CREATE INDEX "work_schedule_branch_date_idx" ON "work_schedule_versions"("tenant_id", "branch_id", "business_date", "state");
CREATE UNIQUE INDEX "off_calendar_scope_version_uniq" ON "company_off_calendar_versions"("tenant_id", "scope_type", "branch_id", "name", "version_number");
CREATE INDEX "off_calendar_effective_idx" ON "company_off_calendar_versions"("tenant_id", "scope_type", "branch_id", "start_date", "end_date", "status");
CREATE UNIQUE INDEX "video_policy_scope_version_uniq" ON "video_policy_versions"("tenant_id", "scope_type", "branch_id", "version_number");
CREATE INDEX "video_policy_effective_idx" ON "video_policy_versions"("tenant_id", "scope_type", "branch_id", "effective_from_date", "effective_to_date");
CREATE UNIQUE INDEX "video_policy_ack_member_policy_uniq" ON "video_policy_acknowledgements"("tenant_id", "membership_id", "policy_version_id");
CREATE UNIQUE INDEX "attendance_event_member_date_uniq" ON "attendance_events"("tenant_id", "membership_id", "business_date");
CREATE INDEX "attendance_event_branch_state_idx" ON "attendance_events"("tenant_id", "branch_id", "business_date", "state");
CREATE UNIQUE INDEX "checkin_video_attendance_event_uniq" ON "checkin_video_assets"("tenant_id", "attendance_event_id");
CREATE INDEX "checkin_video_processing_idx" ON "checkin_video_assets"("tenant_id", "processing_state", "requested_at", "id");
CREATE INDEX "video_review_attendance_idx" ON "video_review_results"("tenant_id", "attendance_event_id", "reviewed_at", "id");
CREATE UNIQUE INDEX "late_occurrence_event_uniq" ON "late_occurrences"("tenant_id", "attendance_event_id");
CREATE INDEX "late_occurrence_queue_idx" ON "late_occurrences"("tenant_id", "branch_id", "business_date", "queue_impact_flag");
CREATE UNIQUE INDEX "attendance_penalty_policy_scope_version_uniq" ON "attendance_penalty_policy_versions"("tenant_id", "scope_type", "branch_id", "version_number");
CREATE INDEX "attendance_penalty_policy_effective_idx" ON "attendance_penalty_policy_versions"("tenant_id", "scope_type", "branch_id", "effective_from_date", "effective_to_date");
CREATE UNIQUE INDEX "attendance_violation_idempotency_uniq" ON "attendance_violations"("tenant_id", "violation_kind", "source_type", "source_id", "idempotency_key");
CREATE INDEX "attendance_violation_member_idx" ON "attendance_violations"("tenant_id", "membership_id", "business_date", "violation_kind");
CREATE UNIQUE INDEX "penalty_settlement_member_day_month_uniq" ON "penalty_settlements"("tenant_id", "membership_id", "business_date", "settlement_month");
CREATE INDEX "penalty_settlement_branch_month_idx" ON "penalty_settlements"("tenant_id", "branch_id", "settlement_month", "status", "id");
CREATE UNIQUE INDEX "penalty_payment_actor_idempotency_uniq" ON "penalty_payment_transitions"("tenant_id", "actor_membership_id", "idempotency_key");
CREATE UNIQUE INDEX "workflow_definition_scope_version_uniq" ON "workflow_definition_versions"("tenant_id", "request_type", "scope_type", "branch_id", "version_number");
CREATE UNIQUE INDEX "approval_request_actor_idempotency_uniq" ON "approval_requests"("tenant_id", "requested_by_membership_id", "request_type", "idempotency_key");
CREATE UNIQUE INDEX "approval_step_order_uniq" ON "approval_run_steps"("tenant_id", "approval_request_id", "step_order");
CREATE UNIQUE INDEX "approval_decision_actor_step_uniq" ON "approval_decision_records"("tenant_id", "approval_request_id", "step_id", "approver_membership_id");
CREATE UNIQUE INDEX "approval_decision_idempotency_uniq" ON "approval_decision_records"("tenant_id", "approver_membership_id", "idempotency_key");
CREATE INDEX "leave_conflict_branch_date_idx" ON "leave_conflict_snapshots"("tenant_id", "branch_id", "business_date", "result");
CREATE UNIQUE INDEX "monthly_absence_threshold_uniq" ON "monthly_absence_summaries"("tenant_id", "membership_id", "year_month", "threshold_days");
CREATE INDEX "monthly_absence_branch_idx" ON "monthly_absence_summaries"("tenant_id", "branch_id", "year_month", "over_threshold", "id");
CREATE UNIQUE INDEX "attendance_job_run_day_uniq" ON "attendance_job_runs"("tenant_id", "job_type", "business_date") WHERE "business_date" IS NOT NULL;
CREATE UNIQUE INDEX "attendance_job_run_month_uniq" ON "attendance_job_runs"("tenant_id", "job_type", "year_month") WHERE "year_month" IS NOT NULL;
CREATE INDEX "attendance_job_run_lease_idx" ON "attendance_job_runs"("tenant_id", "status", "lease_until", "id");
CREATE UNIQUE INDEX "media_retention_tombstone_object_uniq" ON "media_retention_tombstones"("tenant_id", "storage_provider", "bucket", "object_key");

-- Domain checks omitted by Prisma's generated DDL.
ALTER TABLE "shift_definitions" ADD CONSTRAINT "shift_definition_time_ck"
  CHECK ("start_local_time" ~ '^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$' AND "version_number" > 0);
ALTER TABLE "work_schedule_versions" ADD CONSTRAINT "work_schedule_state_shift_ck"
  CHECK (("state" IN ('SCHEDULED','ADJUSTED') AND "shift_definition_id" IS NOT NULL)
    OR ("state" IN ('OFF','LEAVE_APPROVED','CANCELLED')));
ALTER TABLE "work_schedule_versions" ADD CONSTRAINT "work_schedule_version_ck"
  CHECK ("version_number" > 0 AND ("superseded_at" IS NULL OR "superseded_at" > "effective_at"));
ALTER TABLE "company_off_calendar_versions" ADD CONSTRAINT "off_calendar_scope_ck"
  CHECK (("scope_type" = 'TENANT' AND "branch_id" IS NULL) OR ("scope_type" = 'BRANCH' AND "branch_id" IS NOT NULL));
ALTER TABLE "company_off_calendar_versions" ADD CONSTRAINT "off_calendar_range_ck"
  CHECK ("end_date" >= "start_date" AND "version_number" > 0);
ALTER TABLE "video_policy_versions" ADD CONSTRAINT "video_policy_scope_ck"
  CHECK (("scope_type" = 'TENANT' AND "branch_id" IS NULL) OR ("scope_type" = 'BRANCH' AND "branch_id" IS NOT NULL));
ALTER TABLE "video_policy_versions" ADD CONSTRAINT "video_policy_money_ck"
  CHECK ("missing_checkin_penalty_minor" >= 0 AND "video_failed_penalty_minor" >= 0 AND "currency" = 'VND');
ALTER TABLE "video_policy_versions" ADD CONSTRAINT "video_policy_range_ck"
  CHECK ("effective_to_date" IS NULL OR "effective_to_date" >= "effective_from_date");
ALTER TABLE "video_policy_acknowledgements" ADD CONSTRAINT "video_policy_ack_action_ck" CHECK ("action" = 'ACKNOWLEDGED');
ALTER TABLE "checkin_video_assets" ADD CONSTRAINT "checkin_video_attempt_ck" CHECK ("attempt_count" >= 0);
ALTER TABLE "late_occurrences" ADD CONSTRAINT "late_occurrence_minutes_ck"
  CHECK ("late_seconds" >= 0 AND "late_minutes" >= 0 AND "monthly_late_sequence" > 0);
ALTER TABLE "attendance_penalty_policy_versions" ADD CONSTRAINT "penalty_policy_scope_ck"
  CHECK (("scope_type" = 'TENANT' AND "branch_id" IS NULL) OR ("scope_type" = 'BRANCH' AND "branch_id" IS NOT NULL));
ALTER TABLE "attendance_penalty_policy_versions" ADD CONSTRAINT "penalty_policy_amount_ck"
  CHECK ("late_fixed_1_15_minor" >= 0
    AND "late_excess_per_minute_minor" >= 0
    AND "late_excess_after_minutes" >= 0
    AND "late_max_threshold_minutes" > 0
    AND "late_max_minor" >= 0
    AND "late_no_notice_minor" >= 0
    AND "sudden_leave_no_notice_minor" >= 0
    AND "sudden_leave_over_limit_minor" >= 0
    AND "leave_rule_violation_minor" >= 0
    AND "monthly_sudden_leave_free_days" >= 0
    AND "monthly_absence_notify_threshold_days" >= 0
    AND "currency" = 'VND');
ALTER TABLE "attendance_violations" ADD CONSTRAINT "attendance_violation_money_ck" CHECK ("amount_minor" >= 0 AND "currency" = 'VND');
ALTER TABLE "penalty_settlements" ADD CONSTRAINT "penalty_settlement_money_ck"
  CHECK ("base_amount_minor" >= 0 AND "independent_amount_minor" >= 0 AND "suppressed_amount_minor" >= 0 AND "total_amount_minor" >= 0 AND "currency" = 'VND');
ALTER TABLE "penalty_payment_transitions" ADD CONSTRAINT "payment_transition_status_ck"
  CHECK (
    ("from_status" = 'PENDING' AND "to_status" = 'SUBMITTED')
    OR ("from_status" = 'SUBMITTED' AND "to_status" IN ('CONFIRMED','REJECTED','WAIVED'))
    OR ("from_status" = 'CONFIRMED' AND "to_status" IN ('WAIVED','REFUNDED'))
    OR ("from_status" IS NULL AND "to_status" IN ('SUBMITTED','WAIVED'))
  );
ALTER TABLE "workflow_definition_versions" ADD CONSTRAINT "workflow_definition_scope_ck"
  CHECK (("scope_type" = 'TENANT' AND "branch_id" IS NULL) OR ("scope_type" = 'BRANCH' AND "branch_id" IS NOT NULL));
ALTER TABLE "approval_run_steps" ADD CONSTRAINT "approval_step_count_ck"
  CHECK ("step_order" > 0 AND "required_approval_count" > 0);
ALTER TABLE "monthly_absence_summaries" ADD CONSTRAINT "monthly_absence_amount_ck"
  CHECK ("approved_absence_days_decimal" >= 0 AND "sudden_leave_days_decimal" >= 0 AND "threshold_days" >= 0);
ALTER TABLE "attendance_job_runs" ADD CONSTRAINT "attendance_job_run_key_ck"
  CHECK (num_nonnulls("business_date", "year_month") = 1 AND "attempt" >= 0);

-- Composite tenant foreign keys prevent cross-tenant graph edges.
ALTER TABLE "shift_definitions" ADD CONSTRAINT "shift_definition_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "shift_definitions" ADD CONSTRAINT "shift_definition_actor_fk" FOREIGN KEY ("tenant_id", "created_by_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "work_schedule_versions" ADD CONSTRAINT "work_schedule_membership_fk" FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "work_schedule_versions" ADD CONSTRAINT "work_schedule_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "work_schedule_versions" ADD CONSTRAINT "work_schedule_shift_fk" FOREIGN KEY ("tenant_id", "shift_definition_id") REFERENCES "shift_definitions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "work_schedule_versions" ADD CONSTRAINT "work_schedule_actor_fk" FOREIGN KEY ("tenant_id", "created_by_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "company_off_calendar_versions" ADD CONSTRAINT "off_calendar_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "company_off_calendar_versions" ADD CONSTRAINT "off_calendar_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "company_off_calendar_versions" ADD CONSTRAINT "off_calendar_actor_fk" FOREIGN KEY ("tenant_id", "created_by_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "video_policy_versions" ADD CONSTRAINT "video_policy_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "video_policy_versions" ADD CONSTRAINT "video_policy_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "video_policy_versions" ADD CONSTRAINT "video_policy_actor_fk" FOREIGN KEY ("tenant_id", "created_by_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "video_policy_acknowledgements" ADD CONSTRAINT "video_policy_ack_member_fk" FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "video_policy_acknowledgements" ADD CONSTRAINT "video_policy_ack_policy_fk" FOREIGN KEY ("tenant_id", "policy_version_id") REFERENCES "video_policy_versions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_event_member_fk" FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_event_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_event_schedule_fk" FOREIGN KEY ("tenant_id", "schedule_version_id") REFERENCES "work_schedule_versions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_event_video_policy_fk" FOREIGN KEY ("tenant_id", "video_policy_version_id") REFERENCES "video_policy_versions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "checkin_video_assets" ADD CONSTRAINT "checkin_video_attendance_fk" FOREIGN KEY ("tenant_id", "attendance_event_id") REFERENCES "attendance_events"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "checkin_video_assets" ADD CONSTRAINT "checkin_video_media_fk" FOREIGN KEY ("tenant_id", "media_object_id") REFERENCES "media_objects"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "checkin_video_assets" ADD CONSTRAINT "checkin_video_converted_media_fk" FOREIGN KEY ("tenant_id", "converted_media_object_id") REFERENCES "media_objects"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "video_review_results" ADD CONSTRAINT "video_review_attendance_fk" FOREIGN KEY ("tenant_id", "attendance_event_id") REFERENCES "attendance_events"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "video_review_results" ADD CONSTRAINT "video_review_reviewer_fk" FOREIGN KEY ("tenant_id", "reviewed_by_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "late_occurrences" ADD CONSTRAINT "late_occurrence_attendance_fk" FOREIGN KEY ("tenant_id", "attendance_event_id") REFERENCES "attendance_events"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "late_occurrences" ADD CONSTRAINT "late_occurrence_member_fk" FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "late_occurrences" ADD CONSTRAINT "late_occurrence_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "attendance_penalty_policy_versions" ADD CONSTRAINT "attendance_penalty_policy_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "attendance_penalty_policy_versions" ADD CONSTRAINT "attendance_penalty_policy_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "attendance_penalty_policy_versions" ADD CONSTRAINT "attendance_penalty_policy_actor_fk" FOREIGN KEY ("tenant_id", "created_by_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "attendance_violations" ADD CONSTRAINT "attendance_violation_member_fk" FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "attendance_violations" ADD CONSTRAINT "attendance_violation_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "attendance_violations" ADD CONSTRAINT "attendance_violation_policy_fk" FOREIGN KEY ("tenant_id", "policy_version_id") REFERENCES "attendance_penalty_policy_versions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "penalty_settlements" ADD CONSTRAINT "penalty_settlement_member_fk" FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "penalty_settlements" ADD CONSTRAINT "penalty_settlement_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "penalty_payment_transitions" ADD CONSTRAINT "penalty_payment_settlement_fk" FOREIGN KEY ("tenant_id", "settlement_id") REFERENCES "penalty_settlements"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "penalty_payment_transitions" ADD CONSTRAINT "penalty_payment_actor_fk" FOREIGN KEY ("tenant_id", "actor_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "penalty_payment_transitions" ADD CONSTRAINT "penalty_payment_media_fk" FOREIGN KEY ("tenant_id", "media_object_id") REFERENCES "media_objects"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "workflow_definition_versions" ADD CONSTRAINT "workflow_definition_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "workflow_definition_versions" ADD CONSTRAINT "workflow_definition_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "workflow_definition_versions" ADD CONSTRAINT "workflow_definition_actor_fk" FOREIGN KEY ("tenant_id", "created_by_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_request_requester_fk" FOREIGN KEY ("tenant_id", "requested_by_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_request_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_request_schedule_fk" FOREIGN KEY ("tenant_id", "schedule_version_id") REFERENCES "work_schedule_versions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "approval_requests" ADD CONSTRAINT "workflow_request_definition_fk" FOREIGN KEY ("tenant_id", "workflow_version_id") REFERENCES "workflow_definition_versions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "work_schedule_versions" ADD CONSTRAINT "work_schedule_source_request_fk" FOREIGN KEY ("tenant_id", "source_request_id") REFERENCES "approval_requests"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "work_schedule_versions" ADD CONSTRAINT "work_schedule_source_off_calendar_fk" FOREIGN KEY ("tenant_id", "source_off_calendar_id") REFERENCES "company_off_calendar_versions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_event_source_request_fk" FOREIGN KEY ("tenant_id", "source_request_id") REFERENCES "approval_requests"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "late_occurrences" ADD CONSTRAINT "late_occurrence_late_notice_fk" FOREIGN KEY ("tenant_id", "late_notice_request_id") REFERENCES "approval_requests"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "approval_run_steps" ADD CONSTRAINT "approval_step_request_fk" FOREIGN KEY ("tenant_id", "approval_request_id") REFERENCES "approval_requests"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "approval_decision_records" ADD CONSTRAINT "approval_decision_request_fk" FOREIGN KEY ("tenant_id", "approval_request_id") REFERENCES "approval_requests"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "approval_decision_records" ADD CONSTRAINT "approval_decision_step_fk" FOREIGN KEY ("tenant_id", "step_id") REFERENCES "approval_run_steps"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "approval_decision_records" ADD CONSTRAINT "approval_decision_approver_fk" FOREIGN KEY ("tenant_id", "approver_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "leave_conflict_snapshots" ADD CONSTRAINT "leave_conflict_request_fk" FOREIGN KEY ("tenant_id", "approval_request_id") REFERENCES "approval_requests"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "leave_conflict_snapshots" ADD CONSTRAINT "leave_conflict_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "leave_conflict_snapshots" ADD CONSTRAINT "leave_conflict_department_fk" FOREIGN KEY ("tenant_id", "department_id") REFERENCES "departments"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "leave_conflict_snapshots" ADD CONSTRAINT "leave_conflict_position_fk" FOREIGN KEY ("tenant_id", "position_id") REFERENCES "positions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "leave_conflict_snapshots" ADD CONSTRAINT "leave_conflict_other_request_fk" FOREIGN KEY ("tenant_id", "conflicting_request_id") REFERENCES "approval_requests"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "leave_conflict_snapshots" ADD CONSTRAINT "leave_conflict_other_member_fk" FOREIGN KEY ("tenant_id", "conflicting_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "monthly_absence_summaries" ADD CONSTRAINT "monthly_absence_member_fk" FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "monthly_absence_summaries" ADD CONSTRAINT "monthly_absence_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "attendance_job_runs" ADD CONSTRAINT "attendance_job_run_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "media_retention_tombstones" ADD CONSTRAINT "media_retention_tombstone_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "media_retention_tombstones" ADD CONSTRAINT "media_retention_tombstone_media_fk" FOREIGN KEY ("tenant_id", "media_object_id") REFERENCES "media_objects"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "media_retention_tombstones" ADD CONSTRAINT "media_retention_tombstone_job_fk" FOREIGN KEY ("tenant_id", "deleted_by_job_run_id") REFERENCES "attendance_job_runs"("tenant_id", "id") ON DELETE RESTRICT;
