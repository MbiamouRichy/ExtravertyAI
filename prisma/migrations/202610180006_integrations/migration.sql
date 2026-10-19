-- Intégrations : webhooks signés et Google Sheets, alimentés par une file d'envoi (outbox)
CREATE TYPE "IntegrationKind" AS ENUM ('WEBHOOK', 'GOOGLE_SHEETS');
CREATE TYPE "IntegrationDeliveryState" AS ENUM ('QUEUED', 'DELIVERING', 'DELIVERED', 'FAILED');

CREATE TABLE "integration_endpoint" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "IntegrationKind" NOT NULL,
    "name" TEXT NOT NULL CHECK (char_length("name") BETWEEN 1 AND 80),
    "url" TEXT CHECK (char_length("url") <= 2000),
    -- Secrets chiffrés (AES-256-GCM, liés à l'identifiant de l'endpoint).
    "secretCiphertext" TEXT,
    "refreshTokenCiphertext" TEXT,
    "events" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "disabledReason" TEXT,
    "spreadsheetId" TEXT,
    "spreadsheetUrl" TEXT,
    "sheetName" TEXT,
    "googleEmail" TEXT,
    "createdById" TEXT,
    "lastDeliveryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "integration_endpoint_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "integration_endpoint_projectId_idx" ON "integration_endpoint"("projectId");
ALTER TABLE "integration_endpoint" ADD CONSTRAINT "integration_endpoint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_endpoint" ADD CONSTRAINT "integration_endpoint_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "integration_delivery" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "state" "IntegrationDeliveryState" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseToken" UUID,
    "leaseUntil" TIMESTAMP(3),
    "lastStatus" INTEGER,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "integration_delivery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "integration_delivery_state_availableAt_idx" ON "integration_delivery"("state", "availableAt");
CREATE INDEX "integration_delivery_endpointId_createdAt_idx" ON "integration_delivery"("endpointId", "createdAt");
CREATE INDEX "integration_delivery_projectId_createdAt_idx" ON "integration_delivery"("projectId", "createdAt");
ALTER TABLE "integration_delivery" ADD CONSTRAINT "integration_delivery_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_delivery" ADD CONSTRAINT "integration_delivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "integration_endpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
