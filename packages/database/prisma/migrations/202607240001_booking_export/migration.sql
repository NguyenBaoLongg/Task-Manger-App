CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TYPE "ActionItemType" ADD VALUE IF NOT EXISTS 'BOOKING_MISSING_STATUS';
ALTER TYPE "ActionItemType" ADD VALUE IF NOT EXISTS 'BOOKING_MISSING_CUSTOMER_PHOTO';
ALTER TYPE "ActionItemType" ADD VALUE IF NOT EXISTS 'TOUR_INCOMPLETE';

CREATE TYPE "BookingType" AS ENUM ('SCHEDULED', 'WALK_IN');
CREATE TYPE "BookingStatus" AS ENUM ('SCHEDULED', 'ARRIVED', 'NO_SHOW', 'CANCELLED', 'RESCHEDULED');
CREATE TYPE "BookingConfigStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "CustomerPhotoDebtState" AS ENUM ('OPEN', 'RESOLVED', 'WAIVED');
CREATE TYPE "CustomerPhotoConsentMethod" AS ENUM ('VERBAL', 'WRITTEN', 'OTHER');
CREATE TYPE "BookingReportType" AS ENUM ('TOMORROW_SCHEDULE', 'TODAY_OUTCOME');
CREATE TYPE "BookingJobState" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'RETRYABLE', 'FAILED');
CREATE TYPE "ExportFormat" AS ENUM ('XLSX');
CREATE TYPE "ExportState" AS ENUM ('PENDING', 'RUNNING', 'READY', 'RETRYABLE', 'FAILED', 'EXPIRED');

CREATE TABLE "customers" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "display_name" VARCHAR(160) NOT NULL,
  "phone_normalized" VARCHAR(30),
  "email_normalized" VARCHAR(254),
  "note" VARCHAR(1000),
  "created_by_membership_id" UUID NOT NULL,
  "state_version" INTEGER NOT NULL DEFAULT 1,
  "archived_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "customers_pkey" PRIMARY KEY ("tenant_id", "id")
);

CREATE TABLE "customer_branch_access" (
  "tenant_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "granted_by_membership_id" UUID NOT NULL,
  "granted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMPTZ(3),
  CONSTRAINT "customer_branch_access_pkey" PRIMARY KEY ("tenant_id", "customer_id", "branch_id")
);

CREATE TABLE "service_offerings" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "created_by_membership_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_offerings_pkey" PRIMARY KEY ("tenant_id", "id")
);

CREATE TABLE "service_offering_versions" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "service_offering_id" UUID NOT NULL,
  "version_number" INTEGER NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "description" VARCHAR(1000),
  "status" "BookingConfigStatus" NOT NULL DEFAULT 'ACTIVE',
  "effective_from" TIMESTAMPTZ(3) NOT NULL,
  "effective_to" TIMESTAMPTZ(3),
  "created_by_membership_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_offering_versions_pkey" PRIMARY KEY ("tenant_id", "id")
);

CREATE TABLE "service_branch_availability" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "service_offering_id" UUID NOT NULL,
  "service_offering_version_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "status" "BookingConfigStatus" NOT NULL DEFAULT 'ACTIVE',
  "effective_from" TIMESTAMPTZ(3) NOT NULL,
  "effective_to" TIMESTAMPTZ(3),
  CONSTRAINT "service_branch_availability_pkey" PRIMARY KEY ("tenant_id", "id")
);

CREATE TABLE "bookings" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "service_offering_id" UUID NOT NULL,
  "service_offering_version_id" UUID NOT NULL,
  "service_code_snapshot" VARCHAR(50) NOT NULL,
  "service_name_snapshot" VARCHAR(160) NOT NULL,
  "assigned_membership_id" UUID NOT NULL,
  "form_submission_id" UUID,
  "form_version_id" UUID,
  "booking_type" "BookingType" NOT NULL,
  "scheduled_start_at" TIMESTAMPTZ(3) NOT NULL,
  "business_date" DATE NOT NULL,
  "timezone_snapshot" VARCHAR(80) NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'SCHEDULED',
  "state_version" INTEGER NOT NULL DEFAULT 1,
  "rescheduled_from_id" UUID,
  "rescheduled_to_id" UUID,
  "created_by_membership_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "bookings_pkey" PRIMARY KEY ("tenant_id", "id")
);

CREATE TABLE "booking_status_transitions" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "from_status" "BookingStatus",
  "to_status" "BookingStatus" NOT NULL,
  "reason_version_id" UUID,
  "reason_code_snapshot" VARCHAR(50),
  "reason_label_snapshot" VARCHAR(160),
  "actor_membership_id" UUID NOT NULL,
  "evidence_media_id" UUID,
  "source_event_id" UUID NOT NULL,
  "correlation_id" VARCHAR(100) NOT NULL,
  "metadata_redacted" JSONB NOT NULL DEFAULT '{}',
  "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_status_transitions_pkey" PRIMARY KEY ("tenant_id", "id")
);

