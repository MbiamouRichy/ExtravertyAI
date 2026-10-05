ALTER TABLE "contact"
  ADD COLUMN "instinctInteresting" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "instinctSourceId" TEXT,
  ADD COLUMN "instinctConfigVersion" INTEGER NOT NULL DEFAULT -1,
  ADD COLUMN "instinctLeaseToken" TEXT,
  ADD COLUMN "instinctLeaseUntil" TIMESTAMP(3);
