-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "IdentityProvider" AS ENUM ('GOOGLE');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'LEFT');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RoleKind" AS ENUM ('SYSTEM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RoleStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ScopeType" AS ENUM ('TENANT', 'BRANCH');

-- CreateEnum
CREATE TYPE "InvitationType" AS ENUM ('DIRECT', 'GROUP_LINK');

-- CreateEnum
CREATE TYPE "FormTemplateStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FormVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "FormSubmissionStatus" AS ENUM ('SUBMITTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ChatChannelType" AS ENUM ('TENANT_GENERAL', 'BRANCH', 'GROUP');

-- CreateEnum
CREATE TYPE "ChatChannelStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ChatChannelRole" AS ENUM ('MEMBER', 'MODERATOR');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PENDING_UPLOAD', 'READY', 'REJECTED', 'DELETED');

-- CreateEnum
CREATE TYPE "MediaPurpose" AS ENUM ('CHECKIN', 'BOOKING', 'FORM_EVIDENCE', 'CHAT_ATTACHMENT', 'PROFILE', 'OTHER');

-- CreateEnum
CREATE TYPE "EndpointPlatform" AS ENUM ('IOS', 'ANDROID');

-- CreateEnum
CREATE TYPE "PushProvider" AS ENUM ('FCM', 'APNS');

-- CreateEnum
CREATE TYPE "EndpointStatus" AS ENUM ('ACTIVE', 'INVALID', 'REVOKED');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED_RETRYABLE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(120),
    "full_name_confirmed_at" TIMESTAMPTZ(3),
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "locale" VARCHAR(16) NOT NULL DEFAULT 'vi-VN',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "IdentityProvider" NOT NULL,
    "provider_subject" VARCHAR(255) NOT NULL,
    "email" VARCHAR(320),
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "external_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" VARCHAR(128) NOT NULL,
    "token_family_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "revoke_reason" VARCHAR(160),
    "replaced_by_session_id" UUID,
    "device_label" VARCHAR(120),
    "user_agent_hash" VARCHAR(128),
    "ip_prefix" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_endpoints" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "platform" "EndpointPlatform" NOT NULL,
    "provider" "PushProvider" NOT NULL,
    "token_ciphertext" TEXT NOT NULL,
    "token_fingerprint" VARCHAR(128) NOT NULL,
    "status" "EndpointStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_seen_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "allowed_scopes" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "session_id" UUID,
    "event_type" VARCHAR(100) NOT NULL,
    "correlation_id" VARCHAR(100) NOT NULL,
    "ip_prefix" VARCHAR(64),
    "user_agent_hash" VARCHAR(128),
    "metadata_redacted" JSONB,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_idempotency_records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "operation" VARCHAR(100) NOT NULL,
    "key" VARCHAR(160) NOT NULL,
    "request_hash" VARCHAR(128) NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "response_status" INTEGER,
    "response_body_redacted" JSONB,
    "resource_id" UUID,
    "locked_until" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "account_idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "timezone_override" VARCHAR(64),
    "status" "ResourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_membership_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "departments" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "status" "ResourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "positions" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "status" "ResourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "tenant_memberships" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "membership_display_name" VARCHAR(120) NOT NULL,
    "employee_code" VARCHAR(50),
    "status" "MembershipStatus" NOT NULL DEFAULT 'INVITED',
    "joined_at" TIMESTAMPTZ(3),
    "suspended_at" TIMESTAMPTZ(3),
    "left_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "department_id" UUID,
    "position_id" UUID,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "effective_to" TIMESTAMPTZ(3),
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_membership_id" UUID NOT NULL,
    "reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "roles" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "kind" "RoleKind" NOT NULL,
    "status" "RoleStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "tenant_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("tenant_id","role_id","permission_id")
);

