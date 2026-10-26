-- Bridge from the two historical migrations. Stop on schema drift; see docs/deployment.md.
BEGIN;
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "InstanceStatus" AS ENUM ('disconnected', 'connecting', 'qr_ready', 'connected');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('trialing', 'active', 'paused', 'inactive');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'OWNER');

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('light', 'dark', 'system');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('starter', 'business', 'pro');

-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('CLIENT', 'BOT', 'AGENT');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'TEMPLATE', 'OTHER');

-- CreateEnum
CREATE TYPE "OutboundState" AS ENUM ('QUEUED', 'DISPATCHING', 'ACCEPTED', 'UNCERTAIN', 'CANCELLED');

-- CreateTable
CREATE TABLE "quota_period" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "ProjectStatus" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "limit" INTEGER NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quota_period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_job" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "requestId" UUID NOT NULL,
    "quotaPeriodId" TEXT NOT NULL,
    "state" "OutboundState" NOT NULL DEFAULT 'QUEUED',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'trialing',
    "instanceName" TEXT NOT NULL,
    "instanceToken" TEXT,
    "instanceStatus" "InstanceStatus" NOT NULL DEFAULT 'disconnected',
    "plan" "Plan" NOT NULL DEFAULT 'starter',
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "allMessagesCount" INTEGER NOT NULL DEFAULT 0,
    "pairingCodeRequestedAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "stripeCurrentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiredAt" TIMESTAMP(3),

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "remoteJid" TEXT NOT NULL,
    "pushName" TEXT,
    "name" TEXT,
    "aiActive" BOOLEAN NOT NULL DEFAULT true,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "aiVersion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" TEXT NOT NULL,
    "evolutionId" TEXT,
    "fromMe" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "mediaUrl" TEXT,
    "senderType" "SenderType" NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "source" TEXT DEFAULT 'unknown',
    "contactId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "agentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "token" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quota_period_projectId_isCurrent_idx" ON "quota_period"("projectId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "quota_period_projectId_key_key" ON "quota_period"("projectId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_job_messageId_key" ON "outbound_job"("messageId");

-- CreateIndex
CREATE INDEX "outbound_job_state_createdAt_idx" ON "outbound_job"("state", "createdAt");

-- CreateIndex
CREATE INDEX "outbound_job_state_startedAt_idx" ON "outbound_job"("state", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_job_projectId_requestId_key" ON "outbound_job"("projectId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "project_instanceName_key" ON "project"("instanceName");

-- CreateIndex
CREATE UNIQUE INDEX "project_instanceToken_key" ON "project"("instanceToken");

-- CreateIndex
CREATE UNIQUE INDEX "project_stripeCustomerId_key" ON "project"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "project_stripeSubscriptionId_key" ON "project"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "contact_projectId_lastMessageAt_id_idx" ON "contact"("projectId", "lastMessageAt", "id");

-- CreateIndex
CREATE INDEX "contact_projectId_idx" ON "contact"("projectId");

-- CreateIndex
CREATE INDEX "contact_projectId_updatedAt_id_idx" ON "contact"("projectId", "updatedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "contact_projectId_remoteJid_key" ON "contact"("projectId", "remoteJid");

-- CreateIndex
CREATE UNIQUE INDEX "message_evolutionId_key" ON "message"("evolutionId");

-- CreateIndex
CREATE INDEX "message_projectId_idx" ON "message"("projectId");

-- CreateIndex
CREATE INDEX "message_contactId_createdAt_idx" ON "message"("contactId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "message_evolutionId_idx" ON "message"("evolutionId");

-- CreateIndex
CREATE INDEX "message_projectId_contactId_createdAt_id_idx" ON "message"("projectId", "contactId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "project_membership_userId_idx" ON "project_membership"("userId");

-- CreateIndex
CREATE INDEX "project_membership_projectId_idx" ON "project_membership"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "project_membership_userId_projectId_key" ON "project_membership"("userId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_token_key" ON "invitation"("token");

-- CreateIndex
CREATE INDEX "invitation_token_idx" ON "invitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_email_projectId_key" ON "invitation"("email", "projectId");

-- AddForeignKey
ALTER TABLE "quota_period" ADD CONSTRAINT "quota_period_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_job" ADD CONSTRAINT "outbound_job_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_job" ADD CONSTRAINT "outbound_job_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_job" ADD CONSTRAINT "outbound_job_quotaPeriodId_fkey" FOREIGN KEY ("quotaPeriodId") REFERENCES "quota_period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact" ADD CONSTRAINT "contact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_membership" ADD CONSTRAINT "project_membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_membership" ADD CONSTRAINT "project_membership_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user" ADD COLUMN "theme" "Theme" NOT NULL DEFAULT 'system',
  ADD COLUMN "globalRole" "Role" NOT NULL DEFAULT 'USER',
  ADD COLUMN "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Preserve the historical project data and owner memberships. No fresh quota is granted.
INSERT INTO "project" (id, name, numero, status, "instanceName", "instanceStatus", "createdAt", "updatedAt")
SELECT id, name, numero,
  CASE WHEN status IN ('active', 'trialing', 'paused', 'inactive') THEN status::"ProjectStatus" ELSE 'inactive'::"ProjectStatus" END,
  "instanceName",
  CASE WHEN "instanceStatus" IN ('disconnected', 'connecting', 'qr_ready', 'connected') THEN "instanceStatus"::"InstanceStatus" ELSE 'disconnected'::"InstanceStatus" END,
  "createdAt", "updatedAt" FROM "Project";
INSERT INTO project_membership (id, "userId", "projectId", role, "createdAt")
SELECT 'legacy_owner_' || id, "userId", id, 'OWNER', "createdAt" FROM "Project";
-- Keep the old table as a read-only historical archive until its data is verified.
ALTER TABLE "Project" RENAME TO "legacy_project_archive";
COMMIT;
