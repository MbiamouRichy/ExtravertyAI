-- Photo de profil WhatsApp des prospects, copiée dans le stockage du projet.
ALTER TABLE "contact" ADD COLUMN "avatarKey" TEXT;
ALTER TABLE "contact" ADD COLUMN "avatarCheckedAt" TIMESTAMP(3);