CREATE TABLE "booking_cancellation_reasons" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "created_by_membership_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_cancellation_reasons_pkey" PRIMARY KEY ("tenant_id", "id")
);

CREATE TABLE "booking_cancellation_reason_versions" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "reason_id" UUID NOT NULL,
  "version_number" INTEGER NOT NULL,
  "label" VARCHAR(160) NOT NULL,
  "applies_to_cancellation" BOOLEAN NOT NULL DEFAULT true,
  "applies_to_reschedule" BOOLEAN NOT NULL DEFAULT false,
  "status" "BookingConfigStatus" NOT NULL DEFAULT 'ACTIVE',
  "effective_from" TIMESTAMPTZ(3) NOT NULL,
  "effective_to" TIMESTAMPTZ(3),
  "created_by_membership_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_cancellation_reason_versions_pkey" PRIMARY KEY ("tenant_id", "id")
);

CREATE TABLE "customer_photo_consent_policy_versions" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "version_number" INTEGER NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "policy_text" TEXT NOT NULL,
  "allowed_methods" JSONB NOT NULL,
  "status" "BookingConfigStatus" NOT NULL DEFAULT 'ACTIVE',
  "effective_from" TIMESTAMPTZ(3) NOT NULL,
  "effective_to" TIMESTAMPTZ(3),
  "created_by_membership_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_photo_consent_policy_versions_pkey" PRIMARY KEY ("tenant_id", "id")
);

CREATE TABLE "customer_photo_consents" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "actor_membership_id" UUID NOT NULL,
  "method" "CustomerPhotoConsentMethod" NOT NULL,
  "policy_version_id" UUID NOT NULL,
  "correlation_id" VARCHAR(100) NOT NULL,
  "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_photo_consents_pkey" PRIMARY KEY ("tenant_id", "id")
);

CREATE TABLE "customer_photo_debts" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "owner_membership_id" UUID NOT NULL,
  "state" "CustomerPhotoDebtState" NOT NULL DEFAULT 'OPEN',
  "state_version" INTEGER NOT NULL DEFAULT 1,
  "action_item_id" UUID,
  "resolved_media_id" UUID,
  "source_event_id" UUID NOT NULL,
  "opened_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMPTZ(3),
  "resolution_reason" VARCHAR(500),
  CONSTRAINT "customer_photo_debts_pkey" PRIMARY KEY ("tenant_id", "id")
);

CREATE TABLE "tour_completions" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "performed_by_membership_id" UUID NOT NULL,
  "service_offering_id" UUID NOT NULL,
  "customer_photo_media_id" UUID NOT NULL,
  "form_submission_id" UUID,
  "business_date" DATE NOT NULL,
  "completed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source_event_id" UUID NOT NULL,
  "supersedes_completion_id" UUID,
  "superseded_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tour_completions_pkey" PRIMARY KEY ("tenant_id", "id")
);

CREATE TABLE "booking_report_destinations" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "branch_id" UUID,
  "report_type" "BookingReportType" NOT NULL,
  "chat_channel_id" UUID NOT NULL,
  "status" "BookingConfigStatus" NOT NULL DEFAULT 'ACTIVE',
  "effective_from" TIMESTAMPTZ(3) NOT NULL,
  "effective_to" TIMESTAMPTZ(3),
  "created_by_membership_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_report_destinations_pkey" PRIMARY KEY ("tenant_id", "id")
);

CREATE TABLE "booking_job_runs" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "job_type" VARCHAR(80) NOT NULL,
  "report_type" "BookingReportType",
  "business_date" DATE NOT NULL,
  "branch_scope_json" JSONB NOT NULL DEFAULT '[]',
  "state" "BookingJobState" NOT NULL DEFAULT 'PENDING',
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "lease_owner" VARCHAR(160),
  "lease_until" TIMESTAMPTZ(3),
  "checkpoint" VARCHAR(500),
  "input_hash" VARCHAR(64) NOT NULL,
  "safe_error_code" VARCHAR(100),
  "correlation_id" VARCHAR(100) NOT NULL,
  "started_at" TIMESTAMPTZ(3),
  "completed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "booking_job_runs_pkey" PRIMARY KEY ("tenant_id", "id")
);

CREATE TABLE "booking_report_deliveries" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "run_id" UUID NOT NULL,
  "branch_id" UUID,
  "destination_channel_id" UUID NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "dedupe_key" VARCHAR(200) NOT NULL,
  "content_hash" VARCHAR(64) NOT NULL,
  "state" "BookingJobState" NOT NULL DEFAULT 'PENDING',
  "message_id" UUID,
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "safe_error_code" VARCHAR(100),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "booking_report_deliveries_pkey" PRIMARY KEY ("tenant_id", "id")
);

