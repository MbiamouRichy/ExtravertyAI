"use server";

import { refresh } from "next/cache";
import type { z } from "zod";
import prisma from "@/lib/prisma";
import { getAdminForAction } from "@/lib/admin-auth";
import { ManualBillingError, recordManualPayment } from "@/lib/manual-billing";
import { ManualPaymentSchema } from "@/lib/manual-billing-shared";

type Result =
  | {
      success: true;
      duplicate: boolean;
      projectName: string;
      mode: "start" | "extend";
      endsAt: string;
    }
  | { success: false; error: string };

export async function recordManualPaymentAction(
  input: z.input<typeof ManualPaymentSchema>,
): Promise<Result> {
  // Accès vérifié avant toute validation : rien ne trahit l'action aux autres.
  const check = await getAdminForAction();
  if (!check.ok) return { success: false, error: "Action introuvable." };
  const parsed = ManualPaymentSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Demande invalide.",
    };
  try {
    const result = await recordManualPayment(prisma, check.admin, parsed.data);
    refresh();
    return {
      success: true,
      duplicate: result.duplicate,
      projectName: result.projectName,
      mode: result.mode,
      endsAt: result.endsAt.toISOString(),
    };
  } catch (error) {
    if (error instanceof ManualBillingError)
      return { success: false, error: error.message };
    console.error("[admin] Paiement hors carte non enregistré.", {
      projectId: parsed.data.projectId,
    });
    return {
      success: false,
      error: "Le paiement n’a pas pu être enregistré. Aucun accès n’a été ouvert : réessayez.",
    };
  }
}
