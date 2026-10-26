"use server";

import { refresh } from "next/cache";
import type { z } from "zod";
import prisma from "@/lib/prisma";
import { getAdminForAction } from "@/lib/admin-auth";
import {
  AdminFeedbackError,
  UpdateFeedbackSchema,
  updateFeedback,
} from "@/lib/admin-feedback";

type Result = { success: true; changed: boolean } | { success: false; error: string };

export async function updateFeedbackAction(
  input: z.input<typeof UpdateFeedbackSchema>,
): Promise<Result> {
  // Accès vérifié avant toute validation : rien ne trahit l'action aux autres.
  const check = await getAdminForAction();
  if (!check.ok) return { success: false, error: "Action introuvable." };
  const parsed = UpdateFeedbackSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Demande invalide.",
    };
  try {
    const result = await updateFeedback(prisma, check.admin, parsed.data);
    if (result.changed) refresh();
    return { success: true, changed: result.changed };
  } catch (error) {
    if (error instanceof AdminFeedbackError)
      return { success: false, error: error.message };
    console.error("[admin] Retour non mis à jour.", { id: parsed.data.id });
    return {
      success: false,
      error: "La modification n’a pas pu être enregistrée. Réessayez.",
    };
  }
}
