-- Pendant l'essai, seul le numéro de test enregistré échange avec le projet.
ALTER TABLE "project" ADD COLUMN "trialTestNumber" TEXT;
ALTER TABLE "project" ADD COLUMN "trialTestJid" TEXT;
ALTER TABLE "project" ADD COLUMN "trialTestNumberChanges" INTEGER NOT NULL DEFAULT 0;
