UPDATE "audit_events"
SET "reason" = 'LEGACY_EVENT_BACKFILL'
WHERE "reason" IS NULL;

ALTER TABLE "audit_events"
ALTER COLUMN "reason" SET NOT NULL;
