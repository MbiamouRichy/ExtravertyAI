import "server-only";

import type { PrismaClient } from "../src/generated/prisma/client";
import { getChatPusher, projectChatChannel } from "./chat-realtime";
import {
  CONTACT_PRESENCE_EVENT,
  parsePresenceUpdate,
  type ContactPresence,
} from "./contact-presence-shared";

/** Événements demandés à la passerelle ; incrémenter la version après un ajout. */
export const EVOLUTION_WEBHOOK_EVENTS = [
  "CONNECTION_UPDATE",
  "MESSAGES_UPSERT",
  "MESSAGES_UPDATE",
  "PRESENCE_UPDATE",
] as const;
/**
 * Version du webhook attendue : 2 = événements de présence ; 3 = adresse avec
 * le jeton Vercel. Sans jeton configuré on s’arrête à 2, pour que l’ajout du
 * jeton plus tard déclenche encore la mise à jour.
 */
export function webhookEventsVersion() {
  return process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? 3 : 2;
}

/**
 * Adresse du webhook Evolution. Sur un déploiement protégé (Vercel
 * Authentication), le jeton « Protection Bypass for Automation » laisse passer
 * la passerelle ; sans lui, Vercel répond 401 et aucun message n’arrive.
 */
export function evolutionWebhookUrl() {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (!secret || !appUrl) return null;
  const url = new URL(`${appUrl}/api/webhooks/evolution`);
  url.searchParams.set("secret", secret);
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypass) url.searchParams.set("x-vercel-protection-bypass", bypass);
  return url.toString();
}

function evolutionConfig() {
  const base = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const key = process.env.EVOLUTION_API_KEY;
  return base && key ? { base, key } : null;
}

/**
 * Relaie un `presence.update` : seuls l’identifiant interne du contact et son
 * état partent vers le navigateur, jamais le numéro.
 */
export async function relayPresenceUpdate(
  prisma: PrismaClient,
  projectId: string,
  data: unknown,
) {
  const updates = parsePresenceUpdate(data);
  if (!updates.length) return 0;
  const contacts = await prisma.contact.findMany({
    where: { projectId, remoteJid: { in: updates.map((u) => u.remoteJid) } },
    select: { id: true, remoteJid: true },
  });
  let sent = 0;
  for (const contact of contacts) {
    const presence = updates.find(
      (u) => u.remoteJid === contact.remoteJid,
    )?.presence;
    if (!presence) continue;
    await notifyContactPresence(projectId, contact.id, presence);
    sent += 1;
  }
  return sent;
}

async function notifyContactPresence(
  projectId: string,
  contactId: string,
  presence: ContactPresence,
) {
  try {
    await getChatPusher().trigger(
      projectChatChannel(projectId),
      CONTACT_PRESENCE_EVENT,
      {
        contactId,
        presence,
      },
    );
  } catch {
    console.error("[presence] Statut du contact non publié.");
  }
}

/**
 * WhatsApp n’envoie la présence d’un contact qu’aux comptes abonnés.
 * L’état « paused » abonne sans rien montrer au prospect.
 */
export async function subscribeContactPresence(
  instanceName: string,
  remoteJid: string,
  fetchImpl: typeof fetch = fetch,
) {
  const config = evolutionConfig();
  if (!config) throw new Error("EVOLUTION_CONFIG_MISSING");
  const number = remoteJid.endsWith("@lid")
    ? remoteJid
    : remoteJid.split("@")[0];
  const response = await fetchImpl(
    `${config.base}/chat/sendPresence/${encodeURIComponent(instanceName)}`,
    {
      method: "POST",
      headers: { apikey: config.key, "Content-Type": "application/json" },
      body: JSON.stringify({ number, presence: "paused", delay: 0 }),
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!response.ok) throw new Error(`PRESENCE_HTTP_${response.status}`);
}

/** Met à jour les événements du webhook d’un numéro déjà connecté (une seule fois). */
export async function upgradeWebhookEvents(
  prisma: PrismaClient,
  project: { id: string; instanceName: string; webhookEventsVersion: number },
  fetchImpl: typeof fetch = fetch,
) {
  const target = webhookEventsVersion();
  if (project.webhookEventsVersion >= target) return;
  const config = evolutionConfig();
  const webhookUrl = evolutionWebhookUrl();
  if (!config || !webhookUrl) return;
  const response = await fetchImpl(
    `${config.base}/webhook/set/${encodeURIComponent(project.instanceName)}`,
    {
      method: "POST",
      headers: { apikey: config.key, "Content-Type": "application/json" },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false,
          events: EVOLUTION_WEBHOOK_EVENTS,
        },
      }),
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!response.ok) throw new Error(`WEBHOOK_HTTP_${response.status}`);
  await prisma.project.updateMany({
    where: {
      id: project.id,
      webhookEventsVersion: { lt: target },
    },
    data: { webhookEventsVersion: target },
  });
}
