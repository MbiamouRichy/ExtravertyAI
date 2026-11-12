"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server"; // Ton helper Better Auth
import {
  acceptInvitation,
  declineInvitation,
  type InvitationFailure,
} from "@/lib/project-invitations";

const failures: Record<InvitationFailure, string> = {
  NOT_FOUND: "Invitation introuvable ou déjà utilisée.",
  EXPIRED: "Cette invitation a expiré.",
  WRONG_ACCOUNT: "L'email de votre compte ne correspond pas à l'invitation.",
  REVOKED: "Cette invitation n'est plus valable. Demandez-en une nouvelle.",
  TEAM_FULL:
    "L’équipe de ce projet est complète pour son offre. Votre invitation reste valable : réessayez quand une place se libère.",
};

// Appelée par un clic explicite de l'invité, jamais à l'ouverture du lien.
export async function consumeInvitation(token: string) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return { success: false as const, error: "Vous devez être authentifié." };
    }
    const result = await acceptInvitation(prisma, session.user, token);
    if (!result.ok)
      return { success: false as const, error: failures[result.reason] };
    return {
      success: true as const,
      projectId: result.projectId,
      message: `Bienvenue dans le projet ${result.projectName} !`,
    };
  } catch (error) {
    console.error("Erreur consumeInvitation:", error);
    return {
      success: false as const,
      error: "Erreur lors de l'acceptation de l'invitation.",
    };
  }
}

export async function refuseInvitation(token: string) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return { success: false, error: "Vous devez être authentifié." };
    }
    const declined = await declineInvitation(prisma, session.user, token);
    return declined
      ? { success: true }
      : { success: false, error: failures.NOT_FOUND };
  } catch (error) {
    console.error("Erreur refuseInvitation:", error);
    return { success: false, error: "Impossible de refuser l'invitation." };
  }
}
