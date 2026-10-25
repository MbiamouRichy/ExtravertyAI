-- Diffusion de messages (offres Pro et Business)
CREATE TYPE "BroadcastStatus" AS ENUM ('SCHEDULED', 'SENDING', 'PAUSED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "BroadcastRecipientState" AS ENUM ('PENDING', 'QUEUED', 'SKIPPED');

CREATE TABLE "broadcast" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT,
    "requestId" UUID NOT NULL,
    "name" TEXT NOT NULL CHECK (char_length("name") BETWEEN 1 AND 80),
    "content" TEXT NOT NULL CHECK (char_length("content") BETWEEN 1 AND 1000),
    "nameFallback" TEXT NOT NULL DEFAULT '' CHECK (char_length("nameFallback") <= 40),
    "mediaUrl" TEXT,
    "mediaType" "MessageType",
    "audience" JSONB NOT NULL,
    "status" "BroadcastStatus" NOT NULL DEFAULT 'SCHEDULED',
    "pauseReason" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "nextSendAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "recipientCount" INTEGER NOT NULL CHECK ("recipientCount" > 0),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "broadcast_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "broadcast_requestId_key" ON "broadcast"("requestId");
CREATE INDEX "broadcast_status_nextSendAt_idx" ON "broadcast"("status", "nextSendAt");
CREATE INDEX "broadcast_projectId_createdAt_idx" ON "broadcast"("projectId", "createdAt");
ALTER TABLE "broadcast" ADD CONSTRAINT "broadcast_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "broadcast" ADD CONSTRAINT "broadcast_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "broadcast_recipient" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "state" "BroadcastRecipientState" NOT NULL DEFAULT 'PENDING',
    "skipReason" TEXT,
    "messageId" TEXT,
    "queuedAt" TIMESTAMP(3),
    CONSTRAINT "broadcast_recipient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "broadcast_recipient_messageId_key" ON "broadcast_recipient"("messageId");
CREATE UNIQUE INDEX "broadcast_recipient_broadcastId_contactId_key" ON "broadcast_recipient"("broadcastId", "contactId");
CREATE INDEX "broadcast_recipient_broadcastId_state_id_idx" ON "broadcast_recipient"("broadcastId", "state", "id");
ALTER TABLE "broadcast_recipient" ADD CONSTRAINT "broadcast_recipient_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "broadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "broadcast_recipient" ADD CONSTRAINT "broadcast_recipient_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "broadcast_recipient" ADD CONSTRAINT "broadcast_recipient_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Désinscription des diffusions (réponse STOP), annulée par START
ALTER TABLE "contact" ADD COLUMN "broadcastOptOutAt" TIMESTAMP(3);
ALTER TYPE "ContactEventType" ADD VALUE 'BROADCAST_OPT_OUT';
ALTER TYPE "ContactEventType" ADD VALUE 'BROADCAST_OPT_IN';

-- Journal d'audit des diffusions
CREATE TYPE "BroadcastEventType" AS ENUM ('CREATED', 'STARTED', 'PAUSED', 'RESUMED', 'CANCELLED', 'COMPLETED');
CREATE TABLE "broadcast_event" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "BroadcastEventType" NOT NULL,
    "detail" TEXT CHECK (char_length("detail") <= 80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "broadcast_event_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "broadcast_event_broadcastId_createdAt_id_idx" ON "broadcast_event"("broadcastId", "createdAt", "id");
ALTER TABLE "broadcast_event" ADD CONSTRAINT "broadcast_event_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "broadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "broadcast_event" ADD CONSTRAINT "broadcast_event_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
