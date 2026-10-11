import type { PrismaClient } from "../src/generated/prisma/client";
export type PresenceStatus = "online" | "idle" | "offline";
export async function heartbeat(
  db: PrismaClient,
  userId: string,
  tabId: string,
  active: boolean,
) {
  await db.$executeRaw`
    INSERT INTO user_presence ("userId", "tabId", "lastSeenAt", "lastActiveAt")
    VALUES (${userId}, ${tabId}, NOW(), CASE WHEN ${active} THEN NOW() ELSE NULL END)
    ON CONFLICT ("userId", "tabId") DO UPDATE SET "lastSeenAt" = NOW(),
      "lastActiveAt" = CASE WHEN ${active} THEN NOW() ELSE user_presence."lastActiveAt" END
  `;
  await db.$executeRaw`DELETE FROM user_presence WHERE "userId" = ${userId} AND "lastSeenAt" < NOW() - INTERVAL '1 day'`;
}
export async function projectPresence(
  db: PrismaClient,
  projectId: string,
  viewerId: string,
) {
  return db.$queryRaw<{ userId: string; status: PresenceStatus }[]>`
    SELECT pm."userId", CASE
      WHEN bool_or(up."lastSeenAt" > NOW() - INTERVAL '90 seconds' AND up."lastActiveAt" > NOW() - INTERVAL '2 minutes') THEN 'online'
      WHEN bool_or(up."lastSeenAt" > NOW() - INTERVAL '90 seconds') THEN 'idle'
      ELSE 'offline' END AS status
    FROM project_membership pm
    LEFT JOIN user_presence up ON up."userId" = pm."userId"
    WHERE pm."projectId" = ${projectId} AND EXISTS (
      SELECT 1 FROM project_membership viewer WHERE viewer."projectId" = pm."projectId" AND viewer."userId" = ${viewerId}
    )
    GROUP BY pm."userId"
  `;
}
