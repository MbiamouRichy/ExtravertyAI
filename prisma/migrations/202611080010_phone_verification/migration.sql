-- Vérification du numéro WhatsApp par code, avant l'enregistrement d'un projet.
ALTER TABLE "project" ADD COLUMN "numeroVerifiedAt" TIMESTAMP(3);

CREATE TABLE "phone_verification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "numberHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_verification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "phone_verification_userId_createdAt_idx" ON "phone_verification"("userId", "createdAt");
CREATE INDEX "phone_verification_numberHash_createdAt_idx" ON "phone_verification"("numberHash", "createdAt");
CREATE INDEX "phone_verification_projectId_idx" ON "phone_verification"("projectId");

ALTER TABLE "phone_verification" ADD CONSTRAINT "phone_verification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "phone_verification" ADD CONSTRAINT "phone_verification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
