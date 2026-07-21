ALTER TABLE "media_objects"
  ALTER COLUMN "purpose" TYPE VARCHAR(50)
  USING "purpose"::text;
