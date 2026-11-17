-- Fiche de l'entreprise remplie au début de la configuration de l'assistant.
-- Colonne facultative, sans valeur par défaut : les versions déjà déployées qui
-- partagent la base l'ignorent.
ALTER TABLE "project" ADD COLUMN "businessProfile" JSONB;