CREATE TABLE "export_requests" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "requester_membership_id" UUID NOT NULL,
  "format" "ExportFormat" NOT NULL DEFAULT 'XLSX',
  "data_types_json" JSONB NOT NULL,
  "date_from" DATE NOT NULL,
  "date_to" DATE NOT NULL,
  "branch_scope_json" JSONB NOT NULL,
  "filter_json" JSONB NOT NULL,
  "filter_schema_version" INTEGER NOT NULL DEFAULT 1,
  "request_hash" VARCHAR(64) NOT NULL,
  "state" "ExportState" NOT NULL DEFAULT 'PENDING',
  "progress_rows" INTEGER NOT NULL DEFAULT 0,
  "checkpoint" VARCHAR(500),
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "lease_owner" VARCHAR(160),
  "lease_until" TIMESTAMPTZ(3),
  "media_object_id" UUID,
  "checksum_sha256" VARCHAR(64),
  "byte_size" BIGINT,
  "expires_at" TIMESTAMPTZ(3),
  "safe_error_code" VARCHAR(100),
  "idempotency_key" VARCHAR(160) NOT NULL,
  "correlation_id" VARCHAR(100) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "export_requests_pkey" PRIMARY KEY ("tenant_id", "id")
);

CREATE TABLE "booking_retention_policy_versions" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "version_number" INTEGER NOT NULL,
  "customer_photo_days" INTEGER NOT NULL DEFAULT 180,
  "xlsx_days" INTEGER NOT NULL DEFAULT 30,
  "platform_bounds_json" JSONB NOT NULL DEFAULT '{}',
  "effective_from" TIMESTAMPTZ(3) NOT NULL,
  "effective_to" TIMESTAMPTZ(3),
  "created_by_membership_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_retention_policy_versions_pkey" PRIMARY KEY ("tenant_id", "id"),
  CONSTRAINT "booking_retention_days_ck" CHECK (
    "customer_photo_days" BETWEEN 1 AND 3650 AND "xlsx_days" BETWEEN 1 AND 365
  )
);

CREATE UNIQUE INDEX "service_offerings_tenant_code_key" ON "service_offerings"("tenant_id", "code");
CREATE UNIQUE INDEX "service_offering_version_number_uniq" ON "service_offering_versions"("tenant_id", "service_offering_id", "version_number");
CREATE UNIQUE INDEX "service_branch_version_uniq" ON "service_branch_availability"("tenant_id", "service_offering_version_id", "branch_id");
CREATE UNIQUE INDEX "booking_transition_source_event_uniq" ON "booking_status_transitions"("tenant_id", "booking_id", "source_event_id");
CREATE UNIQUE INDEX "booking_reason_code_uniq" ON "booking_cancellation_reasons"("tenant_id", "code");
CREATE UNIQUE INDEX "booking_reason_version_uniq" ON "booking_cancellation_reason_versions"("tenant_id", "reason_id", "version_number");
CREATE UNIQUE INDEX "customer_photo_consent_policy_version_uniq" ON "customer_photo_consent_policy_versions"("tenant_id", "version_number");
CREATE UNIQUE INDEX "customer_photo_debt_booking_uniq" ON "customer_photo_debts"("tenant_id", "booking_id");
CREATE UNIQUE INDEX "tour_completion_booking_uniq" ON "tour_completions"("tenant_id", "booking_id");
CREATE UNIQUE INDEX "booking_job_run_schedule_uniq" ON "booking_job_runs"("tenant_id", "job_type", "business_date", "input_hash");
CREATE UNIQUE INDEX "booking_report_delivery_dedupe_uniq" ON "booking_report_deliveries"("tenant_id", "dedupe_key");
CREATE UNIQUE INDEX "export_request_actor_idempotency_uniq" ON "export_requests"("tenant_id", "requester_membership_id", "idempotency_key");
CREATE UNIQUE INDEX "booking_retention_policy_version_uniq" ON "booking_retention_policy_versions"("tenant_id", "version_number");

CREATE INDEX "customers_tenant_name_idx" ON "customers"("tenant_id", "display_name", "id");
CREATE INDEX "customer_branch_scope_idx" ON "customer_branch_access"("tenant_id", "branch_id", "revoked_at", "customer_id");
CREATE INDEX "booking_branch_day_idx" ON "bookings"("tenant_id", "branch_id", "business_date", "scheduled_start_at", "id");
CREATE INDEX "booking_employee_day_idx" ON "bookings"("tenant_id", "assigned_membership_id", "business_date", "status");
CREATE INDEX "booking_customer_history_idx" ON "bookings"("tenant_id", "customer_id", "scheduled_start_at");
CREATE INDEX "photo_debt_scope_idx" ON "customer_photo_debts"("tenant_id", "branch_id", "state", "opened_at", "id");
CREATE INDEX "tour_kpi_source_idx" ON "tour_completions"("tenant_id", "performed_by_membership_id", "branch_id", "business_date");
CREATE INDEX "booking_job_claim_idx" ON "booking_job_runs"("tenant_id", "state", "lease_until", "id");
CREATE INDEX "export_job_claim_idx" ON "export_requests"("tenant_id", "state", "lease_until", "id");

