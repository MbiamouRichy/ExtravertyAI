CREATE TABLE user_presence (
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "tabId" TEXT NOT NULL,
  "lastSeenAt" TIMESTAMPTZ(3) NOT NULL,
  "lastActiveAt" TIMESTAMPTZ(3),
  PRIMARY KEY ("userId", "tabId")
);
CREATE INDEX "user_presence_lastSeenAt_idx" ON user_presence ("lastSeenAt");
CREATE TABLE notification_receipt (
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  key TEXT NOT NULL,
  version TEXT NOT NULL,
  "readAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", key)
);
