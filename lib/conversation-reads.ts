import type { PrismaClient } from "../src/generated/prisma/client";

export async function conversationUnreadCounts(
  prisma: PrismaClient,
  projectId: string,
  userId: string,
  contactIds: string[],
) {
  if (!contactIds.length) return new Map<string, number>();
  const rows = await prisma.$queryRaw<
    Array<{ contactId: string; count: number }>
  >`
    SELECT m."contactId", COUNT(*)::int AS count
    FROM message m
    JOIN project_membership pm ON pm."projectId" = m."projectId" AND pm."userId" = ${userId}
    LEFT JOIN conversation_read_state r ON r."membershipId" = pm.id AND r."contactId" = m."contactId"
    WHERE m."projectId" = ${projectId} AND m."contactId" = ANY(${contactIds}::text[])
      AND m."senderType" = 'CLIENT' AND m."fromMe" = false
      AND (r."lastReadAt" IS NULL OR (m."createdAt", m.id) > (r."lastReadAt", r."lastReadId"))
    GROUP BY m."contactId"
  `;
  return new Map(rows.map((row) => [row.contactId, row.count]));
}

// The server resolves the membership and cursor. Repeated/out-of-order requests
// never decrease the read position and cannot touch another project's messages.
export async function markConversationRead(
  prisma: PrismaClient,
  projectId: string,
  userId: string,
  contactId: string,
  messageId: string,
) {
  return prisma.$executeRaw`
    INSERT INTO conversation_read_state ("membershipId", "contactId", "lastReadAt", "lastReadId")
    SELECT pm.id, m."contactId", m."createdAt", m.id
    FROM message m
    JOIN contact c ON c.id = m."contactId" AND c."projectId" = m."projectId"
    JOIN project_membership pm ON pm."projectId" = m."projectId" AND pm."userId" = ${userId}
    WHERE m.id = ${messageId} AND m."contactId" = ${contactId} AND m."projectId" = ${projectId}
    ON CONFLICT ("membershipId", "contactId") DO UPDATE
      SET "lastReadAt" = EXCLUDED."lastReadAt", "lastReadId" = EXCLUDED."lastReadId"
    WHERE (conversation_read_state."lastReadAt", conversation_read_state."lastReadId")
      <= (EXCLUDED."lastReadAt", EXCLUDED."lastReadId")
  `;
}

export async function unreadConversationCount(
  prisma: PrismaClient,
  projectId: string,
  userId: string,
  query: string,
  filter: string,
  tagId?: string,
) {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(DISTINCT m."contactId")::int AS count
    FROM message m
    JOIN contact c ON c.id = m."contactId" AND c."projectId" = m."projectId"
    JOIN project_membership pm ON pm."projectId" = m."projectId" AND pm."userId" = ${userId}
    LEFT JOIN conversation_read_state r ON r."membershipId" = pm.id AND r."contactId" = m."contactId"
    WHERE m."projectId" = ${projectId} AND m."senderType" = 'CLIENT' AND m."fromMe" = false
      AND (r."lastReadAt" IS NULL OR (m."createdAt", m.id) > (r."lastReadAt", r."lastReadId"))
      AND (${filter} = 'all'
        OR (${filter} = 'resolved' AND c."resolvedAt" IS NOT NULL)
        OR (${filter} IN ('ai', 'manual') AND c."resolvedAt" IS NULL AND c."aiActive" = ${filter === "ai"}))
      AND (${tagId ?? null}::text IS NULL OR EXISTS (
        SELECT 1 FROM contact_tag ct JOIN tag t ON t.id = ct."tagId"
        WHERE ct."contactId" = c.id AND t."projectId" = c."projectId" AND t.id = ${tagId ?? null}))
      AND (${query} = '' OR strpos(lower(coalesce(c.name, '')), lower(${query})) > 0
        OR strpos(lower(coalesce(c."pushName", '')), lower(${query})) > 0)
  `;
  return rows[0]?.count ?? 0;
}
