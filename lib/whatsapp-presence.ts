import type { PrismaClient } from "../src/generated/prisma/client";

/** Intervalle de rafraîchissement : WhatsApp retire le statut après un moment d’inactivité. */
export const PRESENCE_REFRESH_MS = 60_000;

/**
 * « Afficher le statut en ligne » : la passerelle n’annonce la présence qu’à la
 * connexion, puis WhatsApp (ou le téléphone) la retire. On la renvoie donc
 * régulièrement pour les numéros connectés qui l’ont demandée.
 * Retourne le nombre de numéros rafraîchis.
 */
export async function refreshOnlinePresence(
  prisma: PrismaClient,
  fetchImpl: typeof fetch = fetch,
) {
  const base = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const key = process.env.EVOLUTION_API_KEY;
  if (!base || !key) return 0;
  const projects = await prisma.project.findMany({
    where: {
      whatsappAlwaysOnline: true,
      instanceStatus: "connected",
      deletionPending: false,
      status: { in: ["active", "trialing"] },
    },
    orderBy: { id: "asc" },
    take: 500,
    select: { instanceName: true },
  });
  let refreshed = 0;
  for (const project of projects) {
    try {
      const response = await fetchImpl(
        `${base}/instance/setPresence/${encodeURIComponent(project.instanceName)}`,
        {
          method: "POST",
          headers: { apikey: key, "Content-Type": "application/json" },
          body: JSON.stringify({ presence: "available" }),
          signal: AbortSignal.timeout(5000),
        },
      );
      if (response.ok) refreshed += 1;
      // Code seul dans les journaux : ni nom d’instance ni clé.
      else console.error("[presence] Rafraîchissement refusé.", { status: response.status });
    } catch {
      console.error("[presence] Passerelle injoignable.");
    }
  }
  return refreshed;
}
