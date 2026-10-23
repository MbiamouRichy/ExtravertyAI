import type { PrismaClient } from "../src/generated/prisma/client";
import { chatContactName } from "./chat-privacy";
import type { AppNotification, NotificationFeed } from "./notification-types";

export async function notificationFeed(
  db: PrismaClient,
  userId: string,
): Promise<NotificationFeed> {
  const messages = await db.$queryRaw<
    {
      id: string;
      contactId: string;
      projectId: string;
      projectName: string;
      name: string | null;
      pushName: string | null;
      createdAt: Date;
      read: boolean;
    }[]
  >`
    SELECT m.id, m."contactId", p.id AS "projectId", p.name AS "projectName", c.name, c."pushName", m."createdAt",
      COALESCE((m."createdAt", m.id) <= (r."lastReadAt", r."lastReadId"), false) AS read
    FROM project_membership pm
    JOIN project p ON p.id = pm."projectId" AND NOT p."deletionPending"
    JOIN contact c ON c."projectId" = p.id
    JOIN LATERAL (
      SELECT id, "contactId", "createdAt" FROM message
      WHERE "contactId" = c.id AND "projectId" = p.id AND "senderType" = 'CLIENT' AND "fromMe" = false
        AND "createdAt" >= pm."createdAt" AND "createdAt" > NOW() - INTERVAL '30 days'
      ORDER BY "createdAt" DESC, id DESC LIMIT 1
    ) m ON true
    LEFT JOIN conversation_read_state r ON r."contactId" = c.id AND r."membershipId" = pm.id
    WHERE pm."userId" = ${userId}
    ORDER BY m."createdAt" DESC, m.id DESC LIMIT 51
  `;
  const projects = await db.$queryRaw<
    {
      id: string;
      name: string;
      role: string;
      instanceStatus: string;
      status: string;
      quotaId: string | null;
      used: number | null;
      limit: number | null;
      endsAt: Date | null;
    }[]
  >`
    SELECT p.id, p.name, pm.role::text, p."instanceStatus"::text,
      CASE WHEN p."automationPaused" THEN COALESCE(p."statusBeforePause"::text, p.status::text) ELSE p.status::text END AS status,
      q.id AS "quotaId", q.used, q."limit", q."endsAt"
    FROM project_membership pm JOIN project p ON p.id = pm."projectId"
    LEFT JOIN LATERAL (SELECT id, used, "limit", "endsAt" FROM quota_period WHERE "projectId" = p.id AND "isCurrent" ORDER BY "startsAt" DESC LIMIT 1) q ON true
    WHERE pm."userId" = ${userId} AND NOT p."deletionPending" AND p."agentSetupCompletedAt" IS NOT NULL
    ORDER BY p.id LIMIT 101
  `;
  const items: AppNotification[] = [];
  for (const p of projects.slice(0, 100)) {
    const admin = p.role === "ADMIN" || p.role === "OWNER";
    function alert(
      code: string,
      version: string,
      title: string,
      description: string,
      href: string,
    ) {
      items.push({
        key: code + ":" + p.id,
        version,
        projectName: p.name,
        title,
        description,
        href,
        kind: "alert",
        date: null,
        read: false,
      });
    }
    if (p.instanceStatus !== "connected")
      alert(
        "connection",
        p.instanceStatus,
        "WhatsApp à reconnecter",
        admin
          ? "Reconnectez WhatsApp pour reprendre les échanges."
          : "Un administrateur doit reconnecter WhatsApp.",
        "/projects/" + p.id + "/chat",
      );
    if (
      admin &&
      (!["active", "trialing"].includes(p.status) ||
        !p.endsAt ||
        p.endsAt <= new Date())
    ) {
      alert(
        "billing",
        p.status + ":" + (p.quotaId ?? "none"),
        "Abonnement à vérifier",
        "Vérifiez la période d’accès et le paiement de ce projet.",
        "/projects/" + p.id + "/billing",
      );
    } else if (admin && p.limit && p.used !== null && p.used / p.limit >= 0.8) {
      alert(
        "quota",
        (p.quotaId ?? "") + ":" + (p.used >= p.limit ? "exhausted" : "warning"),
        p.used >= p.limit ? "Quota atteint" : "Quota bientôt atteint",
        p.used + " messages utilisés sur " + p.limit + ".",
        "/projects/" + p.id + "/billing",
      );
    }
  }
  items.push(
    ...messages.slice(0, 50).map((m) => ({
      key: "message:" + m.contactId,
      version: m.id,
      projectName: m.projectName,
      title: "Message de " + chatContactName(m),
      description: "Ouvrir la conversation pour consulter les messages.",
      href:
        "/projects/" +
        m.projectId +
        "/chat?contactId=" +
        encodeURIComponent(m.contactId),
      kind: "message" as const,
      date: m.createdAt.toISOString(),
      read: m.read,
    })),
  );
  // Conversations confiées par un autre membre et encore ouvertes.
  const assignments = await db.$queryRaw<
    {
      contactId: string;
      projectId: string;
      projectName: string;
      name: string | null;
      pushName: string | null;
      assignedAt: Date;
      assignerName: string | null;
    }[]
  >`
    SELECT c.id AS "contactId", p.id AS "projectId", p.name AS "projectName", c.name, c."pushName",
      c."assignedAt", u.name AS "assignerName"
    FROM contact c
    JOIN project p ON p.id = c."projectId" AND NOT p."deletionPending"
    JOIN project_membership pm ON pm."projectId" = p.id AND pm."userId" = ${userId}
    LEFT JOIN "user" u ON u.id = c."assignedById"
    WHERE c."assigneeId" = ${userId} AND c."assignedById" IS DISTINCT FROM ${userId}
      AND c."resolvedAt" IS NULL AND c."assignedAt" > NOW() - INTERVAL '30 days'
    ORDER BY c."assignedAt" DESC LIMIT 20
  `;
  items.push(
    ...assignments.map((a) => ({
      key: "assigned:" + a.contactId,
      version: a.assignedAt.toISOString(),
      projectName: a.projectName,
      title: "Conversation assignée : " + chatContactName(a),
      description:
        (a.assignerName?.trim().split(/\s+/)[0] || "Un membre") +
        " vous a confié cette conversation.",
      href:
        "/projects/" +
        a.projectId +
        "/chat?contactId=" +
        encodeURIComponent(a.contactId),
      kind: "message" as const,
      date: a.assignedAt.toISOString(),
      read: false,
    })),
  );
  // Prospects chauds dont l’IA a clos l’échange : une relance humaine peut conclure.
  const quietLeads = await db.$queryRaw<
    {
      contactId: string;
      projectId: string;
      projectName: string;
      name: string | null;
      pushName: string | null;
      aiQuietSince: Date;
    }[]
  >`
    SELECT c.id AS "contactId", p.id AS "projectId", p.name AS "projectName", c.name, c."pushName",
      c."aiQuietSince"
    FROM contact c
    JOIN project p ON p.id = c."projectId" AND NOT p."deletionPending"
    JOIN project_membership pm ON pm."projectId" = p.id AND pm."userId" = ${userId}
    WHERE c."aiQuietSince" > NOW() - INTERVAL '7 days' AND c."aiActive" AND c."resolvedAt" IS NULL
      AND c."pipelineStage" IN ('INTERESTED', 'QUOTE_SENT')
      AND (c."assigneeId" IS NULL OR c."assigneeId" = ${userId})
    ORDER BY c."aiQuietSince" DESC LIMIT 20
  `;
  items.push(
    ...quietLeads.map((lead) => ({
      key: "quiet:" + lead.contactId,
      version: lead.aiQuietSince.toISOString(),
      projectName: lead.projectName,
      title: "Prospect à relancer : " + chatContactName(lead),
      description: "L’IA a clos l’échange. Une relance de votre part peut conclure la vente.",
      href:
        "/projects/" +
        lead.projectId +
        "/chat?contactId=" +
        encodeURIComponent(lead.contactId),
      kind: "message" as const,
      date: lead.aiQuietSince.toISOString(),
      read: false,
    })),
  );
  const receipts = await db.$queryRaw<
    { key: string; version: string; dismissedVersion: string | null }[]
  >`SELECT key, version, "dismissedVersion" FROM notification_receipt WHERE "userId" = ${userId}`;
  const seen = new Map(receipts.map((r) => [r.key, r.version]));
  const dismissed = new Map(receipts.map((r) => [r.key, r.dismissedVersion]));
  for (const item of items) item.read ||= seen.get(item.key) === item.version;
  // Supprimée par l’utilisateur : masquée tant qu’aucun nouvel événement ne la change.
  const kept = items.filter(
    (item) => item.kind === "alert" || dismissed.get(item.key) !== item.version,
  );
  items.length = 0;
  items.push(...kept);
  items.sort(
    (a, b) =>
      Number(a.read) - Number(b.read) ||
      Number(b.kind === "alert") - Number(a.kind === "alert") ||
      (b.date ?? "").localeCompare(a.date ?? ""),
  );
  return {
    items: items.slice(0, 50),
    limited: items.length > 50 || messages.length > 50 || projects.length > 100,
  };
}
export async function readNotifications(
  db: PrismaClient,
  userId: string,
  requested: { key: string; version: string }[],
) {
  const feed = await notificationFeed(db, userId);
  // Resolve current, authorized versions server-side. A concurrent new message stays unread.
  const accepted = requested.filter((r) =>
    feed.items.some((item) => item.key === r.key && item.version === r.version),
  );
  for (const item of accepted) {
    await db.$executeRaw`INSERT INTO notification_receipt ("userId", key, version) VALUES (${userId}, ${item.key}, ${item.version})
      ON CONFLICT ("userId", key) DO UPDATE SET version = EXCLUDED.version, "readAt" = NOW()`;
  }
}

/**
 * Supprime des notifications pour cet utilisateur (glissement latéral). Seules
 * les versions présentes dans son flux autorisé sont acceptées ; les alertes
 * en cours (WhatsApp à reconnecter…) restent jusqu’à leur résolution.
 */
export async function dismissNotifications(
  db: PrismaClient,
  userId: string,
  requested: { key: string; version: string }[],
) {
  const feed = await notificationFeed(db, userId);
  const accepted = requested.filter((r) =>
    feed.items.some(
      (item) =>
        item.kind !== "alert" && item.key === r.key && item.version === r.version,
    ),
  );
  for (const item of accepted) {
    await db.$executeRaw`INSERT INTO notification_receipt ("userId", key, version, "dismissedVersion")
      VALUES (${userId}, ${item.key}, ${item.version}, ${item.version})
      ON CONFLICT ("userId", key) DO UPDATE SET version = EXCLUDED.version,
        "dismissedVersion" = EXCLUDED."dismissedVersion", "readAt" = NOW()`;
  }
  return accepted.length;
}
