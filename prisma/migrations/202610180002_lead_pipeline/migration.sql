-- Pipeline commercial : étape, montant et auteur du dernier déplacement manuel
CREATE TYPE "PipelineStage" AS ENUM ('NEW', 'INTERESTED', 'QUOTE_SENT', 'WON', 'LOST');

ALTER TABLE "contact" ADD COLUMN "pipelineStage" "PipelineStage" NOT NULL DEFAULT 'NEW';
-- Montant dans l'unité mineure de la devise du projet (XAF n'a pas de décimales).
ALTER TABLE "contact" ADD COLUMN "dealValue" INTEGER CHECK ("dealValue" BETWEEN 0 AND 2000000000);
ALTER TABLE "contact" ADD COLUMN "stageChangedAt" TIMESTAMP(3);
-- Renseigné uniquement par un déplacement manuel : Instinct IA ne le contredit jamais.
ALTER TABLE "contact" ADD COLUMN "stageChangedById" TEXT;
ALTER TABLE "contact" ADD CONSTRAINT "contact_stageChangedById_fkey" FOREIGN KEY ("stageChangedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "contact_projectId_pipelineStage_idx" ON "contact"("projectId", "pipelineStage");

ALTER TABLE "project" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'XAF' CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TYPE "ContactEventType" ADD VALUE 'STAGE_CHANGED';
