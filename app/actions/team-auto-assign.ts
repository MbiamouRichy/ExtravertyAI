"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { SettingsError } from "@/lib/project-settings";
import { setTeamAutoAssign } from "@/lib/team-auto-assign";

const Schema = z.object({
  projectId: z.string().cuid(),
  enabled: z.boolean(),
});

export async function setTeamAutoAssignAction(
  input: z.input<typeof Schema>,
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Demande invalide." };
  const session = await getSession();
  if (!session?.user?.id) return { success: false, error: "Connexion requise." };
  try {
    await setTeamAutoAssign(prisma, { ...parsed.data, userId: session.user.id });
    revalidatePath(`/projects/${parsed.data.projectId}/settings`);
    return { success: true };
  } catch (error) {
    if (error instanceof SettingsError) {
      return { success: false, error: error.message };
    }
    console.error("[settings] Échec du réglage de la répartition automatique.");
    return { success: false, error: "Impossible d’enregistrer. Réessayez." };
  }
}
