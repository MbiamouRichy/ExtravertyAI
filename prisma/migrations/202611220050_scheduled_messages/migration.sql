-- Messages programmés depuis la messagerie : envoyés au contact à la date
-- choisie par un membre, après revérification par le worker d'envoi.
CREATE TYPE "ScheduledMessageStatus" AS ENUM ('SCHEDULED', 'SENT', 'CANCELLED', 'FAILED');

-- Journal de la conversation : échec d'un message programmé, annulation par un autre membre.
ALTER TYPE "ContactEventType" ADD VALUE 'SCHEDULED_MESSAGE_FAILED';
ALTER TYPE "ContactEventType" ADD VALUE 'SCHEDULED_MESSAGE_CANCELLED';

CREATE TABLE "scheduled_message" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "authorId" TEXT,
    "requestId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL,
    "status" "ScheduledMessageStatus" NOT NULL DEFAULT 'SCHEDULED',
    "failureReason" TEXT,
    "failedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "messageId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_message_pkey" PRIMARY KEY ("id"),
    -- Mêmes bornes que l'action serveur (lib/scheduled-messages-shared.ts).
    CONSTRAINT "scheduled_message_content_check" CHECK (char_length(btrim("content")) BETWEEN 1 AND 100000),
    CONSTRAINT "scheduled_message_failure_reason_check" CHECK ("failureReason" IS NULL OR "failureReason" ~ '^[A-Z_]{1,40}$'),
    CONSTRAINT "scheduled_message_sent_check" CHECK ("status" <> 'SENT' OR "sentAt" IS NOT NULL),
    CONSTRAINT "scheduled_message_failed_check" CHECK ("status" <> 'FAILED' OR ("failedAt" IS NOT NULL AND "failureReason" IS NOT NULL)),
    CONSTRAINT "scheduled_message_cancelled_check" CHECK ("status" <> 'CANCELLED' OR "cancelledAt" IS NOT NULL)
);

CREATE UNIQUE INDEX "scheduled_message_messageId_key" ON "scheduled_message"("messageId");
CREATE UNIQUE INDEX "scheduled_message_projectId_requestId_key" ON "scheduled_message"("projectId", "requestId");
CREATE INDEX "scheduled_message_status_nextAttemptAt_idx" ON "scheduled_message"("status", "nextAttemptAt");
CREATE INDEX "scheduled_message_projectId_contactId_status_scheduledAt_idx" ON "scheduled_message"("projectId", "contactId", "status", "scheduledAt");

ALTER TABLE "scheduled_message" ADD CONSTRAINT "scheduled_message_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scheduled_message" ADD CONSTRAINT "scheduled_message_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scheduled_message" ADD CONSTRAINT "scheduled_message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "scheduled_message" ADD CONSTRAINT "scheduled_message_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "scheduled_message" ADD CONSTRAINT "scheduled_message_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
