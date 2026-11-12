"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { FollowUpSettingsSchema, saveFollowUpSettings } from "@/lib/follow-ups";
import { PlanFeatureError } from "@/lib/plan-features";
import { SettingsError } from "@/lib/project-settings";

const Schema = z.object({
  projectId: z.string().cuid(),
  settings: FollowUpSettingsSchema,
});

export async function saveFollowUpSettingsAction(
  input: z.input<typeof Schema>,
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Demande invalide." };
  }
  const session = await getSession();
  if (!session?.user?.id) return { success: false, error: "Connexion requise." };
  try {
    // Droits, offre et bornes revérifiés côté serveur, sous verrou du projet.
    await saveFollowUpSettings(prisma, {
      projectId: parsed.data.projectId,
      userId: session.user.id,
      settings: parsed.data.settings,
    });
    revalidatePath(`/projects/${parsed.data.projectId}/pipeline`);
    return { success: true };
  } catch (error) {
    if (error instanceof SettingsError || error instanceof PlanFeatureError) {
      return { success: false, error: error.message };
    }
    console.error("[follow-ups] Échec de l’enregistrement des réglages.");
    return { success: false, error: "Impossible d’enregistrer. Réessayez." };
  }
}
