ALTER TABLE "export_requests"
  ADD COLUMN "next_attempt_at" TIMESTAMPTZ(3);

CREATE INDEX "export_requests_tenant_id_state_next_attempt_at_id_idx"
  ON "export_requests" ("tenant_id", "state", "next_attempt_at", "id");
