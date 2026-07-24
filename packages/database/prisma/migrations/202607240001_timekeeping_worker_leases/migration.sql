ALTER TABLE "checkin_video_assets"
  ADD COLUMN "lease_owner" VARCHAR(160),
  ADD COLUMN "lease_until" TIMESTAMPTZ(3);

CREATE INDEX "checkin_video_assets_tenant_id_processing_state_lease_until_id_idx"
  ON "checkin_video_assets"("tenant_id", "processing_state", "lease_until", "id");
