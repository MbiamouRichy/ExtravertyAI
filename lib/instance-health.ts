import type { PrismaClient } from "../src/generated/prisma/client";
import {
  WhatsAppDisconnectedEmail,
  whatsAppDisconnectedText,
} from "../components/emailTemplate/whatsappDisconnectedEmail";
import { rolesWith } from "./project-permissions";

/** Intervalle entre deux vérifications de l’état réel des numéros. */
export const INSTANCE_CHECK_MS = 2 * 60_000;

export type DisconnectionEmail = {
  /** Même clé pour une même alerte : un nouvel essai n’envoie pas de doublon. */
  idempotencyKey: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};

type Db = Pick<PrismaClient, "project" | "projectMembership">;
type ProjectRef = { id: string; name: string; instanceName: string };

/**
 * L’état « connecté » vient du webhook d’Evolution. Quand ce webhook se perd
 * (site injoignable, DNS en cours de changement, passerelle redémarrée),
 * l’application croit WhatsApp relié alors que plus rien n’arrive, et personne
 * n’est prévenu. Ce contrôle redemande donc l’état à Evolution :
 *
 * - un numéro marqué connecté mais fermé chez Evolution à deux passages de
 *   suite passe à « déconnecté » (une reconnexion de quelques secondes
 *   n’alerte personne) ;
 * - chaque déconnexion, constatée ici ou apprise par le webhook depuis le
 *   passage précédent, est signalée une fois par e-mail aux administrateurs.
 *
 * Seule la déconnexion est décidée ici : une connexion reste confirmée par le
 * webhook ou par l’utilisateur, avec les contrôles de l’essai.
 */
export function createInstanceHealthMonitor({
  db,
  fetchImpl = fetch,
  sendEmail,
  now = () => new Date(),
  env = process.env,
}: {
  db: Db;
  fetchImpl?: typeof fetch;
  sendEmail?: (email: DisconnectionEmail) => Promise<void>;
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
}) {
  let suspects = new Set<string>();
  // Inconnu au démarrage : aucune alerte pour un numéro déjà déconnecté avant.
  let lastConnected: Set<string> | null = null;

  return async function checkInstances() {
    const base = env.EVOLUTION_API_URL?.replace(/\/+$/, "");
    const key = env.EVOLUTION_API_KEY;
    if (!base || !key) return { demoted: [] as string[], alerted: [] as string[] };

    async function stateOf(instanceName: string) {
      const response = await fetchImpl(
        `${base}/instance/connectionState/${encodeURIComponent(instanceName)}`,
        {
          headers: { apikey: key! },
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        },
      );
      // Code seul dans les journaux : ni nom d’instance ni clé.
      if (!response.ok) {
        console.error("[instance-health] État refusé.", { status: response.status });
        return null;
      }
      const data = (await response.json().catch(() => null)) as {
        instance?: { state?: unknown };
      } | null;
      const state = data?.instance?.state;
      return typeof state === "string" ? state.toLowerCase() : null;
    }

    const connected: ProjectRef[] = await db.project.findMany({
      where: { instanceStatus: "connected", deletionPending: false },
      orderBy: { id: "asc" },
      take: 500,
      select: { id: true, name: true, instanceName: true },
    });
    const nextSuspects = new Set<string>();
    const demoted: string[] = [];
    const toAlert: ProjectRef[] = [];
    try {
      for (const project of connected) {
        const checkedAt = now();
        if ((await stateOf(project.instanceName)) !== "close") continue;
        if (!suspects.has(project.id)) {
          nextSuspects.add(project.id);
          continue;
        }
        // Rien n’est écrasé si le projet a changé pendant la vérification
        // (un webhook « open » arrivé entre-temps, par exemple).
        const { count } = await db.project.updateMany({
          where: {
            id: project.id,
            instanceName: project.instanceName,
            instanceStatus: "connected",
            updatedAt: { lte: checkedAt },
          },
          data: { instanceStatus: "disconnected" },
        });
        if (count) {
          demoted.push(project.id);
          toAlert.push(project);
        }
      }
      // Déconnexions apprises par le webhook depuis le passage précédent :
      // signalées si Evolution confirme que le numéro est bien fermé.
      if (lastConnected) {
        const stillConnected = new Set(connected.map(({ id }) => id));
        const dropped = [...lastConnected].filter((id) => !stillConnected.has(id));
        if (dropped.length) {
          const projects = await db.project.findMany({
            where: {
              id: { in: dropped },
              instanceStatus: "disconnected",
              deletionPending: false,
            },
            select: { id: true, name: true, instanceName: true },
          });
          for (const project of projects)
            if ((await stateOf(project.instanceName)) === "close")
              toAlert.push(project);
        }
      }
    } catch {
      // Passerelle injoignable : on ne conclut rien, on réessaie au prochain passage.
      console.error("[instance-health] Passerelle injoignable.");
      return { demoted, alerted: [] as string[] };
    }
    suspects = nextSuspects;
    lastConnected = new Set(
      connected.map(({ id }) => id).filter((id) => !demoted.includes(id)),
    );

    const alerted: string[] = [];
    if (sendEmail)
      for (const project of toAlert)
        if (await alertAdmins(project)) alerted.push(project.id);
    return { demoted, alerted };

    async function alertAdmins(project: ProjectRef) {
      const origin = appOrigin(env);
      if (!origin) {
        console.error("[instance-health] Adresse de l’application manquante.");
        return false;
      }
      const reconnectUrl = `${origin}/projects/${project.id}/chat`;
      const members = await db.projectMembership.findMany({
        where: { projectId: project.id, role: { in: rolesWith("project.manage") } },
        orderBy: { id: "asc" },
        take: 20,
        select: { id: true, user: { select: { email: true } } },
      });
      const html = WhatsAppDisconnectedEmail({ projectName: project.name, reconnectUrl });
      const text = whatsAppDisconnectedText(project.name, reconnectUrl);
      const minute = now().toISOString().slice(0, 16);
      let sent = false;
      for (const member of members) {
        if (!member.user.email) continue;
        try {
          await sendEmail!({
            idempotencyKey: `whatsapp-disconnected/${project.id}/${member.id}/${minute}`,
            to: member.user.email,
            subject: `WhatsApp déconnecté : ${project.name}`,
            html,
            text,
          });
          sent = true;
        } catch {
          console.error("[instance-health] Alerte non envoyée.");
        }
      }
      return sent;
    }
  };
}

function appOrigin(env: NodeJS.ProcessEnv) {
  try {
    const url = new URL(env.NEXT_PUBLIC_APP_URL ?? "");
    if (url.username || url.password) return null;
    if (url.protocol === "https:") return url.origin;
    return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)
      ? url.origin
      : null;
  } catch {
    return null;
  }
}
