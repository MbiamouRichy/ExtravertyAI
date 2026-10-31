"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getSession } from "@/lib/auth-server";
import { isRecentSession } from "@/lib/recent-session";

const newPasswordSchema = z.string().min(8).max(256);

/** Premier mot de passe d’un compte créé via Google ou TikTok. */
export async function setAccountPasswordAction(
  rawPassword: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = newPasswordSchema.safeParse(rawPassword);
  if (!parsed.success)
    return { success: false, error: "Mot de passe invalide (8 à 256 caractères)." };

  const session = await getSession();
  if (!session?.user?.id)
    return { success: false, error: "Votre session a expiré. Reconnectez-vous." };
  if (!isRecentSession(session.session.createdAt))
    return {
      success: false,
      error: "Reconnectez-vous avant de définir un mot de passe.",
    };

  try {
    await auth.api.setPassword({
      body: { newPassword: parsed.data },
      headers: await headers(),
    });
    return { success: true };
  } catch (error) {
    if (error instanceof APIError && error.body?.code === "PASSWORD_ALREADY_SET")
      return { success: false, error: "Ce compte a déjà un mot de passe." };
    return {
      success: false,
      error: "Impossible de définir le mot de passe. Réessayez.",
    };
  }
}
