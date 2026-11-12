"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { SettingsError } from "@/lib/project-settings";
import { setProjectTimeZone } from "@/lib/project-time-zone";

const Schema = z.object({
  projectId: z.string().cuid(),
  timeZone: z.string().trim().min(1).max(100),
});

export async function setProjectTimeZoneAction(
  input: z.input<typeof Schema>,
): Promise<{ success: true; timeZone: string } | { success: false; error: string }> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Demande invalide." };
  const session = await getSession();
  if (!session?.user?.id) return { success: false, error: "Connexion requise." };
  try {
    const timeZone = await setProjectTimeZone(prisma, {
      ...parsed.data,
      userId: session.user.id,
    });
    revalidatePath(`/projects/${parsed.data.projectId}/settings`);
    revalidatePath(`/projects/${parsed.data.projectId}/broadcasts`);
    return { success: true, timeZone };
  } catch (error) {
    if (error instanceof SettingsError) {
      return { success: false, error: error.message };
    }
    console.error("[settings] Échec du changement de fuseau horaire.");
    return { success: false, error: "Impossible d’enregistrer. Réessayez." };
  }
}
