CREATE TABLE account_deletion_record (
 id TEXT PRIMARY KEY,
 "emailHash" TEXT NOT NULL,
 "projectsDeleted" INTEGER NOT NULL,
 "projectsLeft" INTEGER NOT NULL,
 "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "account_deletion_record_emailHash_idx" ON account_deletion_record("emailHash");
CREATE TABLE account_deletion_feedback (
 id TEXT PRIMARY KEY,
 "tokenHash" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 reason TEXT,
 comment TEXT CHECK (char_length(comment) <= 500),
 "submittedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "account_deletion_feedback_tokenHash_key" ON account_deletion_feedback("tokenHash");
CREATE INDEX "account_deletion_feedback_expiresAt_idx" ON account_deletion_feedback("expiresAt");
