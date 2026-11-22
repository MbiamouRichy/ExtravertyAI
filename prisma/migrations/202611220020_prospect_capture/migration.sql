-- Capture IA : informations données par le prospect dans la conversation.
-- Nouvelle table : les versions déjà déployées qui partagent la base l'ignorent.
CREATE TABLE "prospect_capture" (
    "contactId" TEXT NOT NULL,
    "fields" JSONB NOT NULL DEFAULT '{}',
    "sourceId" TEXT,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prospect_capture_pkey" PRIMARY KEY ("contactId")
);

ALTER TABLE "prospect_capture" ADD CONSTRAINT "prospect_capture_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
