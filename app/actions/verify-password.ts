"use server";

import { auth } from "@/lib/auth";
import { getSession } from "@/lib/auth-server";
import { passwordVerificationSchema } from "@/lib/password-verification-schema";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";

type ActionResponse = { success: boolean; error?: string };

export async function VerifyPasswordAction(rawPassword: string): Promise<ActionResponse> {
  const parsed = passwordVerificationSchema.safeParse({ password: rawPassword });
  if (!parsed.success) return { success: false, error: "Format de mot de passe invalide." };

  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, error: "Votre session a expiré. Reconnectez-vous." };

    const result = await auth.api.verifyPassword({
      body: parsed.data,
      headers: await headers(),
    });
    return result.status
      ? { success: true }
      : { success: false, error: "Mot de passe incorrect." };
  } catch (error) {
    if (error instanceof APIError) {
      if (error.body?.code === "INVALID_PASSWORD") {
        return { success: false, error: "Mot de passe incorrect." };
      }
      if (error.status === "UNAUTHORIZED") {
        return { success: false, error: "Votre session a expiré. Reconnectez-vous." };
      }
    }
    return { success: false, error: "Impossible de vérifier le mot de passe. Réessayez." };
  }
}
