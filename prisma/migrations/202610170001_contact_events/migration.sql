-- Journal des activations / mises en pause de l'assistant IA par contact
CREATE TYPE "ContactEventType" AS ENUM ('AI_ENABLED', 'AI_PAUSED', 'AI_PAUSED_BY_REPLY', 'AI_PAUSED_FROM_PHONE');

CREATE TABLE "contact_event" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "ContactEventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contact_event_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "contact_event_projectId_contactId_createdAt_id_idx" ON "contact_event"("projectId", "contactId", "createdAt", "id");
ALTER TABLE "contact_event" ADD CONSTRAINT "contact_event_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_event" ADD CONSTRAINT "contact_event_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_event" ADD CONSTRAINT "contact_event_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
