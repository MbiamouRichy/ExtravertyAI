"use server";

import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { notifyChatChanged } from "@/lib/chat-realtime";
import { CaptureEditError, saveProspectCaptureEdits } from "@/lib/prospect-capture";
import {
  CAPTURE_FIELD_KEYS,
  CaptureEditSchema,
  type ProspectCaptureView,
} from "@/lib/prospect-capture-shared";

// Ce que le membre voyait avant de modifier : sert seulement à savoir quels
// champs il a changés, jamais à autoriser quoi que ce soit.
const BaseSchema = z.object(
  Object.fromEntries(CAPTURE_FIELD_KEYS.map((key) => [key, z.string().max(400)])) as Record<
    (typeof CAPTURE_FIELD_KEYS)[number],
    z.ZodString
  >,
);

const InputSchema = z.object({
  projectId: z.string().cuid(),
  contactId: z.string().cuid(),
  values: CaptureEditSchema,
  base: BaseSchema,
});

type Result =
  | { success: true; capture: ProspectCaptureView }
  | { success: false; error: string };

/**
 * Corrige les informations relevées par Capture IA. Réservé aux membres qui
 * traitent les conversations du projet ; l’offre, le rôle et l’appartenance du
 * contact au projet sont revérifiés en base, dans la transaction d’écriture.
 */
export async function saveProspectCaptureAction(input: unknown): Promise<Result> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Vérifiez les informations saisies." };
  const session = await getSession();
  if (!session?.user?.id) return { success: false, error: "Connexion requise." };
  try {
    const result = await saveProspectCaptureEdits(prisma, {
      ...parsed.data,
      userId: session.user.id,
    });
    if (result.changed) await notifyChatChanged(parsed.data.projectId);
    return { success: true, capture: result.capture };
  } catch (error) {
    if (error instanceof CaptureEditError) return { success: false, error: error.message };
    // Aucune valeur saisie dans les journaux.
    console.error("[prospect-capture] Échec de l’enregistrement d’une correction.");
    return { success: false, error: "Impossible d’enregistrer. Réessayez." };
  }
}
