-- Mise en veille de l'IA en fin de conversation (activée par défaut)
ALTER TABLE "project" ADD COLUMN "aiQuietEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "contact" ADD COLUMN "aiQuietSince" TIMESTAMP(3);

-- Messages client restés volontairement sans réponse de l'IA
CREATE TYPE "AiSkipReason" AS ENUM ('QUIET_ACK', 'SILENCE', 'REPEATED', 'MERGED');
ALTER TABLE "message" ADD COLUMN "aiSkip" "AiSkipReason";
-- Compteur « réponses évitées » de l'analytique : seules ces lignes sont indexées.
CREATE INDEX "message_projectId_createdAt_aiSkip_idx" ON "message"("projectId", "createdAt") WHERE "aiSkip" IS NOT NULL;

-- Journal : « L'IA s'est mise en veille », « L'IA reprend »
ALTER TYPE "ContactEventType" ADD VALUE 'AI_QUIET';
ALTER TYPE "ContactEventType" ADD VALUE 'AI_WOKEN';
