ALTER TABLE "account_idempotency_records"
  ADD COLUMN "response_body_ciphertext" TEXT;

ALTER TABLE "tenant_idempotency_records"
  ADD COLUMN "response_body_ciphertext" TEXT;

ALTER TABLE "media_objects"
  DROP CONSTRAINT IF EXISTS "media_objects_size_ck";

ALTER TABLE "media_objects"
  ADD CONSTRAINT "media_objects_size_ck"
  CHECK ("byte_size" > 0 AND "byte_size" <= 524288000);
