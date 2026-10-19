-- Questionnaire de satisfaction envoyé à la résolution (désactivé par défaut)
ALTER TABLE "project" ADD COLUMN "csatEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "project" ADD COLUMN "csatMessage" TEXT NOT NULL
  DEFAULT 'Merci pour votre échange avec nous ! Comment évaluez-vous notre service ? Répondez par un chiffre de 1 (pas satisfait) à 5 (très satisfait).'
  CHECK (char_length("csatMessage") BETWEEN 10 AND 500);

CREATE TABLE "csat_survey" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    -- Message envoyé au client ; conservé même si le message est supprimé.
    "messageId" TEXT,
    "resolvedById" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "score" INTEGER CHECK ("score" BETWEEN 1 AND 5),
    "respondedAt" TIMESTAMP(3),
    "responseMessageId" TEXT,
    CONSTRAINT "csat_survey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "csat_survey_messageId_key" ON "csat_survey"("messageId");
CREATE INDEX "csat_survey_contactId_expiresAt_idx" ON "csat_survey"("contactId", "expiresAt");
CREATE INDEX "csat_survey_projectId_sentAt_idx" ON "csat_survey"("projectId", "sentAt");
ALTER TABLE "csat_survey" ADD CONSTRAINT "csat_survey_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "csat_survey" ADD CONSTRAINT "csat_survey_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "csat_survey" ADD CONSTRAINT "csat_survey_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "csat_survey" ADD CONSTRAINT "csat_survey_responseMessageId_fkey" FOREIGN KEY ("responseMessageId") REFERENCES "message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "csat_survey" ADD CONSTRAINT "csat_survey_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
