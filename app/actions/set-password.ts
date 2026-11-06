"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { isRecentSession } from "@/lib/recent-session";
import { accountPasswordSchema } from "@/lib/sign-up";

const inputSchema = z.object({
  newPassword: z.string().min(8).max(128),
  revokeOtherSessions: z.boolean(),
});

/**
 * Définit ou remplace le mot de passe. La connexion récente tient lieu de
 * confirmation : un compte Google ou TikTok n’a pas de mot de passe à saisir.
 */
export async function setAccountPasswordAction(
  input: z.infer<typeof inputSchema>,
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: "Mot de passe invalide (8 à 128 caractères)." };

  const session = await getSession();
  if (!session?.user?.id)
    return { success: false, error: "Votre session a expiré. Reconnectez-vous." };
  if (!isRecentSession(session.session.createdAt))
    return {
      success: false,
      error: "Reconnectez-vous avant de modifier votre mot de passe.",
    };

  const { newPassword, revokeOtherSessions } = parsed.data;
  try {
    const context = await auth.$context;
    const account = await context.internalAdapter.findCredentialAccount(session.user.id);
    if (account?.password) {
      await context.internalAdapter.updatePassword(
        session.user.id,
        await context.password.hash(newPassword),
      );
      if (revokeOtherSessions)
        await prisma.session.deleteMany({
          where: { userId: session.user.id, id: { not: session.session.id } },
        });
    } else {
      await auth.api.setPassword({
        body: { newPassword },
        headers: await headers(),
      });
    }
    return { success: true };
  } catch (error) {
    if (!(error instanceof APIError)) console.error("[set-password] Échec.");
    return {
      success: false,
      error: "Impossible d’enregistrer le mot de passe. Réessayez.",
    };
  }
}

const signUpPasswordSchema = z.object({ newPassword: accountPasswordSchema });

export type SignUpPasswordResult =
  | { success: true }
  | { success: false; alreadySet?: true; error: string };

/**
 * Optional password chosen at sign-up, right after the code opened the
 * session. Only ever added: an existing password is never replaced here, even
 * when the address turned out to have an account already.
 */
export async function addSignUpPasswordAction(
  input: unknown,
): Promise<SignUpPasswordResult> {
  const parsed = signUpPasswordSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: "Mot de passe invalide (8 à 128 caractères)." };

  const session = await getSession();
  if (!session?.user?.id || !isRecentSession(session.session.createdAt))
    return {
      success: false,
      error: "Votre session a expiré. Définissez votre mot de passe depuis votre profil.",
    };

  try {
    const context = await auth.$context;
    const account = await context.internalAdapter.findCredentialAccount(session.user.id);
    if (account?.password)
      return {
        success: false,
        alreadySet: true,
        error: "Ce compte avait déjà un mot de passe : il n’a pas été modifié.",
      };
    await auth.api.setPassword({
      body: { newPassword: parsed.data.newPassword },
      headers: await headers(),
    });
    return { success: true };
  } catch (error) {
    if (!(error instanceof APIError)) console.error("[sign-up-password] Échec.");
    return {
      success: false,
      error: "Le mot de passe n’a pas pu être enregistré. Définissez-le depuis votre profil.",
    };
  }
}
