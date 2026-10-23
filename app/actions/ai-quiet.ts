"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { notifyChatChanged } from "@/lib/chat-realtime";
import { AiQuietError, setAiQuietMode, wakeAssistant } from "@/lib/ai-quiet";
import { SettingsError } from "@/lib/project-settings";

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

const WakeSchema = z.object({
  projectId: z.string().cuid(),
  contactId: z.string().cuid(),
});

const ModeSchema = z.object({
  projectId: z.string().cuid(),
  enabled: z.boolean(),
});

/** Sort une conversation de veille : l’IA répondra au prochain message du client. */
export async function wakeAssistantAction(
  input: z.input<typeof WakeSchema>,
): Promise<Result<{ woken: boolean }>> {
  const parsed = WakeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Demande invalide." };
  const session = await getSession();
  if (!session?.user?.id) return { success: false, error: "Connexion requise." };
  try {
    const result = await wakeAssistant(prisma, { ...parsed.data, userId: session.user.id });
    await notifyChatChanged(parsed.data.projectId);
    return { success: true, ...result };
  } catch (error) {
    if (error instanceof AiQuietError) return { success: false, error: error.message };
    console.error("[ai-quiet] Échec du réveil de l’assistant.");
    return { success: false, error: "Impossible de réveiller l’assistant. Réessayez." };
  }
}

/** Active ou désactive la mise en veille automatique (propriétaires et administrateurs). */
export async function setAiQuietModeAction(
  input: z.input<typeof ModeSchema>,
): Promise<Result> {
  const parsed = ModeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Demande invalide." };
  const session = await getSession();
  if (!session?.user?.id) return { success: false, error: "Connexion requise." };
  try {
    await setAiQuietMode(prisma, { ...parsed.data, userId: session.user.id });
    revalidatePath(`/projects/${parsed.data.projectId}/settings`);
    revalidatePath(`/projects/${parsed.data.projectId}/knowledge`);
    // Les badges « IA en veille » de la messagerie ouverte se mettent à jour.
    await notifyChatChanged(parsed.data.projectId);
    return { success: true };
  } catch (error) {
    if (error instanceof SettingsError) return { success: false, error: error.message };
    console.error("[ai-quiet] Échec du réglage de la mise en veille.");
    return { success: false, error: "Impossible d’enregistrer. Réessayez." };
  }
}
