-- Mesure d'audience interne du back-office, sans cookie ni adresse IP.
CREATE TABLE "page_view" (
    "id" TEXT NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "country" TEXT,
    "browser" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "referrerHost" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_view_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "page_view_createdAt_idx" ON "page_view"("createdAt");
CREATE INDEX "page_view_createdAt_visitorHash_idx" ON "page_view"("createdAt", "visitorHash");
