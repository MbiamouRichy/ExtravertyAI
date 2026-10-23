import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import {
  subscribeContactPresence,
  upgradeWebhookEvents,
} from "@/lib/contact-presence";

export const runtime = "nodejs";

// Au plus un abonnement par contact et par minute sur cette instance.
const recent = new Map<string, number>();

/**
 * Abonne le numéro du projet à la présence d’un contact, à l’ouverture de sa
 * conversation. Le statut arrive ensuite par le webhook et le temps réel.
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
    .object({ contactId: z.string().cuid() })
    .safeParse(await request.json().catch(() => null));
  if (!z.string().cuid().safeParse(projectId).success || !body.success)
    return json({ error: "Demande invalide." }, 400);
  const contact = await prisma.contact.findFirst({
    where: {
      id: body.data.contactId,
      projectId,
      project: {
        deletionPending: false,
        instanceStatus: "connected",
        members: { some: { userId: session.user.id } },
      },
    },
    select: {
      remoteJid: true,
      project: {
        select: { id: true, instanceName: true, webhookEventsVersion: true },
      },
    },
  });
  // Projet déconnecté ou contact inaccessible : pas de statut, sans erreur visible.
  if (!contact) return json({ subscribed: false });
  const now = Date.now();
  for (const [key, at] of recent) if (now - at > 60_000) recent.delete(key);
  const key = `${projectId}:${body.data.contactId}`;
  if (recent.has(key)) return json({ subscribed: true });
  recent.set(key, now);
  try {
    await upgradeWebhookEvents(prisma, contact.project);
    await subscribeContactPresence(
      contact.project.instanceName,
      contact.remoteJid,
    );
    return json({ subscribed: true });
  } catch {
    recent.delete(key);
    console.error("[presence] Abonnement au contact refusé.");
    return json({ subscribed: false }, 502);
  }
}
