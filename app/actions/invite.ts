"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server"; // Ton helper Better Auth

// 1. Accepter l'invitation (Une fois le compte créé ou si l'utilisateur est déjà logué)
export async function consumeInvitation(token: string) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return { success: false, error: "Vous devez être authentifié." };
    }

    // Récupérer l'invitation
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { project: true },
    });

    if (!invitation) {
      return {
        success: false,
        error: "Invitation introuvable ou déjà utilisée.",
      };
    }

    if (invitation.expiresAt < new Date()) {
      return { success: false, error: "Cette invitation a expiré." };
    }

    // SÉCURITÉ : Vérifier que l'email de session correspond à l'email invité
    if (session.user.email !== invitation.email) {
      return {
        success: false,
        error: "L'email de votre compte ne correspond pas à l'invitation.",
      };
    }

    // TRANSACTION : Ajouter au projet ET supprimer l'invitation
    await prisma.$transaction(async (tx) => {
      // 1. Ajouter le membre
      await tx.projectMembership.upsert({
        where: {
          userId_projectId: {
            userId: session.user.id,
            projectId: invitation.projectId,
          },
        },
        update: {
          role: invitation.role, // Met à jour le rôle s'il y était déjà
        },
        create: {
          userId: session.user.id,
          projectId: invitation.projectId,
          role: invitation.role,
        },
      });

      // 2. Supprimer l'invitation
      await tx.invitation.delete({
        where: { id: invitation.id },
      });
    });

    return {
      success: true,
      projectId: invitation.projectId,
      message: `Bienvenue dans le projet ${invitation.project.name} !`,
    };
  } catch (error) {
    console.error("Erreur consumeInvitation:", error);
    return {
      success: false,
      error: "Erreur lors de l'acceptation de l'invitation.",
    };
  }
}
