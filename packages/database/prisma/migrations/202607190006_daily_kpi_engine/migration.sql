-- CreateEnum
CREATE TYPE "KpiValueType" AS ENUM ('MONEY', 'COUNT', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "KpiDirection" AS ENUM ('AT_LEAST', 'AT_MOST');

-- CreateEnum
CREATE TYPE "KpiSourceType" AS ENUM ('FORM_FIELD', 'DOMAIN_ADAPTER');

-- CreateEnum
CREATE TYPE "KpiScopeType" AS ENUM ('TENANT', 'BRANCH', 'DEPARTMENT', 'GROUP', 'MEMBERSHIP');

-- CreateEnum
CREATE TYPE "DailyKpiPolicyScopeType" AS ENUM ('TENANT', 'BRANCH');

-- CreateEnum
CREATE TYPE "KpiReportStatus" AS ENUM ('OPEN', 'SUBMITTED', 'LATE', 'CLOSED');

-- CreateEnum
CREATE TYPE "KpiEvaluationStatus" AS ENUM ('PASSED', 'FAILED', 'EXEMPT');

-- CreateEnum
CREATE TYPE "KpiPenaltyKind" AS ENUM ('DAILY_KPI', 'PHOTO_EVIDENCE');

-- CreateEnum
CREATE TYPE "KpiPenaltyStatus" AS ENUM ('ASSESSED', 'FULLY_REVERSED');

-- CreateEnum
CREATE TYPE "EvidenceDebtStatus" AS ENUM ('WAITING_PHOTOS', 'SATISFIED', 'OVERDUE', 'WAIVED');

-- CreateEnum
CREATE TYPE "ActionItemState" AS ENUM ('OPEN', 'OVERDUE', 'COMPLETED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ActionItemType" AS ENUM ('KPI_REPORT', 'KPI_SHORTFALL', 'PHOTO_DEBT', 'DATA_QUALITY');

-- CreateEnum
CREATE TYPE "KpiJobRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'DEAD_LETTER');

-- CreateTable
CREATE TABLE "kpi_definitions" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(1000),
    "value_type" "KpiValueType" NOT NULL,
    "unit" VARCHAR(16) NOT NULL,
    "direction" "KpiDirection" NOT NULL,
    "source_type" "KpiSourceType" NOT NULL,
    "status" "ResourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "kpi_definitions_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "kpi_target_versions" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "kpi_definition_id" UUID NOT NULL,
    "scope_type" "KpiScopeType" NOT NULL,
    "scope_id" UUID,
    "target_money_minor" BIGINT,
    "target_count" BIGINT,
    "target_percentage" DECIMAL(18,4),
    "required" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "effective_to" TIMESTAMPTZ(3),
    "version_number" INTEGER NOT NULL,
    "created_by_membership_id" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_target_versions_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "kpi_source_mapping_versions" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "kpi_definition_id" UUID NOT NULL,
    "source_type" "KpiSourceType" NOT NULL,
    "form_template_id" UUID,
    "form_version_id" UUID,
    "json_pointer" VARCHAR(500),
    "adapter_code" VARCHAR(80),
    "aggregation" VARCHAR(32) NOT NULL,
    "normalization_json" JSONB NOT NULL DEFAULT '{}',
    "requires_evidence" BOOLEAN NOT NULL DEFAULT false,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "effective_to" TIMESTAMPTZ(3),
    "version_number" INTEGER NOT NULL,
    "created_by_membership_id" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_source_mapping_versions_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "daily_kpi_policy_versions" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "scope_type" "DailyKpiPolicyScopeType" NOT NULL,
    "branch_id" UUID,
    "version_number" INTEGER NOT NULL,
    "effective_from_date" DATE NOT NULL,
    "effective_to_date" DATE,
    "timezone" VARCHAR(64) NOT NULL,
    "report_open_local" VARCHAR(8) NOT NULL,
    "report_close_local" VARCHAR(8) NOT NULL,
    "evaluation_local" VARCHAR(8) NOT NULL,
    "failure_penalty_minor" BIGINT NOT NULL DEFAULT 100000,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'VND',
    "kpi_scope_json" JSONB NOT NULL DEFAULT '{}',
    "membership_scope_json" JSONB NOT NULL DEFAULT '{}',
    "exemption_rule_json" JSONB NOT NULL DEFAULT '{}',
    "evidence_enabled" BOOLEAN NOT NULL DEFAULT false,
    "evidence_grace_seconds" INTEGER NOT NULL DEFAULT 300,
    "photo_penalty_minor" BIGINT,
    "created_by_membership_id" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_kpi_policy_versions_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "daily_kpi_reports" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "policy_version_id" UUID NOT NULL,
    "opened_at" TIMESTAMPTZ(3) NOT NULL,
    "closed_at" TIMESTAMPTZ(3) NOT NULL,
    "evaluation_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "KpiReportStatus" NOT NULL DEFAULT 'OPEN',
    "current_revision_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "daily_kpi_reports_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "daily_kpi_report_revisions" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "form_submission_id" UUID NOT NULL,
    "form_version_id" UUID NOT NULL,
    "submitted_at" TIMESTAMPTZ(3) NOT NULL,
    "accepted_in_window" BOOLEAN NOT NULL,
    "source_digest" VARCHAR(64) NOT NULL,
    "created_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_kpi_report_revisions_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "kpi_calculation_events" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "report_revision_id" UUID,
    "kpi_definition_id" UUID NOT NULL,
    "target_version_id" UUID NOT NULL,
    "mapping_version_id" UUID NOT NULL,
    "target_value" VARCHAR(80) NOT NULL,
    "actual_value" VARCHAR(80),
    "remaining_value" VARCHAR(80) NOT NULL,
    "unit" VARCHAR(16) NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "source_type" VARCHAR(32) NOT NULL,
    "source_id" UUID,
    "source_observed_at" TIMESTAMPTZ(3),
    "calculation_version" INTEGER NOT NULL DEFAULT 1,
    "input_digest" VARCHAR(64) NOT NULL,
    "calculated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_calculation_events_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "daily_kpi_evaluations" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "policy_version_id" UUID NOT NULL,
    "report_revision_id" UUID,
    "status" "KpiEvaluationStatus" NOT NULL,
    "failed_details_json" JSONB NOT NULL DEFAULT '[]',
    "exemption_source" VARCHAR(160),
    "evaluated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "job_run_id" UUID NOT NULL,
    "algorithm_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "daily_kpi_evaluations_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "penalty_outcomes" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "evaluation_id" UUID,
    "membership_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "policy_version_id" UUID NOT NULL,
    "kind" "KpiPenaltyKind" NOT NULL,
    "source_key" VARCHAR(160) NOT NULL DEFAULT '',
    "amount_minor" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'VND',
    "failed_details_json" JSONB NOT NULL DEFAULT '[]',
    "status" "KpiPenaltyStatus" NOT NULL DEFAULT 'ASSESSED',
    "assessed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "penalty_outcomes_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "penalty_adjustments" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "penalty_outcome_id" UUID NOT NULL,
    "delta_minor" BIGINT NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "actor_membership_id" UUID NOT NULL,
    "correlation_id" VARCHAR(100) NOT NULL,
    "idempotency_key" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "penalty_adjustments_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "evidence_debts" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "policy_version_id" UUID NOT NULL,
    "required_count" INTEGER NOT NULL,
    "received_count" INTEGER NOT NULL DEFAULT 0,
    "state" "EvidenceDebtStatus" NOT NULL DEFAULT 'WAITING_PHOTOS',
    "deadline_at" TIMESTAMPTZ(3) NOT NULL,
    "reminded_at" TIMESTAMPTZ(3),
    "finalized_at" TIMESTAMPTZ(3),
    "penalty_outcome_id" UUID,
    "state_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "evidence_debts_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "action_items" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "owner_membership_id" UUID NOT NULL,
    "branch_id" UUID,
    "department_id" UUID,
    "item_type" "ActionItemType" NOT NULL,
    "source_type" VARCHAR(50) NOT NULL,
    "source_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "state" "ActionItemState" NOT NULL DEFAULT 'OPEN',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "title" VARCHAR(255) NOT NULL,
    "target_value" VARCHAR(80),
    "actual_value" VARCHAR(80),
    "remaining_value" VARCHAR(80),
    "unit" VARCHAR(16),
    "deadline_at" TIMESTAMPTZ(3) NOT NULL,
    "source_freshness_at" TIMESTAMPTZ(3) NOT NULL,
    "deep_link" VARCHAR(1000) NOT NULL,
    "state_version" INTEGER NOT NULL DEFAULT 1,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "action_items_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "action_item_transitions" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "action_item_id" UUID NOT NULL,
    "from_state" "ActionItemState",
    "to_state" "ActionItemState" NOT NULL,
    "reason_code" VARCHAR(80) NOT NULL,
    "actor_membership_id" UUID,
    "source_event_id" UUID NOT NULL,
    "snapshot_json" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_item_transitions_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "kpi_job_runs" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "job_type" VARCHAR(80) NOT NULL,
    "business_date" DATE NOT NULL,
    "status" "KpiJobRunStatus" NOT NULL DEFAULT 'PENDING',
    "checkpoint" VARCHAR(255),
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "lease_owner" VARCHAR(160),
    "lease_until" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "safe_error_code" VARCHAR(100),
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "correlation_id" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "kpi_job_runs_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "aggregate_type" VARCHAR(80) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "dedupe_key" VARCHAR(200) NOT NULL,
    "payload_redacted" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_owner" VARCHAR(160),
    "lease_until" TIMESTAMPTZ(3),
    "sent_at" TIMESTAMPTZ(3),
    "last_safe_error" VARCHAR(255),
    "correlation_id" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateIndex
CREATE INDEX "kpi_definitions_tenant_id_status_id_idx" ON "kpi_definitions"("tenant_id", "status", "id");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_definitions_tenant_id_code_key" ON "kpi_definitions"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "kpi_target_versions_tenant_id_kpi_definition_id_scope_type__idx" ON "kpi_target_versions"("tenant_id", "kpi_definition_id", "scope_type", "scope_id", "effective_from", "effective_to");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_target_versions_tenant_id_kpi_definition_id_scope_type__key" ON "kpi_target_versions"("tenant_id", "kpi_definition_id", "scope_type", "scope_id", "version_number");

-- CreateIndex
CREATE INDEX "kpi_source_mapping_versions_tenant_id_kpi_definition_id_eff_idx" ON "kpi_source_mapping_versions"("tenant_id", "kpi_definition_id", "effective_from", "effective_to");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_source_mapping_versions_tenant_id_kpi_definition_id_sou_key" ON "kpi_source_mapping_versions"("tenant_id", "kpi_definition_id", "source_type", "version_number");

-- CreateIndex
CREATE INDEX "daily_kpi_policy_versions_tenant_id_scope_type_branch_id_ef_idx" ON "daily_kpi_policy_versions"("tenant_id", "scope_type", "branch_id", "effective_from_date", "effective_to_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_kpi_policy_versions_tenant_id_scope_type_branch_id_ve_key" ON "daily_kpi_policy_versions"("tenant_id", "scope_type", "branch_id", "version_number");

-- CreateIndex
CREATE INDEX "daily_kpi_reports_tenant_id_branch_id_business_date_status_idx" ON "daily_kpi_reports"("tenant_id", "branch_id", "business_date", "status");

-- CreateIndex
CREATE INDEX "daily_kpi_reports_tenant_id_evaluation_at_status_idx" ON "daily_kpi_reports"("tenant_id", "evaluation_at", "status");

-- CreateIndex
CREATE UNIQUE INDEX "daily_kpi_reports_tenant_id_membership_id_business_date_key" ON "daily_kpi_reports"("tenant_id", "membership_id", "business_date");

-- CreateIndex
CREATE INDEX "daily_kpi_report_revisions_tenant_id_report_id_submitted_at_idx" ON "daily_kpi_report_revisions"("tenant_id", "report_id", "submitted_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_kpi_report_revisions_tenant_id_report_id_revision_num_key" ON "daily_kpi_report_revisions"("tenant_id", "report_id", "revision_number");

-- CreateIndex
CREATE UNIQUE INDEX "daily_kpi_report_revisions_tenant_id_report_id_form_submiss_key" ON "daily_kpi_report_revisions"("tenant_id", "report_id", "form_submission_id");

-- CreateIndex
CREATE INDEX "kpi_calculation_events_tenant_id_report_id_kpi_definition_i_idx" ON "kpi_calculation_events"("tenant_id", "report_id", "kpi_definition_id", "calculated_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_calculation_events_tenant_id_report_id_kpi_definition_i_key" ON "kpi_calculation_events"("tenant_id", "report_id", "kpi_definition_id", "input_digest");

-- CreateIndex
CREATE INDEX "daily_kpi_evaluations_tenant_id_branch_id_business_date_sta_idx" ON "daily_kpi_evaluations"("tenant_id", "branch_id", "business_date", "status", "id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_kpi_evaluations_tenant_id_membership_id_business_date_key" ON "daily_kpi_evaluations"("tenant_id", "membership_id", "business_date");

-- CreateIndex
CREATE INDEX "penalty_outcomes_tenant_id_branch_id_business_date_kind_idx" ON "penalty_outcomes"("tenant_id", "branch_id", "business_date", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "penalty_outcomes_tenant_id_membership_id_business_date_kind_key" ON "penalty_outcomes"("tenant_id", "membership_id", "business_date", "kind", "source_key");

-- CreateIndex
CREATE INDEX "penalty_adjustments_tenant_id_penalty_outcome_id_created_at_idx" ON "penalty_adjustments"("tenant_id", "penalty_outcome_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "penalty_adjustments_tenant_id_actor_membership_id_idempoten_key" ON "penalty_adjustments"("tenant_id", "actor_membership_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "evidence_debts_tenant_id_state_deadline_at_id_idx" ON "evidence_debts"("tenant_id", "state", "deadline_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_debts_tenant_id_report_id_key" ON "evidence_debts"("tenant_id", "report_id");

-- CreateIndex
CREATE INDEX "action_items_tenant_id_owner_membership_id_state_updated_at_idx" ON "action_items"("tenant_id", "owner_membership_id", "state", "updated_at", "id");

-- CreateIndex
CREATE INDEX "action_items_tenant_id_branch_id_department_id_state_busine_idx" ON "action_items"("tenant_id", "branch_id", "department_id", "state", "business_date", "updated_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "action_items_tenant_id_owner_membership_id_item_type_source_key" ON "action_items"("tenant_id", "owner_membership_id", "item_type", "source_type", "source_id", "business_date");

-- CreateIndex
CREATE INDEX "action_item_transitions_tenant_id_action_item_id_occurred_a_idx" ON "action_item_transitions"("tenant_id", "action_item_id", "occurred_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "action_item_transitions_tenant_id_action_item_id_source_eve_key" ON "action_item_transitions"("tenant_id", "action_item_id", "source_event_id");

-- CreateIndex
CREATE INDEX "kpi_job_runs_tenant_id_status_lease_until_id_idx" ON "kpi_job_runs"("tenant_id", "status", "lease_until", "id");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_job_runs_tenant_id_job_type_business_date_key" ON "kpi_job_runs"("tenant_id", "job_type", "business_date");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_id_idx" ON "outbox_events"("status", "available_at", "id");

-- CreateIndex
CREATE INDEX "outbox_events_tenant_id_aggregate_type_aggregate_id_created_idx" ON "outbox_events"("tenant_id", "aggregate_type", "aggregate_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_tenant_id_dedupe_key_key" ON "outbox_events"("tenant_id", "dedupe_key");

-- Domain checks omitted by Prisma's generated DDL.
ALTER TABLE "kpi_target_versions" ADD CONSTRAINT "kpi_target_effective_range_ck"
  CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from");
ALTER TABLE "kpi_target_versions" ADD CONSTRAINT "kpi_target_scope_ck"
  CHECK (("scope_type" = 'TENANT' AND "scope_id" IS NULL) OR ("scope_type" <> 'TENANT' AND "scope_id" IS NOT NULL));
ALTER TABLE "kpi_target_versions" ADD CONSTRAINT "kpi_target_exact_value_ck"
  CHECK (num_nonnulls("target_money_minor", "target_count", "target_percentage") = 1);
ALTER TABLE "kpi_source_mapping_versions" ADD CONSTRAINT "kpi_mapping_effective_range_ck"
  CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from");
ALTER TABLE "kpi_source_mapping_versions" ADD CONSTRAINT "kpi_mapping_source_ck"
  CHECK (
    ("source_type" = 'FORM_FIELD' AND "form_template_id" IS NOT NULL AND "form_version_id" IS NOT NULL AND "json_pointer" IS NOT NULL AND "adapter_code" IS NULL)
    OR
    ("source_type" = 'DOMAIN_ADAPTER' AND "form_template_id" IS NULL AND "form_version_id" IS NULL AND "json_pointer" IS NULL AND "adapter_code" IS NOT NULL)
  );
ALTER TABLE "daily_kpi_policy_versions" ADD CONSTRAINT "daily_kpi_policy_scope_ck"
  CHECK (("scope_type" = 'TENANT' AND "branch_id" IS NULL) OR ("scope_type" = 'BRANCH' AND "branch_id" IS NOT NULL));
ALTER TABLE "daily_kpi_policy_versions" ADD CONSTRAINT "daily_kpi_policy_date_range_ck"
  CHECK ("effective_to_date" IS NULL OR "effective_to_date" >= "effective_from_date");
ALTER TABLE "daily_kpi_policy_versions" ADD CONSTRAINT "daily_kpi_policy_time_ck"
  CHECK ("report_open_local" ~ '^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$'
    AND "report_close_local" ~ '^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$'
    AND "evaluation_local" ~ '^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$'
    AND "report_open_local" < "report_close_local" AND "report_close_local" < "evaluation_local");
ALTER TABLE "daily_kpi_policy_versions" ADD CONSTRAINT "daily_kpi_policy_money_ck"
  CHECK ("failure_penalty_minor" >= 0 AND ("photo_penalty_minor" IS NULL OR "photo_penalty_minor" >= 0)
    AND "currency" = 'VND' AND "evidence_grace_seconds" BETWEEN 0 AND 86400);
ALTER TABLE "daily_kpi_reports" ADD CONSTRAINT "daily_kpi_report_instants_ck"
  CHECK ("opened_at" < "closed_at" AND "closed_at" < "evaluation_at");
ALTER TABLE "daily_kpi_report_revisions" ADD CONSTRAINT "daily_kpi_revision_number_ck" CHECK ("revision_number" > 0);
ALTER TABLE "daily_kpi_evaluations" ADD CONSTRAINT "daily_kpi_algorithm_version_ck" CHECK ("algorithm_version" > 0);
ALTER TABLE "penalty_outcomes" ADD CONSTRAINT "penalty_outcome_money_ck"
  CHECK ("amount_minor" >= 0 AND "currency" = 'VND');
ALTER TABLE "penalty_outcomes" ADD CONSTRAINT "penalty_outcome_source_ck"
  CHECK (("kind" = 'DAILY_KPI' AND "source_key" = '' AND "evaluation_id" IS NOT NULL)
    OR ("kind" = 'PHOTO_EVIDENCE' AND "source_key" <> ''));
ALTER TABLE "penalty_adjustments" ADD CONSTRAINT "penalty_adjustment_delta_ck" CHECK ("delta_minor" <> 0);
ALTER TABLE "evidence_debts" ADD CONSTRAINT "evidence_debt_counts_ck"
  CHECK ("required_count" >= 0 AND "received_count" >= 0 AND "state_version" > 0);
ALTER TABLE "action_items" ADD CONSTRAINT "action_item_state_version_ck" CHECK ("state_version" > 0);
ALTER TABLE "kpi_job_runs" ADD CONSTRAINT "kpi_job_attempt_ck" CHECK ("attempt" >= 0 AND "error_count" >= 0);
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_attempt_ck" CHECK ("attempt" >= 0 AND "schema_version" > 0);

-- Composite tenant foreign keys prevent cross-tenant graph edges.
ALTER TABLE "kpi_definitions" ADD CONSTRAINT "kpi_definition_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "kpi_definitions" ADD CONSTRAINT "kpi_definition_actor_fk" FOREIGN KEY ("tenant_id", "created_by_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "kpi_target_versions" ADD CONSTRAINT "kpi_target_definition_fk" FOREIGN KEY ("tenant_id", "kpi_definition_id") REFERENCES "kpi_definitions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "kpi_target_versions" ADD CONSTRAINT "kpi_target_actor_fk" FOREIGN KEY ("tenant_id", "created_by_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "kpi_source_mapping_versions" ADD CONSTRAINT "kpi_mapping_definition_fk" FOREIGN KEY ("tenant_id", "kpi_definition_id") REFERENCES "kpi_definitions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "kpi_source_mapping_versions" ADD CONSTRAINT "kpi_mapping_template_fk" FOREIGN KEY ("tenant_id", "form_template_id") REFERENCES "form_templates"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "kpi_source_mapping_versions" ADD CONSTRAINT "kpi_mapping_version_fk" FOREIGN KEY ("tenant_id", "form_version_id") REFERENCES "form_versions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "kpi_source_mapping_versions" ADD CONSTRAINT "kpi_mapping_actor_fk" FOREIGN KEY ("tenant_id", "created_by_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "daily_kpi_policy_versions" ADD CONSTRAINT "daily_kpi_policy_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "daily_kpi_policy_versions" ADD CONSTRAINT "daily_kpi_policy_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "daily_kpi_policy_versions" ADD CONSTRAINT "daily_kpi_policy_actor_fk" FOREIGN KEY ("tenant_id", "created_by_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "daily_kpi_reports" ADD CONSTRAINT "daily_kpi_report_member_fk" FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "daily_kpi_reports" ADD CONSTRAINT "daily_kpi_report_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "daily_kpi_reports" ADD CONSTRAINT "daily_kpi_report_policy_fk" FOREIGN KEY ("tenant_id", "policy_version_id") REFERENCES "daily_kpi_policy_versions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "daily_kpi_report_revisions" ADD CONSTRAINT "daily_kpi_revision_report_fk" FOREIGN KEY ("tenant_id", "report_id") REFERENCES "daily_kpi_reports"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "daily_kpi_report_revisions" ADD CONSTRAINT "daily_kpi_revision_submission_fk" FOREIGN KEY ("tenant_id", "form_submission_id") REFERENCES "form_submissions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "daily_kpi_report_revisions" ADD CONSTRAINT "daily_kpi_revision_version_fk" FOREIGN KEY ("tenant_id", "form_version_id") REFERENCES "form_versions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "daily_kpi_report_revisions" ADD CONSTRAINT "daily_kpi_revision_actor_fk" FOREIGN KEY ("tenant_id", "created_by_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "daily_kpi_reports" ADD CONSTRAINT "daily_kpi_report_current_revision_fk" FOREIGN KEY ("tenant_id", "current_revision_id") REFERENCES "daily_kpi_report_revisions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "kpi_calculation_events" ADD CONSTRAINT "kpi_calculation_report_fk" FOREIGN KEY ("tenant_id", "report_id") REFERENCES "daily_kpi_reports"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "kpi_calculation_events" ADD CONSTRAINT "kpi_calculation_revision_fk" FOREIGN KEY ("tenant_id", "report_revision_id") REFERENCES "daily_kpi_report_revisions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "kpi_calculation_events" ADD CONSTRAINT "kpi_calculation_definition_fk" FOREIGN KEY ("tenant_id", "kpi_definition_id") REFERENCES "kpi_definitions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "kpi_calculation_events" ADD CONSTRAINT "kpi_calculation_target_fk" FOREIGN KEY ("tenant_id", "target_version_id") REFERENCES "kpi_target_versions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "kpi_calculation_events" ADD CONSTRAINT "kpi_calculation_mapping_fk" FOREIGN KEY ("tenant_id", "mapping_version_id") REFERENCES "kpi_source_mapping_versions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "daily_kpi_evaluations" ADD CONSTRAINT "daily_kpi_evaluation_report_fk" FOREIGN KEY ("tenant_id", "report_id") REFERENCES "daily_kpi_reports"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "daily_kpi_evaluations" ADD CONSTRAINT "daily_kpi_evaluation_member_fk" FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "daily_kpi_evaluations" ADD CONSTRAINT "daily_kpi_evaluation_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "daily_kpi_evaluations" ADD CONSTRAINT "daily_kpi_evaluation_policy_fk" FOREIGN KEY ("tenant_id", "policy_version_id") REFERENCES "daily_kpi_policy_versions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "daily_kpi_evaluations" ADD CONSTRAINT "daily_kpi_evaluation_revision_fk" FOREIGN KEY ("tenant_id", "report_revision_id") REFERENCES "daily_kpi_report_revisions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "penalty_outcomes" ADD CONSTRAINT "penalty_evaluation_fk" FOREIGN KEY ("tenant_id", "evaluation_id") REFERENCES "daily_kpi_evaluations"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "penalty_outcomes" ADD CONSTRAINT "penalty_member_fk" FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "penalty_outcomes" ADD CONSTRAINT "penalty_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "penalty_outcomes" ADD CONSTRAINT "penalty_policy_fk" FOREIGN KEY ("tenant_id", "policy_version_id") REFERENCES "daily_kpi_policy_versions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "penalty_adjustments" ADD CONSTRAINT "penalty_adjustment_outcome_fk" FOREIGN KEY ("tenant_id", "penalty_outcome_id") REFERENCES "penalty_outcomes"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "penalty_adjustments" ADD CONSTRAINT "penalty_adjustment_actor_fk" FOREIGN KEY ("tenant_id", "actor_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "evidence_debts" ADD CONSTRAINT "evidence_debt_report_fk" FOREIGN KEY ("tenant_id", "report_id") REFERENCES "daily_kpi_reports"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "evidence_debts" ADD CONSTRAINT "evidence_debt_policy_fk" FOREIGN KEY ("tenant_id", "policy_version_id") REFERENCES "daily_kpi_policy_versions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "evidence_debts" ADD CONSTRAINT "evidence_debt_penalty_fk" FOREIGN KEY ("tenant_id", "penalty_outcome_id") REFERENCES "penalty_outcomes"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "action_items" ADD CONSTRAINT "action_item_owner_fk" FOREIGN KEY ("tenant_id", "owner_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "action_items" ADD CONSTRAINT "action_item_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "action_items" ADD CONSTRAINT "action_item_department_fk" FOREIGN KEY ("tenant_id", "department_id") REFERENCES "departments"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "action_item_transitions" ADD CONSTRAINT "action_transition_item_fk" FOREIGN KEY ("tenant_id", "action_item_id") REFERENCES "action_items"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "action_item_transitions" ADD CONSTRAINT "action_transition_actor_fk" FOREIGN KEY ("tenant_id", "actor_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "kpi_job_runs" ADD CONSTRAINT "kpi_job_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "daily_kpi_evaluations" ADD CONSTRAINT "daily_kpi_evaluation_job_fk" FOREIGN KEY ("tenant_id", "job_run_id") REFERENCES "kpi_job_runs"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
