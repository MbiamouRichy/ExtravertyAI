-- CreateEnum
CREATE TYPE "AiJobState" AS ENUM ('QUEUED', 'GENERATING', 'COMPLETED', 'CANCELLED', 'FAILED');

-- DropIndex
DROP INDEX "message_evolutionId_key";

-- AlterTable
ALTER TABLE "outbound_job" ADD COLUMN     "aiVersion" INTEGER;

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "billingEventCreated" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ai_job" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "requestId" UUID NOT NULL,
    "aiVersion" INTEGER NOT NULL,
    "state" "AiJobState" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" UUID,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_receipt" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
    "remoteJid" TEXT,
    "content" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_job_messageId_key" ON "ai_job"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_job_requestId_key" ON "ai_job"("requestId");

-- CreateIndex
CREATE INDEX "ai_job_state_availableAt_idx" ON "ai_job"("state", "availableAt");

-- CreateIndex
CREATE INDEX "ai_job_contactId_state_createdAt_idx" ON "ai_job"("contactId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "provider_receipt_resolved_createdAt_idx" ON "provider_receipt"("resolved", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "provider_receipt_projectId_providerId_key" ON "provider_receipt"("projectId", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "message_projectId_evolutionId_key" ON "message"("projectId", "evolutionId");

-- AddForeignKey
ALTER TABLE "ai_job" ADD CONSTRAINT "ai_job_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_job" ADD CONSTRAINT "ai_job_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_job" ADD CONSTRAINT "ai_job_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_receipt" ADD CONSTRAINT "provider_receipt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Database invariants shared by all message producers.
CREATE UNIQUE INDEX "quota_period_one_current" ON "quota_period" ("projectId") WHERE "isCurrent" = true;
ALTER TABLE "quota_period" ADD CONSTRAINT "quota_period_valid_bounds" CHECK ("endsAt" > "startsAt" AND "limit" >= 0 AND "used" >= 0);
CREATE INDEX "outbound_job_provider_identity" ON "outbound_job" ("projectId", "providerMessageId");
