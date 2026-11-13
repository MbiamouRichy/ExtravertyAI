import type { PrismaClient } from "../src/generated/prisma/client";

/**
 * Projet interne d'ExtravertyAI : le support client, branché sur le numéro qui
 * envoie les codes de vérification.
 *
 * Il n'a ni abonnement Polar ni essai. Pour que l'IA, l'équipe et les envois
 * fonctionnent exactement comme sur un projet payé, il reçoit une vraie période
 * de quota « active », renouvelée chaque mois civil (UTC) par le worker de
 * facturation. Le plafond reste celui de l'offre Business : il borne le coût
 * d'une boucle ou d'un abus, comme pour un client.
 */

const DAY = 86_400_000;
// La période d'un mois déborde de deux jours : la suivante prend le relais
// sans laisser d'instant où le projet n'aurait plus d'accès.
const OVERLAP_MS = 2 * DAY;

export const INTERNAL_PERIOD_PREFIX = "internal:";

export function internalQuotaWindow(projectId: string, now: Date) {
  const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return {
    key: `${INTERNAL_PERIOD_PREFIX}${projectId}:${startsAt.toISOString().slice(0, 7)}`,
    startsAt,
    endsAt: new Date(nextMonth.getTime() + OVERLAP_MS),
  };
}

/**
 * Ouvre la période du mois en cours si besoin. Sans effet sur un projet qui
 * n'est pas interne ou qui est en cours de suppression. Vrai si une période a
 * été ouverte ou ajustée.
 */
export async function ensureInternalQuota(
  db: PrismaClient,
  projectId: string,
  limit: number,
  now = new Date(),
) {
  if (!Number.isSafeInteger(limit) || limit <= 0)
    throw new Error("INTERNAL_MESSAGE_LIMIT_INVALID");
  const window = internalQuotaWindow(projectId, now);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId} FOR UPDATE`;
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { internal: true, deletionPending: true },
    });
    if (!project?.internal || project.deletionPending) return false;
    const current = await tx.quotaPeriod.findFirst({
      where: { projectId, isCurrent: true },
      orderBy: { startsAt: "desc" },
    });
    if (current?.key === window.key && current.limit === limit) return false;
    // Une horloge en retard ne fait jamais revenir au mois précédent.
    if (current && current.startsAt > window.startsAt) return false;
    await tx.quotaPeriod.updateMany({
      where: { projectId, isCurrent: true, key: { not: window.key } },
      data: { isCurrent: false },
    });
    const quota = await tx.quotaPeriod.upsert({
      where: { projectId_key: { projectId, key: window.key } },
      create: {
        projectId,
        key: window.key,
        kind: "active",
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        limit,
      },
      update: { isCurrent: true, endsAt: window.endsAt, limit },
    });
    await tx.project.update({
      where: { id: projectId },
      data: { messageCount: quota.used, allMessagesCount: quota.limit },
    });
    return true;
  });
}

/** Renouvelle les projets internes ; renvoie ceux dont la période a changé. */
export async function renewInternalQuotas(
  db: PrismaClient,
  limit: number,
  now = new Date(),
) {
  const projects = await db.project.findMany({
    where: { internal: true, deletionPending: false },
    select: { id: true },
  });
  const changed: string[] = [];
  for (const { id } of projects)
    if (await ensureInternalQuota(db, id, limit, now)) changed.push(id);
  return changed;
}