ALTER TABLE "bookings"
  ADD CONSTRAINT "booking_active_employee_60m_excl"
  EXCLUDE USING gist (
    "tenant_id" WITH =,
    "branch_id" WITH =,
    "assigned_membership_id" WITH =,
    tstzrange(
      "scheduled_start_at",
      ("scheduled_start_at" AT TIME ZONE 'UTC' + interval '60 minutes') AT TIME ZONE 'UTC',
      '[)'
    ) WITH &&
  )
  WHERE ("booking_type" = 'SCHEDULED' AND "status" IN ('SCHEDULED', 'ARRIVED'));

ALTER TABLE "customers" ADD CONSTRAINT "customer_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "customers" ADD CONSTRAINT "customer_creator_fk" FOREIGN KEY ("tenant_id", "created_by_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "customer_branch_access" ADD CONSTRAINT "customer_branch_customer_fk" FOREIGN KEY ("tenant_id", "customer_id") REFERENCES "customers"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "customer_branch_access" ADD CONSTRAINT "customer_branch_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "service_offering_versions" ADD CONSTRAINT "service_version_root_fk" FOREIGN KEY ("tenant_id", "service_offering_id") REFERENCES "service_offerings"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "service_branch_availability" ADD CONSTRAINT "service_branch_version_fk" FOREIGN KEY ("tenant_id", "service_offering_version_id") REFERENCES "service_offering_versions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "service_branch_availability" ADD CONSTRAINT "service_branch_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "bookings" ADD CONSTRAINT "booking_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "bookings" ADD CONSTRAINT "booking_customer_fk" FOREIGN KEY ("tenant_id", "customer_id") REFERENCES "customers"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "bookings" ADD CONSTRAINT "booking_assigned_membership_fk" FOREIGN KEY ("tenant_id", "assigned_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "bookings" ADD CONSTRAINT "booking_service_fk" FOREIGN KEY ("tenant_id", "service_offering_id") REFERENCES "service_offerings"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "bookings" ADD CONSTRAINT "booking_service_version_fk" FOREIGN KEY ("tenant_id", "service_offering_version_id") REFERENCES "service_offering_versions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "bookings" ADD CONSTRAINT "booking_form_submission_fk" FOREIGN KEY ("tenant_id", "form_submission_id") REFERENCES "form_submissions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "bookings" ADD CONSTRAINT "booking_form_version_fk" FOREIGN KEY ("tenant_id", "form_version_id") REFERENCES "form_versions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "booking_status_transitions" ADD CONSTRAINT "booking_transition_booking_fk" FOREIGN KEY ("tenant_id", "booking_id") REFERENCES "bookings"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "booking_cancellation_reason_versions" ADD CONSTRAINT "booking_reason_version_root_fk" FOREIGN KEY ("tenant_id", "reason_id") REFERENCES "booking_cancellation_reasons"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "customer_photo_consents" ADD CONSTRAINT "customer_photo_consent_booking_fk" FOREIGN KEY ("tenant_id", "booking_id") REFERENCES "bookings"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "customer_photo_consents" ADD CONSTRAINT "customer_photo_consent_policy_fk" FOREIGN KEY ("tenant_id", "policy_version_id") REFERENCES "customer_photo_consent_policy_versions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "customer_photo_debts" ADD CONSTRAINT "customer_photo_debt_booking_fk" FOREIGN KEY ("tenant_id", "booking_id") REFERENCES "bookings"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "tour_completions" ADD CONSTRAINT "tour_completion_booking_fk" FOREIGN KEY ("tenant_id", "booking_id") REFERENCES "bookings"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "tour_completions" ADD CONSTRAINT "tour_completion_photo_fk" FOREIGN KEY ("tenant_id", "customer_photo_media_id") REFERENCES "media_objects"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "booking_report_destinations" ADD CONSTRAINT "booking_report_channel_fk" FOREIGN KEY ("tenant_id", "chat_channel_id") REFERENCES "chat_channels"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "booking_report_deliveries" ADD CONSTRAINT "booking_report_delivery_run_fk" FOREIGN KEY ("tenant_id", "run_id") REFERENCES "booking_job_runs"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "export_requests" ADD CONSTRAINT "export_request_actor_fk" FOREIGN KEY ("tenant_id", "requester_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
