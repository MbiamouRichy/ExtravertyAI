-- Vérification inversée : le client envoie lui-même le code depuis son WhatsApp.
CREATE TYPE "PhoneVerificationDirection" AS ENUM ('OUTBOUND', 'INBOUND');

ALTER TABLE "phone_verification" ADD COLUMN "direction" "PhoneVerificationDirection" NOT NULL DEFAULT 'OUTBOUND';
