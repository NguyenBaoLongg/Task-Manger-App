ALTER TABLE "media_objects"
  ADD COLUMN "consent_id" UUID;

CREATE INDEX "media_objects_tenant_id_consent_id_idx"
  ON "media_objects" ("tenant_id", "consent_id");

ALTER TABLE "customer_photo_debts"
  ADD COLUMN "opened_by_membership_id" UUID,
  ADD COLUMN "opened_reason" VARCHAR(500),
  ADD COLUMN "resolved_by_membership_id" UUID,
  ADD COLUMN "waived_by_membership_id" UUID,
  ADD COLUMN "waived_at" TIMESTAMPTZ(3),
  ADD COLUMN "waiver_reason" VARCHAR(500);
