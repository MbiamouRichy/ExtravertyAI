-- Projet interne d'ExtravertyAI (support client sur le numéro des codes) :
-- jamais facturé par Polar, quota mensuel géré par le worker de facturation.
ALTER TABLE "project" ADD COLUMN "internal" BOOLEAN NOT NULL DEFAULT false;
