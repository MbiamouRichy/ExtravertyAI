-- Compteurs des limites de débit de l'authentification (Better Auth), partagés
-- par toutes les instances : en mémoire, chaque instance comptait à part.
CREATE TABLE "rate_limit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "rate_limit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rate_limit_key_key" ON "rate_limit"("key");
-- Purge des compteurs expirés.
CREATE INDEX "rate_limit_lastRequest_idx" ON "rate_limit"("lastRequest");
