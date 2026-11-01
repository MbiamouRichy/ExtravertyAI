import { z } from "zod";
import { rolesWith } from "@/lib/project-permissions";

import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import {
  setInstancePresence,
  jidAliases,
  subscribeContactPresence,
  upgradeWebhookEvents,
} from "@/lib/contact-presence";
import { PRESENCE_MAX_CONTACTS } from "@/lib/contact-presence-shared";

export const runtime = "nodejs";

// Au plus un abonnement par contact et par minute sur cette instance.
const recent = new Map<string, number>();

/**
 * Abonne le numéro du projet à la présence des contacts affichés dans la
 * messagerie. Le statut arrive ensuite par le webhook et le temps réel.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const json = (body: object, status = 200) => Response.json(body, { status });
  const { projectId } = await params;
  const session = await getSession();
  if (!session?.user?.id) return json({ error: "Connexion requise." }, 401);
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return json({ error: "Accès refusé." }, 403);
  const body = z
    .object({
      contactIds: z.array(z.string().cuid()).max(PRESENCE_MAX_CONTACTS).default([]),
      leave: z.boolean().default(false),
    })
    .safeParse(await request.json().catch(() => null));
  if (!z.string().cuid().safeParse(projectId).success || !body.success)
    return json({ error: "Demande invalide." }, 400);
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      deletionPending: false,
      instanceStatus: "connected",
      members: {
        some: {
          userId: session.user.id,
          role: { in: rolesWith("conversations.handle") },
        },
      },
    },
    select: {
      id: true,
      instanceName: true,
      webhookEventsVersion: true,
      whatsappAlwaysOnline: true,
      contacts: {
        where: { id: { in: body.data.contactIds } },
        select: { id: true, remoteJid: true },
      },
    },
  });
  // Projet déconnecté ou inaccessible : pas de statut, sans erreur visible.
  if (!project) return json({ subscribed: false });
  // « Afficher le statut en ligne » activé : le compte reste disponible.
  const managed = !project.whatsappAlwaysOnline;
  if (body.data.leave) {
    if (managed)
      await setInstancePresence(project.instanceName, "unavailable").catch(() =>
        console.error("[presence] Retour hors ligne refusé."),
      );
    return json({ subscribed: false });
  }
  const now = Date.now();
  for (const [key, at] of recent) if (now - at > 60_000) recent.delete(key);
  const contacts = project.contacts.filter(
    (contact) => !recent.has(`${projectId}:${contact.id}`),
  );
  for (const contact of contacts) recent.set(`${projectId}:${contact.id}`, now);
  try {
    await upgradeWebhookEvents(prisma, project);
    // Toujours renouvelé : un membre a pu repasser le compte hors ligne.
    if (managed) await setInstancePresence(project.instanceName, "available");
    if (!contacts.length) return json({ subscribed: true });
    const aliases = await jidAliases(
      project.instanceName,
      contacts[0].remoteJid,
    );
    const results = await Promise.allSettled(
      contacts.flatMap((contact) => {
        const alias = aliases.get(contact.remoteJid);
        return [contact.remoteJid, ...(alias ? [alias] : [])];
      }).map((jid) => subscribeContactPresence(project.instanceName, jid)),
    );
    if (results.some((result) => result.status === "rejected"))
      throw new Error("PRESENCE_SUBSCRIBE_FAILED");
    return json({ subscribed: true });
  } catch {
    for (const contact of contacts) recent.delete(`${projectId}:${contact.id}`);
    console.error("[presence] Abonnement au contact refusé.");
    return json({ subscribed: false }, 502);
  }
}
