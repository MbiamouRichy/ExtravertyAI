"use server";

import { auth } from "@/lib/auth";
import { getSession } from "@/lib/auth-server";
import { headers } from "next/headers";
import { z } from "zod";

// 1. Définition stricte des types de retour
type ActionResponse = {
  success: boolean;
  error?: string;
};

// 2. Schéma de validation Zod pour l'entrée
const passwordSchema = z.object({
  password: z
    .string("Le mot de passe est requis.")
    .min(1, "Le mot de passe ne peut pas être vide.")
    .max(255, "Le mot de passe est trop long."), // Prévention contre les attaques par déni de service (DoS) sur le hachage
});

export async function VerifyPasswordAction(
  rawPassword: string,
): Promise<ActionResponse> {
  try {
    // 3. Validation et assainissement des entrées (Ne jamais faire confiance au client)
    const parsedInput = passwordSchema.safeParse({ password: rawPassword });

    if (!parsedInput.success) {
      // On ne logge jamais le mot de passe, même en cas d'erreur de validation
      return { success: false, error: "Format de mot de passe invalide." };
    }

    const { password } = parsedInput.data;

    // 4. Vérification de la session (Authentification)
    const session = await getSession();
    if (!session?.user?.id) {
      // Message d'erreur générique : on ne donne pas d'indices sur la raison exacte
      return { success: false, error: "Action non autorisée." };
    }

    // [OPTIONNEL] Insérer ici un mécanisme de Rate Limiting (ex: Upstash/Redis)
    // await rateLimitServerAction(session.user.id);

    // 5. Appel à l'API d'authentification avec transfert du contexte
    await auth.api.verifyPassword({
      body: {
        password: password,
      },
      // Important dans Next.js : passer les headers pour que la lib d'auth lise les cookies/IP
      headers: await headers(),
    });

    return { success: true };
  } catch (error) {
    // 7. Gestion sécurisée des erreurs (Prévention des fuites d'informations)

    // Log côté serveur uniquement pour le debugging (avec un outil comme Sentry ou Datadog)
    console.error(
      "[VerifyPasswordAction] Erreur interne :",
      error instanceof Error ? error.message : error,
    );

    // Si c'est une erreur connue de votre librairie d'auth (ex: Better Auth / Lucia)
    // Adaptez 'APIError' selon la librairie que vous utilisez
    if (error instanceof Error && error.message.includes("INVALID_PASSWORD")) {
      return { success: false, error: "Mot de passe incorrect." }; // Message métier autorisé
    }

    // Fallback : Message générique et opaque pour le client.
    // On ne renvoie JAMAIS l'erreur brute (qui pourrait contenir des requêtes SQL ou des chemins de fichiers).
    return {
      success: false,
      error: "Une erreur est survenue lors de la vérification.",
    };
  }
}
