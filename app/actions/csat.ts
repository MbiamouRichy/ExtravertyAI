"use server";

import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { CsatMessageSchema, setCsatSettings } from "@/lib/csat";
import { PlanFeatureError } from "@/lib/plan-features";
import { SettingsError } from "@/lib/project-settings";

const CsatSettingsSchema = z.object({
  projectId: z.string().cuid(),
  enabled: z.boolean(),
  message: CsatMessageSchema,
});

export async function setCsatSettingsAction(
  input: z.input<typeof CsatSettingsSchema>,
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = CsatSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Demande invalide." };
  }
  const session = await getSession();
  if (!session?.user?.id) return { success: false, error: "Connexion requise." };
  try {
    await setCsatSettings(prisma, { ...parsed.data, userId: session.user.id });
    return { success: true };
  } catch (error) {
    if (error instanceof SettingsError || error instanceof PlanFeatureError) {
      return { success: false, error: error.message };
    }
    console.error("[csat] Échec de l’enregistrement des réglages.");
    return { success: false, error: "Impossible d’enregistrer. Réessayez." };
  }
}
