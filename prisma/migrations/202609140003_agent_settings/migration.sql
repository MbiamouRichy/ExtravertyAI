-- AlterTable
ALTER TABLE "outbound_job" ADD COLUMN     "agentConfigVersion" INTEGER;

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "agentAskOneQuestion" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "agentConfigVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "agentHumanHandover" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "agentLanguage" TEXT NOT NULL DEFAULT 'auto',
ADD COLUMN     "agentName" TEXT NOT NULL DEFAULT 'Assistant',
ADD COLUMN     "agentQualifyLeads" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "agentResponseLength" TEXT NOT NULL DEFAULT 'concise',
ADD COLUMN     "agentSetupCompletedAt" TIMESTAMP(3),
ADD COLUMN     "agentSystemMessage" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "agentTone" TEXT NOT NULL DEFAULT 'warm',
ADD COLUMN     "agentUseEmojis" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "automationPaused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletionPending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "settingsVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "whatsappAlwaysOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappReadMessages" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappSettingsError" TEXT,
ADD COLUMN     "whatsappSettingsPending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappSyncAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "whatsappTyping" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ai_job" ADD COLUMN     "agentConfigVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "settings_audit" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "settings_audit_projectId_createdAt_idx" ON "settings_audit"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "settings_audit" ADD CONSTRAINT "settings_audit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
