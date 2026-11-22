"use server";

import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { notifyChatChanged } from "@/lib/chat-realtime";
import {
  ScheduledMessageError,
  cancelScheduledMessage,
  dismissScheduledMessage,
  scheduleMessage,
  updateScheduledMessage,
} from "@/lib/scheduled-messages";

// Bornes grossières ici ; le contenu et la date sont jugés par lib/scheduled-messages.
const Content = z.string().max(200_000);
const When = z.string().datetime({ offset: true });

const ScheduleSchema = z.object({
  projectId: z.string().cuid(),
  contactId: z.string().cuid(),
  requestId: z.string().uuid(),
  content: Content,
  scheduledAt: When,
});

const UpdateSchema = z.object({
  projectId: z.string().cuid(),
  scheduledMessageId: z.string().cuid(),
  version: z.number().int().min(0),
  content: Content,
  scheduledAt: When,
});

const TargetSchema = z.object({
  projectId: z.string().cuid(),
  scheduledMessageId: z.string().cuid(),
});

type Failure = { success: false; error: string };
type Saved = { success: true; id: string; scheduledAt: string; version: number };

async function currentUserId() {
  const session = await getSession();
  return session?.user?.id ?? null;
}

async function afterChange(projectId: string) {
  // Les autres membres voient le changement sans attendre l'actualisation.
  try {
    await notifyChatChanged(projectId);
  } catch {
    console.error("[scheduled-messages] Notification indisponible.");
  }
}

function failure(error: unknown, fallback: string): Failure {
  if (error instanceof ScheduledMessageError) return { success: false, error: error.message };
  console.error("[scheduled-messages] Échec de l’enregistrement.");
  return { success: false, error: fallback };
}

export async function scheduleMessageAction(input: z.input<typeof ScheduleSchema>): Promise<Saved | Failure> {
  const userId = await currentUserId();
  if (!userId) return { success: false, error: "Connexion requise." };
  const parsed = ScheduleSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Demande invalide." };
  try {
    // Droits, projet, offre, date et limites revérifiés sous verrou.
    const item = await scheduleMessage(prisma, {
      ...parsed.data,
      userId,
      scheduledAt: new Date(parsed.data.scheduledAt),
    });
    await afterChange(parsed.data.projectId);
    return { success: true, id: item.id, scheduledAt: item.scheduledAt.toISOString(), version: item.version };
  } catch (error) {
    // La demande est idempotente : un nouvel essai ne programme pas deux fois.
    return failure(error, "Programmation non confirmée. Réessayez : le message ne sera pas programmé deux fois.");
  }
}

export async function updateScheduledMessageAction(
  input: z.input<typeof UpdateSchema>,
): Promise<Saved | Failure> {
  const userId = await currentUserId();
  if (!userId) return { success: false, error: "Connexion requise." };
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Demande invalide." };
  try {
    const item = await updateScheduledMessage(prisma, {
      ...parsed.data,
      userId,
      scheduledAt: new Date(parsed.data.scheduledAt),
    });
    await afterChange(parsed.data.projectId);
    return { success: true, id: item.id, scheduledAt: item.scheduledAt.toISOString(), version: item.version };
  } catch (error) {
    return failure(error, "Impossible d’enregistrer la modification. Réessayez.");
  }
}

export async function cancelScheduledMessageAction(
  input: z.input<typeof TargetSchema>,
): Promise<{ success: true } | Failure> {
  const userId = await currentUserId();
  if (!userId) return { success: false, error: "Connexion requise." };
  const parsed = TargetSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Demande invalide." };
  try {
    await cancelScheduledMessage(prisma, { ...parsed.data, userId });
    await afterChange(parsed.data.projectId);
    return { success: true };
  } catch (error) {
    return failure(error, "Impossible d’annuler. Réessayez.");
  }
}

export async function dismissScheduledMessageAction(
  input: z.input<typeof TargetSchema>,
): Promise<{ success: true } | Failure> {
  const userId = await currentUserId();
  if (!userId) return { success: false, error: "Connexion requise." };
  const parsed = TargetSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Demande invalide." };
  try {
    await dismissScheduledMessage(prisma, { ...parsed.data, userId });
    await afterChange(parsed.data.projectId);
    return { success: true };
  } catch (error) {
    return failure(error, "Impossible de retirer ce message. Réessayez.");
  }
}
