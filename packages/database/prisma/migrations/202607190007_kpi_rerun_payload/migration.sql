-- Persist the authorized rerun scope so a background worker can execute the
-- request without trusting client state or losing the scope after a retry.
ALTER TABLE "kpi_job_runs"
ADD COLUMN "payload_json" JSONB NOT NULL DEFAULT '{}';