-- CreateTable
CREATE TABLE "membership_role_bindings" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "scope_type" "ScopeType" NOT NULL,
    "branch_id" UUID,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "effective_to" TIMESTAMPTZ(3),
    "granted_by_membership_id" UUID NOT NULL,
    "reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "membership_role_bindings_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "token_hint" VARCHAR(16) NOT NULL,
    "invitation_type" "InvitationType" NOT NULL,
    "role_id" UUID NOT NULL,
    "branch_id" UUID,
    "max_uses" INTEGER NOT NULL DEFAULT 1,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "invitation_acceptances" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "invitation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "accepted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlation_id" VARCHAR(100) NOT NULL,

    CONSTRAINT "invitation_acceptances_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "form_templates" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(1000),
    "status" "FormTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
    "current_published_version_id" UUID,
    "created_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "form_templates_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "form_versions" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "form_template_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "FormVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "json_schema" JSONB NOT NULL,
    "ui_schema" JSONB,
    "effective_from" TIMESTAMPTZ(3),
    "published_at" TIMESTAMPTZ(3),
    "published_by_membership_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "form_versions_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "form_submissions" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "form_template_id" UUID NOT NULL,
    "form_version_id" UUID NOT NULL,
    "submitted_by_membership_id" UUID NOT NULL,
    "branch_id" UUID,
    "data" JSONB NOT NULL,
    "status" "FormSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided_at" TIMESTAMPTZ(3),
    "void_reason" VARCHAR(500),
    "idempotency_key" VARCHAR(160) NOT NULL,
    "supersedes_submission_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "chat_channels" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "type" "ChatChannelType" NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "branch_id" UUID,
    "status" "ChatChannelStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "chat_channels_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "chat_channel_memberships" (
    "tenant_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "role" "ChatChannelRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMPTZ(3),
    "last_read_message_id" UUID,

    CONSTRAINT "chat_channel_memberships_pkey" PRIMARY KEY ("tenant_id","channel_id","membership_id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "author_membership_id" UUID NOT NULL,
    "author_display_name_snapshot" VARCHAR(120) NOT NULL,
    "client_message_id" VARCHAR(100) NOT NULL,
    "body" TEXT NOT NULL,
    "message_type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "reply_to_message_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "media_objects" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "owner_membership_id" UUID NOT NULL,
    "branch_id" UUID,
    "source_type" VARCHAR(80) NOT NULL,
    "source_id" UUID,
    "purpose" "MediaPurpose" NOT NULL,
    "storage_provider" VARCHAR(32) NOT NULL,
    "bucket" VARCHAR(255) NOT NULL,
    "object_key" VARCHAR(1024) NOT NULL,
    "content_type" VARCHAR(160) NOT NULL,
    "byte_size" BIGINT NOT NULL,
    "checksum_sha256" VARCHAR(64) NOT NULL,
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "upload_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "ready_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "retention_until" TIMESTAMPTZ(3),
    "legal_hold_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "media_objects_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "actor_membership_id" UUID,
    "actor_user_id" UUID,
    "correlation_id" VARCHAR(100) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(100) NOT NULL,
    "target_id" UUID,
    "reason" VARCHAR(500),
    "before_redacted" JSONB,
    "after_redacted" JSONB,
    "metadata_redacted" JSONB,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "tenant_idempotency_records" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "operation" VARCHAR(100) NOT NULL,
    "key" VARCHAR(160) NOT NULL,
    "request_hash" VARCHAR(128) NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "response_status" INTEGER,
    "response_body_redacted" JSONB,
    "resource_id" UUID,
    "locked_until" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tenant_idempotency_records_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateIndex
CREATE INDEX "external_identities_user_id_idx" ON "external_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "external_identities_provider_provider_subject_key" ON "external_identities"("provider", "provider_subject");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_refresh_token_hash_key" ON "auth_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_revoked_at_expires_at_idx" ON "auth_sessions"("user_id", "revoked_at", "expires_at");

-- CreateIndex
CREATE INDEX "auth_sessions_token_family_id_idx" ON "auth_sessions"("token_family_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_endpoints_user_id_token_fingerprint_key" ON "notification_endpoints"("user_id", "token_fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "security_events_user_id_occurred_at_idx" ON "security_events"("user_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "account_idempotency_records_user_id_operation_key_key" ON "account_idempotency_records"("user_id", "operation", "key");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "branches_tenant_id_status_idx" ON "branches"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "branches_tenant_id_code_key" ON "branches"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_tenant_id_code_key" ON "departments"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "positions_tenant_id_code_key" ON "positions"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "tenant_memberships_tenant_id_status_idx" ON "tenant_memberships"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_memberships_tenant_id_user_id_key" ON "tenant_memberships"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_memberships_tenant_id_employee_code_key" ON "tenant_memberships"("tenant_id", "employee_code");

-- CreateIndex
CREATE INDEX "assignments_tenant_id_membership_id_effective_from_effectiv_idx" ON "assignments"("tenant_id", "membership_id", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "assignments_tenant_id_branch_id_effective_from_effective_to_idx" ON "assignments"("tenant_id", "branch_id", "effective_from", "effective_to");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenant_id_code_key" ON "roles"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "membership_role_bindings_tenant_id_membership_id_effective__idx" ON "membership_role_bindings"("tenant_id", "membership_id", "effective_from", "effective_to");

-- CreateIndex
CREATE UNIQUE INDEX "membership_role_bindings_tenant_id_membership_id_role_id_sc_key" ON "membership_role_bindings"("tenant_id", "membership_id", "role_id", "scope_type", "branch_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_tenant_id_expires_at_revoked_at_idx" ON "invitations"("tenant_id", "expires_at", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_acceptances_tenant_id_invitation_id_user_id_key" ON "invitation_acceptances"("tenant_id", "invitation_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_acceptances_tenant_id_membership_id_key" ON "invitation_acceptances"("tenant_id", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "form_templates_tenant_id_code_key" ON "form_templates"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "form_versions_tenant_id_form_template_id_version_number_key" ON "form_versions"("tenant_id", "form_template_id", "version_number");

-- CreateIndex
CREATE INDEX "form_submissions_tenant_id_form_template_id_submitted_at_idx" ON "form_submissions"("tenant_id", "form_template_id", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "form_submissions_tenant_id_submitted_by_membership_id_idemp_key" ON "form_submissions"("tenant_id", "submitted_by_membership_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "chat_channels_tenant_id_type_status_idx" ON "chat_channels"("tenant_id", "type", "status");

-- CreateIndex
CREATE INDEX "chat_channel_memberships_tenant_id_membership_id_left_at_idx" ON "chat_channel_memberships"("tenant_id", "membership_id", "left_at");

-- CreateIndex
CREATE INDEX "chat_messages_tenant_id_channel_id_created_at_id_idx" ON "chat_messages"("tenant_id", "channel_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_tenant_id_author_membership_id_client_message_key" ON "chat_messages"("tenant_id", "author_membership_id", "client_message_id");

-- CreateIndex
CREATE INDEX "media_objects_tenant_id_source_type_source_id_idx" ON "media_objects"("tenant_id", "source_type", "source_id");

-- CreateIndex
CREATE INDEX "media_objects_tenant_id_status_upload_expires_at_idx" ON "media_objects"("tenant_id", "status", "upload_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "media_objects_storage_provider_bucket_object_key_key" ON "media_objects"("storage_provider", "bucket", "object_key");

-- CreateIndex
CREATE INDEX "audit_events_tenant_id_occurred_at_id_idx" ON "audit_events"("tenant_id", "occurred_at", "id");

-- CreateIndex
CREATE INDEX "audit_events_tenant_id_target_type_target_id_occurred_at_idx" ON "audit_events"("tenant_id", "target_type", "target_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_tenant_id_actor_membership_id_occurred_at_idx" ON "audit_events"("tenant_id", "actor_membership_id", "occurred_at");

-- CreateIndex
CREATE INDEX "tenant_idempotency_records_tenant_id_expires_at_idx" ON "tenant_idempotency_records"("tenant_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_idempotency_records_tenant_id_membership_id_operatio_key" ON "tenant_idempotency_records"("tenant_id", "membership_id", "operation", "key");

-- Reviewed constraints and foreign keys not represented by scalar-only Prisma relations.
ALTER TABLE "users" ADD CONSTRAINT "users_full_name_length_ck"
  CHECK ("full_name" IS NULL OR char_length(btrim("full_name")) BETWEEN 2 AND 120);
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_effective_range_ck"
  CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from");
ALTER TABLE "membership_role_bindings" ADD CONSTRAINT "role_binding_scope_ck"
  CHECK (("scope_type" = 'TENANT' AND "branch_id" IS NULL) OR ("scope_type" = 'BRANCH' AND "branch_id" IS NOT NULL));
ALTER TABLE "membership_role_bindings" ADD CONSTRAINT "role_binding_effective_range_ck"
  CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from");
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_usage_ck"
  CHECK ("max_uses" > 0 AND "use_count" >= 0 AND "use_count" <= "max_uses");
ALTER TABLE "form_versions" ADD CONSTRAINT "form_versions_number_ck" CHECK ("version_number" > 0);
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_size_ck"
  CHECK ("byte_size" > 0 AND "byte_size" <= 262144000);
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_checksum_ck"
  CHECK ("checksum_sha256" ~ '^[0-9a-f]{64}$');
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_tenant_key_ck"
  CHECK ("object_key" LIKE "tenant_id"::text || '/%');

ALTER TABLE "external_identities" ADD CONSTRAINT "external_identity_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_session_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_session_replacement_fk" FOREIGN KEY ("replaced_by_session_id") REFERENCES "auth_sessions"("id") ON DELETE SET NULL;
ALTER TABLE "notification_endpoints" ADD CONSTRAINT "notification_endpoint_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "security_events" ADD CONSTRAINT "security_event_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "security_events" ADD CONSTRAINT "security_event_session_fk" FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("id") ON DELETE SET NULL;
ALTER TABLE "account_idempotency_records" ADD CONSTRAINT "account_idem_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "tenants" ADD CONSTRAINT "tenant_creator_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;

ALTER TABLE "branches" ADD CONSTRAINT "branch_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "departments" ADD CONSTRAINT "department_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "positions" ADD CONSTRAINT "position_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "membership_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "membership_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;

ALTER TABLE "assignments" ADD CONSTRAINT "assignment_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "assignments" ADD CONSTRAINT "assignment_member_fk" FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "assignments" ADD CONSTRAINT "assignment_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "assignments" ADD CONSTRAINT "assignment_department_fk" FOREIGN KEY ("tenant_id", "department_id") REFERENCES "departments"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "assignments" ADD CONSTRAINT "assignment_position_fk" FOREIGN KEY ("tenant_id", "position_id") REFERENCES "positions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "assignments" ADD CONSTRAINT "assignment_actor_fk" FOREIGN KEY ("tenant_id", "created_by_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;

ALTER TABLE "roles" ADD CONSTRAINT "role_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permission_role_fk" FOREIGN KEY ("tenant_id", "role_id") REFERENCES "roles"("tenant_id", "id") ON DELETE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permission_permission_fk" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT;
ALTER TABLE "membership_role_bindings" ADD CONSTRAINT "binding_member_fk" FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "membership_role_bindings" ADD CONSTRAINT "binding_role_fk" FOREIGN KEY ("tenant_id", "role_id") REFERENCES "roles"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "membership_role_bindings" ADD CONSTRAINT "binding_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "membership_role_bindings" ADD CONSTRAINT "binding_actor_fk" FOREIGN KEY ("tenant_id", "granted_by_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;

ALTER TABLE "invitations" ADD CONSTRAINT "invitation_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "invitations" ADD CONSTRAINT "invitation_role_fk" FOREIGN KEY ("tenant_id", "role_id") REFERENCES "roles"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "invitations" ADD CONSTRAINT "invitation_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "invitations" ADD CONSTRAINT "invitation_actor_fk" FOREIGN KEY ("tenant_id", "created_by_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "invitation_acceptances" ADD CONSTRAINT "acceptance_invite_fk" FOREIGN KEY ("tenant_id", "invitation_id") REFERENCES "invitations"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "invitation_acceptances" ADD CONSTRAINT "acceptance_member_fk" FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "invitation_acceptances" ADD CONSTRAINT "acceptance_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;

ALTER TABLE "form_templates" ADD CONSTRAINT "form_template_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "form_templates" ADD CONSTRAINT "form_template_actor_fk" FOREIGN KEY ("tenant_id", "created_by_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "form_versions" ADD CONSTRAINT "form_version_template_fk" FOREIGN KEY ("tenant_id", "form_template_id") REFERENCES "form_templates"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "form_versions" ADD CONSTRAINT "form_version_actor_fk" FOREIGN KEY ("tenant_id", "published_by_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "form_templates" ADD CONSTRAINT "form_template_current_version_fk" FOREIGN KEY ("tenant_id", "current_published_version_id") REFERENCES "form_versions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "form_submissions" ADD CONSTRAINT "submission_template_fk" FOREIGN KEY ("tenant_id", "form_template_id") REFERENCES "form_templates"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "form_submissions" ADD CONSTRAINT "submission_version_fk" FOREIGN KEY ("tenant_id", "form_version_id") REFERENCES "form_versions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "form_submissions" ADD CONSTRAINT "submission_member_fk" FOREIGN KEY ("tenant_id", "submitted_by_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "form_submissions" ADD CONSTRAINT "submission_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "form_submissions" ADD CONSTRAINT "submission_supersedes_fk" FOREIGN KEY ("tenant_id", "supersedes_submission_id") REFERENCES "form_submissions"("tenant_id", "id") ON DELETE RESTRICT;

ALTER TABLE "chat_channels" ADD CONSTRAINT "channel_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "chat_channels" ADD CONSTRAINT "channel_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "chat_channels" ADD CONSTRAINT "channel_actor_fk" FOREIGN KEY ("tenant_id", "created_by_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "chat_channel_memberships" ADD CONSTRAINT "channel_member_channel_fk" FOREIGN KEY ("tenant_id", "channel_id") REFERENCES "chat_channels"("tenant_id", "id") ON DELETE CASCADE;
ALTER TABLE "chat_channel_memberships" ADD CONSTRAINT "channel_member_member_fk" FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "message_channel_fk" FOREIGN KEY ("tenant_id", "channel_id") REFERENCES "chat_channels"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "chat_messages" ADD CONSTRAINT "message_author_fk" FOREIGN KEY ("tenant_id", "author_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "chat_messages" ADD CONSTRAINT "message_reply_fk" FOREIGN KEY ("tenant_id", "reply_to_message_id") REFERENCES "chat_messages"("tenant_id", "id") ON DELETE RESTRICT;

ALTER TABLE "media_objects" ADD CONSTRAINT "media_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "media_objects" ADD CONSTRAINT "media_owner_fk" FOREIGN KEY ("tenant_id", "owner_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "media_objects" ADD CONSTRAINT "media_branch_fk" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_actor_member_fk" FOREIGN KEY ("tenant_id", "actor_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_actor_user_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "tenant_idempotency_records" ADD CONSTRAINT "tenant_idem_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "tenant_idempotency_records" ADD CONSTRAINT "tenant_idem_member_fk" FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE CASCADE;
