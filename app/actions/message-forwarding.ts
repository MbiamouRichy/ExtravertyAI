"use server";

import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { notifyChatChanged } from "@/lib/chat-realtime";
import { MessageQuotaError } from "@/lib/message-quota";
import { allowRequest } from "@/lib/rate-limit";
import {
  FORWARD_LIMITS,
  ForwardError,
  forwardMessage,
  forwardTargets,
  type ForwardTarget,
} from "@/lib/message-forwarding";

const TargetsSchema = z.object({
  projectId: z.string().cuid(),
  excludeContactId: z.string().cuid(),
  query: z.string().trim().max(100).default(""),
});

const ForwardSchema = z.object({
  projectId: z.string().cuid(),
  messageId: z.string().cuid(),
  requestId: z.string().uuid(),
  contactIds: z.array(z.string().cuid()).min(1).max(FORWARD_LIMITS.maxTargets),
});

type Failure = { success: false; error: string };

export async function searchForwardTargetsAction(
  input: z.input<typeof TargetsSchema>,
): Promise<{ success: true; targets: ForwardTarget[] } | Failure> {
  const session = await getSession();
  if (!session?.user?.id) return { success: false, error: "Connexion requise." };
  const parsed = TargetsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Recherche invalide." };
  // Recherche au fil de la frappe : garde-fou contre les rafales.
  if (!allowRequest(`forward-targets:${session.user.id}`, 60, 60_000)) {
    return { success: false, error: "Trop de recherches. Patientez quelques secondes." };
  }
  try {
    const targets = await forwardTargets(prisma, { ...parsed.data, userId: session.user.id });
    return { success: true, targets };
  } catch (error) {
    if (error instanceof ForwardError) return { success: false, error: error.message };
    console.error("[forward] Recherche des conversations indisponible.");
    return { success: false, error: "Impossible de charger les conversations. Réessayez." };
  }
}

export async function forwardMessageAction(
  input: z.input<typeof ForwardSchema>,
): Promise<{ success: true; forwarded: number } | Failure> {
  const session = await getSession();
  if (!session?.user?.id) return { success: false, error: "Connexion requise." };
  const parsed = ForwardSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Demande invalide." };
  if (!allowRequest(`forward:${session.user.id}`, 20, 10 * 60_000)) {
    return { success: false, error: "Trop de transferts en peu de temps. Réessayez dans quelques minutes." };
  }
  try {
    // Droits, projet, quota et fenêtre de 24 h revérifiés sous verrou.
    const result = await forwardMessage(prisma, { ...parsed.data, userId: session.user.id });
    try {
      await notifyChatChanged(parsed.data.projectId);
    } catch {
      console.error("[forward] Notification indisponible.");
    }
    return { success: true, forwarded: result.forwarded };
  } catch (error) {
    if (error instanceof ForwardError || error instanceof MessageQuotaError) {
      return { success: false, error: error.message };
    }
    console.error("[forward] Résultat du transfert non confirmé.");
    // La demande est idempotente : un nouvel essai ne double aucun envoi.
    return {
      success: false,
      error: "Transfert non confirmé. Réessayez : aucun message ne sera envoyé deux fois.",
    };
  }
}
