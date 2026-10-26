"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { notifyChatChanged } from "@/lib/chat-realtime";
import { SettingsError } from "@/lib/project-settings";
import { setWaitingTimeIndicator } from "@/lib/waiting-indicator";

const Schema = z.object({
  projectId: z.string().cuid(),
  enabled: z.boolean(),
});

export async function setWaitingTimeIndicatorAction(
  input: z.input<typeof Schema>,
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Demande invalide." };
  const session = await getSession();
  if (!session?.user?.id) return { success: false, error: "Connexion requise." };
  try {
    await setWaitingTimeIndicator(prisma, {
      ...parsed.data,
      userId: session.user.id,
    });
    revalidatePath(`/projects/${parsed.data.projectId}/settings`);
    // La messagerie ouverte se met à jour sans rechargement.
    await notifyChatChanged(parsed.data.projectId);
    return { success: true };
  } catch (error) {
    if (error instanceof SettingsError) {
      return { success: false, error: error.message };
    }
    console.error("[settings] Échec du réglage de l’indicateur d’attente.");
    return { success: false, error: "Impossible d’enregistrer. Réessayez." };
  }
}
