ALTER TYPE "MessageType" ADD VALUE 'IMAGE';
ALTER TYPE "MessageType" ADD VALUE 'VIDEO';
ALTER TYPE "MessageType" ADD VALUE 'AUDIO';
ALTER TYPE "MessageType" ADD VALUE 'FILE';
ALTER TABLE "chat_messages" ADD COLUMN "media_id" UUID;
CREATE INDEX "chat_messages_tenant_id_media_id_idx" ON "chat_messages"("tenant_id","media_id");
ALTER TABLE "media_objects" ADD COLUMN "duration_ms" INTEGER;
