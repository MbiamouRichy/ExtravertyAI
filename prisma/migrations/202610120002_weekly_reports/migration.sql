ALTER TABLE project
 ADD COLUMN "reportsEnabled" BOOLEAN NOT NULL DEFAULT true,
 ADD COLUMN "reportsSkipEmpty" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "reportsIncludeTips" BOOLEAN NOT NULL DEFAULT true,
 ADD COLUMN "reportsHourUtc" INTEGER NOT NULL DEFAULT 8 CHECK ("reportsHourUtc" BETWEEN 0 AND 23),
 ADD COLUMN "reportsVersion" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "reportsCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "project_reportsCheckAt_idx" ON project("reportsCheckAt");
CREATE TABLE weekly_report (
 id TEXT PRIMARY KEY, "projectId" TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
 "weekStart" TIMESTAMP(3) NOT NULL, "weekEnd" TIMESTAMP(3) NOT NULL,
 snapshot JSONB NOT NULL, skipped BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "weekly_report_projectId_weekStart_key" ON weekly_report("projectId", "weekStart");
CREATE TABLE report_email (
 id TEXT PRIMARY KEY, "reportId" TEXT NOT NULL REFERENCES weekly_report(id) ON DELETE CASCADE,
 "recipientId" TEXT NOT NULL, recipient TEXT NOT NULL, "from" TEXT NOT NULL,
 subject TEXT NOT NULL, text TEXT NOT NULL, html TEXT NOT NULL,
 state "BillingEmailState" NOT NULL DEFAULT 'PENDING', attempts INTEGER NOT NULL DEFAULT 0,
 "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "firstAttemptAt" TIMESTAMP(3), "leaseToken" TEXT, "leaseUntil" TIMESTAMP(3),
 "sentAt" TIMESTAMP(3), "providerId" TEXT
);
CREATE UNIQUE INDEX "report_email_reportId_recipientId_key" ON report_email("reportId", "recipientId");
CREATE INDEX "report_email_state_availableAt_idx" ON report_email(state, "availableAt");
CREATE INDEX "message_projectId_createdAt_idx" ON message("projectId", "createdAt");
