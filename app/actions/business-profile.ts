"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { notifyChatChanged } from "@/lib/chat-realtime";
import { writeBusinessProfile } from "@/lib/business-profile-store";
import { KnowledgeError } from "@/lib/knowledge";
import { SettingsError } from "@/lib/project-settings";
import { generateProjectSystemMessage } from "@/lib/system-message-generator";

const Id = z.string().cuid("Projet introuvable.");

type Failure = { success: false; error: string };

/** Messages sûrs pour l’utilisateur ; le reste reste côté serveur. */
function publicError(error: unknown, fallback: string) {
  if (error instanceof SettingsError || error instanceof KnowledgeError) return error.message;
  return fallback;
}

/**
 * Fiche de l’entreprise (propriétaire et administrateurs). Le site web et les
 * réseaux sociaux rejoignent l’entrée « Informations » de la base de
 * connaissances ; la page est réaffichée dans la même réponse.
 */
export async function saveBusinessProfile(
  input: unknown,
): Promise<
  { success: true; renamed: boolean; agentVersion: number; linksChanged: boolean } | Failure
> {
  try {
    const parsed = z.object({ projectId: Id, profile: z.unknown() }).parse(input);
    const session = await getSession();
    if (!session?.user?.id) throw new SettingsError("Connexion requise.");
    const result = await writeBusinessProfile(prisma, {
      projectId: parsed.projectId,
      userId: session.user.id,
      profile: parsed.profile,
    });
    revalidatePath(`/projects/${parsed.projectId}`, "layout");
    revalidatePath("/projects");
    await notifyChatChanged(parsed.projectId);
    return { success: true, ...result };
  } catch (error) {
    // Messages des schémas : rédigés pour l’utilisateur (lib/business-profile.ts).
    if (error instanceof z.ZodError)
      return { success: false, error: error.issues[0]?.message || "Vérifiez les informations saisies." };
    if (!(error instanceof SettingsError || error instanceof KnowledgeError))
      console.error("[business-profile] Échec de l’enregistrement de la fiche.");
    return {
      success: false,
      error: publicError(error, "La fiche n’a pas été enregistrée. Réessayez."),
    };
  }
}

/**
 * Rédige les instructions de l’agent à partir de la fiche enregistrée
 * (`generateProjectSystemMessage` : droits, fiche complète, abonnement ou
 * essai, quotas réservés avant l’appel au modèle).
 */
export async function generateSystemMessageFromProfile(
  input: unknown,
): Promise<{ success: true; systemMessage: string } | Failure> {
  try {
    const parsed = z.object({ projectId: Id }).strict().safeParse(input);
    if (!parsed.success) throw new SettingsError("Demande invalide.");
    const session = await getSession({ fresh: true });
    if (!session?.user?.id) throw new SettingsError("Reconnectez-vous pour utiliser l’IA.");
    if (!process.env.OPENROUTER_API_KEY || !process.env.OPENROUTER_MODEL)
      throw new SettingsError("L’assistance IA n’est pas configurée.");
    const systemMessage = await generateProjectSystemMessage(prisma, {
      projectId: parsed.data.projectId,
      userId: session.user.id,
    });
    return { success: true, systemMessage };
  } catch (error) {
    // Jamais le détail : la réponse du modèle ou de la base n’atteint pas le navigateur.
    if (!(error instanceof SettingsError))
      console.error("[business-profile] Échec de la génération des instructions.", {
        // Codes internes seulement : un message d’analyse peut citer la réponse du modèle.
        code:
          error instanceof Error && /^[A-Z0-9_]{3,60}$/.test(error.message)
            ? error.message
            : error instanceof Error
              ? error.name
              : "UNKNOWN",
      });
    return {
      success: false,
      error: publicError(
        error,
        "L’IA n’a pas pu rédiger les instructions. Votre texte est conservé. Réessayez plus tard.",
      ),
    };
  }
}
