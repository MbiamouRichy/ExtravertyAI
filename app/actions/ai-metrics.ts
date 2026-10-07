import "server-only";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import type { ResponseSample } from "@/lib/ai-response-metrics";
export async function getAiResponseTimeData(
  projectId: string,
): Promise<{ samples: ResponseSample[]; now: string; error: boolean }> {
  const now = new Date();
  const empty = { samples: [], now: now.toISOString(), error: true };
  const session = await getSession();
  if (!session?.user?.id) return empty;
  const member = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
    select: { role: true },
  });
  if (!member || !["OWNER", "ADMIN"].includes(member.role)) return empty;
  try {
    // Correlate the actual client request and accepted outbound, not adjacent messages.
    const rows = await prisma.$queryRaw<
      Array<{ receivedAt: Date; sentAt: Date }>
    >`SELECT m."createdAt" AS "receivedAt", o."finishedAt" AS "sentAt"
       FROM ai_job a JOIN message m ON m.id = a."messageId" AND m."projectId" = a."projectId"
       JOIN outbound_job o ON o."projectId" = a."projectId" AND o."requestId" = a."requestId"
       WHERE a."projectId" = ${projectId} AND o.state = 'ACCEPTED'
       AND o."finishedAt" >= ${new Date(now.getTime() - 8 * 86400000)}
       AND o."finishedAt" <= ${now} AND o."finishedAt" >= m."createdAt"
       ORDER BY o."finishedAt"`;
    return {
      samples: rows.map((row) => ({
        receivedAt: row.receivedAt.toISOString(),
        sentAt: row.sentAt.toISOString(),
      })),
      now: now.toISOString(),
      error: false,
    };
  } catch {
    return empty;
  }
}
