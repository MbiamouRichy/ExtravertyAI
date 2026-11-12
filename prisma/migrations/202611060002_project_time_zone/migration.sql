-- Fuseau horaire de l'activité : les diffusions partent entre 8 h et 20 h dans ce fuseau.
-- Les projets existants gardent le fuseau utilisé jusqu'ici.
ALTER TABLE "project" ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'Africa/Libreville';
