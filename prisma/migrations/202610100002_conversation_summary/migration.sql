CREATE TABLE "conversation_summary" (
  "contactId" TEXT NOT NULL PRIMARY KEY REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "fingerprint" TEXT,
  "summary" JSONB,
  "partial" BOOLEAN NOT NULL DEFAULT false,
  "generatedAt" TIMESTAMPTZ(3),
  "leaseToken" TEXT,
  "leaseUntil" TIMESTAMPTZ(3)
);
