-- Version des événements du webhook Evolution ; 2 ajoute la présence des contacts.
ALTER TABLE "project" ADD COLUMN "webhookEventsVersion" INTEGER NOT NULL DEFAULT 1;
