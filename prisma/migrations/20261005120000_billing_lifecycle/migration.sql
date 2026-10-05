ALTER TABLE "project"
  ADD COLUMN "billingRevision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "stripeStatus" TEXT,
  ADD COLUMN "billingNextCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "project_billingNextCheckAt_idx" ON "project"("billingNextCheckAt");
CREATE TYPE "BillingEmailState" AS ENUM ('PENDING', 'SENDING', 'SENT', 'CANCELLED', 'REVIEW_REQUIRED');
CREATE TABLE "billing_email" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "key" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "from" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "state" "BillingEmailState" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "firstAttemptAt" TIMESTAMP(3),
  "leaseToken" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "providerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "billing_email_key_key" ON "billing_email"("key");
CREATE INDEX "billing_email_state_availableAt_idx" ON "billing_email"("state", "availableAt");
