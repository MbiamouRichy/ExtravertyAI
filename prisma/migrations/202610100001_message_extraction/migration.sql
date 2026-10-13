CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
ALTER TABLE "message"
  ADD COLUMN "extractedText" TEXT,
  ADD COLUMN "extractionStatus" "ExtractionStatus",
  ADD COLUMN "extractionModel" TEXT,
  ADD COLUMN "extractionVersion" INTEGER,
  ADD COLUMN "extractedAt" TIMESTAMP(3),
  ADD COLUMN "extractionAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "extractionAvailableAt" TIMESTAMP(3),
  ADD COLUMN "extractionLeaseToken" UUID,
  ADD COLUMN "extractionLeaseUntil" TIMESTAMP(3),
  ADD COLUMN "extractionErrorCode" TEXT;
CREATE INDEX "message_extractionStatus_extractionAvailableAt_idx"
  ON "message"("extractionStatus", "extractionAvailableAt");
-- Existing media is not queued: deployment must not trigger a paid backlog.
