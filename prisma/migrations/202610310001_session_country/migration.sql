-- Pays de connexion (code ISO à deux lettres), affiché à la place de l'adresse IP.
ALTER TABLE "session" ADD COLUMN "country" TEXT;
