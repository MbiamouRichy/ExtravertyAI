-- Indicateur du temps d'attente des clients dans la messagerie (activé par défaut)
ALTER TABLE "project" ADD COLUMN "showWaitingTime" BOOLEAN NOT NULL DEFAULT true;
